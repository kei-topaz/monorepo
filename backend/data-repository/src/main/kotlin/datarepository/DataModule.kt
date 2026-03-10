package datarepository

import datarepository.redis.RedisModule
import datarepository.sql.SqlModule
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module

@Module(includes = [SqlModule::class, RedisModule::class])
@ComponentScan("datarepository")
class DataModule
