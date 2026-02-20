plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

dependencies {
    implementation(libs.kotlin.serialization.json)
    implementation(libs.kotlin.logging)
    implementation(libs.dotenv)
    implementation(libs.aws.secretsmanager)
}
