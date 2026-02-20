package com.project.domain.core
import kotlinx.serialization.Serializable

@Serializable @JvmInline
value class UserId(val value: String) {
    init {
        require(value.isNotBlank())
    }
}

@Serializable @JvmInline
value class Email(val value: String) {
    init {
        require(value.contains("@"))
    }
}
