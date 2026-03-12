package data

import data.redis.RedisModule
import data.sql.SqlModule
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module

@Module(includes = [SqlModule::class, RedisModule::class])
@ComponentScan("data")
class DataModule
