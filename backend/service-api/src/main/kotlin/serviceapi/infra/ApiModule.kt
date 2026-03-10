package serviceapi.infra

import io.ktor.server.routing.Route
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import datarepository.DataModule



@Module(includes = [DataModule::class, NetworkModule::class])
@ComponentScan("serviceapi")
class ApiModule
