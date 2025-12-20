# CLV Error Diagnostics Guide

## Overview
This document explains the improved CLV error handling and diagnostic features implemented to help identify why CLV checks fail.

## Error Types

### 1. `league_not_supported`
**Meaning**: The tournament/league is not covered by the CSV data source (football-data.co.uk).

**Common Causes**:
- International competitions (Champions League, Europa League, World Cup)
- Cup competitions (FA Cup, Copa del Rey, DFB-Pokal)
- Non-European leagues (MLS, J-League, Saudi Pro League)
- South American leagues (Guatemala Liga Nacional, Bolivia Primera Division)

**What to Check**:
- Look at console logs for the specific tournament name
- Check if the tournament is in the `UNSUPPORTED_TOURNAMENTS` list in `footballDataLeagues.js`
- Check if the tournament needs to be added to league mappings

**Solution**:
- If it's a known unsupported competition: This is expected behavior
- If it's a supported league that's not mapping: Add the tournament name to the aliases in `footballDataLeagues.js`

### 2. `match_not_found`
**Meaning**: The match could not be found in the CSV data, even though the league is supported.

**Common Causes**:
- Team names don't match between the betting site and CSV data
- Match date is too far in the future (CSV only has historical data)
- Match was postponed or cancelled
- Low confidence score (<50%) in fuzzy matching

**What to Check**:
1. **Console Logs** - Look for:
   - `⚠️ Low confidence match (X%)` - Shows the best match found and its confidence score
   - `⚠️ Parsed teams: Home="...", Away="..."` - Shows how the team names were parsed
   - `⚠️ Best match was: "..." on ...` - Shows the closest CSV match found

2. **Team Name Matching**:
   - Compare the parsed team names with CSV team names
   - Check for abbreviations (e.g., "Man Utd" vs "Manchester United")
   - Check for special characters or accents

3. **Date Issues**:
   - Check if the match date is in the future (CSV only has past data)
   - Verify the match hasn't been postponed

**Solutions**:
- **Add team name normalization**: Update `fuzzyMatcher.js` to handle specific team name variations
- **Lower confidence threshold**: Current threshold is 50% (in `csvClvService.js` line ~387)
- **Check CSV availability**: Verify the CSV file exists and has data for that season

### 3. `closing_odds_missing`
**Meaning**: The match was found, but closing odds for the specific market are not available.

**Common Causes**:
- Market type not supported in CSV (only Pinnacle closing odds for 1X2, O/U 2.5, Asian Handicap)
- Pinnacle didn't offer odds for this specific market
- Market detection failed (couldn't parse the market type)

**What to Check**:
- Check the bet's `market` field in console logs
- Verify the market type is supported (1X2, Over/Under 2.5, Asian Handicap)
- Check if the market detection logic needs improvement

**Solution**:
- Add market type aliases in `detectMarketType()` function
- Verify the CSV has Pinnacle closing odds columns (PSC, PSD, PSA, PSH for 1X2, etc.)

### 4. `csv_download_failed`
**Meaning**: Failed to download the CSV file from football-data.co.uk.

**Common Causes**:
- Network connectivity issues
- CSV file not available for that season/league
- football-data.co.uk website is down

**Solution**:
- Check network connection
- Verify the CSV URL in console logs
- Check if the season is too old or too recent (CSV data availability varies)

## Improved Diagnostics

### Enhanced Console Logging
All CLV operations now include detailed console logging:

```javascript
[CSV CLV] ℹ️ Tournament "Champions League" is not covered by CSV data
[CSV CLV] ℹ️ Event: Liverpool vs Real Madrid
[CSV CLV] ⚠️ No match found in CSV for: Arsenal vs Chelsea (Premier League)
[CSV CLV] ⚠️ Searched 380 rows in E0 2024-25
[CSV CLV] ⚠️ Low confidence match (48.5%) for: Man City vs Tottenham
[CSV CLV] ⚠️ Best match was: "Manchester City vs Tottenham Hotspur" on 2024-12-10
[CSV CLV] ⚠️ Parsed teams: Home="man city", Away="tottenham"
```

### Categorized Error Messages
Error messages now show counts by category:

```
❌ CLV check failed: 2 unsupported league(s), 3 match(es) not found
```

Instead of the raw error codes:
```
❌ CLV check failed: league_not_supported; match_not_found
```

### Detailed Error Objects
Each error now includes a `details` object with context:

```javascript
{
  error: 'match_not_found',
  details: {
    event: 'Arsenal vs Chelsea',
    tournament: 'Premier League',
    league: 'E0'
  }
}
```

## Debugging Workflow

1. **Enable Debug Logging**: The `clv_debug.js` module is already active
2. **Check Console**: Open browser DevTools console before running CLV check
3. **Look for Patterns**:
   - Are all failures from the same tournament? → League mapping issue
   - Are all failures "match_not_found"? → Team name matching issue
   - Mixed errors? → Review each case individually

4. **Use the Console Output**:
   - Search for `[CSV CLV]` to see all CLV-related logs
   - Look for `⚠️` warnings showing failed matches
   - Check `ℹ️` info logs showing unsupported tournaments

5. **Test Specific Cases**:
   - Copy the tournament and event name from error logs
   - Test the mapping functions in console:
     ```javascript
     mapTournamentToLeague("Premier League")  // Should return "E0"
     ```

## Common Fixes

### Adding a New League Mapping
Edit `footballDataLeagues.js` and add aliases:

```javascript
E0: {
  code: 'E0',
  name: 'Premier League',
  aliases: [
    'premier league',
    'epl',
    'your new alias here'  // Add here
  ]
}
```

### Improving Team Name Matching
Edit `fuzzyMatcher.js` and add normalization rules:

```javascript
function normalizeTeamName(name) {
  // Add specific replacements
  name = name.replace(/man\s+utd/i, 'manchester united');
  name = name.replace(/spurs/i, 'tottenham');
  // ... etc
}
```

### Lowering Match Confidence Threshold
Edit `csvClvService.js` line ~387:

```javascript
// Current: 50% confidence required
if (bestScore < 0.50) {  // Change to 0.40 for 40%, etc.
```

⚠️ **Warning**: Lowering too much may cause false matches!

## Support Resources

- **League mappings**: `footballDataLeagues.js`
- **Team name matching**: `fuzzyMatcher.js`
- **CLV core logic**: `csvClvService.js`
- **Debug logging**: `clv_debug.js`
- **Error handling**: `background.js` (lines 1550-1640)

## Quick Reference

| Error Code | Severity | Common Cause | Quick Fix |
|------------|----------|--------------|-----------|
| `league_not_supported` | ℹ️ Info | International/cup competition | Add to UNSUPPORTED_TOURNAMENTS or league mappings |
| `match_not_found` | ⚠️ Warning | Team name mismatch | Check console for parsed names, update fuzzyMatcher |
| `closing_odds_missing` | ⚠️ Warning | Market not in CSV | Verify market type is supported |
| `csv_download_failed` | ❌ Error | Network/availability | Check connection and CSV URL |

---

**Last Updated**: December 14, 2025
**Version**: 1.0.80+
