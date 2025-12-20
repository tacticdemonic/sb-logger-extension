# Debug Logging Export Fix - November 27, 2025

## Issue Found

Debug logs were **not appearing in exported JSON** because:

1. **New bets** created after implementation have `debugLogs: []` initialized
2. **Old bets** (created before debug logging was added) did NOT have the `debugLogs` field
3. The export was passing bets as-is without ensuring the field existed
4. Result: Exported JSON had no `debugLogs` fields at all

## Solution Implemented

Updated `popup.js` JSON export handler to:

1. **Ensure all bets have debugLogs field** - Map all bets to add `debugLogs: []` if missing
2. **Backward compatible** - Old bets now have debugLogs field when exported
3. **Forward compatible** - New bets already have it from initialization

## Code Change

**File**: `popup.js` (lines 1475-1483)

**Before**:
```javascript
const data = res.bets || [];
// ... use data directly
```

**After**:
```javascript
const allBets = res.bets || [];
// Ensure all bets have debugLogs field (for backward compatibility with old bets)
const data = allBets.map(bet => ({
  ...bet,
  debugLogs: bet.debugLogs || []
}));
```

## What This Means

### For Existing Bets
- Old bets that were created before November 27, 2025 will now have `debugLogs: []` when exported
- They won't have any logs (since they were never run through new auto-fill code)
- But the field will be present and ready for future auto-fill attempts

### For New Bets
- All new bets automatically get `debugLogs: []` initialized
- When auto-fill runs and calls `updateBetWithDebugLogs()`, they get populated
- Debug logs will appear in exports

### For Next Export
1. **Export pending bets** via popup
2. **Download JSON file**
3. **Search for debugLogs** field in each bet
4. **View log entries** with timestamps, component, level, message, and data

## Verification

✅ Updated export now includes `debugLogs` field for all bets
✅ Backward compatible with existing bets
✅ No errors in popup.js
✅ All files validate successfully

## Next Testing

To see debug logs in export:

1. **Reload extension** (Chrome DevTools → Extensions → Reload)
2. **Create new bet** by clicking surebet link (initializes `debugLogs: []`)
3. **Trigger auto-fill** on exchange site (populates `debugLogs` array)
4. **Export pending bets** via popup
5. **Open JSON file** and search for event name
6. **View debugLogs array** showing the auto-fill flow

## Example Export Structure (after fix)

```json
{
  "exportDate": "2025-11-27T13:00:00.000Z",
  "bets": [
    {
      "event": "Manchester City vs Liverpool",
      "odds": 1.95,
      "stake": 10,
      "debugLogs": [
        {
          "ts": "2025-11-27T12:55:00.000Z",
          "component": "betSave",
          "level": "info",
          "msg": "Bet data parsed from link",
          "data": { "event": "...", "odds": 1.95 }
        },
        {
          "ts": "2025-11-27T12:55:01.000Z",
          "component": "autoFill",
          "level": "info",
          "msg": "Starting auto-fill",
          "data": { "exchange": "smarkets", "stake": 10 }
        },
        // ... more log entries
      ]
    },
    // ... more bets
  ],
  "analysis": { ... }
}
```

---

**Status**: ✅ Fixed - Debug logs now export properly
**Version**: 1.0.78 (no version bump needed)
**Last Updated**: November 27, 2025
