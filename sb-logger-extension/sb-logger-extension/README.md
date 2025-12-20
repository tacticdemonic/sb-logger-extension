# Surebet Helper — Firefox Extension for Surebet.com

## What it does
- **Auto-injects** a "💾 Save" button on every bet row on surebet.com/valuebets pages
- **Auto-fill stakes** (configurable): Automatically inputs calculated Kelly stakes into betting slips on Betfair, Smarkets, and Matchbook
- **Bookmaker filter presets**: Quick-apply preset bookmaker filters in the filter popup
- **Auto-captures** all bet details: bookmaker, event, market, odds, probability, overvalue
- **Prompts for stake** when you click Save
- **Tracks profit**: Automatically calculates potential return and profit
- **Expected Value (EV)**: Shows theoretical expected profit for each bet
- **Exchange commission**: Supports commission rates for Betfair, Betdaq, Matchbook, Smarkets
- **Bet settlement**: Mark bets as Won ✓, Lost ✗, or Void ○ with one click
- **Auto-check results**: Optionally configure free APIs to automatically check bet outcomes (see API Setup below)
- **Smart retries**: Waits 30 min after event ends, retries up to 5 times with exponential backoff
- **Running P/L**: Shows total profit/loss and ROI across all settled bets
- **Advanced Analysis**: Comprehensive dashboard with odds band performance, overvalue distribution, and sport breakdown
- **EV vs Actual**: Compare your actual results against expected value to track performance
- **Visual charts**: Interactive graph showing your P/L and Expected EV trends over time
- **Export & manage**: View all saved bets in popup, export to JSON/CSV, or clear all
- **Auto-Hide Bets**: Automatically hides bets on surebet.com immediately after saving them (configurable in Settings).
 - **Market Filters (On-site & Popup)**: Configure market-level filtering to hide or highlight types of markets both in the saved-bets popup and directly on surebet.com (e.g., Asian Handicap, DNB, Cards).

## Installation

