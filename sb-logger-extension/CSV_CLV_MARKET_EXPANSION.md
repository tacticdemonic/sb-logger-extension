# CSV CLV Market Expansion - Implementation Complete

**Date**: December 10, 2025  
**Version**: 1.0.102.3 → 1.0.103.0 (pending version bump)

## Summary

Expanded CSV-based CLV tracking from **1X2 match odds only** to support **3 market types**:
- ✅ **1X2 / Match Odds** (Home, Draw, Away) - *previously supported*
- ✅ **Over/Under 2.5 Goals** - *NEW*
- ✅ **Asian Handicap** (all handicap lines) - *NEW*

All data sourced from **FREE** Pinnacle closing odds via **football-data.co.uk** CSVs.

---

## What Changed

### 1. CSV Parser Expansion (`csvClvService.js`)

**Added columns** (lines 117-127):
```javascript
// Over/Under 2.5 goals
'P>2.5': header.indexOf('P>2.5'),   // Opening over 2.5
'P<2.5': header.indexOf('P<2.5'),   // Opening under 2.5
'PC>2.5': header.indexOf('PC>2.5'), // Closing over 2.5 (if exists)
'PC<2.5': header.indexOf('PC<2.5'), // Closing under 2.5 (if exists)

// Asian Handicap
PAHH: header.indexOf('PAHH'),   // Opening AH home
PAHA: header.indexOf('PAHA'),   // Opening AH away
PAH: header.indexOf('PAH'),     // Handicap size (e.g., -0.5)
PCAHH: header.indexOf('PCAHH'), // Closing AH home (if exists)
PCAHA: header.indexOf('PCAHA')  // Closing AH away (if exists)
```

**Made new columns optional** (lines 122-135):
- Core columns (Home/Draw/Away) remain required
- O/U and AH columns are optional (not all CSVs have them)
- Console logs available markets on parse

**Updated odds parsing** (lines 161-179):
- Parses all O/U and AH odds as floats
- Handles handicap size (can be negative)

---

### 2. Market Type Detection (`csvClvService.js`)

**New function** `detectMarketType(bet)` (lines 369-451):

Analyzes bet's `market` field using regex patterns:

#### Over/Under Detection
```javascript
// Patterns: "Over 2.5", "Under 2.5", "O/U 2.5", "Total goals over 2.5"
const ouPatterns = [/over.*2\.?5/i, /under.*2\.?5/i, /o\/u.*2\.?5/i, ...]
// Returns: { type: 'OU', details: { direction: 'over'|'under', line: 2.5 } }
```

#### Asian Handicap Detection
```javascript
// Patterns: "Asian Handicap", "AH", "Handicap -0.5", "+1.0 Handicap"
const ahPatterns = [/asian.*handicap/i, /\bah\b/i, ...]
// Returns: { type: 'AH', details: { handicap: -0.5, team: 'home'|'away' } }
```

#### 1X2 / Match Odds (Default)
```javascript
// Patterns: "Home", "Draw", "Away", "1", "X", "2", "Win"
const matchOddsPatterns = [/\bhome\b/i, /\bdraw\b/i, /\baway\b/i, ...]
// Returns: { type: '1X2', details: { selection: 'home'|'draw'|'away' } }
```

---

### 3. Closing Odds Extraction (`csvClvService.js`)

**Refactored** `extractClosingOdds(csvRow, bet)` (lines 453-598):

Changed from simple string matching to intelligent market type handling:

#### Before (1X2 Only)
```javascript
function extractClosingOdds(csvRow, betMarket) {
  // Simple string matching for Home/Draw/Away
  if (['home', '1', 'h'].includes(betMarket)) return csvRow.PSCH;
  // ...
}
```

