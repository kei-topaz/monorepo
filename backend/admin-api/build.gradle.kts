plugins {
    kotlin("jvm")
    application
    id("io.ktor.plugin")
}

application {
    mainClass.set("adminapi.ApplicationKt")
}

dependencies {
    // Minimal Ktor Server
    implementation(libs.bundles.ktor.server)
    implementation(libs.bundles.logging)
}