### Chrome / Edge / Brave (Chromium-based browsers)
1. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`

2. Enable "Developer mode" (toggle in top-right corner)

3. Click "Load unpacked" and select the `surebet-helper-extension` folder

4. The extension is now permanently installed (persists across browser restarts)

### Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

2. Click "Load Temporary Add-on" and select the `manifest.json` file from the `surebet-helper-extension` folder
   - Note: In Firefox, temporary add-ons are removed when the browser restarts
   - For permanent installation in Firefox, you would need to sign the extension through Mozilla Add-ons

3. **For permanent Firefox installation**, package and sign the extension:
   ```bash
   # Install web-ext tool
   npm install -g web-ext
   
   # Build and sign (requires Mozilla account)
   cd surebet-helper-extension
   web-ext sign --api-key=YOUR_KEY --api-secret=YOUR_SECRET --channel=unlisted 
   ```
   - Get API credentials from: https://addons.mozilla.org/developers/addon/api/key/

## Try it
1. Visit **https://surebet.com/valuebets**
2. Each bet row will have a **💾 Save** button
3. **Filter presets**: Click the bookmaker filter to open the popup - you'll see two preset buttons at the top:
   - **⭐ My Normal List** - Apply your standard bookmaker selection
   - **🔄 Exchanges Only** - Filter to show only betting exchanges
4. Click Save on any bet, enter your stake amount
5. Open the extension popup (click toolbar icon) to see all saved bets
6. **Mark bets**: Click ✓ Won, ✗ Lost, or ○ Void buttons for each bet as they settle
7. **Track performance**: See your running P/L and ROI at the top of the popup
8. **View Chart**: Click 📊 View Chart to see a visual graph of your P/L vs Expected EV over time
9. Use **Export JSON** or **Export CSV** to download, or **Clear All** to delete
 
## Market Filters (on-site)

You can now configure Market Filters under the extension **⚙️ Settings → Market Filters**. Market filters support both **Hide** and **Highlight** modes and are applied to both:

- Saved Bets Popup — hides or highlights saved bets by market type
- surebet.com valuebets page — hides or highlights rows in the valuebets table

Usage:
1. Click the extension icon → ⚙️ Settings → Market Filters
2. Choose a preset (Asian Handicap, DNB, Cards, Goals Only, Corners Only)
3. Set Mode: **Hide** (completely remove rows) or **Highlight** (red border/badge, see screenshot)
4. Reload the surebet.com/valuebets page to apply filters

Pattern matching notes:
- Abbreviations like `AH`, `AH1`, `AH2`, and `DNB` are matched using a lookahead regex to properly catch `AH2(+1.5)` and similar variations.
- Words like `Asian handicap` are matched using whole-word boundaries.
- The whitelist-first logic allows `Goals Only` and `Corners Only` to override blacklist presets.

This feature was added to allow you to continue browsing the surebet table while masking out market types you do not want to see, or to highlight them for an extra layer of caution.
   
  For debugging CSV import issues: you can export only pending (unsettled) bets from the extension settings: **⚙️ Settings → 🗑️ Data → 🐛 Debug Export → Export Pending Bets (JSON)**. This is useful when you want to reproduce an import parser issue or inspect unsettled data.
  
  New: The import page includes a `🐛 Report Match Issue` button that builds a pre-filled GitHub issue with a concise summary and a clipboard-copied JSON debug payload. See `CSV_IMPORT_ISSUE_REPORTING.md` for usage and privacy notes.

## Auto-Fill Stakes (Complete Feature - v1.0.37!)

The extension now fully implements automatic Kelly stake calculation and filling across all exchanges using a cross-origin broker pattern:

### How to use:
1. Click the extension icon and go to **⚙️ Auto-Fill** settings
2. Enable **"Enable automatic stake input on betting slip"**
3. Select which exchanges you want (Betfair, Smarkets, Matchbook, Betdaq)
4. When browsing surebet.com, **click a stake indicator** from your bet row (e.g., the stake amount)
5. You'll be redirected to the exchange betting slip
6. Your calculated Kelly stake will automatically populate on the betting slip

### How it works (Complete Pipeline):
1. **Stake indicator clicked** → Broker service stores bet data (in-memory + backup storage)
2. **Navigate to exchange** → Content script queries broker for pending bet
3. **Broker retrieves data** → Returns cached bet data from safe background context
4. **Kelly calculation** → Extension calculates optimal stake based on odds/probability
5. **Auto-fill stake** → Betting slip input receives calculated amount
6. **Validation** → Odds compared; warning shown if significantly changed
7. **Success notification** → User sees confirmation stake was filled
8. **You review & place** → You manually confirm odds and place the bet
9. **Fallback chain** → If broker unavailable: Storage → Document referrer → Parent frame

### Supported Exchanges:
- ✅ **Betfair** - Fully supported (v1.0+)
- ✅ **Smarkets** - Complete (v1.0.37: Broker + Kelly calculation)
- ✅ **Matchbook** - Fully supported (v1.0+)
- ✅ **Betdaq** - Fully supported (v1.0+)

### Settings:
- **Per-exchange toggle**: Enable/disable for each exchange individually
- **Disabled by default**: Must explicitly enable for safety
- **Timeout**: Waits up to 10 seconds for betting slip to appear
- **Odds Validation**: Warns if odds change after you clicked the bet

### Odds Validation ⚠️
The extension compares the odds from your surebet.com link with the current odds on the betting slip:
- If odds differ slightly (±0.01), auto-fill proceeds silently
- If odds change significantly, you'll see a warning notification but auto-fill still happens
- This helps you catch when odds have shifted before placing the bet

## What gets saved
Each bet record includes:
## Distribution Package
## Auto-Fill Stakes (Complete Feature)
To distribute the extension or prepare for Chrome Web Store submission:
### Recent Major Changes (v1.0.82.2)
```powershell
# PowerShell (Windows) - Create distribution ZIP
Compress-Archive -Path .\surebet-helper-extension\* -DestinationPath .\surebet-helper-extension.zip -Force
```

```bash
# Linux/Mac - Create distribution ZIP
cd surebet-helper-extension
zip -r ../surebet-helper-extension.zip . -x "*.git*" -x "*node_modules*"
```

### Chrome Web Store Publishing
1. Create a developer account at https://chrome.google.com/webstore/devcenter/
2. Pay one-time $5 registration fee
3. Upload the ZIP file created above
4. Fill in store listing details (description, screenshots, etc.)
5. Submit for review (usually approved within a few days)

### Firefox Add-ons Publishing
1. Create an account at https://addons.mozilla.org/
2. Submit your extension for review at https://addons.mozilla.org/developers/
3. Choose self-distribution or listed in Mozilla Add-ons store
4. Review process typically takes a few days= (Probability% / 100 × Stake × Odds) - ((1 - Probability% / 100) × Stake)
```

**Example:** Stake 10 at odds 2.5 with 41.51% probability:
```
EV = (0.4151 × 10 × 2.5) - (0.5849 × 10)
EV = 10.3775 - 5.849 = +4.53
```

### Summary Bar Metrics:
- **Total EV**: Sum of EV for ALL bets (pending + settled) - your theoretical expected profit
- **P/L**: Actual profit/loss for settled bets only
- **Expected (Settled)**: Sum of EV for settled bets only
- **vs Expected**: Difference between actual P/L and expected (settled bets)

