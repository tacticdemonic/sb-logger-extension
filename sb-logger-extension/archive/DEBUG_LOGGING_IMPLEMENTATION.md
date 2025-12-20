# Debug Logging Implementation Summary

## Overview
Added a comprehensive 24-hour time-based debug logging system to diagnose auto-fill failures on betting exchanges. Debug logs are attached directly to each bet object for easy correlation and exported with pending bets JSON.

## Implementation Details

### 1. BetDebugLogger Class (contentScript.js)
- **Location**: Lines 17-64 in contentScript.js
- **Features**:
  - Session ID generation for grouping logs per page load
  - Exchange auto-detection from `location.hostname`
  - `log(component, message, data, level)` method for recording entries
  - `attachToBet(bet)` method to merge logs into bet objects
  - Structured log format: `{ ts, sessionId, component, level, msg, data, url, exchange }`

### 2. Log Filtering Utility (contentScript.js)
- **Location**: Lines 66-75 in contentScript.js
- **Function**: `filterLogsLast24Hours(logs)`
- **Purpose**: Maintains 24-hour retention policy for debug logs
- **Auto-applied**: When updating bets with logs via `updateBetWithDebugLogs()`

### 3. Bet Debug Initialization (contentScript.js)
- **Location**: Line 2149 in parseSurebetLinkData()
- **Change**: Added `debugLogs: []` initialization to all new bet objects
- **Effect**: Every bet created has empty debug log array ready for auto-fill telemetry

### 4. Bet Save Logging (contentScript.js)
- **Location**: Lines 3253-3269 in clickHandlers.surebetLink
- **Logs**:
  - Bet data parsed from surebet.com link
  - Broker save confirmation/failure
  - Bet communication errors
- **Data captured**: Bet ID, event, bookmaker, odds, exchange

### 5. Auto-Fill Instrumentation (contentScript.js)

#### autoFillBetSlip() - Lines 2615-2696
- Entry/exit logging with exchange, stake, event, timeout
- Settings check and auto-fill disabled notifications
- Betting slip detection results (immediate vs MutationObserver vs polling)
- Timeout warnings with elapsed time
- Success/failure reasons with data captured

#### waitForBettingSlip() - Lines 2470-2529
- Attempt count and elapsed time tracking
- Betting slip found/timeout status
- Stake input visibility checks
- Per-attempt telemetry

#### findElement() - Lines 2390-2421
- Selector matching attempts and which selector matched
- Invalid selector warnings
- Total selectors tried and first 3 attempted

#### findStakeInput() - Lines 2423-2461
- Exchange and lay/back flag
- Container found/not found status
- Fallback search results

#### fillStakeInputValue() - Lines 2531-2559
- Stake value being set
- Events dispatched list and count
- Event dispatch error handling

#### getSurebetDataFromReferrer() - Lines 2766-2833
- Broker query status and results
- Cache hit/miss indication
- Storage fallback attempts
- Referrer-based retrieval

### 6. Debug Log Update Function (contentScript.js)
- **Location**: Lines 2561-2575
- **Function**: `updateBetWithDebugLogs(betData)`
- **Purpose**: 
  - Merges session logs into bet's `debugLogs` array
  - Filters to last 24 hours automatically
  - Persists to chrome.storage.local
  - Provides merge/update feedback in console

### 7. Storage Size Check (background.js)
- **Location**: Lines 27-39 in background.js
- **Function**: `getStorageSizeKB()`
- **Features**:
  - Returns KB used, raw bytes, and warning flag
  - Warning flag triggers at 4MB threshold (Chrome limit is 5MB)
  - Error handling with fallback values
  - Uses chrome.storage.local.getBytesInUse() API

### 8. Storage Check Message Handler (background.js)
- **Location**: Lines 631-636 in background.js
- **Action**: `'checkStorageSize'`
- **Response**: `{ success, kb, bytes, warning }`
- **Called before export**: Popup checks storage before download

### 9. Export Enhancement (popup.js)
- **Location**: Lines 1488-1496 in popup.js
- **Addition**: Storage size check call before export
- **Debug logs included**: Automatically via bet objects' `debugLogs` arrays

## Data Structure

### Debug Log Entry Format
```javascript
{
  ts: "2025-11-27T10:45:00.000Z",          // ISO timestamp
  sessionId: "abc123def456",                 // Unique per page load
  component: "autoFill",                     // Function category
  level: "info|warn|error",                  // Log severity
  msg: "Starting auto-fill",                 // Human readable
  data: { exchange, stake, betId, ... },     // Context data
  url: "https://smarkets.com/...",           // Current page
  exchange: "smarkets"                       // Detected exchange
}
```

