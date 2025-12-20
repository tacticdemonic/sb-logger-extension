# Player Props Poller Documentation

**File**: `sb-logger-extension/prop_poller.js`
**Version**: 1.0.0

## Overview

The Player Props Poller is a background module that tracks line movement for player proposition bets (e.g., points, assists, rebounds). Unlike match odds which have widely available closing lines, player props require active polling during the life of the bet to capture market movement.

## Features

*   **Automated Polling**: Runs 3 times daily (08:00, 14:00, 20:00 local time).
*   **Smart Quota Management**: Designed to work within The Odds API free tier (500 requests/month).
    *   Daily Limit: ~16 requests (automatic).
    *   Manual Reserve: 50 requests/month reserved for user-triggered checks.
*   **Sport Prioritization**: Prioritizes active major sports (NFL > NBA > MLB > NHL).
*   **Line Movement Tracking**: Calculates percentage change between opening odds (when bet was placed) and current market odds.

## Configuration

### API Key
Requires a valid API key from [The Odds API](https://the-odds-api.com/).
Configure this in the extension settings: **Settings → API Setup → Odds API Key**.

### Supported Markets
The poller automatically detects prop bets based on keywords in the market name or event name:
*   **NBA/NCAAB**: Points, Rebounds, Assists, Threes
*   **NFL/NCAAF**: Passing Yards/TDs, Rushing Yards, Receptions
*   **MLB**: Strikeouts, Hits, Home Runs, RBIs
*   **NHL**: Points, Shots on Goal, Blocked Shots

## Usage

### Automatic
Once the API key is saved, the extension will automatically schedule the polling alarms. No further action is needed.

### Manual Force Check
You can trigger a manual poll for debugging or immediate updates:
1.  Open the Extension Popup.
2.  Go to **Settings**.
3.  (If implemented in UI) Click "Force Prop Poll" or similar debug action.
    *   *Note: This consumes from the "Manual Reserve" quota.*

## Technical Details

### Storage
*   **`bets`**: Updates the `currentOdds`, `lineMovement`, and `lastPolled` fields on matching bet objects.
*   **`propApiUsage`**: Tracks `monthlyUsed`, `dailyUsed`, and reset dates to enforce quotas.

### Matching Logic
Uses fuzzy matching to link your bet (e.g., "LeBron James Over 25.5") to the API events and markets.
1.  Matches Event (Team A vs Team B).
2.  Matches Market Type (Player Points).
3.  Matches Line/Outcome (Over 25.5).

## Troubleshooting

*   **No Updates?**: Check if your API key is valid and has quota remaining.
*   **Wrong Match?**: The fuzzy matcher might struggle with obscure player names or inconsistent naming conventions between bookmakers.
*   **Logs**: Check the browser console (Background page) for logs prefixed with `🎯` or `[Prop Poller]`.
