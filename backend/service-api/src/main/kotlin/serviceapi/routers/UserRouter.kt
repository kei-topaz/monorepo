package serviceapi.routers

import serviceapi.routers.core.*

import serviceapi.handlers.user.RegisterRequest
import serviceapi.handlers.user.RegisterResponse
import serviceapi.handlers.user.RegisterUserHandler
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
