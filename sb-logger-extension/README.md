# SB Logger — Firefox Extension for Surebet.com

## What it does
- **Auto-injects** a "💾 Save" button on every bet row on surebet.com/valuebets pages
- **Bookmaker filter presets**: Quick-apply preset bookmaker filters in the filter popup
- **Auto-captures** all bet details: bookmaker, event, market, odds, probability, overvalue
- **Prompts for stake** and optional note when you click Save
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

## Install locally (Firefox)
1. Icons are already generated in the `icons` subfolder (icon48.png, icon96.png)

2. In Firefox, open `about:debugging#/runtime/this-firefox`

3. Click "Load Temporary Add-on" and select the `manifest.json` file from this folder
   - The extension loads temporarily (reloads on browser restart unless packaged)

## Try it
1. Visit **https://surebet.com/valuebets**
2. Each bet row will have a **💾 Save** button
3. **Filter presets**: Click the bookmaker filter to open the popup - you'll see two preset buttons at the top:
   - **⭐ My Normal List** - Apply your standard bookmaker selection
   - **🔄 Exchanges Only** - Filter to show only betting exchanges
4. Click Save on any bet, enter your stake amount (and optional note)
5. Open the extension popup (click toolbar icon) to see all saved bets
6. **Mark bets**: Click ✓ Won, ✗ Lost, or ○ Void buttons for each bet as they settle
7. **Track performance**: See your running P/L and ROI at the top of the popup
8. **View Chart**: Click 📊 View Chart to see a visual graph of your P/L vs Expected EV over time
9. Use **Export JSON** or **Export CSV** to download, or **Clear All** to delete

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

## Understanding Expected Value (EV)
The extension calculates EV for each bet using:
```
EV = (Probability% / 100 × Stake × Odds) - ((1 - Probability% / 100) × Stake)
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
- `manifest.json` - Firefox-compatible configuration
- `contentScript.js` - Site-specific injection for surebet.com (parses DOM/JSON data)
- `background.js` - Handles export downloads and clearBets action
- `popup.html` + `popup.js` - Display saved bets with rich formatting
- Uses `chrome.storage.local` for persistence
- MutationObserver monitors for dynamically added bet rows

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
