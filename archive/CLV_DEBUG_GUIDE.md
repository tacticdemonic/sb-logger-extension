# CLV Debugging Quick Reference

## Current Status
✅ Debug logging module installed  
✅ API server running on 127.0.0.1:8765  
✅ Extension URLs updated to 127.0.0.1  
✅ Comprehensive error handling in place  

## How to Use Debug Logging

### 1. Reload Extension
- Firefox: Navigate to `about:debugging#/runtime/this-firefox`
- Click **Reload** on "Surebet Helper - Save Bets"

### 2. Open Extension Console
- Click **Inspect** button on the extension
- Switch to **Console** tab
- You should see: `🐛 [CLV DEBUG] Debug logging module loaded`

### 3. Trigger CLV Check
- Open extension popup
- Click ⚙️ **Settings**
- Scroll to **CLV Settings** section
- Click **⚡ Force Check Now** button

### 4. Watch Console Output

#### Expected Log Sequence:
```
🐛 [CLV DEBUG] Debug logging module loaded
🐛 [CLV DEBUG] Interceptors installed
📈 [CLV] Force CLV check triggered
📈 [CLV] Getting CLV settings...
📈 [CLV] Settings loaded: { enabled: false, apiUrl: "http://127.0.0.1:8765", ... }
🐛 [CLV DEBUG] FETCH INTERCEPTED: { url: "http://127.0.0.1:8765/health", method: "GET" }
🐛 [CLV DEBUG] FETCH RESPONSE: { status: 200, ok: true }
🐛 [CLV DEBUG] RESPONSE BODY: {"status":"ok","version":"1.0.0"...}
📈 [CLV] Starting fetchClvFromApi
📈 [CLV] API URL: http://127.0.0.1:8765
📈 [CLV] Bet count: 0
🐛 [CLV DEBUG] FETCH INTERCEPTED: { url: "http://127.0.0.1:8765/api/batch-closing-odds" }
🐛 [CLV DEBUG] FETCH RESPONSE: { status: 200, ok: true }
🐛 [CLV DEBUG] RESPONSE BODY: {"job_id":"...", "results":[...]}
📈 [CLV] Parsed job response: { job_id: "...", status: "completed" }
🐛 [CLV DEBUG] MESSAGE RESPONSE: { success: true, checked: 0, updated: 0 }
```

#### If Error Occurs:
```
🐛 [CLV DEBUG] FETCH ERROR: {
  errorName: "TypeError",
  errorMessage: "Failed to fetch",
  errorStack: "TypeError: Failed to fetch\n  at ...",
  rawError: {...}
}
📈 [CLV] FETCH ERROR CAUGHT: {
  name: "TypeError",
  message: "Failed to fetch",
  stack: "...",
  constructor: "TypeError"
}
📈 [CLV] Returning error message: "Failed to fetch"
```

## Common Issues & Solutions

### Issue: "Unknown error"
**Symptom**: Error message is vague  
**Debug**: Look for `🐛 [CLV DEBUG] FETCH ERROR` in console  
**Cause**: Network connectivity, CORS, or API down  
**Solution**: Check `errorMessage` and `errorName` in log

### Issue: "CLV tracking is disabled"
**Symptom**: Check fails immediately  
**Debug**: Look at `📈 [CLV] Settings loaded` - check `enabled: false`  
**Solution**: Enable CLV in Settings → CLV Settings → Toggle ON

### Issue: "CLV API not responding"
**Symptom**: Health check fails
**Debug**: Look at `🐛 [CLV DEBUG] FETCH RESPONSE` for /health endpoint
**Cause**: In historical setups, the API server might not be running or the port is wrong. Note: the OddsHarvester FastAPI server is deprecated and archived — it is no longer the production CLV solution.
**Solution**: For active CSV-based CLV, view the extension Diagnostics → Load Log and the browser DevTools background console. If you are experimenting with the archived server, start it from the archived location:
```powershell
# Archived server (for research only) - Not recommended for production
python archive\clv_api_attempts\odds_harvester_api\server.py
```

### Issue: "No pending bets found"
**Symptom**: Nothing to check  
**Debug**: Check console for bet count: `📈 [CLV] Bet count: 0`  
**Solution**: Save some bets first, settle them (won/lost), then retry

### Issue: Fetch fails with CORS error
**Symptom**: Network error in console  
**Debug**: Look at `🐛 [CLV DEBUG] FETCH ERROR`  
**Cause**: Browser blocking cross-origin request  
**Solution**: Check `host_permissions` in manifest.json includes `<all_urls>`

## Debug Log Prefixes

| Prefix | Component | Purpose |
|--------|-----------|---------|
| 🐛 [CLV DEBUG] | Debug interceptor | Low-level fetch/message logging |
| 📈 [CLV] | Background script | Main CLV flow |
| 📈 [CLV UI] | Settings UI | User interaction logging |

## Test Scenarios

### Test 1: API Health Check
```javascript
// In extension console:
fetch('http://127.0.0.1:8765/health')
  .then(r => r.json())
  .then(console.log)
```
**Expected**: `{status: "ok", version: "1.0.0", ...}`

### Test 2: Manual Batch Request
```javascript
// In extension console:
fetch('http://127.0.0.1:8765/api/batch-closing-odds', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    bets: [{
      betId: "test-123",
      sport: "football",
      tournament: "Premier League",
      homeTeam: "Man City",
      awayTeam: "Liverpool",
      market: "Match Odds",
      eventDate: "2025-12-08T15:00:00Z",
      bookmaker: "Bet365",
      selection: "Man City",
      odds: 1.95
    }],
    fallbackStrategy: "pinnacle"
  })
})
.then(r => r.json())
.then(console.log)
```
**Expected**: `{job_id: "...", total_bets: 1, status: "completed", results: [...]}`

### Test 3: Check Extension Permissions
```javascript
// In extension console:
chrome.permissions.getAll((perms) => {
  console.log('Permissions:', perms.permissions);
  console.log('Host permissions:', perms.origins);
});
```
**Expected**: Should include `storage`, `alarms`, `notifications`, and `<all_urls>`

## Files Modified

### New Files
- `clv_debug.js` - Debug logging interceptor (loaded first in background)

### Modified Files
- `manifest.json` - Added `clv_debug.js` to background scripts
- `background.js` - Enhanced error handling (lines 1715-1723)
- `settings.js` - All localhost URLs changed to 127.0.0.1

## Next Steps After Debugging

1. **Reload extension** with debug logging
2. **Open console** and click Force Check Now
3. **Copy all console output** and share for analysis
4. **Identify the exact error** from `🐛 [CLV DEBUG] FETCH ERROR`
5. **Fix root cause** based on error details

## Removing Debug Logging (Production)

When debugging is complete:
1. Remove `clv_debug.js` from `manifest.json` background scripts
2. Delete `clv_debug.js` file
3. Keep enhanced error handling in `background.js`

---

**Created**: December 8, 2025  
**Purpose**: Diagnose "Unknown error" in CLV check  
**Status**: Debug logging active - ready for testing
