# Auto-Fill Implementation Guide

## Recent Updates (v1.0.45+)

### Matchbook Auto-Fill Support Added
Enhanced the extension with production-ready Matchbook exchange auto-fill selectors. The implementation uses React module class names and data-hook patterns matching Matchbook's current DOM structure.

**Matchbook Selectors**:
- **Betting Slip Container**: Uses `Betslip-module__betslip`, `Offers-module__offers`, and data-hook wildcards
- **Stake Input**: Primary `data-hook^="betslip-stake-"` (supports multi-bet with wildcard), fallback to `input[name="backInput"]` with OfferEdit module classes
- **Odds Input**: `data-hook^="betslip-back-"` for consistency with Betfair pattern

**Note**: Matchbook uses the same universal retry logic (10 attempts × 200ms) as Betfair/Smarkets.

---

## Historical: Smarkets Verification Implementation (v1.0.32)

The Surebet Helper extension includes comprehensive diagnostic logging for Smarkets auto-fill. The implementation adds detailed console logging at both the storage and retrieval phases to help diagnose the exact point where the auto-fill flow fails.

### Version: 1.0.32

## Changes Made

### 1. Enhanced Click Handler (Line ~2625)
**File**: `contentScript.js`
**Function**: `clickHandlers.surebetLink`

Added detailed logging for storage operations:
- **Timestamp logging**: Tracks when `pendingBet` is written to storage
- **Bet ID tracking**: Logs the unique bet ID being stored for correlation
- **Verification check**: Immediately verifies the stored data exists and ID matches
- **Error handling**: Improved error reporting if storage write fails

**Expected Logs When Clicking Surebet Link**:
```
Surebet Helper: Surebet link clicked, storing data for later
Surebet Helper: [2025-11-24T10:07:00.080Z] Writing pendingBet to storage with ID: 1485188009
Surebet Helper: ✓ Set callback completed without error
Surebet Helper: Bet data stored for bookmaker page: {...}
Surebet Helper: ✓ Storage verification PASSED - pendingBet ID 1485188009 persisted correctly
Surebet Helper: Storage complete, navigating to: https://smarkets.com/...
```

### 2. Enhanced Smarkets Retrieval Function (Line ~2175)
**File**: `contentScript.js`
**Function**: `getSurebetDataFromReferrer()`

Added comprehensive storage enumeration and retrieval checks:
- **Retrieval timestamp**: Tracks when retrieval starts
- **Enumeration Check 1**: Lists all storage keys available
- **Enumeration Check 2**: Explicitly retrieves `pendingBet` and validates
- **Fallback mechanisms**: Tests referrer, iframe parent, and direct parsing
- **Success indicators**: Clear "SUCCESS" and "Fallback" messages for different retrieval paths

**Expected Logs When Navigating to Smarkets**:
```
Surebet Helper: [2025-11-24T10:07:05.123Z] Starting Smarkets retrieval - looking for pendingBet
Surebet Helper: [Retrieval Check 1] Storage enumeration - Total keys: 8
Surebet Helper: [Retrieval Check 1] All keys: [..., "pendingBet"]
Surebet Helper: [Retrieval Check 1] pendingBet exists in storage: true
Surebet Helper: [Retrieval Check 2] Direct pendingBet get - Keys returned: 1
Surebet Helper: ✓ SUCCESS - Found stored bet data from Surebet click (ID: 1485188009)
Surebet Helper: ✓ Cleared pendingBet from storage after retrieval
```

## Testing Instructions

### Test 1: Verify Storage Write (Surebet Page)

1. Open surebet.com/valuebets with Developer Console (F12)
2. **LEFT-CLICK** on a Smarkets stake indicator (e.g., the "390" stake)
3. Check console for logs matching the "Expected Logs When Clicking Surebet Link" above
4. **Critical check**: Look for the verification line:
   - ✓ `Storage verification PASSED` = Storage working correctly
   - ⚠ `Storage verification FAILED` = Storage write problem

