# Surebet Helper - AI Development Instructions

## Project Overview
A Manifest V3 browser extension for tracking value bets from surebet.com. Core features: save bets with one click, auto-fill stakes on betting exchanges, auto-check results via sports APIs, visualize P/L trends, and export data.

## Architecture & Key Components

### Core Data Flow
1. **Content Script** (`contentScript.js`) - Injects UI into surebet.com, captures bet data, handles auto-fill on exchanges
2. **Background Service Worker** (`background.js`) - Exports/downloads, auto-checks results via scheduled tasks, manages cross-tab communication
3. **Popup UI** (`popup.html/js`) - Extension popup showing saved bets, P/L summary, settings panels (Commission, Rounding, Auto-Fill)
4. **API Service** (`apiService.js`) - Sports result checking via API-Football and The Odds API with caching

### Storage Architecture
- **Extension Storage**: Uses `chrome.storage.local` for persistent bet data and settings (shared across content scripts and background)
- **Async Communication**: Content script and background communicate via `chrome.runtime.sendMessage/onMessage`
- **Cross-Origin Handling**: Bet data transferred between surebet.com and exchange domains via in-memory `global_pendingBetCache` broker (see background.js line 5)

### Key Data Structures
```javascript
// Bet object (saved to storage)
{
  id: timestamp,
  timestamp: Date.now(),
  bookmaker: "Bet365",
  sport: "Football",
  event: "Manchester City vs Liverpool",
  odds: 1.95,
  probability: 51.28,
  stake: 10,
  overvalue: 2.5,
  potentialReturn: 19.50,
  profit: 9.50,
  expectedValue: 0.25,
  status: "pending|won|lost|void",
  isLay: false,
  note: "Optional user note",
  url: "https://surebet.com/valuebets..."
}

// Settings object
{
  commission: { betfair: 5, betdaq: 2, matchbook: 1, smarkets: 2 },
  rounding: { enabled: false, increment: 0.50 },
  autofill: { enabled: true, bookmakers: { betfair: true, smarkets: true } }
}
```

## Critical Patterns & Workflows

### Auto-Fill Workflow (Stakes on Betting Exchanges)
1. **User clicks stake link** on surebet.com → `clickHandlers.surebetLink` stores bet in `chrome.storage.local` with verification logging
2. **Navigation occurs** to exchange (Betfair/Smarkets/Matchbook)
3. **Exchange domain** content script calls `getSurebetDataFromReferrer()` to retrieve stored bet
4. **Exchange selectors** find betting slip inputs using `BETTING_SLIP_SELECTORS` map (different for each exchange - see contentScript.js lines 65-115)
5. **Stakes auto-fill** with exponential backoff for SPA (Single Page App) detection via `MutationObserver`

**Key Quirk**: Smarkets requires special handling with increased retry delays (250ms vs 150ms for Betfair) - see `IMPLEMENTATION_GUIDE.md` Scenario 3.

### Bet Settlement Calculation
- **Won bets**: `(stake × odds) - stake - commission`
- **Lay bets**: `stake - commission` (different from back bets)
- **Commission deducted from wins only**, via `getCommissionFromMap()` in background.js
- **Expected Value**: `(win_prob × potential_return) - (lose_prob × stake)`

### Result Auto-Checking
- **Background alarm**: Checks pending bets hourly (`chrome.alarms` API)
- **30-minute event delay**: Only queries APIs 30 minutes after event ends
- **Retry strategy**: Up to 5 attempts with exponential backoff (1hr, 2hr, 4hr, 8hr, 24hr)
- **Two APIs**: API-Football (100/day, soccer) + The Odds API (500/month, other sports)
- **Caching**: 10-minute in-memory cache prevents duplicate API calls

### UI Settings Panels
Three modal panels in popup for configuration:
- **Commission**: Exchange commission rates (per-exchange override)
- **Rounding**: Auto-round new stakes to nearest increment (e.g., £0.50)
- **Auto-Fill**: Toggle auto-stake input, select exchanges (Betfair/Smarkets/Matchbook)

## Development Workflows

### Loading Extension for Testing
```powershell
# Chrome/Edge/Brave:
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode" (top-right)
# 3. Click "Load unpacked"
# 4. Select: c:\Local\Surebet Helper\surebet-helper-extension\surebet-helper-extension

# Firefox:
# 1. Navigate to about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on"
# 3. Select: manifest.json in surebet-helper-extension folder
```

### Testing Auto-Fill
1. Open DevTools (F12) on surebet.com
2. LEFT-CLICK (not right-click) stake indicator for target exchange
3. Check console for storage verification logs (key: "Storage verification PASSED")
4. Navigate to exchange, check retrieval logs in console
5. Verify stakes auto-fill in betting slip

