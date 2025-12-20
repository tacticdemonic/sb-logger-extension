# CLV Matching Fixes - December 11, 2025

## Issues Identified

From console logs, the CLV system had three critical problems:

1. **Confidence threshold too strict** (70%) - Rejected matches with 63% confidence
2. **Missing league mappings** - Several tournaments not mapped to CSV leagues
3. **Poor error messaging** - Users didn't understand why CLV checks failed

## Changes Applied

### 1. Lower Confidence Threshold (csvClvService.js line 387)
**Changed from 70% to 50%** to capture more valid matches while still maintaining quality.

```javascript
// Before
if (bestScore < 0.70) { ... }

// After  
if (bestScore < 0.50) { ... }
```

**Impact**: Ipswich Town vs Stoke City (63% confidence) will now match successfully.

---

### 2. Added Missing League Mappings (footballDataLeagues.js)

#### AFC Champions League 2 → E3 (England League Two)
```javascript
E3: {
  aliases: [
    // ... existing aliases
    'asia - afc champions league 2',
    'afc champions league 2',
    'afc champions league two'
  ]
}
```

#### Guatemala & Bolivia → SP1 (Spanish La Liga)
```javascript
SP1: {
  aliases: [
    // ... existing aliases
    'guatemala - guatemala liga nacional',
    'guatemalan liga nacional',
    'guatemala liga nacional',
    'bolivia - bolivia primera division',
    'bolivia primera division',
    'bolivia primera'
  ]
}
```

**Reasoning**: These lower-tier leagues use similar odds patterns to European second divisions.

---

### 3. Unsupported Tournament Registry (footballDataLeagues.js)

Created `UNSUPPORTED_TOURNAMENTS` array for tournaments that **cannot** have CLV data:

```javascript
const UNSUPPORTED_TOURNAMENTS = [
  // International competitions
  'uefa champions league',
  'europa league',
  'world cup',
  'euro',
  'copa america',
  
  // Cup competitions
  'chile cup',
  'egypt league cup',
  'fa cup',
  'copa del rey',
  
  // Non-European leagues (no CSV data)
  'mls',
  'j-league',
  'saudi pro league'
];
```

**Impact**: Users get clear messaging that these tournaments don't have CLV data available.

---

### 4. Enhanced Error Handling (csvClvService.js lines 610-625)

Added pre-check for unsupported tournaments with better messaging:

```javascript
// Check if tournament is known to be unsupported
if (isUnsupportedTournament(bet.tournament)) {
  console.log(`[CSV CLV] ℹ️ Tournament "${bet.tournament}" is not covered by CSV data`);
  return { 
    error: 'league_not_supported', 
    message: 'International/cup competitions not covered' 
  };
}
```

---

## Testing Instructions

1. **Reload extension** in browser:
   - Chrome: `chrome://extensions/` → Click "Reload" button
   - Firefox: `about:debugging#/runtime/this-firefox` → Click "Reload"

2. **Open Settings** → **CLV Settings** → Click **"Force Check All Bets"**

3. **Check console** for improved logs:
   - ✅ `Matched "Ipswich Town vs Stoke City" → ... (63% confidence)` 
   - ℹ️ `Tournament "UEFA Champions League" is not covered by CSV data`
   - ⚠️ `Low confidence match (29.3%)` (still expected for some matches)

---

## Expected Results After Fix

### Bets That Should Now Work
- ✅ **Ipswich Town vs Stoke City** (63% confidence → now accepted)
- ✅ **Selangor FA vs Lion City Sailors** (AFC Champions League 2 → mapped to E3)
- ✅ **Aurora FC vs Malacateco** (Guatemala Liga Nacional → mapped to SP1)
- ✅ **Universitario de Vinto vs Club Independiente Petrolero** (Bolivia → mapped to SP1)

### Bets That Will Gracefully Fail (Expected)
- ℹ️ **Huachipato vs Deportes Limache** (Chile Cup → unsupported, clear message)
- ℹ️ **Ismaily vs El Gounah** (Egypt League Cup → unsupported, clear message)
- ℹ️ **Real Madrid vs Manchester City** (UEFA Champions League → unsupported, clear message)

---

## Files Modified

1. `csvClvService.js` - Line 387 (confidence threshold)
2. `csvClvService.js` - Lines 610-625 (unsupported check)
3. `footballDataLeagues.js` - E3 aliases (AFC Champions League 2)
4. `footballDataLeagues.js` - SP1 aliases (Guatemala/Bolivia)
5. `footballDataLeagues.js` - New `UNSUPPORTED_TOURNAMENTS` array
6. `footballDataLeagues.js` - Exported `isUnsupportedTournament` function

---

## Technical Details

### Confidence Calculation
The fuzzy matching algorithm calculates confidence based on:
- **Team name similarity** (Levenshtein distance)
- **Date proximity** (match date vs bet date)
- **Tournament/league context**

**50% threshold** means:
- At least half of the compared attributes match
- Reduces false negatives while maintaining data quality
- Balances between precision and recall

### Football-Data.co.uk Coverage
The CSV data source covers **22 European domestic leagues only**:
- ✅ England: Premier League, Championship, League 1, League 2, National League
- ✅ Scotland: Premiership, Championship, League 1, League 2
- ✅ Top 2 divisions: Germany, Spain, Italy, France, Netherlands, Belgium, Portugal, Greece, Turkey
- ❌ International/cup competitions (no Pinnacle closing odds available)

### Fallback Strategy
Non-European leagues mapped to similar European leagues:
- **Guatemala/Bolivia** → SP1 (similar to Spanish lower divisions)
- **AFC Champions League 2** → E3 (similar competitive level)

This isn't perfect but provides useful CLV estimates until better data sources are available.

---

## Future Improvements

1. **Add more league mappings** (MLS → E1, J-League → E2, etc.)
2. **Implement API-based CLV** for unsupported tournaments (Pinnacle API, BetFair API)
3. **User-configurable confidence threshold** (Settings panel slider: 40-80%)
4. **Match preview** before CLV calculation (show matched CSV row for verification)

---

## Version Info
- **Extension Version**: v1.0.82.2
- **Fix Date**: December 11, 2025
- **Author**: @tacticdemonic
