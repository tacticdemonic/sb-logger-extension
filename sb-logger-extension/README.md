# SB Logger — Firefox Extension for Surebet.com

## What it does
- **Auto-injects** a "💾 Save" button on every bet row on surebet.com/valuebets pages
- **Auto-captures** all bet details: bookmaker, event, market, odds, probability, overvalue
- **Prompts for stake** and optional note when you click Save
- **Tracks profit**: Automatically calculates potential return and profit
- **Expected Value (EV)**: Shows theoretical expected profit for each bet
- **Bet settlement**: Mark bets as Won ✓, Lost ✗, or Void ○ with one click
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
3. Click it, enter your stake amount (and optional note)
4. Open the extension popup (click toolbar icon) to see all saved bets
5. **Mark bets**: Click ✓ Won, ✗ Lost, or ○ Void buttons for each bet as they settle
6. **Track performance**: See your running P/L and ROI at the top of the popup
7. **View Chart**: Click 📊 View Chart to see a visual graph of your P/L vs Expected EV over time
8. Use **Export JSON** or **Export CSV** to download, or **Clear All** to delete

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

## Next steps
- Test on surebet.com/valuebets
- Verify all fields are captured correctly
- Try exporting CSV to validate data structure
- Consider adding filters/search in popup for large bet lists
