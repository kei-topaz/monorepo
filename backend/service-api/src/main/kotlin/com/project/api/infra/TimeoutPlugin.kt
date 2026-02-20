package com.project.api.infra

import io.ktor.server.application.*
import io.ktor.server.request.*
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

import com.project.domain.util.ConfigLoader

fun Application.configureTimeout() {
    val defaultTimeout = ConfigLoader.get("DEFAULT_TIMEOUT_MS")?.toLongOrNull() ?: 30_000L

    intercept(ApplicationCallPipeline.Monitoring) {
        val headerValue = context.request.header("X-Request-Timeout")?.toLongOrNull()
        val timeoutMs = headerValue ?: defaultTimeout

        if (timeoutMs != null) {
            try {
                withTimeout(timeoutMs) {
                    proceed()
                }
            } catch (e: TimeoutCancellationException) {
                val uri = context.request.uri
                val method = context.request.httpMethod.value
                val msg = "Request timed out: $method $uri after ${timeoutMs}ms."
                application.log.warn(msg)
                throw com.project.domain.core.AppException.Timeout(msg)
            }
        } else {
            proceed()
        }
    }
}
