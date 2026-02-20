# 🏗️ Technical Specification: Kotlin-Backend Architecture

## 1. Project Topology & Dependencies
* **domain-core**: "The Atoms." Value Classes, Enums, and AppException hierarchy. **Zero dependencies.**
* **data-repository**: "The Molecules." jOOQ code, Repositories, DbContext, and Domain Entities/DTOs.
* **service-api**: "The Engine." Ktor Routers, Handlers, and Routing Orchestrators. Depends on both.

## 2. The domain-core and Value Classes
All primitives (String, Long, etc.) must be wrapped in **Value Classes** at the architectural edge.
* **Validation**: Must occur in the `init` block via `require` to ensure "garbage" never enters the logic zone.
* **Pattern**:
  @Serializable @JvmInline value class UserId(val value: Long)
  @Serializable @JvmInline value class Email(val value: String) {
  init { require(value.contains("@")) { "Invalid Email" } }
  }

## 3. Repository Orchestrator and DbContext
Database access is mediated by a re-entrant ambient context (`TxContext`).
* **DbContext**: Implements Re-entrancy and Read/Write Splitting.
* **transaction(current)**: If `current != null`, join/execute. Else, start Master transaction.
* **read(current)**: If `current != null`, stay on Master (consistency). Else, hit Read Replica.
* **Context Sugar**: Uses `context(TxContext)` to provide an implicit `dsl` (DSLContext) to repositories.

## 4. Repository and Mapping Interfaces
We use **Explicit Scoped Mapping**. Data Entities/DTOs live in `data-repository`.
* **Prohibition**: Do NOT use global jOOQ Converters.
* **Rule**: Each Repository implements a `Mapping` interface to convert Records to Entities.
* **Pattern**:
  interface UserMapping {
  fun Record.toUserId() = UserId(this[USERS.ID]!!)
  fun Record.toUserDomain() = User(id = toUserId(), name = this[USERS.NAME]!!)
  }
  class UserRepository : UserMapping {
  context(TxContext)
  fun findById(id: UserId): User? = dsl.selectFrom(USERS)
  .where(USERS.ID.eq(id.value)) // Explicit unwrapping is the standard
  .fetchOne()?.toUserDomain()
  }

## 5. Handler Patterns and DTOs
Handlers represent a single use-case/logic unit.
* **The Gatekeeper**: Public entry is always `suspend fun handle(req: Req, current: TxContext? = null)`.
* **The Logic Zone**: All internal logic functions MUST use `context(TxContext)`.
* **DTO Location**: Request and Response DTOs must be defined right above each Handler class.
* **Prohibition**: NEVER pass `TxContext` or `DSLContext` as standard function parameters.

## 6. The Router and Router Orchestration
Routers delegate to Handlers using standardized Action DSLs (`postAction`, `getAction`, etc.).
* **Responsibility**: Routers are "thin"; they only handle path parameters and call the Handler.
* **Pattern**:
  postAction<RegisterReq, RegisterRes>("/users") { req -> registerHandler.handle(req) }

## 7. Invisible Observability and Traceability
The `RequestId` travels through the system via the Coroutine Context ("The Ether").
* **RequestIdElement**: A `CoroutineContext.Element` used for contextual discovery.
* **MDCContext**: Synchronizes the ID with SLF4J MDC for log traceability across suspension points.
* **SQL Tagging**: jOOQ `ExecuteListener` prepends `/* req_id: ${requestId} */` to all queries automatically.

## 8. Global Error Handling
* **Domain Errors**: Handlers throw `AppException` (Sealed class). Logic stays "Happy Path."
* **System Errors**: Unhandled Throwables are caught by the Router Orchestrator and mapped to 500 status.
* **Safety**: The orchestrator masks internal system errors while exposing the `requestId` for support.

## 9. Logging Standard
* **Stack**: `kotlin-logging` (JVM) + `Logback`.
* **MDC Integration**: Every log line must include `[req_id: %X{request_id}]` via `logback.xml`.
* **Lazy Evaluation**: Always use lambda syntax to avoid unnecessary string construction: `logger.info { "User $id created" }`.

## 10. Summary of Guardrails
1. NEVER use `ThreadLocal`; always use `CoroutineContext` (MDCContext).
2. NEVER perform external I/O (HTTP calls) inside a `db.transaction` block.
3. ALWAYS use `context(TxContext)` for functions requiring database access.
4. ALWAYS return a Response DTO; never leak Database Records or Domain Entities to the Router.
5. ALWAYS use the `toDomain()` extension functions defined in mapping interfaces.
