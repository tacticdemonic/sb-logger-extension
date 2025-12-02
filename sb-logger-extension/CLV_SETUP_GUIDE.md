# CLV (Closing Line Value) Setup Guide

This guide explains how to set up Closing Line Value (CLV) tracking for SB Logger.

## What is CLV?

**Closing Line Value** measures how your bet odds compare to the market's closing line (the final odds before an event starts). It's one of the most important metrics for evaluating betting skill:

- **Positive CLV**: You got better odds than the market closing price → Long-term edge
- **Negative CLV**: You got worse odds than the market closing price → Potential leak

Professional bettors typically aim for consistent positive CLV, as it correlates strongly with long-term profitability.

---

## Prerequisites

Before setting up CLV tracking, you need:

1. **Python 3.11 or higher** installed on your system
2. **OddsHarvester** - A Python tool for scraping historical odds data
3. **SB Logger browser extension** v1.0.98+

---

## Installation Steps

### Step 1: Run the Automated Installer

We provide installation scripts that handle everything automatically.

#### Windows (PowerShell)

1. Open PowerShell as Administrator
2. Navigate to the extension folder:
   ```powershell
   cd "c:\Local\SB Logger\sb-logger-extension\sb-logger-extension\tools\odds_harvester_api"
   ```
3. Run the installer:
   ```powershell
   .\install_odds_api.ps1
   ```

#### Linux/Mac (Bash)

1. Open Terminal
2. Navigate to the extension folder:
   ```bash
   cd ~/path-to-extension/tools/odds_harvester_api
   ```
3. Make the script executable and run:
   ```bash
   chmod +x install_odds_api.sh
   ./install_odds_api.sh
   ```

The installer will:
- Create a Python virtual environment
- Install OddsHarvester and its dependencies
- Set up the local API server
- Test the installation

### Step 2: Verify Installation

After installation completes, the API server should be running. Verify by opening:

```
http://localhost:8765/health
```

You should see:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "oddsharvester_installed": true
}
```

### Step 3: Configure the Extension

1. Open the SB Logger extension popup
2. Click the **⚙️ Settings** button
3. Navigate to the **📈 CLV** section
4. Toggle **Enable CLV Tracking** to ON
5. Click **Test Connection** to verify

---

## Configuration Options

### CLV Delay

How long to wait after a match ends before fetching closing odds.

- **Recommended**: 6-12 hours
- **Minimum**: 2 hours
- **Maximum**: 48 hours

Longer delays ensure odds data is fully settled on OddsPortal.

### Fallback Strategy

When no exact match is found, you can choose:

- **Pinnacle Only**: Only use Pinnacle closing odds (most accurate)
- **Weighted Average**: Average of multiple sharp bookmakers
- **Any Available**: Use any available closing odds

### Max Concurrent Jobs

How many matches to process simultaneously:

- **Low (1-2)**: Safer, slower, less likely to trigger rate limits
- **Medium (3-4)**: Balanced
- **High (5)**: Faster but may hit rate limits

The API automatically adjusts based on system resources.

---

## How CLV is Calculated

The CLV formula is:

```
CLV = ((Your Odds / Closing Odds) - 1) × 100%
```

**Example:**
- You bet at odds 2.10
- Closing line was 2.00
- CLV = ((2.10 / 2.00) - 1) × 100% = **+5%**

This means you captured 5% edge over the closing line.

---

## Viewing CLV Data

### In Popup
- Each settled bet shows a CLV badge (🟢 positive, 🔴 negative)
- Pending CLV shows ⏳ icon

### In Analysis Dashboard
- Navigate to **📈 CLV Analysis** tab
- View CLV distribution histogram
- See CLV vs ROI correlation scatter plot
- Breakdown by bookmaker

### Manual Entry

If automatic CLV lookup fails after 3 retries:
1. Click the ⏳ pending icon on a bet
2. Enter the closing odds manually
3. Click **Save**

You can find closing odds on [OddsPortal](https://www.oddsportal.com).

---

## Troubleshooting

### "Connection Failed" in Settings

1. Ensure the API server is running:
   ```powershell
   cd tools\odds_harvester_api
   .\venv\Scripts\Activate.ps1
   python server.py
   ```

2. Check if port 8765 is available:
   ```powershell
   netstat -an | Select-String ":8765"
   ```

3. If another process is using the port, kill it or change the port in `server.py`

### No CLV Data Appearing

1. CLV is only fetched for **settled** bets (won/lost)
2. There's a configurable delay (default 6 hours) after settlement
3. Check the batch check alarm in background console

### Wrong Match Found

OddsPortal event names may differ from your source. If CLV looks wrong:

1. Click the bet's CLV badge
2. Click "Report Mismatch"
3. Provide the correct OddsPortal URL

This helps improve matching for future bets.

### Rate Limiting

If you see many "failed" jobs:

1. Reduce **Max Concurrent Jobs** to 1-2
2. Increase **CLV Delay** to 12+ hours
3. Clear cache and retry

---

## Architecture Overview

```
┌─────────────────────┐     HTTP      ┌─────────────────────┐
│  Browser Extension  │◄────────────►│  Local API Server   │
│  (SB Logger)        │   localhost   │  (FastAPI + Python) │
└─────────────────────┘    :8765      └──────────┬──────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │   OddsHarvester     │
                                      │   (CLI Scraper)     │
                                      └──────────┬──────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │   OddsPortal.com    │
                                      │   (Historical Data) │
                                      └─────────────────────┘
