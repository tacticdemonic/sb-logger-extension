# JSON Import Feature - Quick Reference

## What Was Done
Refactored the JSON import feature from broken popup implementation to working dedicated page implementation.

## Why It Was Necessary
Firefox extension popups close when file pickers appear, preventing FileReader callbacks from executing. The workaround is to use a dedicated page opened in a new tab (like the CSV import already does).

## How It Works Now

### User Flow
1. User clicks "📥 Import JSON" button in popup
2. Extension opens `import.html?type=json` in new tab
3. User selects JSON file with saved bets
4. Extension validates, deduplicates, and merges bets
5. User sees success message and closes tab

### Technical Flow
1. **popup.js** → Simple 7-line button handler opens dedicated page
2. **import.html** → Detects `?type=json` parameter and updates UI
3. **import.js** → Routes JSON files to new `processImportedJSON()` function
4. **Storage** → Merges bets with deduplication via uid/composite keys

## Key Changes

| File | Before | After | Lines Changed |
|------|--------|-------|---|
| popup.js | 180 lines (broken) | 7 lines (tab opener) | -173 |
| import.html | Static UI | Dynamic UI with IDs | +4 IDs |
| import.js | CSV only | JSON + CSV support | +178 |
| **Total** | **Broken** | **Working** | **+9 net** |

## Testing the Feature

### Quick Test
```
1. Open extension popup
2. Click "📥 Import JSON" button
3. Select test_import.json
4. See success message
5. Close tab
```

### Verify It Works
- [ ] import.html opens in NEW tab (not popup)
- [ ] Page title says "📥 Import Saved Bets (JSON)"
- [ ] File input accepts only .json files
- [ ] Console shows "Processing JSON file..." logs
- [ ] Success message appears with count
- [ ] Bets appear in popup after import
- [ ] CSV import still works (regression test)

## Files to Review

### Primary Changes
- `popup.js` (line 1715): Button handler - now 1 function instead of 4
- `import.js` (lines 14-32): URL detection - detects type=json parameter
- `import.js` (lines 519-596): New JSON processor with validation/merge

### Documentation
- `JSON_IMPORT_TESTING.md` - Detailed testing guide
- `IMPLEMENTATION_COMPLETE.md` - Full implementation summary
- `test_import.json` - Sample file for testing

## Key Functions Added to import.js

```javascript
// 1. Validation (lines 419-449)
function validateImportedBet(bet) { ... }

// 2. Identity (lines 451-467)
function ensureBetIdentity(bet) { ... }

// 3. Key Generation (lines 469-471)
function getBetKey(bet) { ... }

// 4. Deduplication (lines 473-516)
function mergeJsonBets(existingBets, importedBets) { ... }

// 5. JSON Processing (lines 519-596)
async function processImportedJSON(jsonText, filename) { ... }
```

## Supported JSON Formats

### Format 1: New Export (Recommended)
```json
{
  "bets": [{...}, {...}],
  "analysis": {
    "tiers": {...},
    "bookmakers": {...}
  }
}
```

### Format 2: Legacy Flat Array
```json
[{...}, {...}, {...}]
```

## Deduplication Strategy

- **Primary Key**: UUID in `bet.uid` field (generated on export)
- **Fallback Key**: `${bet.id}::${bet.timestamp}` (composite)
- **Merge Rule**: Update only if imported is settled and existing is pending

## Console Logs to Expect

- `📥 Import page loaded v2.2` - Page loaded
- `📁 Processing JSON file: test.json` - File reading started
- `📋 Detected new export format with analysis` - Format detected
- `📊 Processing 4 bets from import file` - Count
- `✅ Added new bet: Event Name` - Per bet added
- `🔄 Updated pending bet with settlement: Event` - Per bet updated
- `⏭️ Skipped duplicate bet: Event` - Per duplicate skipped
- `✅ Import complete: Added X, Updated Y, Skipped Z` - Summary

## Rollback Instructions (if needed)

```bash
git revert 60b8ecb
```

Or manually revert by:
1. Restoring popup.js from previous commit
2. Restoring import.js from previous commit
3. Reloading extension in Firefox

## GitHub Commit

```
commit 60b8ecb
fix(import): refactor JSON import to use dedicated page instead of popup file picker
```

View changes: https://github.com/tacticdemonic/surebet-helper-extension/commit/60b8ecb

## Support

If JSON import doesn't work:
1. Check console for error messages
2. Verify extension loaded successfully
3. Try with test_import.json file
4. Reload extension (about:debugging → Reload button)
5. Check browser version (requires Firefox 140.0+)

## Version Info
- **Extension Version**: 1.0.48
- **Minimum Firefox**: 140.0
- **Feature Status**: ✅ WORKING
