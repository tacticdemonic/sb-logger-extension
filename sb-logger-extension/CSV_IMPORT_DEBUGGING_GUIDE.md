# CSV Import Debugging Guide

This guide helps contributors debug and fix CSV import matching issues reported via the "🐛 Report Match Issue" button.

---

## How Matching Works

### Overview

1. **CSV Parsing** - File is parsed to extract event, market, P/L, and date
2. **Event Normalization** - Event names cleaned via `normalizeString()`
3. **Market Normalization** - Markets cleaned via `normalizeMarket()` to produce tokens like `_MATCHWIN_`, `_OVERUNDER_`, `_AH_`
4. **Candidate Matching** - Each CSV entry is compared against all pending bets
5. **Scoring** - Multiple similarity scores calculated (Levenshtein, token overlap, market types)
6. **Threshold Check** - Entry must exceed minimum thresholds to match

### Key Functions in `import.js`

| Function | Purpose |
|----------|---------|
| `normalizeString(str)` | Removes special chars, extra spaces, lowercases |
| `normalizeMarket(market)` | Converts market names to standardized tokens |
| `matchBetWithPLDebug(csvEntry, pendingBets)` | Main matching logic with debug info |
| `calculateLevenshteinSimilarity(a, b)` | String edit distance similarity |
| `calculateTokenOverlap(a, b)` | Shared word count between normalized strings |

---

## Understanding the Debug Report

When a user reports a match failure, the issue contains:

### Summary Section
```
- Matched: 0
- Unmatched: 64
- Total CSV Entries: 64
- Pending Bets Available: 26
```
This tells you how many entries failed and how many candidates existed.

### Normalization Debug Section
```
CSV Entry:
- Raw Market: "Moneyline (Melbourne Renegades Women)"
- Normalized: "_MATCHWIN__NUMS_"

Best Candidate:
- Market: "Melbourne Renegades Women to win / Draw No Bet - run" → "_NUMS_"
```
**This is the key diagnostic.** Compare the normalized forms - they should have shared tokens to match.

### What to Look For

| Symptom | Likely Cause |
|---------|--------------|
| Event 100% but Market 0% | Market normalization discrepancy |
| Both low scores | Events are genuinely different (no bug) |
| Shared tokens but no match | Threshold too high or numbers don't match |
| `_NUMS_` only after normalization | Market type token was stripped too early |

---

## Common Issues & Fixes

### Issue 1: Market Type Lost During Slash Removal

**Symptom:**
```
CSV: "Moneyline (Team)" → "_MATCHWIN__NUMS_"
Saved: "Team to win / Draw No Bet" → "_NUMS_"  ← Missing _MATCHWIN_ or _DNB_
```

**Cause:** The slash removal regex runs before market type detection:
```javascript
.replace(/\s+\/\s+[^_].*$/g, '')  // Cuts off "/ Draw No Bet"
```

**Fix:** Detect market types BEFORE slash removal:
```javascript
// Add these BEFORE the slash removal line
.replace(/\bdraw\s+no\s+bet\b/gi, '_DNB_')
.replace(/\bto\s+win\b/gi, '_MATCHWIN_')
```

### Issue 2: "to win" Not Normalized to _MATCHWIN_

**Symptom:**
```
"Team to win / Draw No Bet" → "_NUMS_" (should be "_MATCHWIN_" or "_DNB_")
```

**Cause:** "to win" is being stripped instead of converted.

**Fix:** In `normalizeMarket()`, ensure conversion happens before removal:
```javascript
// Convert first
.replace(/\bto\s+win\b/gi, '_MATCHWIN_')
// Then clean up (but don't re-strip "to win")
```

### Issue 3: Different Total/Over-Under Formats

**Symptom:**
```
CSV: "Total (OVER 229.0)" → "_OVERUNDER__NUMS_"
Saved: "Total over 229 - points" → "_OVERUNDER__NUMS_"
```
These SHOULD match but don't because of decimal differences.

**Fix:** Normalize numbers more aggressively (strip trailing .0):
```javascript
.replace(/(\d+)\.0\b/g, '$1')  // 229.0 → 229
```

### Issue 4: Handicap Format Mismatch

**Symptom:**
```
CSV: "Team +0.5 / Team -0.5" → "_AH__NUMS_"
Saved: "Team to win with handicap +0.5" → "_AH__NUMS_"
```
Should match but handicap sign isn't preserved consistently.

**Fix:** Ensure both positive and negative handicaps extract the same way.

---

## Debugging Workflow

### Step 1: Reproduce Locally

1. Get the user's CSV file (ask them to attach or email privately)
2. Create test pending bets that match the events in the CSV
3. Run the import and check DevTools console

### Step 2: Add Debug Logging

Add temporary logging in `normalizeMarket()`:
```javascript
function normalizeMarket(market) {
  const original = market;
  let result = market.toLowerCase();
  
  // ... normalization steps ...
  
  console.log(`normalizeMarket: "${original}" → "${result}"`);
  return result;
}
```

### Step 3: Test Your Fix

1. Edit `normalizeMarket()` in `import.js`
2. Reload the extension
3. Re-run the import
4. Check if similarity scores improve

### Step 4: Verify No Regressions

Test against these CSV formats:
- Smarkets (event format: "Team A v Team B")
- Betfair Exchange (event format: "Team A vs Team B")  
- Betfair (different market naming)

---

## Test Cases

### Moneyline ↔ Draw No Bet
```javascript
// These should match
csv = { market: "Moneyline (Team A)" }
saved = { market: "Team A to win / Draw No Bet - run" }
```

### Total Over/Under
```javascript
// These should match
csv = { market: "Total (OVER 229.0)" }
saved = { market: "Total over 229 - points" }
```

### Asian Handicap
```javascript
// These should match
csv = { market: "Team A +0.5 / Team B -0.5" }
saved = { market: "Team A to win with a handicap of +0.5 (Asian handicap)" }
```

---

## Files to Modify

| File | What to Change |
|------|----------------|
| `import.js` | `normalizeMarket()` function (around line 840) |
| `import.js` | Matching thresholds in `matchBetWithPLDebug()` |
| `TESTING_GUIDE.md` | Add new test cases |

---

## Acceptance Criteria

Before merging a fix, verify:

- [ ] The specific failing case from the issue now matches
- [ ] Previously working CSV formats still work
- [ ] Smarkets handicap format still works ("Team +0.5 / Team -0.5")
- [ ] Betfair format still works
- [ ] No new console errors

---

## Related Documentation

- `CSV_IMPORT_ISSUE_REPORTING.md` - How the Report Issue feature works
- `IMPLEMENTATION_GUIDE.md` - Overall extension architecture
- `TESTING_GUIDE.md` - Installation and testing instructions

---

*Last Updated: November 2025*
