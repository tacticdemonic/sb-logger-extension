# Debug Logging Quick Reference

## What's New

The extension now captures detailed debug logs for every auto-fill attempt and exports them with pending bets. This helps diagnose why bets aren't being matched on betting exchanges.

## How to View Debug Logs

### In Real-Time (DevTools)

1. Open the extension popup
2. Click on a surebet.com link to trigger auto-fill
3. Press **F12** to open DevTools
4. Go to **Console** tab
5. Look for logs prefixed with `Surebet Helper [autoFill]:`, `Surebet Helper [waitForBettingSlip]:`, etc.

**Example Console Output:**
```
Surebet Helper [autoFill]: Starting auto-fill { exchange: "smarkets", stake: 10, event: "Man City vs Liverpool", betId: "1234567890" }
Surebet Helper [waitForBettingSlip]: Waiting for betting slip { exchange: "smarkets", maxAttempts: 30, pollDelay: 300 }
Surebet Helper [waitForBettingSlip]: Betting slip found { attempt: 5, elapsed: 1600 }
Surebet Helper [fillStakeInput]: Stake filled and events dispatched { stake: "10", eventsDispatched: 3 }
```

### In Exported JSON

1. Click popup → **Export JSON** button
2. Open downloaded `surebet-bets-YYYY-MM-DDTHH-mm-ss.json` file
3. Search for your event name, e.g., `"Manchester City vs Liverpool"`
4. Look for the `"debugLogs"` array within that bet object

**Example JSON Structure:**
```json
{
  "exportDate": "2025-11-27T10:45:08.000Z",
  "bets": [
    {
      "id": "1234567890",
      "event": "Manchester City vs Liverpool",
      "bookmaker": "Bet365",
      "odds": 1.95,
      "stake": 10,
      "status": "pending",
      "debugLogs": [
        {
          "ts": "2025-11-27T10:45:02.000Z",
          "component": "betSave",
          "level": "info",
          "msg": "Bet data parsed from link",
          "data": {
            "event": "Manchester City vs Liverpool",
            "bookmaker": "Bet365",
            "odds": 1.95,
            "exchange": "smarkets"
          }
        },
        {
          "ts": "2025-11-27T10:45:03.000Z",
          "component": "autoFill",
          "level": "info",
          "msg": "Starting auto-fill",
          "data": {
            "exchange": "smarkets",
            "stake": 10,
            "event": "Manchester City vs Liverpool",
            "betId": "1234567890",
            "timeout": 10000
          }
        },
        {
          "ts": "2025-11-27T10:45:04.000Z",
          "component": "waitForBettingSlip",
          "level": "info",
          "msg": "Betting slip found",
          "data": {
            "attempt": 3,
            "elapsed": 1050
          }
        },
        {
          "ts": "2025-11-27T10:45:04.100Z",
          "component": "fillStakeInput",
          "level": "info",
          "msg": "Stake filled and events dispatched",
          "data": {
            "stake": "10",
            "eventsDispatched": 3
          }
        },
        {
          "ts": "2025-11-27T10:45:04.200Z",
          "component": "autoFill",
          "level": "info",
          "msg": "Stake auto-filled successfully",
          "data": {
            "stake": 10,
            "currency": "GBP"
          }
        }
      ]
    }
  ],
  "storageUsedKB": 245,
  "storageWarning": false
}
```

## Debug Components

Each debug entry includes these fields:

- **ts**: ISO timestamp when event occurred
- **component**: Which function generated the log
  - `betSave` - Bet being saved from surebet.com link
  - `autoFill` - Main auto-fill flow
  - `waitForBettingSlip` - Polling for betting slip container
  - `findStakeInput` - Locating stake input field
  - `selector` - CSS selector matching attempts
  - `fillStakeInput` - Setting stake value and firing events
  - `betRetrieval` - Getting bet data from broker
- **level**: Severity level
  - `info` - Normal flow
  - `warn` - Warning condition (might fail)
  - `error` - Failed operation
- **msg**: Human-readable message
- **data**: Context-specific data (varies by component)

## Debugging Tips

### Problem: Auto-fill doesn't start

**Look for**: `autoFill` logs with level `error` or `warn`

**Common causes**:
- Auto-fill disabled in settings
- Exchange not detected (wrong site)
- No stake in bet data

**Example error**:
```json
{
  "component": "autoFill",
  "level": "error",
  "msg": "Could not detect exchange",
  "data": { "hostname": "example.com" }
}
```

### Problem: Betting slip not found

**Look for**: `waitForBettingSlip` logs showing timeout

**Common causes**:
- Wrong CSS selectors for this exchange version
- Site layout changed
- Betting slip loads very slowly

**Diagnostic logs**:
```json
{
  "component": "waitForBettingSlip",
  "level": "warn",
  "msg": "Timeout reached",
  "data": { "maxAttempts": 30, "totalElapsed": 9000 }
},
{
  "component": "selector",
  "level": "warn",
  "msg": "No matching selector found",
  "data": { "totalTried": 3, "selectors": [".bet-slip-container", ".bet-slip-content", ...] }
}
```

### Problem: Stake input not filled

**Look for**: `fillStakeInput` or `selector` logs showing no input found

**Common causes**:
- Stake input selector doesn't match current DOM
- Input field is inside a shadow DOM or iframe
- Input loads asynchronously after polling completes

**Diagnostic logs**:
```json
{
  "component": "selector",
  "level": "warn",
  "msg": "No matching selector found",
  "data": { "totalTried": 6 }
},
{
  "component": "waitForBettingSlip",
  "level": "info",
  "msg": "Stake input not ready",
  "data": { "attempt": 2, "stakeInputFound": false }
}
```

### Problem: Events not dispatched

**Look for**: `fillStakeInput` with low `eventsDispatched` count or errors

**Diagnostic logs**:
```json
{
  "component": "fillStakeInput",
  "level": "warn",
  "msg": "Error dispatching event",
  "data": { "event": "change", "error": "Event dispatch failed" }
}
```

## 24-Hour Auto-Cleanup

- Debug logs older than 24 hours are automatically filtered out when saving
- This prevents storage bloat and keeps logs focused on recent issues
- Timestamp-based: checks `(now - 24 hours)` when updating bets

## Storage Size Warning

- Extension storage has 5MB limit per Chrome spec
- Warning triggers at 4MB (80% full)
- Check warning flag in exported JSON: `"storageWarning": false`
- If warning is `true`:
  - Old settled bets accumulate log data
  - Consider clearing very old pending bets
  - Export and archive old data

## Sharing Debug Logs

To help developers debug issues:

1. Export pending bets JSON (includes debug logs)
2. Open the JSON file in a text editor
3. Copy the `debugLogs` array for your problematic bet
4. Paste into GitHub issue or support request

**Example sharing format**:
```
Event: Manchester City vs Liverpool
Exchange: Smarkets
Timestamp: 2025-11-27T10:45:00Z

Debug Logs:
[copy debugLogs array here]
```

## Performance Impact

- Negligible: ~0.1ms per log entry
- Memory: ~100 bytes per log entry in session
- Storage: ~100 bytes per log entry persisted
- No observable slowdown in auto-fill operations

## Disabling Debug Logging

Debug logging is automatic and cannot be disabled per se, but you can:

1. **Ignore console logs**: They don't affect functionality
2. **Don't export JSON**: No logs will be saved if you don't export
3. **Clear old bets**: Delete settled bets to remove old logs

Debug logging has zero performance cost and helps diagnose issues, so it's recommended to leave it enabled.

---

**Last Updated**: November 27, 2025
**Version**: 1.0.78
