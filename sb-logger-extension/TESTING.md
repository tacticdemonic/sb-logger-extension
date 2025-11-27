# Testing Guide for Surebet Helper Extension

## Quick Start Testing

### 1. Load Extension in Firefox
1. Open Firefox
2. Navigate to: `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Browse to: `d:\Local\Surebet Helper\surebet-helper-extension\`
5. Select `manifest.json`
6. Extension should load successfully

### 2. Test on Surebet.com
1. Navigate to: `https://surebet.com/valuebets`
2. **Expected**: Each bet row (tbody.valuebet_record) should have a "💾 Save" button
3. Click any **💾 Save** button
4. **Expected**: Prompt asking for stake amount appears
5. Enter a test amount (e.g., "100")
6. Enter stake when prompted
7. **Expected**: Alert confirms bet was saved

### 3. View Saved Bets
1. Click the extension icon in Firefox toolbar (Surebet logo)
2. **Expected**: Popup opens showing saved bets
3. **Verify these fields are displayed**:
   - Timestamp
   - Bookmaker name (e.g., Bet365, Unibet)
   - Sport
   - Event name
   - Tournament
   - Market (e.g., "Home", "Over 2.5")
   - Odds value
   - Probability %
   - Overvalue %
   - Stake amount (what you entered)
   - Potential return (stake × odds)
   - Profit (potential - stake)

### 4. Test Bet Settlement
1. In the popup, find a bet with status "⋯ PENDING"
2. Click **"✓ Won"** button
3. **Expected**: 
   - Button disappears
   - Status changes to "✓ WON" (green badge)
   - P/L shows positive profit (green)
   - Running P/L at top updates
4. Save another test bet, then click **"✗ Lost"**
5. **Expected**:
   - Status changes to "✗ LOST" (red badge)
   - P/L shows negative stake amount (red)
   - Running P/L decreases
6. Save another test bet, then click **"○ Void"**
7. **Expected**:
   - Status changes to "○ VOID" (gray badge)
   - P/L shows 0.00
   - Running P/L unchanged

### 5. Test Expected Value (EV)
1. Look at any bet in the popup
2. **Verify EV is displayed** after P/L in blue text
3. **Expected calculation**: EV = (Prob% / 100 × Stake × Odds) - ((1 - Prob% / 100) × Stake)
4. Example: 
   - Stake: 10, Odds: 2.52, Prob: 41.72%
   - EV = (0.4172 × 10 × 2.52) - (0.5828 × 10) = 10.51 - 5.83 = +4.68

### 6. Test Running Totals
1. After settling some bets, check the summary bar at top of popup
2. **Verify first row displays**:
3. **Verify first row displays**:
   - Total Staked: sum of all stakes
   - Settled: count of won/lost/void bets vs total (calculated from the current filtered view — e.g., when "Pending Only" is checked the settled count will reflect visible bets only)
   - P/L: running profit/loss (green if positive, red if negative)
   - ROI %: (P/L / Total Staked) × 100
4. **Filter-specific test**
   1. Toggle the **Pending Only** checkbox to show only pending bets
   2. **Expected**: The "Settled" count shows the number of settled bets among visible bets (e.g., "0/X" if there are no settled bets in the filtered view)
3. **Verify second row displays** (only if bets settled):
   - Expected P/L: sum of all EV values for settled bets (blue)
   - vs Expected: difference between actual and expected (green if better, red if worse)

### 7. Test Chart Visualization
1. In the popup, click **"📊 View Chart"**
2. **Expected**: Modal overlay appears with chart
3. **Verify chart shows**:
   - Blue line: Cumulative Expected EV (all bets)
   - Green/Red line: Cumulative Actual P/L (settled bets only)
   - Zero line (dashed horizontal)
   - X-axis: Number of bets
   - Y-axis: Profit/Loss amount
   - Legend showing both lines
   - Final values in top right corner
4. **Test interactions**:
   - Click X button to close
   - Click dark background to close
   - Chart should update when you settle more bets and reopen

