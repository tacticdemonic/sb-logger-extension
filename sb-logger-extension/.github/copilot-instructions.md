# SB Logger Extension — AI Coding Agent Instructions

## Project Overview
Firefox browser extension for logging value bets from surebet.com. Injects save buttons on bet rows, tracks expected value (EV) calculations, supports manual/automatic bet settlement, and provides visual P/L analytics with chart visualization.

## Architecture Components

### 1. Content Script (`contentScript.js`)
- **Injection target**: `surebet.com/valuebets` only (hostname + pathname check)
- **DOM structure**: Targets `tbody.valuebet_record` rows with MutationObserver for dynamic content
- **Data extraction**: Reads `data-value`, `data-probability`, `data-overvalue` attributes + text content from specific selectors
- **Market handling**: Extracts from `.coeff abbr` text (includes "- lay" suffix) or fallback to `[data-comb-json]` attribute
- **Event time**: Extracted from `.time abbr[data-utc]` attribute (Unix milliseconds)
- **Pattern**: Guard check `window.__sbLoggerInjected` prevents double-injection

### 2. Popup UI (`popup.html` + `popup.js`)
- **Layout**: Fixed width (520px), max-height (350px) scrollable bet list
- **Bet status**: Uses button listeners (`.status-btn`) with `data-bet-id` and `data-status` attributes
- **Sorting**: 5 sort modes via `#sort-select` — saved (asc/desc), event time (asc/desc), status grouping
- **EV calculation formula**: `(winProb × stake × odds) - (loseProb × stake)` where winProb = probability% / 100
- **Running totals**: Two-row summary — total stakes/P/L/ROI, then expected vs actual for settled bets only
- **Chart rendering**: Vanilla Canvas API (no libs), dual-line cumulative graph (blue=EV, green/red=actual P/L)

### 3. Background Service (`background.js`)
- **Message actions**: `export`, `clearBets`, `checkResults`
- **Export pattern**: Creates Blob URLs, triggers `chrome.downloads.download()`, revokes URL after 5s
- **CSV escaping**: Double-quotes values, replaces internal `"` with `""`
- **API integration**: Loads `apiService.js` via manifest, calls `ApiService.checkBetsForResults()`
- **Auto-checking**: Chrome alarm (`checkBetResults`) fires every 60 minutes, sends notifications on found results

### 4. API Service (`apiService.js`)
- **Dual APIs**: API-Football (soccer, 100 req/day) + The Odds API (other sports, 500 req/month)
- **User config**: API keys stored at top of file — users must replace placeholder strings
- **Retry logic**: Max 5 attempts with exponential backoff, tracked via `bet.apiRetryCount` and `bet.lastApiCheck`
- **Lookup timing**: Waits 2.25 hours after `eventTime` (90min match + 15min halftime + 30min buffer)
- **Market types**: Supports 1X2, Over/Under goals, Asian Handicap, Cards, Lay bets (inverts outcome)
- **Matching**: Team name fuzzy matching using Dice coefficient (bigrams), 0.7 threshold
- **Cache**: 10-minute TTL in-memory Map, keyed by date + sport

## Critical Workflows

### Loading Extension in Firefox
```powershell
# Navigate to: about:debugging#/runtime/this-firefox
# Click "Load Temporary Add-on" → select manifest.json
```

### Packaging for Distribution
```powershell
# From parent directory
Compress-Archive -Path .\sb-logger-extension\* -DestinationPath .\sb-logger-extension.zip -Force
```

### API Key Configuration
1. Edit `apiService.js` lines ~7-17 (API_CONFIG object)
2. Replace `'fb3802...'` (API-Football) and `'abdc8d...'` (Odds API) strings
3. Reload extension via `about:debugging`

## Data Model

### Bet Object Structure
```javascript
{
  id: string,              // Row data-id or timestamp
  timestamp: ISO8601,      // When saved
  eventTime: ISO8601,      // When event starts (from data-utc)
  bookmaker: string,       // Extracted from .booker a
  sport: string,           // From .booker .minor
  event: string,           // From .event a
  tournament: string,      // From .event .minor
  market: string,          // From .coeff abbr (includes "- lay")
  odds: number,            // From data-value
  probability: number,     // From data-probability (%)
  overvalue: number,       // From data-overvalue (%)
  stake: number,           // User input via prompt
  note: string,            // Optional user note
  status: 'pending'|'won'|'lost'|'void',
  settledAt: ISO8601,      // When status changed
  apiRetryCount: number,   // API lookup attempts (max 5)
  lastApiCheck: ISO8601,   // Last API request time
  url: string              // Page URL where saved
}
```

