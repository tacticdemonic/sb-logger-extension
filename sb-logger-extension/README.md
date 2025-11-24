# SB Logger — Firefox Extension for Surebet.com

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
- **EV vs Actual**: Compare your actual results against expected value to track performance
- **Visual charts**: Interactive graph showing your P/L and Expected EV trends over time
- **Export & manage**: View all saved bets in popup, export to JSON/CSV, or clear all

## Installation

### Chrome / Edge / Brave (Chromium-based browsers)
1. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`

2. Enable "Developer mode" (toggle in top-right corner)

3. Click "Load unpacked" and select the `sb-logger-extension` folder

4. The extension is now permanently installed (persists across browser restarts)

### Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

2. Click "Load Temporary Add-on" and select the `manifest.json` file from the `sb-logger-extension` folder
   - Note: In Firefox, temporary add-ons are removed when the browser restarts
   - For permanent installation in Firefox, you would need to sign the extension through Mozilla Add-ons

3. **For permanent Firefox installation**, package and sign the extension:
   ```bash
   # Install web-ext tool
   npm install -g web-ext
   
   # Build and sign (requires Mozilla account)
   cd sb-logger-extension
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
- **Timestamp** - When you saved it
- **Bookmaker** - Betting site (e.g., Bet365, Unibet)
- **Sport** - Sport type
- **Event** - Match/game name
- **Tournament** - League/competition
- **Market** - Bet type (e.g., "Home", "Over 2.5")
- **Odds** - Decimal odds value
- **Probability** - Calculated probability %
- **Overvalue** - Value edge %
- **Stake** - Your bet amount (manual entry)
- **Potential Return** - Stake × Odds
- **Profit** - Potential Return - Stake
- **Expected Value (EV)** - (Win Probability × Win Amount) - (Lose Probability × Stake)
- **Status** - Pending/Won/Lost/Void
- **Settled At** - When you marked the bet as settled
- **Actual P/L** - Real profit/loss after settlement
- **Note** - Optional personal note
- **URL** - Link back to the page
## Distribution Package

To distribute the extension or prepare for Chrome Web Store submission:

```powershell
# PowerShell (Windows) - Create distribution ZIP
Compress-Archive -Path .\sb-logger-extension\* -DestinationPath .\sb-logger-extension.zip -Force
```

```bash
# Linux/Mac - Create distribution ZIP
cd sb-logger-extension
zip -r ../sb-logger-extension.zip . -x "*.git*" -x "*node_modules*"
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
Compress-Archive -Path .\sb-logger-extension\* -DestinationPath .\sb-logger-extension.zip -Force
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

The auto-fill feature works by matching CSS selectors to HTML elements on betting slip pages. If you want to add support for a new exchange or fix selectors for an existing one, you can help by contributing DOM structure information!

### How to Contribute:

1. **Navigate to the betting slip** on the exchange you want to support
2. **Open browser DevTools** (F12 on most browsers)
3. **Run this diagnostic script** in the Console tab:

```javascript
// Find betting slip containers
console.log('=== BETTING SLIP CONTAINERS ===');
document.querySelectorAll('[class*="slip"], [class*="bet"], [class*="order"], [class*="panel"]').forEach(el => {
  if (el.className && el.offsetHeight > 50) {
    console.log('Container:', el.className, el);
  }
});

// Find all number/text inputs
console.log('\n=== STAKE INPUT FIELDS ===');
document.querySelectorAll('input[type="number"], input[type="text"]').forEach(el => {
  if (el.offsetHeight > 0) {
    console.log('Input:', {
      type: el.type,
      className: el.className,
      placeholder: el.placeholder,
      name: el.name,
      id: el.id,
      value: el.value,
      parent: el.parentElement?.className
    }, el);
  }
});

// Find data attributes
console.log('\n=== DATA ATTRIBUTES ===');
document.querySelectorAll('[data-test], [data-testid], [data-test-id]').forEach(el => {
  if (el.offsetHeight > 0) {
    console.log('Data:', el.dataset, el);
  }
});
```

4. **Right-click the stake input field** → Inspect Element, then copy the full HTML:
   - Copy the input element and at least 3 parent levels up
   - Include all class names and data attributes

5. **Create a GitHub issue** or email with:
   - Exchange name (e.g., "Betdaq")
   - Console output from the script above
   - Full HTML structure of the stake input
   - Screenshot showing where the input appears on the page
   - Browser/OS you tested on

### Example Submission:

```markdown
## Add Support for Betdaq

**Console Output:**
```
=== BETTING SLIP CONTAINERS ===
Container: betting-slip__container ...

=== STAKE INPUT FIELDS ===
Input: {
  type: "text",
  className: "input-field stake-input",
  placeholder: "Enter stake",
  ...
}
```

**HTML Structure:**
```html
<div class="betting-slip__container">
  <div class="betting-slip__form">
    <input type="text" class="input-field stake-input" placeholder="Enter stake">
  </div>
</div>
```

**Screenshot:** [attach image]
**Browser:** Firefox 120 on Windows
```

### What Happens Next:

1. Developer reviews your submission
2. Selectors are added to `BETTING_SLIP_SELECTORS` in `contentScript.js`
3. Auto-fill feature is tested with your selectors
4. Exchange support is added to the next release
5. You're credited in UPGRADE_NOTES.md

### Current Selector Status:

```javascript
BETTING_SLIP_SELECTORS = {
  betfair: { ... },        // ✅ Tested & working
  smarkets: { ... },       // ✅ Tested & working (v1.0.29+)
  matchbook: { ... },      // ✅ Tested & working
  betdaq: { ... }          // ⚠️  Needs updating/testing
}
```

### Why This Helps:

- Auto-fill is more reliable with precise selectors
- Exchange websites update their HTML regularly
- Community contributions keep selectors current
- New exchanges can be supported faster
- Your betting experience improves!
