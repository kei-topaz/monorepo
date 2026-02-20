package com.project.domain.core

import kotlinx.serialization.Serializable

@Serializable
data class ServerConfig(
    val port: Int,
    val host: String,
    val environment: Environment
)

@Serializable
enum class Environment {
    DEVELOPMENT, STAGING, PRODUCTION
}