## Project-Specific Patterns

### DOM Selectors (surebet.com specific)
- Bet rows: `tbody.valuebet_record`
- Button container: `td .d-flex` (first cell)
- Bookmaker: `.booker a` text
- Sport: `.booker .minor` text
- Event: `.event a` text
- Tournament: `.event .minor` text
- Market: `.coeff abbr` full text content (includes lay suffix)
- Time: `.time abbr[data-utc]` attribute

### Message Passing Pattern
```javascript
// Always return true for async sendResponse
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'asyncAction') {
    (async () => {
      try {
        const result = await doWork();
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true; // Keep channel open
  }
});
```

### EV vs P/L Tracking
- **Total EV**: Sum of all bets (pending + settled) — theoretical edge
- **Expected (Settled)**: Sum of EV for settled bets only
- **vs Expected**: Actual P/L minus Expected (Settled) — variance tracking
- Chart shows cumulative EV (blue) vs cumulative actual P/L (green/red)

### Market Type Detection
- **Over/Under**: Regex `/(\d+\.?\d*)/` extracts threshold, checks `homeScore + awayScore`
- **1X2**: Keywords `home`/`away`/`draw` or standalone `1`/`2`/`x` (exclude `1st`, `2nd`)
- **Handicap**: Regex `/ah([12])\(([+-]?\d+\.?\d*)\)/i` extracts team + value
- **Lay bets**: Suffix `"- lay"` inverts boolean outcome

### Retry Backoff Schedule
- Attempt 1: 30 min after event ends (2.25hr after eventTime)
- Attempt 2: +1 hour
- Attempt 3: +2 hours
- Attempt 4: +4 hours
- Attempt 5: +8 hours
- After 5: Manual settlement required

## Testing Checklist
1. Load extension → verify no console errors
2. Visit surebet.com/valuebets → confirm 💾 buttons appear
3. Click save → enter stake → verify storage write
4. Open popup → confirm all fields render
5. Test status buttons (Won/Lost/Void) → verify P/L calculations
6. Export CSV → verify all columns including `expected_value`, `actual_pl`
7. Click "🔍 Check Results" → check console logs for API flow
8. Verify chart modal opens/closes correctly

## Extension Permissions Explained
- `storage`: Persistent bet data via `chrome.storage.local`
- `downloads`: Export JSON/CSV files
- `activeTab`: Current page URL for bet records
- `alarms`: Hourly background result checking
- `notifications`: Alert user when auto-check finds results
- `<all_urls>`: API requests to sports data services

## Common Gotchas
- **MutationObserver**: Must check `node.nodeType === 1` before accessing `.classList` to avoid text node errors
- **CSV escaping**: Always wrap in quotes and double internal quotes — `"value with ""quotes"""`
- **API rate limits**: No retry after hitting quota — user must wait for reset (midnight UTC for API-Football, monthly for Odds API)
- **Canvas dimensions**: Set width/height attributes, not CSS — `<canvas width="700" height="450">`
- **Async sendResponse**: Must return `true` from message listener to keep channel open
- **Event timing**: API checks 2.25hr after eventTime, not after match finishes (assumes 90min+15min+30min)

## File Dependencies
- `background.js` loads `apiService.js` first (manifest scripts array order matters)
- `popup.html` loads `popup.js` (creates global `ApiService` instance)
- All files use `chrome.*` APIs (Firefox WebExtensions compatible)

## When Adding Features
- New bet fields: Update `parseRowData()` + popup render + CSV export headers
- New market types: Add detection + outcome logic in `apiService.js` `determineFootballOutcome()`
- New sports: Add to `sportMap` in `fetchOtherSportsResults()` + implement matching logic
- UI changes: Remember 520px popup width constraint, test in Firefox addon popup
