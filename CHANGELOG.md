# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [1.0.99] - 2025-12-02

### 🐛 Bug Fixes
- **CLV badge gating**: CLV badges (Pending/Manual Entry) now only show when CLV tracking is enabled. Previously showed for all settled bets regardless of setting.
- **CLV scatter plot NaN fix**: Added minimum range fallback to prevent chart from breaking when all CLV points share the same X or Y value.
- **CLV delay for legacy bets**: Bets without `settledAt` timestamp now use `timestamp` as fallback, or are skipped entirely to avoid querying API before closing lines are available.
- **Force CLV Check**: Added "⚡ Force Check Now" button in Settings → CLV to manually trigger CLV fetch for all eligible bets.

### 🔧 Technical
- Added 30-second timeout with AbortController to CLV API fetch calls to prevent stalls.
- Added 5-second timeout to CLV API health checks.
- Unknown/missing sports now log warnings instead of silently defaulting to football.
- Save CLV button now has double-click protection and async error handling.

## [1.0.98] - 2025-12-02

### ✨ New Features
- **CLV (Closing Line Value) Tracking**: Major new feature to measure betting edge vs closing market prices.
  - **Local API Server**: Python-based OddsHarvester integration running on localhost:8765 for historical odds lookups.
  - **Automatic CLV Calculation**: Background service polls for closing odds after bet settlement (configurable 2-48h delay).
  - **CLV Settings Panel**: New "📈 CLV" section in Settings with toggle, connection status, delay slider, fallback strategy, and cache management.
  - **CLV Analysis Dashboard**: New "📈 CLV Analysis" tab in Analysis page with histogram distribution, CLV vs ROI scatter plot, and bookmaker breakdown.
  - **Manual CLV Entry**: Modal in popup for entering closing odds when automatic lookup fails.
  - **CLV Badges**: Visual indicators on bets showing positive (🟢), negative (🔴), or pending (⏳) CLV status.
  - **Fuzzy Matching**: Intelligent event name matching using Levenshtein distance and token overlap for OddsPortal lookups.
  - **League Mapping**: Automatic tournament-to-OddsPortal league mapping with custom alias support.
  - **Pinnacle Fallback**: Uses Pinnacle closing odds as primary source (industry standard for sharp lines).
  - **SQLite Cache**: Local database for caching odds lookups and job status.
  - **Mismatch Reporting**: GitHub issue template for reporting CLV lookup failures to improve matching.

### 📝 Documentation
- **CLV_SETUP_GUIDE.md**: Comprehensive setup guide for installing and configuring CLV tracking.
- **GitHub Issue Template**: Added `clv-mismatch.md` template for reporting lookup failures.

### 🔧 Technical
- New `tools/odds_harvester_api/` directory with FastAPI server, SQLite database, fuzzy matcher, and league mapper.
- Installation scripts for Windows (PowerShell) and Linux/Mac (Bash).
- New background alarms: `clv-batch-check` (4h interval) and `clv-job-poll` (60s interval).

## [1.0.96.1] - 2025-12-01

### 🐛 Bug Fixes
- **Market filter persistence**: Fixed incomplete `DEFAULT_UI_PREFERENCES` in contentScript.js that was missing market filter properties, causing settings to reset on extension updates. Now properly includes `marketFilterEnabled`, `marketFilterMode`, and `activePresets`.
- **Settings loading**: Changed from `||` to `??` (nullish coalescing) in `loadMarketFilterSettings()` to properly handle `false` values and ensure saved settings persist correctly.

## [1.0.96] - 2025-12-01

### ✨ New Features
- **On-site Market Filtering**: Added the ability to hide or highlight specific market types directly on the surebet.com valuebets page. Presets include Asian Handicap, DNB, Cards, Goals Only, and Corners Only. Supports Hide & Highlight modes and mirrors popup settings.
- **New Market Filter Presets**: Added three additional filter presets to block Shots, Player Props (goalscorers, assists), and Correct Score markets.
- **Real-time Filter Updates**: Market filters now apply immediately when toggled in settings/popup without requiring page reload. Content script listens to `uiPreferences` storage changes and reapplies filters in real-time.

### 🐛 Bug Fixes
- **Asian Handicap matching**: Improved regex compilation to detect abbreviations like `AH`, `AH1`, `AH2` and variations like `AH2(+1.5)` by using a lookahead. Added content-script-level filtering and highlight badge for easier identification.
- **Market filter toggle regression**: Fixed issue where disabling market filters wouldn't remove existing filter styling from rows until page reload. Filters now properly clear classes when disabled.
- **Settings preservation bug**: Fixed critical bug in `settings.js` where saving market filter settings would overwrite and discard other UI preferences like `hideLayBets` and `showPendingOnly`. Now properly merges with existing settings.
- **Highlight mode counter**: Fixed `marketFilteredCount` not incrementing in highlight mode, so the summary line now correctly reports the number of highlighted rows.
- **Storage listener gap**: Added missing `uiPreferences` handler in content script storage listener to enable real-time market filter updates without page reload.


