# CLV Troubleshooting Quick Reference

## 🚨 Error: "league_not_supported"

**Check Console For**:
```
[CSV CLV] ℹ️ Tournament "..." is not covered by CSV data
[CSV CLV] ℹ️ Event: ...
```

**Actions**:
1. Is it Champions League, Europa League, or a cup? → **Expected behavior**
2. Is it a top European league? → **Add to league mappings**
3. Unknown competition? → **Add to UNSUPPORTED_TOURNAMENTS**

---

## 🚨 Error: "match_not_found"

**Check Console For**:
```
[CSV CLV] ⚠️ No match found in CSV for: ... (...)
[CSV CLV] ⚠️ Searched X rows in Y 2024-25
[CSV CLV] ⚠️ Low confidence match (48%)
[CSV CLV] ⚠️ Best match was: "..." on ...
[CSV CLV] ⚠️ Parsed teams: Home="...", Away="..."
```

**Diagnostic Steps**:
1. **Compare team names**: Do they match?
   - Example: "Man City" vs "Manchester City"
   - Example: "Spurs" vs "Tottenham Hotspur"
   → **Solution**: Add normalization rule to `fuzzyMatcher.js`

2. **Check date**: Is the match in the future?
   → **CSV only has historical data** (expected behavior)

3. **Check confidence**: Is it close to 50%?
   → **Consider lowering threshold** in `csvClvService.js`

4. **Check row count**: Searched 0 rows?
   → **CSV download/parse failed**

---

## 🚨 Error: "closing_odds_missing"

**Check Console For**:
```
[CSV CLV] ⚠️ No closing odds for market: ...
```

**Actions**:
1. Check market type: Is it 1X2, O/U 2.5, or AH?
   - **Yes** → CSV may not have Pinnacle odds
   - **No** → Unsupported market type (expected)

2. Check market parsing:
   - Does the market field parse correctly?
   → **Add alias to `detectMarketType()`**

---

## 🛠️ Common Fixes

### Add League Mapping
**File**: `footballDataLeagues.js`
```javascript
E0: {
  aliases: [
    'premier league',
    'add your new name here'  // ← ADD HERE
  ]
}
```

### Add Team Name Normalization
**File**: `fuzzyMatcher.js`
```javascript
function normalizeTeamName(name) {
  name = name.replace(/man city/i, 'manchester city');  // ← ADD HERE
  return name;
}
```

### Lower Match Confidence
**File**: `csvClvService.js` (line ~389)
```javascript
if (bestScore < 0.50) {  // Change to 0.40 for 40%
```

### Mark Tournament as Unsupported
**File**: `footballDataLeagues.js`
```javascript
const UNSUPPORTED_TOURNAMENTS = [
  'your tournament name',  // ← ADD HERE
];
```

---

## 🔍 Console Commands for Testing

```javascript
// Test league mapping
mapTournamentToLeague("Premier League")  // Should return "E0"

// Test team normalization (if available)
normalizeTeamName("Man City")  // Should return normalized form

// View all supported leagues
getAllLeagueCodes()  // Returns array of codes

// Check if tournament is unsupported
isUnsupportedTournament("Champions League")  // Should return true
```

---

## 📊 Understanding Error Messages

**Old Format** (confusing):
```
❌ CLV check failed: league_not_supported; match_not_found
```

**New Format** (clear):
```
❌ CLV check failed: 2 unsupported league(s), 3 match(es) not found
```

**Unsupported Leagues Only**:
```
ℹ️ 2 unsupported league(s) (cups, international competitions, or non-European leagues not covered by CSV data)
```

---

## 🎯 Decision Tree

```
CLV Check Failed
│
├─ Only "unsupported league" errors?
│  ├─ Yes → ℹ️ Expected (cups/international)
│  └─ No → Continue investigating
│
├─ Only "match_not_found" errors?
│  ├─ Check console for team names
│  ├─ Check if matches are in future
│  └─ Check confidence scores
│
├─ Only "closing_odds_missing"?
│  ├─ Check market type
│  └─ Verify CSV has Pinnacle odds
│
└─ Mixed errors?
   └─ Investigate each case individually
```

---

## 📝 Reporting Issues

When reporting CLV errors, include:
1. ✅ Console logs (search for `[CSV CLV]`)
2. ✅ Tournament name
3. ✅ Event name  
4. ✅ Bet market type
5. ✅ Error message text
6. ✅ Expected behavior

**Example Good Report**:
```
Tournament: "England - Premier League"
Event: "Man City vs Arsenal"
Market: "Full Time Result - Home"
Error: match_not_found
Console: Shows "Parsed teams: Home='man city', Away='arsenal'"
Expected: Should match "Manchester City vs Arsenal" in E0 CSV
```

---

**Version**: 1.0.80+
**Last Updated**: December 14, 2025
