package com.project.api.handlers.example

import com.project.api.infra.NetworkModule
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import org.koin.core.annotation.Single

@Serializable
data class ExternalApiResponse(val data: String)

@Single
class ScatterGatherHandler(private val client: HttpClient) {

    suspend fun aggregateData(): List<String> = coroutineScope {
        val urls = listOf(
            "https://api.example.com/service-a",
            "https://api.example.com/service-b",
            "https://api.example.com/service-c"
        )

        // Scatter: Launch parallel requests
        val deferredResults = urls.map { url ->
            async {
                runCatching {
                    // The client has a global timeout configured in NetworkModule
                    client.get(url).body<ExternalApiResponse>().data
                }.getOrNull() // Ignore errors (Gather only successes)
            }
        }

        // Gather: Wait for all and filter nulls
        deferredResults.awaitAll().filterNotNull()
    }
}
