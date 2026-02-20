package com.project.data.sql.client

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.jooq.DSLContext
import org.jooq.impl.DSL
import org.slf4j.LoggerFactory

class DbContext(private val master: DSLContext, private val replica: DSLContext) {
    private val logger = LoggerFactory.getLogger(DbContext::class.java)

    // Create a scope for background tasks that survives individual requests
    private val backgroundScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    suspend fun <T> transaction(
        current: TxContext? = null,
        block: context(TxContext)
        () -> T,
    ): T =
        withContext(Dispatchers.IO) {
            when (current) {
                null -> {
                    val config = master.configuration().derive()

                    var postCommitActions: List<suspend () -> Unit> = emptyList()
                    var asyncPostCommitActions: List<suspend () -> Unit> = emptyList()
                    val result =
                        DSL.using(config).transactionResult { c ->
                            val ctx = TxContext(c)
                            val res = block(ctx)
                            postCommitActions = ctx.getPostCommitActions()
                            asyncPostCommitActions = ctx.getAsyncPostCommitActions()
                            res
                        }

                    // Execute synchronous actions
                    postCommitActions.forEach { it() }

                    // Execute asynchronous actions
                    if (asyncPostCommitActions.isNotEmpty()) {
                        asyncPostCommitActions.forEach { action ->
                            backgroundScope.launch {
                                try {
                                    action()
                                } catch (e: Exception) {
                                    logger.error("Async post-commit action failed", e)
                                }
                            }
                        }
                    }

                    result
                }
                else -> block(current)
            }
        }

    suspend fun <T> read(
        current: TxContext? = null,
        block: context(TxContext)
        () -> T,
    ): T =
        withContext(Dispatchers.IO) {
            when (current) {
                null -> {
                    block(TxContext(replica.configuration()))
                }
                else -> block(current)
            }
        }
}