#### After (All Markets)
```javascript
function extractClosingOdds(csvRow, bet) {
  const marketInfo = detectMarketType(bet);
  
  if (marketInfo.type === '1X2') {
    // Home/Draw/Away
    return csvRow.PSCH / PSCD / PSCA;
    
  } else if (marketInfo.type === 'OU') {
    // Over/Under 2.5 - try closing, fallback to opening
    return csvRow['PC>2.5'] || csvRow['P>2.5'];
    
  } else if (marketInfo.type === 'AH') {
    // Asian Handicap - validate handicap size matches
    if (csvRow.PAH !== bet.handicap) return null; // Mismatch
    return csvRow.PCAHH / PCAHA || csvRow.PAHH / PAHA;
  }
}
```

**Fallback logic**:
- Prefers closing odds (`PC*` columns)
- Falls back to opening odds (`P*` columns) if closing not available
- Logs when fallback used

---

### 4. Documentation Updates

#### `CLV_TROUBLESHOOTING.md` (lines 164-176)
**Before**:
> ⚠️ IMPORTANT: CLV tracking only works for **1X2 / Moneyline** markets.

**After**:
> ✅ CSV-Based CLV supports:
> - 1X2 / Match Odds
> - Over/Under 2.5 Goals
> - Asian Handicap (all lines)

#### `CLV_SETUP_GUIDE.md` (lines 10-22, 115-145)
Added comprehensive market support section:
- **Supported Markets** table with checkmarks
- **Supported Leagues** list (22 European leagues)
- **NOT Supported** list (BTTS, Correct Score, Props, etc.)

---

## Technical Details

### Market Detection Logic

The system uses a **cascade pattern**:

1. **Check O/U patterns** → If match, return `{ type: 'OU', ... }`
2. **Check AH patterns** → If match, return `{ type: 'AH', ... }`
3. **Check 1X2 patterns** → If match, return `{ type: '1X2', ... }`
4. **Default to 1X2** → If no pattern matches (most conservative)

### Odds Column Priority

For each market type:

| Market | Preferred Column | Fallback Column |
|--------|------------------|-----------------|
| 1X2 Home | `PSCH` | *none* (required) |
| 1X2 Draw | `PSCD` | *none* (required) |
| 1X2 Away | `PSCA` | *none* (required) |
| Over 2.5 | `PC>2.5` | `P>2.5` |
| Under 2.5 | `PC<2.5` | `P<2.5` |
| AH Home | `PCAHH` | `PAHH` |
| AH Away | `PCAHA` | `PAHA` |

**Note**: Closing odds (`PC*`) preferred, but opening odds (`P*`) acceptable if CSV doesn't include closing.

### Handicap Validation (Asian Handicap Only)

Before returning odds, system validates:
```javascript
if (csvRow.PAH !== bet.handicap) {
  console.warn(`Handicap mismatch: bet has ${bet.handicap}, CSV has ${csvRow.PAH}`);
  return null; // Prevent wrong CLV calculation
}
```

This ensures bets with different handicap lines (e.g., -0.5 vs -1.0) don't get matched incorrectly.

---

## Testing Recommendations

### 1. Test 1X2 Bets (Existing)
**Verify backward compatibility**:
- Save bet with market "Home" → CLV should work as before
- Save bet with market "Draw" → CLV should work
- Save bet with market "Away" → CLV should work

### 2. Test Over/Under Bets (NEW)
**Create test bets**:
- Market: "Over 2.5" → Should fetch `PC>2.5` or `P>2.5`
- Market: "Under 2.5 goals" → Should fetch `PC<2.5` or `P<2.5`
- Market: "O/U 2.5" → Should detect as Over (if "Over" in description)

**Expected behavior**:
- Console log: `[CSV CLV] 📊 Detected market: OU { direction: 'over', line: 2.5 }`
- Console log: `[CSV CLV] ℹ️ Using opening odds for O/U (no closing odds in CSV)` (if fallback)
- CLV badge shows with `[CSV]` source label

### 3. Test Asian Handicap Bets (NEW)
**Create test bets**:
- Market: "Asian Handicap -0.5 Home" → Should fetch `PCAHH` or `PAHH`
- Market: "AH +1.0 Away" → Should fetch `PCAHA` or `PAHA`
- Market: "Home Handicap -1.5" → Should validate handicap matches CSV

