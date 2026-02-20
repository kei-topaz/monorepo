package com.project.api.infra

import com.project.domain.util.ConfigLoader
import com.project.domain.core.Environment
import com.project.domain.core.ServerConfig
import org.koin.core.annotation.Module
import org.koin.core.annotation.Single

@Module
class ConfigModule {

    @Single
    fun provideServerConfig(): ServerConfig {
        val envStr = ConfigLoader.get("APP_ENV") ?: "development"
        return ServerConfig(
            port = ConfigLoader.get("PORT")?.toIntOrNull() ?: 8080,
            host = ConfigLoader.get("HOST") ?: "0.0.0.0",
            environment = Environment.entries.find { it.name.equals(envStr, ignoreCase = true) } ?: Environment.DEVELOPMENT
        )
    }
}