### What This Means:
- **Total EV** tracks your overall edge - if positive, your bets have theoretical value
- **vs Expected** shows if you're running lucky (+) or unlucky (-)
- Over 100+ bets, actual should approach expected if probabilities are accurate

## Package (PowerShell — Windows)
```powershell
# Run in the parent folder to create a zip:
Compress-Archive -Path .\surebet-helper-extension\* -DestinationPath .\surebet-helper-extension.zip -Force
```

## Technical details
- `manifest.json` - Manifest V3 configuration (compatible with Chrome, Edge, Brave, and modern Firefox)
- `contentScript.js` - Site-specific injection for surebet.com (parses DOM/JSON data)
- `background.js` - Service worker that handles export downloads, bet clearing, and auto-checking results
- `apiService.js` - ES module for sports result lookups via external APIs
- `popup.html` + `popup.js` - Display saved bets with rich formatting, charts, and management tools
- Uses `chrome.storage.local` for persistence across browser sessions
- MutationObserver monitors for dynamically added bet rows on surebet.com
- Alarm API schedules hourly automatic result checking

## API Setup (Optional - Automatic Result Checking)

The extension can automatically check bet results using free sports APIs. This is completely optional - you can still settle bets manually if you prefer.

### Features:
- **30-Minute Delay**: Only checks results 30 minutes after event ends
- **Smart Retries**: Maximum 5 attempts with exponential backoff (1hr, 2hr, 4hr, 8hr, 24hr)
- **Graceful Failure**: After 5 failed attempts, bet stays pending for manual settlement
- **Hourly Background Checks**: Automatically checks eligible pending bets
- **Manual Check Button**: Use "🔍 Check Results" button anytime

### Supported APIs:
- **API-Football** (for football/soccer) - 100 requests/day free
- **The Odds API** (for other sports) - 500 requests/month free

### Supported Markets:
- **Football/Soccer**: 1X2, Over/Under goals, Asian Handicap, Cards, Lay bets
- **Other Sports**: Tennis, Basketball, American Football, Ice Hockey, Baseball

### Setup Instructions:
See **[API_SETUP.md](API_SETUP.md)** for detailed step-by-step instructions on:
1. Getting free API keys
2. Configuring the extension
3. Testing automatic result checking
4. Troubleshooting

**Note:** API setup is optional. If you don't configure APIs, you can still settle bets manually using the Won/Lost/Void buttons.

## Bookmaker Filter Presets

The extension adds two quick-filter buttons at the top of the bookmaker filter popup:

### Preset Configuration
Edit the `BOOKMAKER_PRESETS` object in `contentScript.js` to customize your presets:

```javascript
const BOOKMAKER_PRESETS = {
  normal: [
    '10Bet', '888sport', 'Bet365', 'Betfair', 'Betway', 
    'Bwin', 'Ladbrokes', 'Paddy Power', 
    'Unibet', 'BetVictor', 'Betfred'
  ],
  exchanges: [
    'Betfair', 'Betdaq', 'Smarkets', 'Matchbook'
  ]
};
```

### Matching Rules
- **"Betfair"** matches only "Betfair 5%" (main version without country code)
- **"Betfair (AU)"** matches only "Betfair (AU) 5%" (Australian version)
- **"Betfair (IT)"** matches only "Betfair (IT) 5%" (Italian version)
- Country-specific versions are automatically excluded unless explicitly specified

This ensures you only select the exact bookmaker versions you want, without accidentally selecting all regional variants.

## Next steps
- Test on surebet.com/valuebets
- Customize your bookmaker presets in `contentScript.js`
- Verify all fields are captured correctly
- (Optional) Set up free APIs for automatic result checking - see [API_SETUP.md](API_SETUP.md)
- Try exporting CSV to validate data structure
- Consider adding filters/search in popup for large bet lists

---

## Contributing DOM Structures for New Exchanges

We rely on community contributions for maintaining accurate DOM selectors for exchange betting slips. To make it easy, we've added a helper script and a GitHub issue template you can use when submitting a new exchange or fixing selectors.

### Quick & Recommended (Best) Way — Use the Console Helper Script

1. Open the betting slip for the exchange you want to support (e.g., Betfair) in your browser.
2. Open DevTools (F12) → Console.
3. Copy the helper script from `tools/collect_betslip_info.js` in this repo and paste it into the Console, then press Enter.
   - The script will collect visible stake inputs, betting slip containers, and relevant data attributes.
   - It will copy a JSON payload to your clipboard containing the page URL, detected inputs, container HTML, data attributes, and your user agent.
4. Create a new GitHub issue using the **Add Exchange Support** template (click "New issue" → "Add Exchange Support") and paste the copied JSON into the "Console output" field.

#### Bookmarklet (one-click issue creation)

