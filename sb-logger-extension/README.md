# Surebet Helper — Browser Extension for Surebet.com

A powerful browser extension for tracking and analyzing value bets from surebet.com. Save bets with one click, automatically check results, visualize your P/L, and export your data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Edge-blue)](https://github.com/tacticdemonic/surebet-helper-extension)

---

## ✨ Features

### 🎯 Core Functionality
- **One-Click Save**: Auto-injected 💾 Save button on every bet row at surebet.com/valuebets
- **Smart Data Capture**: Automatically captures bookmaker, event, odds, probability, overvalue, and more
- **Stake Tracking**: Prompts for stake amount and optional notes when saving
- **Bet Settlement**: Mark bets as Won ✓, Lost ✗, or Void ○ with a single click

### 📊 Analytics & Dashboard
- **Full-Screen Analysis Tab** - Opens in dedicated tab with 6 views:
  - 📈 **P/L Chart** - Interactive profit/loss trend visualization
  - 💧 **Liquidity Tiers** - Analyze bets by limit stratification
  - 📊 **Bookmaker Profiling** - Performance breakdown by bookmaker
  - 📅 **Temporal Analysis** - Identify time-based patterns
  - 🎲 **Kelly Metrics** - Fill ratio vs recommended Kelly stakes
  - 📥 **Export** - JSON (with analysis) + CSV (27-column detail)
- **Real-Time P/L**: Updated automatically as bets settle
- **Expected Value (EV)**: Theoretical profit calculation for every bet
- **Performance Metrics**: ROI, win rate, average odds, and more

### 🤖 Automation
- **Auto-Fill Stakes**: Automatically inputs calculated Kelly stakes into betting slips on Betfair, Smarkets, and Matchbook (configurable, disabled by default)
- **Auto-Check Results**: Optional integration with free sports APIs (API-Football, The Odds API)
- **Smart Retries**: Waits 30 min after event ends, retries up to 5 times with exponential backoff
- **Hourly Background Checks**: Automatically checks eligible pending bets

### 🎲 Kelly Staking Configuration
- **Bankroll Management**: Set your starting bankroll and track current balance
- **Fractional Kelly**: Configure Kelly fraction (25% recommended for safety)
- **Commission Accounting**: Automatically adjust odds based on exchange commission when calculating stakes
- **Real-Time Summary**: View current bankroll, P/L, and status in Settings tab

### 🔧 Convenience Features
 - **Debug Logging & Export**: Per-bet debug logs are captured for auto-fill attempts (selector matches, timing, failures) and are included in pending-bets JSON exports for troubleshooting.

---

## 📸 Screenshots

> **Note**: Add your screenshots to the `screenshots/` folder to showcase the extension in action!

<!-- Uncomment when you add screenshots:
### Save Button on Surebet.com
![Save Button](screenshots/save-button.png)

### Extension Popup with Saved Bets
![Popup View](screenshots/popup-bets.png)

### P/L Chart Visualization
![Chart View](screenshots/chart-view.png)
-->

---

## 🚀 Installation

### Chrome / Edge / Brave (Chromium-based)

1. Download or clone this repository
2. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"** and select the `surebet-helper-extension` folder
5. The extension is now installed permanently

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on"** and select `manifest.json` from the `surebet-helper-extension` folder
   - **Note**: Temporary add-ons are removed when Firefox restarts
   - For permanent installation, see [Signing Guide](surebet-helper-extension/INSTALL.md)

---

## 📖 Usage

### Basic Workflow
1. **Visit** [surebet.com/valuebets](https://surebet.com/valuebets)
2. **Click** the 💾 Save button on any bet row
3. **Enter** your stake amount (and optional note)
4. **Edit**: When editing a bet, use the **To Lay / To Back** toggle in the edit modal to switch the bet type (immediate visual feedback is provided). Lay odds are handled properly even when editing.
4. **View** all saved bets by clicking the extension icon in your toolbar
5. **Settle bets** using the ✓ Won, ✗ Lost, or ○ Void buttons
6. **Analyze** your performance by clicking the 📊 Analysis button
7. **Export data** using the Analysis tab options

### Extension Popup (4 Buttons)
The minimal popup provides quick access to core features:

- **🔍 Check Results** - Manually trigger result checking (or wait for hourly auto-check)
- **📊 Analysis** - Opens full-screen analysis dashboard in new tab with 6 views
- **⚙️ Settings** - Opens settings page with 6 configuration sections
- **📥 Import** - Opens bulk import page for CSV/JSON files

### Analysis Dashboard (analysis.html)
Click **📊 Analysis** to open a dedicated tab with:

1. **📈 P/L Chart** - Interactive graph of your cumulative profit/loss
2. **💧 Liquidity Tiers** - Bets grouped and analyzed by limit stratification
3. **📊 Bookmaker Profiling** - Performance statistics per bookmaker
4. **📅 Temporal Analysis** - Time-based patterns and trends
5. **🎲 Kelly Metrics** - Fill ratio analysis (recommended vs actual stakes)
6. **📥 Export** - Download data as JSON (with analysis) or CSV (27 columns)

### Settings Tab (settings.html)
Click **⚙️ Settings** to configure 6 sections:

1. **💰 Commission** - Set exchange commission rates
2. **📏 Rounding** - Enable stake rounding to nearest increment
3. **⚡ Auto-Fill** - Configure exchanges for automatic stake input
4. **🎲 Kelly Staking** - Bankroll, Kelly fraction, and commission accounting
5. **🔑 API Setup** - Configure sports API keys for result checking
6. **🗑️ Data** - Clear all saved bets (with safety confirmation)

### Auto-Fill Stakes (Exchange Bets)
When enabled, the extension automatically fills in your calculated Kelly stake after clicking a bet link:

1. **Enable auto-fill** in Settings > ⚙️ Auto-Fill tab
2. **Select exchanges** you want to use (Betfair, Smarkets, Matchbook)
3. **Click a stake link** on surebet.com → your calculated stake will auto-populate on the betting slip
4. **Review and place** your bet on the exchange

**Supported Exchanges:**
- Betfair ✓
- Smarkets ✓
- Matchbook ✓ (Back bets, with React/data-hook selectors)

**Note**: Auto-fill requires the Surebet official plugin to find and add the bet first. Falls back to clipboard copy if auto-fill fails.

### Bookmaker Filter Presets

The extension adds quick-filter buttons to the bookmaker filter popup:
- **⭐ My Normal List** - Your standard bookmaker selection
- **🔄 Exchanges Only** - Filter to betting exchanges only

Customize these presets in `contentScript.js` by editing the `BOOKMAKER_PRESETS` object.

### Kelly Staking Configuration

Configure your staking strategy in Settings > 🎲 Kelly Staking:

1. **Starting Bankroll** - Your initial betting bank (automatically adjusted by P/L)
2. **Kelly Fraction (%)** - Percentage of full Kelly to stake (25% recommended)
3. **Commission Accounting** - Checkbox to adjust odds based on exchange commission

The Kelly Criterion calculates optimal bet sizes based on odds and probability. Your extension automatically:
- Calculates recommended stakes for every bet
- Displays stakes on surebet.com value bet rows
- Auto-fills stakes on betting exchanges (if enabled)
- Tracks actual vs recommended stakes in analysis

---

## ⚙️ Optional Features

### Auto-Fill Stakes on Betting Exchanges

Automatically populate betting slip stake fields after the Surebet plugin adds your bet:

1. Click **⚙️ Auto-Fill** in the popup settings
2. Enable **"Enable automatic stake input on betting slip"**
3. Select which exchanges to use (Betfair, Smarkets, Matchbook)
4. When you click a stake link from surebet.com, your calculated stake will auto-fill

**Features:**
- Waits for betting slip to appear after Surebet plugin finds the bet
- Automatically detects when stake input is ready
- Fills the correct stake input (handles back/lay bets)
- Shows confirmation toast notification
- Falls back to clipboard copy if auto-fill fails
- Disabled by default for safety

### Auto-Check Results

The extension can automatically verify bet results using free sports APIs. This is completely optional — manual settlement always works.

### Supported APIs
- **API-Football** (soccer/football) - 100 requests/day free
- **The Odds API** (multiple sports) - 500 requests/month free

### Setup Guide
See **[API_SETUP.md](surebet-helper-extension/API_SETUP.md)** for step-by-step instructions on:
- Getting free API keys
- Configuring the extension
- Testing automatic result checking

---

## 📊 What Gets Saved

Each bet record includes:
- **Timestamp** - When you saved it
- **Bookmaker** - Betting site (e.g., Bet365, Betfair)
- **Sport** - Sport type
- **Event** - Match/game name
- **Tournament** - League/competition
- **Market** - Bet type (e.g., "Home", "Over 2.5")
- **Odds** - Decimal odds value
- **Probability** - Calculated probability %
- **Overvalue** - Value edge %
- **Stake** - Your bet amount
- **Potential Return** - Stake × Odds
- **Profit** - Potential Return - Stake
- **Expected Value (EV)** - Theoretical expected profit
- **Status** - Pending/Won/Lost/Void
- **Settled At** - Settlement timestamp
- **Actual P/L** - Real profit/loss after settlement
- **Note** - Optional personal note
- **URL** - Link back to the original page

---

## 🧮 Understanding Expected Value (EV)

Expected Value is the theoretical average profit you'd make on a bet if placed many times:

```
EV = (Win Probability × Win Amount) - (Lose Probability × Stake)
```

**Example:** $10 stake at 2.50 odds with 41.51% probability:
```
EV = (0.4151 × $10 × 2.50) - (0.5849 × $10)
EV = $10.38 - $5.85 = +$4.53
```

### Summary Metrics
- **Total EV**: Sum of EV for all bets (theoretical expected profit)
- **P/L**: Actual profit/loss for settled bets
- **Expected (Settled)**: Sum of EV for settled bets only
- **vs Expected**: Difference between actual and expected (luck factor)

Over 100+ bets, actual results should approach expected value if probabilities are accurate.

---

## 🛠️ Development

### Project Structure
```
surebet-helper-extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── contentScript.js           # Injects save buttons on surebet.com + auto-fill logic
├── background.js              # Service worker for exports and auto-checking
├── apiService.js              # Sports result API integration
├── popup.html/js              # Minimal 4-button popup interface
├── analysis.html/js           # Full-screen analysis dashboard
├── settings.html/js           # Consolidated settings interface
├── import.html/js             # Bulk import functionality
├── icons/                     # Extension icons
└── README.md                  # This file
```

### Recent Major Changes (v1.0.57)

#### 🎉 UI Redesign - Tab-Based Interface
- **Removed**: Crowded inline modals from popup (Commission, Rounding, Auto-Fill panels)
- **Removed**: Floating Kelly Stake Helper panel from surebet.com
- **Removed**: Chart and liquidity modals from popup
- **Added**: Minimal 4-button popup (Check Results, Analysis, Settings, Import)
- **Added**: Full-screen Analysis tab with 6 views and comprehensive export options
- **Added**: Consolidated Settings tab with 6 configuration sections
- **Moved**: Kelly staking configuration from floating panel to Settings tab

#### 🔧 Technical Improvements
- Fixed Manifest V3 CSP violations (removed inline `onclick` handlers)
- API link buttons now use `api.tabs.create()` for cross-browser compatibility
- All event listeners wrapped in null-guard checks
- Fixed indentation issues in event handler callbacks
- Added hash-based routing for settings sections (#commission, #kelly, #api, etc.)
- Disabled floating staking panel injection from contentScript.js
 - Migration fix: `isLay` backfilling now only runs when the property is undefined so explicit user edits are preserved

#### 📊 Analytics Enhancements
- CSV export now includes 27 detailed columns
- Added Kelly fill ratio analysis
- Added liquidity tier analysis
- Added bookmaker performance profiling
- Added temporal trend analysis
- Real-time P/L summary in Kelly settings

### Contributing
We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Reporting bugs
- Suggesting features
- Submitting pull requests
- Code style and testing

### Local Development
1. Clone the repository
2. Load the extension in developer mode (see Installation above)
3. Make your changes
4. Reload the extension to test
5. Submit a pull request

### Version History
See [CHANGELOG.md](CHANGELOG.md) for complete version history and detailed changes.

---

## 📦 Distribution

To create a distribution package for Chrome Web Store or Firefox Add-ons:

```powershell
# Windows PowerShell
Compress-Archive -Path .\surebet-helper-extension\* -DestinationPath .\surebet-helper-extension.zip -Force
```

```bash
# Linux/Mac
cd surebet-helper-extension
zip -r ../surebet-helper-extension.zip . -x "*.git*"
```

---

## 🐛 Troubleshooting

### Save button not appearing
- Ensure you're on surebet.com/valuebets
- Check browser console for errors
- Try reloading the page

### Bets not saving
- Check extension popup for saved bets
- Open browser console (F12) and check for errors
- Verify extension has storage permissions

### Auto-check not working
- Verify API keys are configured (see API_SETUP.md)
- Check that events have ended (30 min delay)
- Look for error messages in extension popup

For more help, see [TESTING.md](surebet-helper-extension/TESTING.md) or open an issue.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for the value betting community
- Uses free sports data from API-Football and The Odds API
- Compatible with Manifest V3 for modern browsers

---

## 🔗 Links

- [Installation Guide](surebet-helper-extension/INSTALL.md)
- [API Setup Guide](surebet-helper-extension/API_SETUP.md)
- [Testing Guide](surebet-helper-extension/TESTING.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Report Issues](https://github.com/tacticdemonic/surebet-helper-extension/issues)

---

**Made with ❤️ for value bettors**


