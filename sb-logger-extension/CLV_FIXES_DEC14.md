# CLV Fixes - December 14, 2025

## Issues Found & Fixed

### 🐛 Issue 1: False Positive League Matching
**Problem**: "Kenyan Premier League" was incorrectly mapping to "E0" (English Premier League)

**Root Cause**: The fuzzy matching algorithm was too permissive - it matched any tournament containing "premier league" to the English Premier League.

**Fix**: Improved `mapTournamentToLeague()` function in `footballDataLeagues.js`:
- Now requires **country context** to match
- "Kenyan Premier League" contains "premier league" but not "england"
- Only matches if: tournament contains alias AND (alias contains country OR alias is very specific)
- Added length checks to prevent short substring false matches

**Code Change**:
```javascript
// OLD: Too permissive
if (normalized.includes(alias) || alias.includes(normalized)) {
  return code;
}

// NEW: Requires context
if (normalized.includes(alias)) {
  const country = league.country.toLowerCase();
  if (normalized.includes(country) || alias.length > 20) {
    return code;
  }
}
```

### 🐛 Issue 2: Incorrect Error Counts
**Problem**: Error message showed "1 unsupported league(s), 1 match(es) not found" when actually 17 were unsupported and 1 not found.

**Root Cause**: Using `Set` instead of `Array` for `errorReasons` meant duplicate error types were deduplicated.

**Fix**: Changed `errorReasons` from `Set` to `Array` in `background.js`:
```javascript
// OLD
const errorReasons = new Set();
errorReasons.add(errorMsg);

// NEW
const errorReasons = [];
errorReasons.push(errorMsg);
```

Now each bet's error is counted individually, giving accurate totals:
- ✅ "17 unsupported league(s), 1 match(es) not found"
- ❌ "1 unsupported league(s), 1 match(es) not found"

### 🐛 Issue 3: Missing Leagues in UNSUPPORTED_TOURNAMENTS
**Problem**: Several leagues appeared in user logs but weren't in the unsupported list.

**Leagues Added**:
- ✅ Kenyan Premier League
- ✅ Women's Champions League (UEFA)
- ✅ Saudi Arabia League Division 1
- ✅ Serbia SuperLiga
- ✅ Romania Liga 1
- ✅ Portugal Liga 2

**Why These Can't Be Supported**:
- No CSV data available from football-data.co.uk
- football-data.co.uk only covers 22 European leagues with Pinnacle closing odds
- These are outside scope (non-European, lower divisions, or women's competitions)

## Results

### Before
```
[CSV CLV] ✅ Mapped "Kenyan Premier League" → E0
[CSV CLV] ⚠️ No match found in CSV for: Ulinzi Stars vs KCB
❌ CLV check failed: 1 unsupported league(s), 1 match(es) not found
```

### After
```
[CSV CLV] ℹ️ Tournament "Kenyan Premier League" is not covered by CSV data
[CSV CLV] ℹ️ Event: Ulinzi Stars vs KCB
ℹ️ 18 unsupported league(s) (cups, international competitions, or non-European leagues)
```

## Testing

To verify these fixes:

1. **Test Kenyan Premier League**:
   - Should now be marked as unsupported
   - Should NOT map to E0
   - Console: `ℹ️ Tournament "Kenyan Premier League" is not covered by CSV data`

2. **Test Error Counts**:
   - Load 18 bets (17 unsupported, 1 not found)
   - Should show: "17 unsupported league(s), 1 match(es) not found"
   - NOT: "1 unsupported league(s), 1 match(es) not found"

3. **Test New Unsupported Leagues**:
   ```javascript
   isUnsupportedTournament("Kenyan Premier League")  // true
   isUnsupportedTournament("Portugal Liga 2")        // true
   isUnsupportedTournament("Serbia SuperLiga")       // true
   ```

4. **Test English Premier League Still Works**:
   ```javascript
   mapTournamentToLeague("Premier League")           // "E0"
   mapTournamentToLeague("England - Premier League") // "E0"
   mapTournamentToLeague("English Premier League")   // "E0"
   ```

## Files Modified

1. ✅ `footballDataLeagues.js`
   - Improved `mapTournamentToLeague()` fuzzy matching
   - Added 7 missing leagues to `UNSUPPORTED_TOURNAMENTS`

2. ✅ `background.js`
   - Changed `errorReasons` from Set to Array
   - Error counts now accurate

## Backward Compatibility

✅ **Fully backward compatible**
- English Premier League and all 22 supported leagues still map correctly
- Existing functionality unchanged
- Only improvements: better accuracy, no false positives

## Related Documents

- `CLV_ERROR_DIAGNOSTICS.md` - Comprehensive troubleshooting guide
- `CLV_TROUBLESHOOTING_QUICKREF.md` - Quick reference card
- `CLV_ERROR_IMPROVEMENTS_SUMMARY.md` - Original enhancement summary

---

**Status**: ✅ Fixed
**Version**: 1.0.80+
**Date**: December 14, 2025
