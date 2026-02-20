package com.project.data.redis.client

import redis.clients.jedis.JedisPool

/**
 * A simplified Redis Orchestrator that manages connection pools for Master and Replica.
 */
class RedisClient(
    private val masterPool: JedisPool,
    private val replicaPool: JedisPool,
) {
    /**
     * Executes an operation on the Master Redis instance.
     * Use this for Writes or Consistent Reads (Real-time data).
     */
    suspend fun <T> master(block: (redis.clients.jedis.Jedis) -> T): T {
        return execute(masterPool, block)
    }

    /**
     * Executes an operation on the Replica Redis instance.
     * Use this for Eventual Consistent Reads.
     */
    suspend fun <T> replica(block: (redis.clients.jedis.Jedis) -> T): T {
        return execute(replicaPool, block)
    }

    private suspend fun <T> execute(
        pool: JedisPool,
        block: (redis.clients.jedis.Jedis) -> T,
    ): T {
        return pool.resource.use { jedis ->
            block(jedis)
        }
    }
}