```

---

## Data Storage

CLV data is stored in two places:

1. **Extension Storage**: Each bet object gets `clv` and `closingOdds` fields
2. **Local SQLite Database**: Cached responses at `tools/odds_harvester_api/clv_cache.db`

### Clearing Cache

To clear the CLV cache:
1. Go to Settings → CLV
2. Click **Clear Cache**
3. Confirm the action

This removes cached odds but doesn't affect your bet CLV values.

---

## Privacy & Data

- All odds lookups happen **locally** through OddsHarvester
- No bet data is sent to external servers
- The API runs only on `localhost`
- OddsPortal is accessed via standard web scraping

---

## Manual API Server Control

### Start Server
```powershell
cd tools\odds_harvester_api
.\venv\Scripts\Activate.ps1
python server.py
```

### Stop Server
Press `Ctrl+C` in the terminal running the server.

### Run as Background Service (Windows)

You can create a Windows Task to auto-start the API:
1. Open Task Scheduler
2. Create Basic Task → "CLV API Server"
3. Trigger: At startup
4. Action: Start a program
   - Program: `pythonw.exe`
   - Arguments: `server.py`
   - Start in: `path\to\tools\odds_harvester_api`

---

## Supported Sports

OddsHarvester supports:
- ⚽ Football (Soccer)
- 🏀 Basketball
- 🎾 Tennis
- 🏒 Hockey
- 🏈 American Football
- ⚾ Baseball
- 🏐 Volleyball

CLV accuracy is highest for major leagues with good OddsPortal coverage.

---

## FAQ

**Q: Do I need to keep the API running all the time?**
A: The extension checks periodically (every 4 hours by default). The API only needs to be running when those checks happen.

**Q: Can I use this with multiple browsers?**
A: Yes, the same API server can serve multiple browser instances.

**Q: What if OddsPortal doesn't have my match?**
A: Enter closing odds manually, or the bet will remain without CLV data.

**Q: Does this slow down my browser?**
A: No, all processing happens in the background API. The extension just sends requests.

---

## Getting Help

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Look for errors in browser DevTools console
3. Check API server terminal output
4. [Open a GitHub issue](https://github.com/tacticdemonic/sb-logger-extension/issues)

---

*Last updated: December 2025*
