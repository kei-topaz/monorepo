package com.project.data.sql

import com.project.domain.util.ConfigLoader
import com.project.data.sql.client.DbContext
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
import javax.sql.DataSource

data class SqlConfig(
    val driverClassName: String = "org.postgresql.Driver",
    val masterUrl: String,
    val masterUser: String,
    val masterPass: String,
    val replicaUrl: String? = null,
    val replicaUser: String? = null,
    val replicaPass: String? = null
)

@Module
@ComponentScan("com.project.data.sql")
class SqlModule {

    @Single
    fun provideSqlConfig(): SqlConfig {
        return SqlConfig(
            masterUrl = ConfigLoader.get("DB_MASTER_URL") ?: "jdbc:postgresql://localhost:5432/app_db",
            masterUser = ConfigLoader.get("DB_MASTER_USER") ?: "user",
            masterPass = ConfigLoader.get("DB_MASTER_PASSWORD") ?: "password",
            replicaUrl = ConfigLoader.get("DB_REPLICA_URL"),
            replicaUser = ConfigLoader.get("DB_REPLICA_USER"),
            replicaPass = ConfigLoader.get("DB_REPLICA_PASSWORD")
        )
    }

    @Single
    @Named("master")
    fun provideMasterDataSource(config: SqlConfig): DataSource {
        return HikariDataSource(HikariConfig().apply {
            jdbcUrl = config.masterUrl
            username = config.masterUser
            password = config.masterPass
            driverClassName = config.driverClassName
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
            maximumPoolSize = 10
            poolName = "HikariPool-Master"
        })
    }

    @Single
    @Named("replica")
    fun provideReplicaDataSource(config: SqlConfig): DataSource {
        return HikariDataSource(HikariConfig().apply {
            jdbcUrl = config.replicaUrl ?: config.masterUrl
            username = config.replicaUser ?: config.masterUser
            password = config.replicaPass ?: config.masterPass
            driverClassName = config.driverClassName
            isAutoCommit = true
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
            maximumPoolSize = 10
            poolName = "HikariPool-Replica"
        })
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
