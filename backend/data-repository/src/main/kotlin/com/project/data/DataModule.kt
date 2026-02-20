package com.project.data

import com.project.data.redis.RedisModule
import com.project.data.sql.SqlModule
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module

@Module(includes = [SqlModule::class, RedisModule::class])
@ComponentScan("com.project.data")
class DataModule
