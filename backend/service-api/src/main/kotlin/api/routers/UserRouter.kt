package api.routers

import api.routers.core.*

import api.handlers.user.RegisterRequest
import api.handlers.user.RegisterResponse
import api.handlers.user.RegisterUserHandler
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
