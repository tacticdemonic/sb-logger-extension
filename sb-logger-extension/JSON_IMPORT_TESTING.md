# JSON Import Testing Guide

## Overview
This document describes how to test the JSON import feature refactor that moves import from popup context to dedicated page.

## Changes Made
1. **popup.js**: Replaced file picker in popup with simple tab opener that calls `api.tabs.create({url: 'import.html?type=json'})`
2. **import.html**: Added URL parameter detection with IDs for dynamic UI updates
3. **import.js**: 
   - Added URL parameter parsing to detect import type
   - Updated UI labels based on type (JSON vs CSV)
   - Added JSON file type detection in importSingleFile()
   - Added complete JSON processing functions (validation, merging, import)

## Why This Fix Works
**Root Cause**: Firefox extension popups close when file picker appears, preventing FileReader callback from executing
**Solution**: Use dedicated import page opened in new tab (like CSV import) - tab stays open during file operations

## Test Steps

### 1. Load Extension in Firefox
```
1. Navigate to about:debugging#/runtime/this-firefox
2. Click "Load Temporary Add-on"
3. Select: manifest.json in sb-logger-extension folder
```

### 2. Test JSON Import
```
1. Open extension popup (click extension icon)
2. Click "📥 Import JSON" button
3. Verify: import.html opens in NEW TAB (not replacing popup)
4. Tab title should say "📥 Import Saved Bets (JSON)"
5. Instructions should mention "Export bets from Surebet Helper"
6. File picker should accept only .json files
7. Select test_import.json (in this folder)
8. Click "Import Now" button
9. Verify console shows:
   - "📥 Import page loaded v2.2"
   - "📋 Detected new export format with analysis"
   - "📊 Processing X bets from import file"
   - "✅ Added new bet:", "🔄 Updated pending bet:", etc.
   - "✅ Import successful!" message
10. Click "Close & Return to Extension" button
11. Return to popup and verify new bets appear in list
```

### 3. Verify CSV Import Still Works (Regression Test)
```
1. Click "📥 Import CSV" button in popup
2. Verify: import.html opens in NEW TAB
3. Tab title should say "📥 Import Betfair P/L"
4. File picker should accept .csv files
5. Close tab - CSV import should still function normally
```

### 4. Test Deduplication
```
1. Export current bets as JSON from extension
2. Modify one pending bet status to "won" in the JSON file
3. Import the JSON file
4. Verify: 
   - Pending bet with matching uid is updated to "won"
   - Other bets remain unchanged
   - Console shows "🔄 Updated pending bet with settlement"
```

### 5. Test Permissive Validation
```
1. Create JSON with bet missing uid field (should auto-generate)
2. Create JSON with bet having string odds/stake (should coerce to numbers)
3. Create JSON with missing optional fields (should fill with defaults)
4. Import and verify all bets import successfully
```

## Console Logs to Expect

### Successful JSON Import
```
📥 Import page loaded v2.2 - Added JSON import support
📂 Processing file: test_import.json
✅ File loaded, length: XXXX
📋 Processing JSON file...
📁 Processing JSON file: test_import.json
📋 Detected new export format with analysis
📊 Processing 4 bets from import file
📦 Current storage has X bets
✅ Added new bet: Manchester City vs Liverpool
🔄 Updated pending bet with settlement: Chelsea vs Arsenal - Status: won
⏭️ Skipped duplicate bet: ...
💾 Merged bets saved to storage
✅ Import complete: Added 3, Updated 0, Skipped 1
📥 JSON import completed: 3 added, 0 updated, 1 skipped
```

## Files Modified
- `popup.js`: Lines 1715-1722 (replaces 115+ lines of broken code)
- `import.html`: Added element IDs for dynamic UI updates
- `import.js`: 
  - Lines 1-32: Added URL parameter detection and UI update logic
  - Line 89: Updated importSingleFile() to detect and route JSON files
  - Lines 419-596: Added 6 new functions (validation, merge, JSON processing)

## Rollback Instructions
If issues occur:
1. Revert to previous commit: `git checkout HEAD~1 -- popup.js import.html import.js`
2. Reload extension in Firefox
3. Test CSV import to confirm no regressions

## Expected Differences from Previous Implementation
- JSON import now opens in NEW TAB instead of using file picker in popup
- No more "Importing..." loading state in popup (happens on dedicated page)
- Success message shown on dedicated page instead of popup alert
- Tab stays open after import (user must close manually or click close button)
- Console logs appear in import.html DevTools instead of popup DevTools
