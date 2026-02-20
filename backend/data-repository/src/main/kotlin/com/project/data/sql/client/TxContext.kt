package com.project.data.sql.client

import org.jooq.Configuration
import org.jooq.DSLContext
import org.jooq.impl.DSL

class TxContext(val configuration: Configuration) {
    val dsl: DSLContext = DSL.using(configuration)
    private val postCommitActions = mutableListOf<suspend () -> Unit>()
    private val asyncPostCommitActions = mutableListOf<suspend () -> Unit>()

    fun onCommit(action: suspend () -> Unit) {
        postCommitActions.add(action)
    }

    fun onAsyncCommit(action: suspend () -> Unit) {
        asyncPostCommitActions.add(action)
    }

    fun getPostCommitActions(): List<suspend () -> Unit> = postCommitActions.toList()

    fun getAsyncPostCommitActions(): List<suspend () -> Unit> = asyncPostCommitActions.toList()
}
