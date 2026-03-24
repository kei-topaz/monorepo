package datarepository.sql

import domaincore.util.ConfigLoader
import datarepository.sql.client.DbContext
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.opentelemetry.api.OpenTelemetry
import io.opentelemetry.instrumentation.jdbc.datasource.JdbcTelemetry
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import org.koin.core.annotation.Named
import org.koin.core.annotation.Single
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.rds.RdsUtilities
import java.net.URI
import javax.sql.DataSource

data class SqlConfig(
    val driverClassName: String = "org.postgresql.Driver",
    val masterUrl: String,
    val masterUser: String,
    val masterPass: String?,
    val replicaUrl: String? = null,
    val replicaUser: String? = null,
    val replicaPass: String? = null,
    val useIamAuth: Boolean = false
)

@Module
@ComponentScan("datarepository.sql")
class SqlModule {

    @Single
    fun provideSqlConfig(): SqlConfig {
        val appEnv = ConfigLoader.get("APP_ENV") ?: "development"
        val isCloudEnv = appEnv == "production" || appEnv == "staging"

        return SqlConfig(
            masterUrl = ConfigLoader.get("DB_MASTER_URL") ?: "jdbc:postgresql://localhost:5432/app_db",
            masterUser = ConfigLoader.get("DB_MASTER_USER") ?: "user",
            masterPass = if (isCloudEnv) null else (ConfigLoader.get("DB_MASTER_PASSWORD") ?: "password"),
            replicaUrl = ConfigLoader.get("DB_REPLICA_URL"),
            replicaUser = ConfigLoader.get("DB_REPLICA_USER"),
            replicaPass = if (isCloudEnv) null else ConfigLoader.get("DB_REPLICA_PASSWORD"),
            useIamAuth = isCloudEnv
        )
    }

    private fun generateIamAuthToken(jdbcUrl: String, username: String): String {
        val uri = URI(jdbcUrl.removePrefix("jdbc:"))
        val host = uri.host
        val port = if (uri.port > 0) uri.port else 5432
        val region = ConfigLoader.get("AWS_REGION") ?: "ap-northeast-2"

        return RdsUtilities.builder()
            .region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build()
            .generateAuthenticationToken { builder ->
                builder.hostname(host).port(port).username(username)
            }
    }

    private fun createDataSource(
        jdbcUrl: String,
        username: String,
        password: String?,
        config: SqlConfig,
        autoCommit: Boolean,
        poolName: String
    ): DataSource {
        return HikariDataSource(HikariConfig().apply {
            this.jdbcUrl = jdbcUrl
            this.username = username
            this.driverClassName = config.driverClassName
            this.isAutoCommit = autoCommit
            this.transactionIsolation = "TRANSACTION_READ_COMMITTED"
            this.maximumPoolSize = 10
            this.poolName = poolName

            if (config.useIamAuth) {
                this.password = generateIamAuthToken(jdbcUrl, username)
                // IAM tokens expire after 15 minutes. Retire connections before that
                // so HikariCP creates fresh ones with new tokens.
                this.maxLifetime = 600_000 // 10 minutes
            } else {
                this.password = password
            }
        })
    }

    @Single
    @Named("master")
    fun provideMasterDataSource(config: SqlConfig): DataSource {
        return createDataSource(
            jdbcUrl = config.masterUrl,
            username = config.masterUser,
            password = config.masterPass,
            config = config,
            autoCommit = false,
            poolName = "HikariPool-Master"
        )
    }

    @Single
    @Named("replica")
    fun provideReplicaDataSource(config: SqlConfig): DataSource {
        return createDataSource(
            jdbcUrl = config.replicaUrl ?: config.masterUrl,
            username = config.replicaUser ?: config.masterUser,
            password = config.replicaPass ?: config.masterPass,
            config = config,
            autoCommit = true,
            poolName = "HikariPool-Replica"
        )
    }

    @Single
    fun provideDbContext(
        @Named("master") masterDs: DataSource,
        @Named("replica") replicaDs: DataSource,
        openTelemetry: OpenTelemetry
    ): DbContext {
        val otelMasterDs = JdbcTelemetry.create(openTelemetry).wrap(masterDs)
        val otelReplicaDs = JdbcTelemetry.create(openTelemetry).wrap(replicaDs)

        val masterDsl = DSL.using(otelMasterDs, SQLDialect.POSTGRES)
        val replicaDsl = DSL.using(otelReplicaDs, SQLDialect.POSTGRES)

        return DbContext(master = masterDsl, replica = replicaDsl)
    }
}
