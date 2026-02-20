package com.project.api.routers.core

import io.ktor.server.routing.*

interface Router {
    fun setup(route: Route)
}
