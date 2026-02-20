plugins {
    kotlin("jvm") version "2.3.0" apply false
    kotlin("plugin.serialization") version "2.3.0" apply false
    id("io.ktor.plugin") version "3.4.0" apply false
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.ksp) apply false
}

allprojects {
    group = "com.project"
    version = "1.0-SNAPSHOT"

    repositories {
        mavenCentral()
        gradlePluginPortal()
    }

    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
            freeCompilerArgs.add("-Xcontext-parameters")
        }
    }
}

subprojects {
    // apply(plugin = rootProject.libs.plugins.detekt.get().pluginId)
    // apply(plugin = rootProject.libs.plugins.ktlint.get().pluginId)

    // ktlint {
    //     version.set("1.2.1")
    //     verbose.set(true)
    //     android.set(false)
    //     outputToConsole.set(true)
    //     ignoreFailures.set(false)
    //     enableExperimentalRules.set(true)
    // }

    // detekt {
    //     buildUponDefaultConfig = true
    //     config.setFrom(files("$rootDir/detekt.yml"))
    // }

    // tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    //     jvmTarget = "21"
    // }

    dependencies {
        // detektPlugins(rootProject.libs.detekt.formatting)
    }

    // Configure JVM Compatibility (Cross-compile to 21 using current JDK)
    plugins.withId("java") {
        configure<JavaPluginExtension> {
            sourceCompatibility = JavaVersion.VERSION_21
            targetCompatibility = JavaVersion.VERSION_21
        }
    }
}
