Parallel Orchestration (Concurrency)
Objective: Replace legacy Task.WhenAll with safer, structured concurrency. Pattern: Standard Kotlin Coroutines (coroutineScope, async, awaitAll).

Pattern A: Parallel Execution (Fixed Tasks)
Use coroutineScope to group distinct async tasks.

Fail-Fast: If one task throws an exception, the scope cancels all siblings immediately.
kotlin
suspend fun handle(req: PriceRequest): PriceResponse = coroutineScope {
    // 1. Launch independent tasks in parallel
    // These functions MUST be `suspend`
    val t1 = async { holidayRepo.getHolidays(req.dates) }
    val t2 = async { rateRepo.getRates(req.hotelIds) }
    // 2. Wait for results
    val holidays = t1.await()
    val rates = t2.await()
    // 3. Combine results
    combine(holidays, rates)
}

Pattern B: Dynamic Parallel Map (List Processing)
Use map { async { ... } } followed by .awaitAll() to process a list in parallel.

kotlin
suspend fun handle(hotelIds: List<Int>): List<HotelInfo> = coroutineScope {
    // 1. Launch a task for each item in the list
    val deferredResults: List<Deferred<HotelInfo>> = hotelIds.map { id ->
        async { 
            hotelRepo.getDetails(id) 
        }
    }
    // 2. Wait for ALL tasks to complete
    // Returns List<HotelInfo>. Throws exception if ANY task fails.
    deferredResults.awaitAll()
}
Note: For large lists, consider .chunked(size) to batch requests.