**Success Criteria**:
- See timestamp with bet ID
- See "Storage verification PASSED" message
- Page navigates to Smarkets

### Test 2: Verify Storage Retrieval (Smarkets Page)

1. After navigating to Smarkets, check the Smarkets page console
2. Look for logs matching the "Expected Logs When Navigating to Smarkets" above
3. **Critical checks**:
   - `[Retrieval Check 1] Total keys: X` should show at least 8+ keys
   - `[Retrieval Check 1] pendingBet exists in storage: true` means data was found
   - `✓ SUCCESS - Found stored bet data` means auto-fill should proceed
   - `⚠ No stored bet data found` means storage data didn't persist

**Success Criteria**:
- See "Total keys" enumeration
- See `pendingBet exists in storage: true`
- See "SUCCESS - Found stored bet data"
- Stakes auto-fill on Smarkets page

### Test 3: Verify Matchbook Auto-Fill

1. Open surebet.com/valuebets in Developer Console (F12)
2. **LEFT-CLICK** on a Matchbook stake indicator
3. Check console for "Storage verification PASSED" log
4. Navigate to Matchbook and verify stakes auto-fill in the betting slip
5. Console should show "Surebet Helper: Stake placement successful" after successful auto-fill

**Success Criteria**:
- Storage verification passes on Surebet
- Matchbook page detects betting slip using React module classes
- Stake input found with `data-hook^="betslip-stake-"` selector
- Stake value auto-fills without manual intervention

## Diagnostic Interpretation

### Scenario 1: ✓ Both Tests Pass
**Logs show**:
- Surebet: "Storage verification PASSED"
- Smarkets: "SUCCESS - Found stored bet data"

**Result**: Auto-fill should work. If stakes don't fill, problem is in the Smarkets placement logic, not storage.

### Scenario 2: ✓ Storage Passes, but No Data on Smarkets
**Logs show**:
- Surebet: "Storage verification PASSED"
- Smarkets: "No stored bet data found" + keys do NOT include "pendingBet"

**Result**: Storage data lost between navigation. Test if using private browsing or storage isolation settings.

### Scenario 3: ✓ Storage Passes, Retrieval Shows pendingBet But Says "No Stored Bet Data"
**Logs show**:
- Surebet: "Storage verification PASSED"
- Smarkets: "Total keys includes pendingBet" BUT "Direct get result: {}"

**Result**: Storage corruption or race condition. May need to increase delay from 150ms to 250ms.

### Scenario 4: ⚠ Storage Verification Fails on Surebet
**Logs show**:
- Surebet: "Storage verification FAILED"

**Result**: Firefox storage API not working. Check:
- Extension permissions in manifest (should have "storage")
- Firefox storage quota not exceeded
- Not in private browsing mode

## Configuration Adjustments

If Scenario 3 occurs, try increasing the storage sync delay:

**File**: `contentScript.js` Line ~2320
**Current**: `}, 150);` (150ms delay)
**Try**: `}, 250);` (250ms delay for slower systems)

Then test again and report if pendingBet now appears on Smarkets.

## Success Indicators

✅ **Full Success** = Auto-fill works without user intervention
- Storage verified on Surebet
- Data retrieved on Smarkets
- Stakes auto-filled correctly

✅ **Partial Success** = Data flows but auto-fill doesn't complete
- Storage verified
- Retrieval successful
- Problem is in stake placement (different issue)

❌ **Data Lost** = Storage doesn't persist between pages
- Write succeeds but retrieval fails
- Indicates browser storage isolation or private mode

❌ **Write Fails** = Storage API not functioning
- Verification fails on Surebet
- Check extension permissions and browser storage settings

## Next Steps

1. **Run Test 1** on Surebet and share console output
2. **Run Test 2** on Smarkets and share console output
3. Report which scenario matches your logs
4. If Scenario 3, test with 250ms delay

The detailed logging will pinpoint the exact failure point in the auto-fill flow.


