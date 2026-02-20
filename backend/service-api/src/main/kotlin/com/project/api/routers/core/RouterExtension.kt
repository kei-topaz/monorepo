package com.project.api.routers.core

import com.project.domain.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.github.smiley4.ktorswaggerui.dsl.routing.post
import io.github.smiley4.ktorswaggerui.dsl.routing.get
import io.github.smiley4.ktorswaggerui.dsl.routing.put
import io.github.smiley4.ktorswaggerui.dsl.routing.delete
import io.github.smiley4.ktorswaggerui.dsl.routing.patch
import io.github.smiley4.ktorswaggerui.dsl.routes.OpenApiRoute



/**
 * The engine that powers all HTTP methods.
 * It is not an extension function to be resilient to Ktor API changes.
 * Marked @PublishedApi so inline functions can access it.
 */
@PublishedApi
internal suspend inline fun <reified TReq : Any, TRes> handleAction(
    call: ApplicationCall,
    crossinline block: suspend (TReq) -> TRes
) {
    val req = if (TReq::class == Unit::class) Unit as TReq else call.receive<TReq>()
    val res = block(req)
    call.respond(HttpStatusCode.OK, res ?: Unit)
}

/**
 * Auto-generates OpenAPI documentation based on reified types.
 */
@PublishedApi
internal inline fun <reified TReq : Any, reified TRes : Any> autoDoc(): OpenApiRoute.() -> Unit = {
    if (TReq::class != Unit::class) {
        request { body<TReq>() }
    }
    response { HttpStatusCode.OK to { body<TRes>() } }
}

// --- The Public DSL (Auto-Documented) ---

inline fun <reified TReq : Any, reified TRes : Any> Route.postAction(path: String, crossinline block: suspend (TReq) -> TRes) =
    post(path, autoDoc<TReq, TRes>()) { handleAction(call, block) }

inline fun <reified TReq : Any, reified TRes : Any> Route.putAction(path: String, crossinline block: suspend (TReq) -> TRes) =
    put(path, autoDoc<TReq, TRes>()) { handleAction(call, block) }

inline fun <reified TReq : Any, reified TRes : Any> Route.patchAction(path: String, crossinline block: suspend (TReq) -> TRes) =
    patch(path, autoDoc<TReq, TRes>()) { handleAction(call, block) }

inline fun <reified TRes : Any> Route.getAction(path: String, crossinline block: suspend () -> TRes) =
    get(path, autoDoc<Unit, TRes>()) { handleAction<Unit, TRes>(call) { block() } }

inline fun <reified TRes : Any> Route.deleteAction(path: String, crossinline block: suspend () -> TRes) =
    delete(path, autoDoc<Unit, TRes>()) { handleAction<Unit, TRes>(call) { block() } }
