package com.project.api.infra

import com.project.domain.core.AppException
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable

@Serializable
data class ErrorResponse(val code: String, val message: String, val traceId: String? = null)

fun Application.configureExceptions() {
    install(StatusPages) {
        exception<AppException> { call, cause ->
            val status = HttpStatusCode.fromValue(cause.httpStatusCode)
            
            when (cause.logLevel) {
                "WARN" -> call.application.log.warn("AppException: ${cause.message}", cause)
                "ERROR" -> call.application.log.error("AppException: ${cause.message}", cause)
                else -> call.application.log.info("AppException: ${cause.message}", cause)
            }

            call.respond(status, ErrorResponse(code = cause.code, message = cause.message, traceId = io.opentelemetry.api.trace.Span.current().spanContext.traceId))
        }

        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled exception: ${cause.message}", cause)
            val traceId = io.opentelemetry.api.trace.Span.current().spanContext.traceId
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(code = "INTERNAL_ERROR", message = "An unexpected error occurred", traceId = traceId))
        }
    }
}
