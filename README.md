# SB Logger — Browser Extension for Surebet.com

A powerful browser extension for tracking and analyzing value bets from surebet.com. Save bets with one click, automatically check results, visualize your P/L, and export your data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Edge-blue)](https://github.com/YOUR_USERNAME/sb-logger-extension)

---

## ✨ Features

### 🎯 Core Functionality
- **One-Click Save**: Auto-injected 💾 Save button on every bet row at surebet.com/valuebets
- **Smart Data Capture**: Automatically captures bookmaker, event, odds, probability, overvalue, and more
- **Stake Tracking**: Prompts for stake amount and optional notes when saving
- **Bet Settlement**: Mark bets as Won ✓, Lost ✗, or Void ○ with a single click

### 📊 Analytics & Performance
- **Profit/Loss Tracking**: Real-time P/L calculation and ROI across all settled bets
- **Expected Value (EV)**: Theoretical expected profit calculated for every bet
- **EV vs Actual**: Compare actual results against expected value to track luck vs skill
- **Visual Charts**: Interactive P/L graph showing your performance trends over time

### 🤖 Automation
- **Auto-Check Results**: Optional integration with free sports APIs (API-Football, The Odds API)
- **Smart Retries**: Waits 30 min after event ends, retries up to 5 times with exponential backoff
- **Hourly Background Checks**: Automatically checks eligible pending bets

### 🔧 Convenience Features
- **Bookmaker Filter Presets**: Quick-apply your favorite bookmaker combinations
- **Exchange Commission Support**: Built-in support for Betfair, Betdaq, Matchbook, Smarkets
- **Export Options**: Export to JSON or CSV for external analysis
- **Data Management**: View, filter, and manage all saved bets in the popup

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
4. Click **"Load unpacked"** and select the `sb-logger-extension` folder
5. The extension is now installed permanently

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on"** and select `manifest.json` from the `sb-logger-extension` folder
   - **Note**: Temporary add-ons are removed when Firefox restarts
   - For permanent installation, see [Signing Guide](sb-logger-extension/INSTALL.md)

---

## 📖 Usage

1. **Visit** [surebet.com/valuebets](https://surebet.com/valuebets)
2. **Click** the 💾 Save button on any bet row
3. **Enter** your stake amount (and optional note)
4. **View** all saved bets by clicking the extension icon in your toolbar
5. **Settle bets** using the ✓ Won, ✗ Lost, or ○ Void buttons
6. **Track progress** with the P/L summary and 📊 View Chart button
7. **Export data** using the JSON or CSV export buttons

### Bookmaker Filter Presets

The extension adds quick-filter buttons to the bookmaker filter popup:
- **⭐ My Normal List** - Your standard bookmaker selection
- **🔄 Exchanges Only** - Filter to betting exchanges only

Customize these presets in `contentScript.js` by editing the `BOOKMAKER_PRESETS` object.

---

## ⚙️ Optional: Auto-Check Results

The extension can automatically verify bet results using free sports APIs. This is completely optional — manual settlement always works.

### Supported APIs
- **API-Football** (soccer/football) - 100 requests/day free
- **The Odds API** (multiple sports) - 500 requests/month free

### Setup Guide
See **[API_SETUP.md](sb-logger-extension/API_SETUP.md)** for step-by-step instructions on:
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
sb-logger-extension/
├── manifest.json         # Extension configuration (Manifest V3)
├── contentScript.js      # Injects save buttons on surebet.com
├── background.js         # Service worker for exports and auto-checking
├── apiService.js         # Sports result API integration
├── popup.html/js         # Extension popup interface
├── import.html/js        # Bulk import functionality
├── icons/                # Extension icons
└── docs/                 # Documentation files
```

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

---

## 📦 Distribution

To create a distribution package for Chrome Web Store or Firefox Add-ons:

```powershell
# Windows PowerShell
Compress-Archive -Path .\sb-logger-extension\* -DestinationPath .\sb-logger-extension.zip -Force
```

```bash
# Linux/Mac
cd sb-logger-extension
zip -r ../sb-logger-extension.zip . -x "*.git*"
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

For more help, see [TESTING.md](sb-logger-extension/TESTING.md) or open an issue.

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

- [Installation Guide](sb-logger-extension/INSTALL.md)
- [API Setup Guide](sb-logger-extension/API_SETUP.md)
- [Testing Guide](sb-logger-extension/TESTING.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Report Issues](https://github.com/YOUR_USERNAME/sb-logger-extension/issues)

---

**Made with ❤️ for value bettors**
