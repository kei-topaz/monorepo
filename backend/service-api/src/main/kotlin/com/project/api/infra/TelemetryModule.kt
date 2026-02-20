package com.project.api.infra

import io.ktor.server.application.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.callid.callIdMdc
import io.opentelemetry.api.trace.Span
import io.opentelemetry.instrumentation.ktor.v3_0.KtorServerTelemetry
import io.opentelemetry.sdk.OpenTelemetrySdk
import io.opentelemetry.sdk.trace.SdkTracerProvider
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor
import io.opentelemetry.exporter.logging.LoggingSpanExporter
import org.slf4j.event.Level

fun Application.configureTelemetry() {
    // --- OpenTelemetry Setup ---
    val openTelemetry =
        OpenTelemetrySdk.builder()
            .setTracerProvider(
                SdkTracerProvider.builder()
                    .addSpanProcessor(
                        SimpleSpanProcessor.create(
                            LoggingSpanExporter(),
                        ),
                    )
                    .build(),
            )
            .buildAndRegisterGlobal()

    install(KtorServerTelemetry) {
        setOpenTelemetry(openTelemetry)
    }

    install(io.ktor.server.plugins.callid.CallId) {
        header("X-Request-Id")
        verify { callId: String -> callId.isNotEmpty() }
        generate { java.util.UUID.randomUUID().toString() }
    }

    install(CallLogging) {
        level = Level.INFO
        callIdMdc("request_id")
        mdc("trace_id") {
            Span.current().spanContext.traceId
        }
        mdc("span_id") {
            Span.current().spanContext.spanId
        }
        mdc("path") { call -> call.request.local.uri }
        mdc("method") { call -> call.request.local.method.value }
    }
}
