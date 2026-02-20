package com.project.api.infra

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json
import com.project.domain.util.ConfigLoader
import org.koin.core.annotation.Module
import org.koin.core.annotation.Single

@Module
class NetworkModule {

    @Single
    fun httpClient(): HttpClient {
        return HttpClient(CIO) {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    prettyPrint = true
                })
            }
            
            // Global Timeout Configuration
            install(HttpTimeout) {
                // Default: 2.8s
                requestTimeoutMillis = ConfigLoader.get("HTTP_CLIENT_TIMEOUT_MS")?.toLongOrNull() ?: 2_800L
                
                // connectTimeoutMillis = 5_000 // disabled for now, kept for reference
                // socketTimeoutMillis = 5_000 // disabled for now, kept for reference
            }

            install(Logging) {
                level = LogLevel.INFO
            }
        }
    }
}
