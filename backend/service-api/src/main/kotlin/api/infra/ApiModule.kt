package api.infra

import io.ktor.server.routing.Route
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import data.DataModule
import org.koin.ksp.generated.*

@Module(includes = [DataModule::class, NetworkModule::class])
@ComponentScan("api")
class ApiModule