### 8. Test Export
1. In the popup, click **"Export CSV"**
2. **Expected**: CSV file downloads with filename like `surebet-bets-2024-01-15-12-30-45.csv`
3. Open the CSV in Excel or text editor
4. **Verify**: All fields including expected_value, status, settled_at, actual_pl are present
5. **Check EV column**: Should show calculated expected value for each bet

6. Click **"Export JSON"**
7. **Expected**: JSON file downloads
8. Open the JSON file
9. **Verify**: Valid JSON array with bet objects including status field

### 9. Test Clear All
1. In the popup, click **"Clear All"**
2. **Expected**: Confirmation dialog appears
3. Confirm the action
4. **Expected**: All bets are removed and popup shows "No bets saved yet"

### 10. Test Analysis Dashboard
1. In the popup, click the **"Analysis"** tab (chart icon)
2. **Expected**: Dashboard view opens with "Summary Statistics" at the top
3. **Verify Summary Stats**:
   - 9 metric cards displayed (Yield, Profit Factor, Turnover, etc.)
   - Values match your settled bets
   - Color coding works (Green for positive, Red for negative)
4. **Test Performance Tab**:
   - Click **"Performance"** sub-tab
   - **Expected**: Three analysis sections appear (Odds Bands, Overvalue, Sport)
   - **Verify Charts**:
     - Odds Band: Horizontal bars showing ROI%
     - Overvalue: Vertical histogram showing distribution
     - Sport: Horizontal bars ranked by profitability
   - **Verify Tables**:
     - Data matches charts
     - "Significance" indicators (opacity) for rows with <20 bets
     - Deviation column shows +/- % difference
5. **Test Interactions**:
   - Hover over chart bars to see tooltips (if implemented) or values
   - Switch back to "Bets" tab and verify state is preserved

## What to Check

### contentScript.js
- ✅ Buttons appear on each bet row
- ✅ Buttons only appear on surebet.com
- ✅ MutationObserver handles dynamically loaded rows
- ✅ Stake prompt accepts numeric input
- ✅ Stake prompt works
- ✅ Data extraction captures all fields correctly

### popup.js
- ✅ Displays bet list with all fields
- ✅ Shows calculated potential return
- ✅ Shows calculated profit
- ✅ Status badges display correctly (pending/won/lost/void)
- ✅ Won/Lost/Void buttons appear on pending bets
- ✅ Status buttons update bet status
- ✅ Running totals calculate correctly
- ✅ ROI percentage displays
- ✅ Hover highlights rows
- ✅ Export buttons work (with status columns)
- ✅ Clear All removes all bets

### analysis.js & analysis.html
- ✅ Summary stats calculate correctly
- ✅ Performance charts render without errors
- ✅ Canvas elements resize correctly
- ✅ Significance indicators (opacity) work for small samples
- ✅ Deviation calculations are correct
- ✅ Tab switching works smoothly

### background.js
- ✅ Export creates downloadable files
- ✅ CSV format is correct (quoted fields, proper escaping)
- ✅ JSON format is valid
- ✅ Clear action works

## Common Issues

### Buttons don't appear
- Check console (F12) for errors
- Verify you're on surebet.com domain
- Check if tbody.valuebet_record elements exist
- Try refreshing the page

### Data not captured correctly
- Inspect the HTML structure to verify selectors match
- Check console for parsing errors
- Verify data-value, data-probability, data-overvalue attributes exist

### Export fails
- Check if downloads permission is granted
- Look for errors in background script console (about:debugging)
- Verify chrome.downloads API is available

### Extension won't load
- Verify manifest.json is valid JSON
- Check that all file paths in manifest are correct
- Ensure icons exist in icons/ folder

## Console Logging
All scripts have console.log statements. Open developer tools (F12) to see:
- `[Surebet Helper]` messages from contentScript.js
- Background script logs in about:debugging > Inspect

## Reload After Changes
After editing any file:
1. Go to `about:debugging`
2. Find Surebet Helper extension
3. Click **"Reload"**
4. Refresh the surebet.com page



