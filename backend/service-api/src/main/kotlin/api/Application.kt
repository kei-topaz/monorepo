package api
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import domain.util.ConfigLoader
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import api.routers.core.Router
import org.koin.ktor.ext.getKoin
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import org.koin.ksp.generated.module
import api.infra.configureTimeout
import api.infra.configureExceptions
import api.infra.configureTelemetry
import api.infra.configureOpenApi
import api.infra.*


fun main() {
    val port = ConfigLoader.get("PORT")?.toIntOrNull() ?: 8080
    val host = ConfigLoader.get("HOST") ?: "0.0.0.0"
    embeddedServer(Netty, port = port, host = host, module = Application::module)
        .start(wait = true)
}

fun Application.module(testKoinModule: org.koin.core.module.Module? = null) {
    install(ContentNegotiation) {
        json()
    }

    configureOpenApi()
    configureExceptions()

    if (testKoinModule != null) {
        install(Koin) {
            slf4jLogger()
            modules(testKoinModule)
        }
    } else {
        configureTelemetry()
        configureTimeout()

        // Koin Setup
        install(Koin) {
            slf4jLogger()
            modules(ApiModule().module)
        }
    }

    routing {
        get("/health") {
            call.respondText("OK")
        }
        val routers = getKoin().getAll<Router>()
        routers.forEach { it.setup(this) }
    }
}