If you prefer a one-click approach, use our bookmarklet generator to create a bookmark that collects the necessary JSON and opens a prefilled GitHub issue:

1. Open `surebet-helper-extension/tools/create_issue_bookmarklet.js` in this repo and copy the single `javascript:(function(){...})();` string printed by the script.
2. Create a new browser bookmark, paste the string into the bookmark URL.
3. When on an exchange's betting slip, click the bookmark to auto-collect DOM data and open a new GitHub issue with the JSON and HTML prefilled.

Note: If the collected JSON is too large, the issue page will open with empty fields and you'll be prompted to paste the JSON manually.

### Manual Alternative

If you prefer to do this manually, or the helper script doesn’t run, follow these steps:

1. **Navigate to the betting slip** on the exchange you want to support.
2. **Open DevTools** (F12 on most browsers).
3. **Run the diagnostic snippet** in the Console tab to identify key elements:

```javascript
// Find betting slip containers
console.log('=== BETTING SLIP CONTAINERS ===');
document.querySelectorAll('[class*="slip"], [class*="bet"], [class*="order"], [class*="panel"], .betslip-container').forEach(el => {
  if (el.className && el.offsetHeight > 50) {
    console.log('Container:', el.className, el);
  }
});

// Find all stake inputs (numbers, text fields, or Betfair-style inputs)
console.log('\n=== STAKE INPUT FIELDS ===');
document.querySelectorAll('input[type="number"], input[type="text"], input.betslip-size-input, input[bf-number-restrict]').forEach(el => {
  if (el.offsetHeight > 0) {
    console.log('Input:', {
      type: el.type || '',
      className: el.className || '',
      placeholder: el.placeholder || '',
      name: el.name || '',
      id: el.id || '',
      value: el.value || '',
      parent: el.parentElement?.className || ''
    }, el);
  }
});

// Data attributes useful for building selectors
console.log('\n=== DATA ATTRIBUTES ===');
document.querySelectorAll('[data-test], [data-testid], [data-test-id]').forEach(el => {
  if (el.offsetHeight > 0) {
    console.log('Data:', el.dataset, el);
  }
});
```

4. **Right-click the stake input field** → Inspect Element, then copy the HTML for that input element and at least 2–3 parent levels up. Include all class names and data attributes.
5. **Create a new GitHub issue** using the Add Exchange Support template and include:
   - Exchange name and domain
   - Browser and OS used for testing
   - Copied JSON from the helper script (preferred) or the console output
   - Full HTML of the stake input and parent containers
   - Screenshot showing the input in the betting slip (recommended)

### Example Submission

When opening an issue, the template will prompt you for the required fields. Here's an example:

```markdown
## Add Support for Betdaq

**Console JSON:**
```
{ "url":"https://...", "timestamp":"...", "inputs":[{...}], "containers":[...], "dataAttributes":[...], "userAgent":"..." }
```

**HTML Structure:**
```html
<div class="betting-slip__container">
  <div class="betting-slip__form">
    <input type="text" class="input-field stake-input" placeholder="Enter stake">
  </div>
</div>
```

**Browser:** Firefox 120 on Windows

**Screenshot:** [attach screenshot]
```

### What Happens Next

1. A developer will review your issue.
2. We’ll add or refine selectors in `BETTING_SLIP_SELECTORS` in `contentScript.js`.
3. We’ll test and commit changes in an upcoming release.
4. You're credited in `UPGRADE_NOTES.md` if you wish to be.

### Maintainer checklist (for devs)

- Add new selectors to `BETTING_SLIP_SELECTORS` in `contentScript.js` using the same pattern as other exchanges (specific selectors first, fallbacks last).
- Verify the selector doesn't match elements inside `.surebet-helper-stake-panel` and that `findElement()` will skip our UI components.
- Use `tools/collect_betslip_info.js` to reproduce the issue and confirm the selector targets the correct input on desktop and mobile viewports.
- Test auto-fill by enabling the Auto-Fill feature and reproducing the save → redirect flow from surebet.com to the exchange.
- Commit and reference the issue in the PR description for traceability.

### Developer tools

In `surebet-helper-extension/tools` you'll find two helper utilities:
- `collect_betslip_info.js` — paste into an exchange betting slip console to collect DOM data (JSON copied to clipboard)
- `bookmarklet-demo.html` — a demo page that provides a bookmarklet string and instructions for creating a one-click issue bookmarklet

We recommend using the bookmarklet for quick issue creation and the console helper when you need the full JSON payload for maintainers.

### Why This Helps

- Auto-fill is more reliable with precise selectors.
- Sites change frequently; community contributions help keep support working.
- You get faster support for sites you use often.

---

Thank you for helping us keep Surebet Helper working across exchanges!