### Bet Object Addition
```javascript
bet.debugLogs = [
  { ts: "...", sessionId: "...", component: "betSave", level: "info", msg: "Bet data parsed from link", data: {...} },
  { ts: "...", sessionId: "...", component: "autoFill", level: "info", msg: "Starting auto-fill", data: {...} },
  { ts: "...", sessionId: "...", component: "waitForBettingSlip", level: "info", msg: "Betting slip found", data: {...} },
  // ... more entries, filtered to last 24 hours
]
```

## Export Output

### JSON Export Includes
- All pending bets with their `debugLogs` arrays
- Each log entry contains full telemetry for that action
- Storage size information warning flag

### Debug Log Filename
```
surebet-bets-2025-11-27T10-45-08.json
```

## Key Improvements for Debugging

1. **Per-Bet Correlation**: Each bet's debug logs are attached, so you can trace the complete auto-fill flow
2. **24-Hour Window**: Automatic cleanup prevents storage bloat while keeping recent debugging data
3. **Structured Data**: Each log entry has timestamp, component, message, and context
4. **Exchange Detection**: Automatic detection prevents cross-exchange confusion
5. **Storage Warning**: 4MB threshold warning ensures extension stays healthy
6. **Selector Diagnostics**: `findElement()` logs which selectors were tried and which one matched
7. **Timing Data**: `waitForBettingSlip()` includes attempt count and elapsed time
8. **Error Context**: All errors include messages and data for root cause analysis

## How to Use

1. **Enable auto-fill** on a betting exchange
2. **Click a surebet link** to trigger auto-fill attempt
3. **Open DevTools Console** (F12) to see real-time debug logs
4. **Export pending bets** (popup > Export JSON button)
5. **Download JSON file** containing all bets with their debug logs
6. **Search debug logs** for your bet event name or exchange to find the auto-fill trace

## Example Debug Log Sequence

For a Smarkets auto-fill attempt on "Manchester City vs Liverpool":

```json
{
  "timestamp": "2025-11-27T10:45:08Z",
  "bet": {
    "event": "Manchester City vs Liverpool",
    "exchange": "smarkets",
    "stake": 10.00,
    "debugLogs": [
      { "ts": "10:45:02Z", "component": "betSave", "msg": "Bet data parsed from link", "data": { "bookmaker": "Bet365", "odds": 1.95 } },
      { "ts": "10:45:02Z", "component": "autoFill", "msg": "Starting auto-fill", "data": { "exchange": "smarkets", "stake": 10 } },
      { "ts": "10:45:03Z", "component": "waitForBettingSlip", "msg": "Betting slip found", "data": { "attempt": 3, "elapsed": 1050 } },
      { "ts": "10:45:03Z", "component": "fillStakeInput", "msg": "Stake filled and events dispatched", "data": { "stake": "10", "eventsDispatched": 3 } },
      { "ts": "10:45:03Z", "component": "autoFill", "msg": "Stake auto-filled successfully", "data": { "stake": 10, "currency": "GBP" } }
    ]
  }
}
```

## Storage Considerations

- **Per bet**: ~500 bytes base + ~100 bytes per debug log entry
- **Example**: 20 pending bets with 10 logs each = ~20KB
- **24-hour auto-cleanup**: Old entries automatically filtered out
- **4MB warning**: Alert when storage exceeds 4MB (80% of 5MB Chrome limit)

## Troubleshooting

If debug logs aren't appearing:
1. Check DevTools Console for `BetDebugLogger` initialization
2. Verify `debugLogs: []` exists on bet objects in chrome.storage.local
3. Check that `updateBetWithDebugLogs()` is called after auto-fill completes
4. Ensure 24-hour filter isn't removing recent logs (check log timestamps)

## Testing Checklist

- [x] BetDebugLogger class initializes on page load
- [x] `debugLogs: []` added to new bets
- [x] Auto-fill logs attached to bet objects
- [x] 24-hour filter removes old logs
- [x] Storage size check works without errors
- [x] JSON export includes debug logs
- [x] Console shows structured debug messages
- [x] No performance impact on extension

## Files Modified

1. **contentScript.js**
   - Added BetDebugLogger class (lines 17-64)
   - Added filterLogsLast24Hours() utility (lines 66-75)
   - Updated parseSurebetLinkData() to initialize debugLogs (line 2149)
   - Updated clickHandlers.surebetLink with bet save logging (lines 3253-3269)
   - Instrumented 6 key auto-fill functions with debug calls
   - Added updateBetWithDebugLogs() helper (lines 2561-2575)

2. **background.js**
   - Added getStorageSizeKB() utility (lines 27-39)
   - Added 'checkStorageSize' message handler (lines 631-636)

3. **popup.js**
   - Added storage size check before export (lines 1494-1496)

---

**Last Updated**: November 27, 2025
**Version**: 1.0.78
**Status**: Implementation Complete