## [1.0.82.2] - 2025-11-28

### 📝 Documentation & Housekeeping
- Updated docs to reflect manifest version 1.0.82.2 and updated key README and meta docs for clarity.
- Added minor consistency edits across documentation to remove outdated version labels.

## [1.0.78] - 2025-11-27

### ✨ New Features & Fixes
- **Per-bet Debug Logging**: Added `debugLogs` per bet (session-based, structured logs) capturing auto-fill attempts, selector diagnostics, and timing metrics.
- **Export Debug Logs**: Export pending-bets JSON now includes `debugLogs` for each bet (Settings → Data → Debug Export and Analysis → Export)
- **24-hour Log Retention**: Debug logs are filtered to the last 24 hours on save to prevent storage bloat.
- **Storage Size Check**: Background added `checkStorageSize` action to warn when storage usage exceeds 4MB; popup shows warning during export preparation.
- **Documentation**: Added `DEBUG_LOGGING_IMPLEMENTATION.md`, `DEBUG_LOGGING_QUICK_REFERENCE.md`, and `DEBUG_LOGGING_EXPORT_FIX.md` with usage and troubleshooting guidance.
- **Bug Fix**: Fixed an issue where the "Settled" count in the popup summary showed the number of settled bets from all bets while the denominator reflected the filtered view (e.g., 'Pending Only') — the settled count is now derived from the currently visible (filtered) bets.


## [1.0.76] - 2025-11-26

### ✨ New Features
- **Advanced Analysis Dashboard**: Added comprehensive performance analysis tools to the Analysis tab.
- **Summary Statistics**: Persistent top-bar showing 9 key metrics (Yield, Profit Factor, Drawdown, Streaks, etc.).
- **Performance Tab**: New tab with three integrated analyses:
  - **Odds Band Performance**: ROI% and deviation by odds range (1.00-1.50, 1.51-2.00, etc.).
  - **Overvalue Distribution**: Calibration analysis of edge accuracy (0-1%, 1-2%, etc.).
  - **Sport Breakdown**: Profitability ranking by sport category.
- **Significance Indicators**: Visual de-emphasis (50% opacity) for metrics with low sample size (n<20).
- **Deviation Analysis**: All tables now show actual vs expected win rate deviation (+/- %).
- **Enhanced Export**: JSON exports now include all new performance metrics.
- **Debug Export (Pending Bets)**: Added a Settings → Data → Debug Export option to export pending bets as JSON for debugging CSV import and pending-state issues.

---

## [1.0.75] - 2025-11-26

### ✨ New Features
- **Auto-Hide Bets**: Automatically hides bets on surebet.com immediately after saving them.
- **Dustbin Settings**: Configure the default hide action (Hide for 12h, 24h, or Permanently) in the extension settings.
- **Smart Menu Handling**: Automatically detects and clicks the correct "dustbin" menu item based on your preference.

### 🐛 Bug Fixes
- Fixed menu item detection in `contentScript.js` to correctly identify `<button>` elements in the dropdown menu.

---

## [1.0.57] - 2025-11-24

### 🎉 Major Refactor: UI Redesign & Settings Consolidation

#### ✨ New Features
- **Tab-Based Dashboard** - All analysis, settings, and imports now open in dedicated tabs instead of popups
- **Analysis Tab** (analysis.html) - New full-screen dashboard with 6 views:
  - 📈 P/L Chart - Interactive trend visualization
  - 💧 Liquidity Tiers - Limit tier analysis
  - 📊 Bookmaker Profiling - Performance by bookmaker
  - 📅 Temporal Analysis - Time-based trends  
  - 🎲 Kelly Metrics - Fill ratio analysis
  - 📥 Export - JSON with analysis data + CSV with 27-column detail
- **Settings Tab** (settings.html) - Consolidated configuration with 6 sections:
  - 💰 Commission - Exchange rates (Betfair, Betdaq, Matchbook, Smarkets)
  - 📏 Rounding - Stake rounding options
  - ⚡ Auto-Fill - Exchange selection and configuration
  - 🎲 Kelly Staking - Bankroll, fraction, and commission settings (moved from floating panel)
  - 🔑 API Setup - Sports API key configuration
  - 🗑️ Data - Clear all bets with double-confirmation
- **Minimal 4-Button Popup** - Streamlined extension popup with only essential buttons:
  - 🔍 Check Results
  - 📊 Analysis (opens tab)
  - ⚙️ Settings (opens tab)
  - 📥 Import (opens tab)

#### 🗑️ Removed Features
- Removed crowded inline modals from popup (Commission, Rounding, Auto-Fill panels)
- Removed floating Kelly Stake Helper panel from surebet.com (moved to Settings tab)
- Removed chart/liquidity modals from popup (moved to Analysis tab)
- Removed export buttons from popup (moved to Analysis tab)

