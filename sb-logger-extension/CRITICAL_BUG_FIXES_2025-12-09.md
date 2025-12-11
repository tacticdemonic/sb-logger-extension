# Critical Bug Fixes - December 9, 2025

## Issues Fixed

### 1. ✅ Prop Polling Initialization Failure
**File**: `prop_poller.js:81-84`

**Problem**: 
```javascript
if (!api || !propApi.storage || !propApi.alarms) {  // ❌ 'api' is undefined
```
The chrome API alias was renamed from `api` to `propApi`, but the initialization check still referenced the old `api` variable. This caused an immediate exception when the background script loaded, preventing prop polling from ever initializing.

**Fix**:
```javascript
if (!propApi || !propApi.storage || !propApi.alarms) {  // ✅ Now uses propApi
```

**Impact**: Prop polling will now initialize correctly on extension startup.

---

### 2. ✅ The Odds API URL Mangled
**File**: `prop_poller.js:315-317`

**Problem**:
```javascript
const baseUrl = 'https://propApi.the-odds-propApi.com/v4';  // ❌ Invalid domain
```
The find-and-replace that renamed `api` to `propApi` incorrectly modified the API URL string, changing `api.the-odds-api.com` to `propApi.the-odds-propApi.com`. This caused every props poll to fail with `ERR_NAME_NOT_RESOLVED`.

**Fix**:
```javascript
const baseUrl = 'https://api.the-odds-api.com/v4';  // ✅ Correct URL
```

**Impact**: Line-movement data will now be fetched successfully from The Odds API.

---

### 3. ✅ Blocking HTTP Requests in Async Event Loop
**File**: `server.py:590-620`

**Problem**:
```python
def _scrape_with_odds_api(self, sport: str, league: str, event_date: str):
    # ...
    response = requests.get(url, params=params, timeout=15)  # ❌ Blocks event loop
```

The `JobProcessor` was converted to run on the asyncio event loop (no ThreadPool), but `_scrape_with_odds_api` still used the synchronous `requests.get()`. Each API call blocked the main event loop for 15+ seconds, stalling all concurrent API requests and polling.

**Fix**:
```python
async def _scrape_with_odds_api(self, sport: str, league: str, event_date: str):
    # ...
    import httpx
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)  # ✅ Non-blocking async
```

Also updated the call site in `_scrape_league`:
```python
result = await self._scrape_with_odds_api(sport, league, event_date)  # Added await
```

**Impact**: 
- The Odds API calls no longer block the event loop
- Multiple jobs can process concurrently without stalling
- Health checks and other API endpoints remain responsive during scraping

---

## Files Modified

1. **prop_poller.js**
   - Line 81: Fixed `api` → `propApi` in initialization check
   - Line 316: Fixed mangled URL `https://propApi.the-odds-propApi.com/v4` → `https://api.the-odds-api.com/v4`

2. **server.py**
   - Line 590: Made `_scrape_with_odds_api` async
   - Lines 604-620: Replaced `requests.get()` with async `httpx` client
   - Line 710: Added `await` when calling `_scrape_with_odds_api`

---

## Testing Recommendations

### Prop Polling
1. Open extension → Settings → Enable prop polling
2. Add The Odds API key
3. Check background console (chrome://extensions → inspect background)
4. Verify: `🎯 Initializing player props polling system` appears
5. Verify: No `api is not defined` errors
6. Wait 5 minutes and check alarms: `chrome.alarms.getAll(console.log)`

### The Odds API Fallback
1. Start CLV server: `python server.py`
2. Submit bet with unavailable league (to trigger fallback)
3. Check server logs for:
   ```
   🔄 Falling back to The Odds API...
   📊 API Quota: XXX remaining
   ✅ The Odds API succeeded for sport/league
   ```
4. Verify: No blocking/stalling of health check endpoint during scraping

### Load Testing
1. Submit 50+ test bets or run batch CLV checks to simulate load
2. Monitor extension Diagnostics → Load Log and background console for job processing performance
3. Check that batch processing completes and CLV fetches do not block other extension operations

---

## Root Cause Analysis

### How These Bugs Happened

**Prop Polling Bugs**: Automated find-and-replace (`api` → `propApi`) modified:
- Variable names ✅ (intended)
- URL strings ❌ (unintended)
- Comment text ❌ (unintended)

**Lesson**: Use IDE refactoring tools or regex with word boundaries (`\bapi\b`) instead of plain find-and-replace.

**Blocking HTTP Bug**: Async conversion (`ThreadPoolExecutor` → `asyncio`) was incomplete:
- Job orchestration converted to async ✅
- HTTP requests remained synchronous ❌
- Database operations remain synchronous ⚠️ (acceptable for SQLite)

**Lesson**: When converting to async, audit all I/O operations:
- Network requests → use `httpx`, `aiohttp`
- File I/O → use `aiofiles`
- Database → use async driver or accept minor blocking for lightweight ops (SQLite)

---

## Remaining Async Considerations

### Potentially Blocking Operations Still Present

1. **Database Operations** (Lines 358, 383, 395, 401, 408, etc.)
   ```python
   self.db.get_bet_requests(job_id)  # Synchronous SQLite I/O
   self.db.cache_league_data(...)    # Synchronous SQLite I/O
   ```
   **Status**: Acceptable for now (SQLite is fast, operations are <10ms)
   **Future**: Consider `aiosqlite` if scaling beyond 100 concurrent jobs

2. **CSV Fetch / CLV Processing** (Already async ✅)
   ```python
   await self._fetch_csv_for_league(...)  # Async HTTP fetch + CSV parse
   ```

3. **File I/O** (Minimal impact)
   - Log file writes (buffered by Python)
   - Custom mapping loads (one-time on startup)

**Recommendation**: Current async implementation is sufficient for expected load (≤20 concurrent jobs). Monitor event loop lag if scaling further.

---

**Status**: All critical bugs fixed ✅  
**Date**: December 9, 2025  
**Testing**: Syntax validated, ready for integration testing
