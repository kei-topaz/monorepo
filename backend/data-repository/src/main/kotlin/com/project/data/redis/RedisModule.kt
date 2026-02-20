package com.project.data.redis

import com.project.domain.util.ConfigLoader
import com.project.data.redis.client.RedisClient
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import org.koin.core.annotation.Named
import org.koin.core.annotation.Single
import redis.clients.jedis.JedisPool

data class RedisConfig(
    val masterHost: String = "localhost",
    val masterPort: Int = 6379,
    val replicaHost: String? = null,
    val replicaPort: Int? = null
)

@Module
@ComponentScan("com.project.data.redis")
class RedisModule {

    @Single
    fun provideRedisConfig(): RedisConfig {
        return RedisConfig(
            masterHost = ConfigLoader.get("REDIS_MASTER_HOST") ?: "localhost",
            masterPort = (ConfigLoader.get("REDIS_MASTER_PORT") ?: "6379").toInt(),
            replicaHost = ConfigLoader.get("REDIS_REPLICA_HOST"),
            replicaPort = ConfigLoader.get("REDIS_REPLICA_PORT")?.toInt()
        )
    }

    @Single
    @Named("redisMaster")
    fun provideRedisMasterPool(config: RedisConfig): JedisPool {
        return JedisPool(config.masterHost, config.masterPort)
    }

    @Single
    @Named("redisReplica")
    fun provideRedisReplicaPool(config: RedisConfig): JedisPool {
        val host = config.replicaHost ?: config.masterHost
        val port = config.replicaPort ?: config.masterPort
        return JedisPool(host, port)
    }

    @Single
    fun provideRedisClient(
        @Named("redisMaster") masterPool: JedisPool,
        @Named("redisReplica") replicaPool: JedisPool
    ): RedisClient {
        return RedisClient(masterPool = masterPool, replicaPool = replicaPool)
    }
}
