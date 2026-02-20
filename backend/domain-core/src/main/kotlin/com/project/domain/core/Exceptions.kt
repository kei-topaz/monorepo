package com.project.domain.core

sealed class AppException(val code: String, override val message: String) : RuntimeException(message) {
    abstract val httpStatusCode: Int
    abstract val logLevel: String // "WARN", "ERROR", etc.

    class NotFound(msg: String) : AppException("NOT_FOUND", msg) {
        override val httpStatusCode = 404
        override val logLevel = "WARN"
    }

    class Conflict(msg: String) : AppException("CONFLICT", msg) {
        override val httpStatusCode = 409
        override val logLevel = "WARN"
    }

    class Internal(msg: String) : AppException("INTERNAL_ERROR", msg) {
        override val httpStatusCode = 500
        override val logLevel = "ERROR"
    }

    class Timeout(msg: String) : AppException("TIMEOUT", msg) {
        override val httpStatusCode = 408
        override val logLevel = "WARN"
    }
}
