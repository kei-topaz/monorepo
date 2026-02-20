package com.project.domain.util

import io.github.cdimascio.dotenv.Dotenv
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest

object ConfigLoader {
    private val logger = KotlinLogging.logger {}

    private val appEnv: String = System.getenv("APP_ENV") ?: "development"
    private val isCloudEnv: Boolean = appEnv == "production" || appEnv == "staging"

    // Strict: If we are in a Cloud Env, we MUST load secrets successfully or crash.
    private val awsSecrets: Map<String, String> by lazy {
        if (!isCloudEnv) return@lazy emptyMap()

        val secretName =
            System.getenv("AWS_SECRET_NAME")
                ?: error("Configuration Error: APP_ENV is '$appEnv' but AWS_SECRET_NAME is not set.")

        val region = System.getenv("AWS_REGION") ?: "us-east-1"

        logger.info { "Initializing Configuration for $appEnv. Fetching secret: $secretName in $region..." }

        try {
            SecretsManagerClient.builder()
                .region(Region.of(region))
                .build()
                .use { client ->
                    val valueRequest =
                        GetSecretValueRequest.builder()
                            .secretId(secretName)
                            .build()

                    val secretValue = client.getSecretValue(valueRequest).secretString()
                    val jsonElement = Json.parseToJsonElement(secretValue)

                    logger.info { "Successfully loaded AWS Secrets." }

                    jsonElement.jsonObject.entries.associate { (key, value) ->
                        key to (value.jsonPrimitive.content)
                    }
                }
        } catch (e: Exception) {
            logger.error(e) { "CRITICAL: Failed to load AWS Secrets for $appEnv. Application cannot start." }
            throw e // Fail Fast
        }
    }

    private val dotenv: Dotenv by lazy {
        io.github.cdimascio.dotenv.dotenv {
            ignoreIfMissing = true
        }
    }

    fun get(key: String): String? {
        return if (isCloudEnv) {
            // In Cloud, we rely on AWS Secrets + System Env (for non-secret platform vars)
            awsSecrets[key] ?: System.getenv(key)
        } else {
            // In Dev, we rely on .env + System Env
            dotenv[key] ?: System.getenv(key)
        }
    }

    val version: String by lazy {
        try {
            val props = java.util.Properties()
            ConfigLoader::class.java.getResourceAsStream("/build.properties")?.use {
                props.load(it)
            }
            props.getProperty("version") ?: "unknown"
        } catch (e: Exception) {
            logger.warn { "Failed to load build.properties: ${e.message}" }
            "unknown"
        }
    }
}