#### 🔧 Technical Changes
- Fixed Manifest V3 CSP violations - removed inline `onclick` handlers
- API link buttons now use `api.tabs.create()` for cross-browser compatibility
- Kelly staking settings properly integrated with contentScript.js calculations
- All event listeners wrapped in null-guard checks for safety
- Fixed indentation issues in popup.js event handler callbacks
- Added hash-based routing support for settings sections (#commission, #kelly, #api, etc.)

#### 📝 UX Improvements
- Settings now opens to relevant tab via hash routing
- Real-time P/L summary in Kelly Staking section
- Cleaner, more focused popup interface
- Analysis page shows comprehensive betting performance metrics
- CSV export includes 27 detailed columns (bankroll, limit tiers, Kelly metrics, etc.)

#### 🐛 Bug Fixes
- Fixed syntax error in btnJson/btnCsv export callbacks (missing closing braces)
- Fixed alert indentation in CSV export error handling
- Proper CSP compliance for API link opening

#### 📦 Files Changed
**New:**
- `analysis.html` (5.8 KB) - Full-screen analysis dashboard
- `analysis.js` (30.6 KB) - Chart rendering and analysis functions
- `settings.html` (11.3 KB) - Consolidated settings interface
- `settings.js` (10.2 KB) - Settings persistence and UI logic

**Modified:**
- `popup.html` - Reduced from 6+ buttons to 4 essential buttons
- `popup.js` - Updated button handlers, fixed syntax errors, added new event listeners
- `contentScript.js` - Disabled floating staking panel injection
- `manifest.json` - Version bumped to 1.0.57

---

## [1.0.63.1] - 2025-11-24

### 🐛 Bug Fixes
- Fixed editing lay bets: added a 'To Lay'/'To Back' toggle to the edit modal and corrected odds validation so lay odds can be saved without HTML5 min constraint preventing submission.
- Fixed migration logic for `isLay` backfilling so that it only backfills when `isLay` is undefined (preserves explicit user edits).


## [1.0.56] - 2025-11-24

### 🔧 Configuration Changes
- Updated API link buttons to use `api.tabs.create()` for Manifest V3 compliance
- Fixed CSP violation with inline `onclick` handlers in settings.html

---

## [1.0.55] - 2025-11-23

### 🐛 Bug Fixes
- Fixed missing closing brace in btnCsv event listener callback
- Corrected indentation in alert statements for CSV export error handling

---

## [1.0.54] - 2025-11-23

### 🐛 Bug Fixes
- Fixed btnJson event listener structure - added missing closing brace for addEventListener callback
- Resolved syntax error: "missing ) after argument list popup.js:1440:3"

---

## [1.0.53] - 2025-11-22

### ✨ Enhancement
- Updated Kelly Criterion calculations to account for exchange commission rates
- Improved expected value calculations for lay bets

---

## [1.0.52] - 2025-11-20

### ✨ Features
- Added Kelly fill ratio metrics to CSV export
- Added recommended Kelly stake calculations to CSV output
- Added hours-to-event calculation for temporal analysis

---

## [1.0.51] - 2025-11-18

### ✨ Features
- Enhanced CSV export with liquidity metrics
- Added limit tier classification
- Added commission accounting to profit calculations

---

## [1.0.50] - 2025-11-15

### 📊 Analytics Improvements
- Added liquidity tier analysis (limit stratification)
- Added bookmaker performance profiling
- Added temporal analysis (time-based trends)
- Added Kelly fill ratio calculations

---

## [1.0.49] - 2025-11-12

### ✨ Features
- Added CSV export functionality
- Added JSON export with analysis data
- Implemented liquidity analysis caching

---

## [1.0.48] - 2025-11-10

### 🔧 Technical
- Updated to web-ext version 1.0.48
- Improved background service worker stability

---

## [1.0.47] - 2025-11-08

### 🐛 Bug Fixes
- Fixed auto-fill stake calculation for lay bets
- Improved betting slip detection on Smarkets

---

## [1.0.46] - 2025-11-05

### ✨ Features
- Added support for Matchbook lay bets
- Enhanced auto-fill with React/data-hook selectors

---

## [1.0.45] - 2025-11-02

### 🔧 Technical
- Improved MutationObserver polling for SPA betting sites
- Added exponential backoff for auto-fill retries

---

## [1.0.44] - 2025-10-30

### ✨ Features

---

## [1.0.43] - 2025-10-28

## [1.0.42] - 2025-10-25


---

## [1.0.40] - 2025-10-20

### 🐛 Bug Fixes
- Fixed background.js alarms API issues
- Improved result checking retry logic

---

## [1.0.38] - 2025-10-15

### 📦 Release
- Latest stable web-ext build

---

## [1.0.37] - 2025-10-10

### 🎉 Major Feature
- Completed auto-fill stakes feature for Betfair, Smarkets, Matchbook
- Full cross-origin broker pattern implementation
- Comprehensive auto-fill documentation

---

## [1.0.32] - 2025-09-20

### 🚀 Initial Release
- Core functionality: Save bets, track P/L, settle results
- Manual commission configuration
- Basic auto-check result checking
- Betfair P/L CSV import support
