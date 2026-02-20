plugins {
    kotlin("jvm")
    alias(libs.plugins.ksp)
}

dependencies {
    implementation(project(":domain-core"))
    implementation(libs.jooq)
    implementation(libs.jedis)
    implementation(libs.kotlin.coroutines.core)
    implementation(libs.slf4j.api)

    // DI
    implementation(libs.koin.core)
    implementation(libs.koin.annotations)
    ksp(libs.koin.ksp.compiler)

    implementation(platform(libs.opentelemetry.bom))
    implementation(libs.opentelemetry.api)
    implementation(libs.opentelemetry.instrumentation.jdbc)
    
    // Database Drivers & Pools
    implementation(libs.hikari)
    implementation(libs.postgresql)
}

// Note: You will need to update your jOOQ code generation configuration
// to target the new package: com.project.data.sql.generated
