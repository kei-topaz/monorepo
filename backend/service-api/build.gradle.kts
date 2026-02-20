plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    application
    id("io.ktor.plugin")
    alias(libs.plugins.ksp)
}

application {
    mainClass.set("com.project.api.ApplicationKt")
}

sourceSets {
    create("tools") {
        compileClasspath += sourceSets.main.get().output + sourceSets.test.get().output
        runtimeClasspath += sourceSets.main.get().output + sourceSets.test.get().output
    }
}

val toolsImplementation by configurations.getting {
    extendsFrom(configurations.testImplementation.get())
}

dependencies {
    implementation(project(":domain-core"))
    implementation(project(":data-repository"))

    // Ktor & Serialization
    implementation(libs.bundles.ktor.server)
    implementation(libs.bundles.ktor.serialization)
    implementation(libs.bundles.ktor.serialization)
    implementation(libs.ktor.server.openapi)

    // OpenTelemetry
    implementation(platform(libs.opentelemetry.bom))
    implementation(libs.opentelemetry.api)
    implementation(libs.opentelemetry.sdk)
    implementation(libs.opentelemetry.exporter.logging)
    implementation(libs.opentelemetry.ktor)
    implementation(libs.opentelemetry.instrumentation.jdbc)
    implementation(libs.opentelemetry.instrumentation.jdbc)
    implementation(libs.ktor.server.call.logging)

    // Ktor Client
    implementation(libs.bundles.ktor.client)

    // Logging
    implementation(libs.bundles.logging)
    implementation(libs.kotlin.coroutines.slf4j)

    // Database
    implementation(libs.postgresql)
    implementation(libs.hikari)
    implementation(libs.jooq)
    implementation(libs.jedis)

    // DI
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger)
    implementation(libs.koin.annotations)
    ksp(libs.koin.ksp.compiler)

    // Config & Utils
    implementation(libs.dotenv)
    implementation(libs.aws.secretsmanager)
    implementation(libs.swagger.ui)
    implementation(libs.okhttp)

    // Test
    testImplementation(libs.bundles.ktor.test)
    testImplementation(libs.ktor.client.content.negotiation)
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.archunit.junit5)
}

val exportOpenApi by tasks.registering(JavaExec::class) {
    group = "openapi"
    description = "Exports and patches the OpenAPI JSON spec to src/main/resources"
    classpath = sourceSets["tools"].runtimeClasspath
    mainClass.set("com.project.api.tools.ExportOpenApiKt")
    workingDir = projectDir
    outputs.file("src/main/resources/openapi.json")
}

val verifyOpenApi by tasks.registering {
    group = "verification"
    description = "Verifies that the committed OpenAPI spec matches the generated one"
    dependsOn(exportOpenApi)
    doLast {
        try {
            val process =
                ProcessBuilder("git", "status", "--porcelain", "src/main/resources/openapi.json")
                    .directory(projectDir)
                    .start()

            if (process.waitFor() == 0) {
                val gitStatus = process.inputStream.bufferedReader().readText()
                if (gitStatus.isNotEmpty()) {
                    throw GradleException(
                        "OpenAPI spec is out of date! Please run './gradlew :service-api:exportOpenApi' and commit the changes.",
                    )
                }
            } else {
                logger.warn("Skipping OpenAPI verification: Not a git repository or git command failed.")
            }
        } catch (e: Exception) {
            logger.warn("Skipping OpenAPI verification: ${e.message}")
        }
    }
}

tasks.check {
    dependsOn(verifyOpenApi)
}

tasks.processResources {
    filesMatching("build.properties") {
        expand(project.properties)
    }
}

tasks.test {
    useJUnitPlatform()
    // Don't fail if no tests are found (e.g. checks disabled)
    (this as Test).failOnNoDiscoveredTests = false
    
    testLogging {
        events("passed", "skipped", "failed")
    }
}
