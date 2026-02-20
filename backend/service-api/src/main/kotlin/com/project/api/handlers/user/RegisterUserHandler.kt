package com.project.api.handlers.user

import com.project.data.sql.client.*
import com.project.domain.core.*
import com.project.data.sql.repos.UserRepository
import org.koin.core.annotation.Single

@kotlinx.serialization.Serializable
data class RegisterRequest(val email: Email)

@kotlinx.serialization.Serializable
data class RegisterResponse(val id: UserId)

 
@Single
class RegisterUserHandler(
    private val db: DbContext,
    private val userRepo: UserRepository
) {
    suspend fun handle(req: RegisterRequest, current: TxContext? = null): RegisterResponse {
        return db.transaction(current) {
            if (userRepo.exists(req.email)) {
                throw AppException.Conflict("Email already exists")
            }
            val userId = userRepo.save(req.email)
            RegisterResponse(userId)
        }
    }

    context(ctx: TxContext)
    private fun validate(email: Email) {
        // Internal logic using context sugar
    }
}