### Debugging Storage Issues
- `chrome.storage.local` is key-value pair storage, not a database
- Each content script has same storage access - beware race conditions on multi-tab
- Storage persists across browser restarts but cleared on extension unload
- Check `IMPLEMENTATION_GUIDE.md` for diagnostic logging patterns

### Commission Rates (in percentage)
- **Betfair**: 5% (default)
- **Betdaq**: 2% (default)  
- **Matchbook**: 1% (default)
- **Smarkets**: 2% (default)
- Stored as decimals (5.0) in background, percentages (5) in popup UI

## Project-Specific Conventions

### File Organization
```
surebet-helper-extension/
├── manifest.json           # Manifest V3 config (no background page, uses service worker)
├── contentScript.js        # 2985 lines: DOM injection, event handlers, exchange selectors
├── background.js           # 664 lines: exports, API calls, scheduled tasks
├── popup.html/js           # UI for saved bets list, settings, charts
├── apiService.js           # 505 lines: Sports API integration with caching
├── import.js               # Betfair P/L CSV import with player name matching
├── smarketssource.html     # Deprecated helper (legacy)
├── TESTING_GUIDE.md        # Installation verification steps
├── API_SETUP.md            # API key configuration instructions
└── icons/                  # 48x48 and 96x96 PNG icons
```

### Logging Conventions
- Content script logs prefix: `"Surebet Helper:"` (see contentScript.js line 102+)
- Background logs prefix: `"[Surebet Helper Background]"`
- API service logs: emojis for state (⚽ football, 🌐 network, 💾 cache, ❌ error)
- Use `console.log` (no logging library) - logs appear in extension DevTools

### Event Naming
- Bet statuses: `"pending" | "won" | "lost" | "void"` (lowercase strings)
- Commission keys: `"betfair" | "betdaq" | "matchbook" | "smarkets"` (lowercase)
- Storage keys: `"bets" | "settings" | "commission" | "autofill"` (camelCase, lowercase)

## External Dependencies & Integration Points

### No NPM/Build Dependencies
- Pure JavaScript (no webpack, no transpilation)
- Load as-is in browser
- Manual version bumps in manifest.json

### Browser APIs Used
- `chrome.storage.local` - Persistent data (abstraction: `chrome` or `browser`)
- `chrome.alarms` - Scheduled result checking (hourly)
- `chrome.runtime.sendMessage` - Cross-tab communication
- `chrome.downloads` - File exports (JSON/CSV)
- `chrome.notifications` - Bet settlement toasts
- `MutationObserver` - SPA betting slip detection

### Sports APIs (Optional)
- **API-Football** - v3.football.api-sports.io (soccer/football only)
- **The Odds API** - api.the-odds-api.com/v4 (multiple sports)
- Both require free API keys configured in `apiService.js` lines 5-17

## Common Tasks & Patterns

### Adding a New Betting Exchange
1. Add exchange name and selectors to `BETTING_SLIP_SELECTORS` map in contentScript.js (lines 65-115)
2. Implement stake placement logic in auto-fill function (find input, set value, trigger change event)
3. Add commission rate to `DEFAULT_COMMISSION_RATES` if needed (background.js line 16)
4. Test with DevTools open to debug selector issues
5. Use `MutationObserver` polling if SPA doesn't update input immediately

### Modifying Bet Data Schema
1. Update `BET_SCHEMA` comment in contentScript.js (around line ~800)
2. Add migration logic in background.js if adding required fields
3. Update popup.html table columns if adding visible fields
4. Update popup.js rendering logic to display new fields
5. Test import/export to ensure backwards compatibility

### Adding a New Settings Option
1. Add to popup.html with new input element and unique `id`
2. Add default value to `DEFAULT_*_SETTINGS` in contentScript.js
3. Add load handler in popup.js to read from storage
4. Add save handler to write to storage via `chrome.storage.local.set`
5. Pass setting to components that use it (e.g., stakes calculation, auto-fill logic)

## Manifest V3 Constraints

- **No background page**: Use service workers instead (background.js is async-only)
- **No inline scripts**: All JavaScript must be in separate files
- **Host permissions**: `<all_urls>` required for cross-domain auto-fill
- **Content scripts**: Run at `document_idle` per manifest.json line 80
- **Alarms API**: Used for hourly result checks (persists across browser sessions)

## Version History Reference
- **v1.0.82.2** (current): Latest stable version (see `surebet-helper-extension/manifest.json`)
- Latest web-ext build: check the `web-ext-artifacts/` folder for the most recent artifacts
- Previous: Auto-fill feature gradual rollout (v1.0.32-v1.0.37)

---

**Last Updated**: November 2025 | **Contact**: @tacticdemonic on GitHub


