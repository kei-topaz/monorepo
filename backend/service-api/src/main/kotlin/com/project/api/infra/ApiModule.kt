package com.project.api.infra

import io.ktor.server.routing.Route
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import com.project.data.DataModule

interface ApiRoute {
    fun setup(route: Route)
}


@Module(includes = [DataModule::class, NetworkModule::class])
@ComponentScan("com.project.api")
class ApiModule
