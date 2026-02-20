package com.project.api.infra

import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.github.smiley4.ktorswaggerui.SwaggerUI
import io.github.smiley4.ktorswaggerui.routing.openApiSpec
import io.github.smiley4.ktorswaggerui.routing.swaggerUI
import io.ktor.server.response.*
import io.ktor.server.routing.*
import com.project.domain.util.ConfigLoader

fun Application.configureOpenApi() {
    // OpenAPI / Swagger UI Configuration
    install(SwaggerUI) {
        info {
            title = "Service API"
            version = ConfigLoader.version
            description = "Auto-generated OpenAPI Spec"
        }
        externalDocs {
            url = "https://wiki.example.com/api"
            description = "Detailed API Usage Guides"
        }
        // This ensures the spec is available at /openapi.json
        spec("default") {
        }
    }

    routing {
        // Serve the static, patched OpenAPI spec from resources
        route("openapi.json") {
            get {
                val spec = Application::class.java.getResource("/openapi.json")?.readText()
                if (spec != null) {
                    call.respondText(spec, io.ktor.http.ContentType.Application.Json)
                } else {
                    call.respond(io.ktor.http.HttpStatusCode.NotFound, "OpenAPI spec not found")
                }
            }
        }

        // Dynamic spec generation for the export tool only
        route("openapi-raw") {
            openApiSpec()
        }

        // Serve the UI which points to /openapi.json
        route("swagger") {
            swaggerUI(apiUrl = "/openapi.json")
        }
    }
}