**Expected behavior**:
- Console log: `[CSV CLV] 📊 Detected market: AH { handicap: -0.5, team: 'home' }`
- If handicap mismatch: `[CSV CLV] ⚠️ Handicap mismatch: bet has -0.5, CSV has -1.0`
- CLV badge shows with `[CSV]` source label

### 4. Test Unsupported Markets
**Create test bets**:
- Market: "Both Teams to Score" → Should show "CLV not available"
- Market: "Correct Score 2-1" → Should show "CLV not available"
- Market: "Player to Score Anytime" → Should show "CLV not available"

**Expected behavior**:
- Console log: `[CSV CLV] ⚠️ Unknown market type: "BTTS"`
- No CLV badge appears
- No errors thrown

---

## Console Logging

New log messages to watch for:

### Parse Time
```
[CSV CLV] 📊 Available markets: 1X2, O/U 2.5, Asian Handicap
```

### Market Detection
```
[CSV CLV] 📊 Detected market: OU { direction: 'over', line: 2.5 }
[CSV CLV] 📊 Detected market: AH { handicap: -0.5, team: 'home' }
[CSV CLV] 📊 Detected market: 1X2 { selection: 'home' }
```

### Odds Extraction
```
[CSV CLV] ℹ️ Using opening odds for O/U (no closing odds in CSV)
[CSV CLV] ℹ️ Using opening odds for AH (no closing odds in CSV)
[CSV CLV] ⚠️ Handicap mismatch: bet has -0.5, CSV has -1.0
[CSV CLV] ⚠️ No Asian Handicap odds available (CSV may not include this market)
```

---

## Known Limitations

### 1. Over/Under Line (2.5 Only)
- **Supported**: Over 2.5, Under 2.5
- **NOT Supported**: Over 1.5, Over 3.5, Over 4.5, etc.
- **Reason**: football-data.co.uk CSVs only include 2.5 line

### 2. Closing vs Opening Odds
- Some CSVs have closing odds (`PC*` columns)
- Some CSVs only have opening odds (`P*` columns)
- System uses fallback: prefers closing, accepts opening

### 3. Handicap Line Validation
- Asian Handicap bets must match CSV's handicap line
- If mismatch, CLV returns `null` (prevents wrong calculation)
- Example: Bet has -0.5, CSV has -1.0 → No CLV

### 4. Market Name Variations
- System uses regex patterns for flexibility
- Handles: "Over 2.5", "Over 2.5 goals", "O/U 2.5", "Total over 2.5"
- May miss unusual market naming (report if found)

---

## Next Steps

### Immediate
1. **Version bump**: Update `manifest.json` to `1.0.103.0`
2. **Test extension**: Reload and verify all 3 market types
3. **Monitor console**: Check for unexpected errors

### Future Enhancements
1. **Multi-line O/U**: Support Over/Under 1.5, 3.5, 4.5 (requires CSV column availability)
2. **BTTS Support**: If football-data.co.uk adds BTTS odds columns
3. **Double Chance**: If CSV data available (e.g., "1X", "X2", "12")

---

## Files Modified

1. **csvClvService.js** (539 → 705 lines)
   - Added 10 new CSV columns
   - Added `detectMarketType()` function (83 lines)
   - Refactored `extractClosingOdds()` (146 lines)
   - Updated odds parsing logic

2. **CLV_TROUBLESHOOTING.md**
   - Replaced "1X2 only" limitation with expanded market list

3. **CLV_SETUP_GUIDE.md**
   - Added market support section to intro
   - Replaced generic sports list with football-specific market details

---

## Rollback Instructions

If issues arise, revert to previous 1X2-only implementation:

1. **Restore `csvClvService.js`** from commit before expansion
2. **Restore documentation** files
3. **Reload extension** in browser

Or keep code but disable new markets by modifying `detectMarketType()` to always return `{ type: '1X2', ... }`.

---

**Implementation Status**: ✅ Complete  
**Testing Status**: ⏳ Pending user verification  
**Documentation**: ✅ Updated

