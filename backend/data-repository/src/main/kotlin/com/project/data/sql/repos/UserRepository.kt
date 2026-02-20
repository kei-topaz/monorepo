package com.project.data.sql.repos

import com.project.data.sql.client.TxContext
import com.project.domain.core.Email
import com.project.domain.core.UserId
import org.koin.core.annotation.Single
import java.util.UUID

@Single
class UserRepository {
    context(ctx: TxContext)
    fun save(email: Email): UserId {
        // ctx is TxContext, so we can access properties directly
        // ctx.dsl.insertInto(...)
        return UserId(UUID.randomUUID().toString())
    }

    context(ctx: TxContext)
    fun exists(email: Email): Boolean {
        // ctx.dsl.fetchExists(...)
        return false 
    }
}
