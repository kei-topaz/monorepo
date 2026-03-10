package datarepository.redis.repos

import datarepository.redis.client.RedisClient
import org.koin.core.annotation.Single

@Single
class SessionRepository(
    private val redis: RedisClient
) {

    suspend fun save(userId: String, token: String) {
        redis.master { jedis ->
            jedis.setex("session:$token", 3600, userId)
        }
    }

    suspend fun getUserId(token: String): String? {
        return redis.replica { jedis ->
            jedis.get("session:$token")
        }
    }
}
