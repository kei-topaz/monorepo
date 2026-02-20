package com.project.api.routers

import com.project.api.routers.core.*

import com.project.api.handlers.user.RegisterRequest
import com.project.api.handlers.user.RegisterResponse
import com.project.api.handlers.user.RegisterUserHandler
import io.ktor.server.routing.*
import org.koin.core.annotation.Single

@Single(binds = [Router::class])
class UserRouter(
    private val registerHandler: RegisterUserHandler
) : Router {
    override fun setup(route: Route) {
        with(route) {
            postAction<RegisterRequest, RegisterResponse>("/api/v1/users") { req ->
                registerHandler.handle(req)
            }
        }
    }
}
