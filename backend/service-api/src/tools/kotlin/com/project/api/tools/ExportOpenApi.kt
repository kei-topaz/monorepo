package com.project.api.tools

import com.project.api.module
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import java.io.File

fun main() {
    try {
        testApplication {
            application {
                try {
                    // Provide an empty module to bypass DB/Redis init
                    module(org.koin.dsl.module { 
                        single<List<com.project.api.routers.core.Router>> { emptyList() }
                    })
                } catch (e: Exception) {
                    System.err.println("CRITICAL ERROR in ExportOpenApi Application Module Setup:")
                    e.printStackTrace()
                    throw e
                }
            }

        val client =
            createClient {
                install(ContentNegotiation) {
                    json(
                        kotlinx.serialization.json.Json {
                            ignoreUnknownKeys = true
                            prettyPrint = true
                        },
                    )
                }
            }

        val response = client.get("/openapi-raw")
        if (response.status.value != 200) {
            throw RuntimeException("Failed to fetch OpenAPI spec: ${response.status}")
        }

        val rawContent = response.bodyAsText()

        // Automated Patch 1: Ensure 200 responses have a description
        var patchedContent =
            rawContent.replace(
                "\"200\" : \\{\\s*\"headers\" : \\{ \\}".toRegex(),
                "\"200\" : { \"description\" : \"Success\", \"headers\" : { }",
            )

        // Automated Patch 2: Simplify Schema Names (remove package prefixes)
        // Replaces "com.project.api.handlers.user.RegisterRequest" with "RegisterRequest"
        // Matches standard Kotlin package patterns followed by valid class name
        patchedContent =
            patchedContent.replace(
                "com\\.project\\.api\\.handlers\\.[a-z]+\\.".toRegex(),
                "",
            )

        val file = File("src/main/resources/openapi.json")
        file.parentFile.mkdirs()
        file.writeText(patchedContent)

        println("✅ Exported and patched OpenAPI spec to: ${file.absolutePath}")
    }
    } catch (e: Exception) {
        System.err.println("CRITICAL ERROR in ExportOpenApi Main:")
        e.printStackTrace()
        throw e
    }
}
