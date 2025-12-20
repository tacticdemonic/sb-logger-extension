# API Setup Instructions

The SB Logger extension can automatically check bet results using free sports APIs. Follow these steps to set up API access:

## Overview

The extension uses two APIs:
- **API-Football** - For football/soccer matches (100 requests/day free)
- **The Odds API** - For other sports like tennis, basketball (500 requests/month free)

## Automatic Checking Features

- ✅ **30-Minute Delay**: Only checks results 30 minutes after event ends
- ✅ **Smart Retries**: Maximum 5 attempts with exponential backoff (1hr, 2hr, 4hr, 8hr, 24hr)
- ✅ **Graceful Failure**: After 5 failed attempts, bet stays pending for manual settlement
- ✅ **Hourly Background Checks**: Automatically checks eligible pending bets every hour
- ✅ **Manual Check Button**: Use "🔍 Check Results" button anytime

## Step 1: Get API-Football Key (for football/soccer)

1. Visit: https://www.api-football.com/
2. Click "Get Free Trial" or "Register"
3. Create a free account
4. Go to your dashboard: https://dashboard.api-football.com/
5. Copy your API key from the dashboard

**Free Tier Limits:**
- 100 requests per day
- Covers major football leagues worldwide
- Sufficient for ~10-20 bet checks per day

## Step 2: Get The Odds API Key (for other sports)

1. Visit: https://the-odds-api.com/
2. Click "Get API Key"
3. Create a free account
4. Copy your API key from the dashboard

**Free Tier Limits:**
- 500 requests per month
- Covers tennis, basketball, American football, ice hockey, baseball, and more
- Sufficient for ~50-100 bet checks per month

## Step 3: Configure API Keys

1. Open the extension folder: `sb-logger-extension`
2. Open `apiService.js` in a text editor (Notepad, VS Code, etc.)
3. Find these lines near the top (around line 5-15):

```javascript
const API_CONFIG = {
  apiFootball: {
    baseUrl: 'https://v3.football.api-sports.io',
    apiKey: 'YOUR_API_FOOTBALL_KEY_HERE', // ← Replace this
    requestsPerDay: 100
  },
  oddsApi: {
    baseUrl: 'https://api.the-odds-api.com/v4/sports',
    apiKey: 'YOUR_ODDS_API_KEY_HERE', // ← Replace this
    requestsPerMonth: 500
  }
};
```

4. Replace `YOUR_API_FOOTBALL_KEY_HERE` with your API-Football key
5. Replace `YOUR_ODDS_API_KEY_HERE` with your Odds API key
6. Save the file

**Example (with fake keys):**
```javascript
apiKey: 'abc123def456ghi789',  // API-Football key
apiKey: 'xyz987uvw654rst321',  // Odds API key
```

## Step 4: Reload Extension

### In Firefox:
1. Type `about:debugging` in the address bar
2. Click "This Firefox"
3. Find "SB Logger - Save Bets"
4. Click "Reload"

### In Chrome:
1. Type `chrome://extensions/` in the address bar
2. Find "SB Logger - Save Bets"
3. Click the reload icon (circular arrow)

## Step 5: Test It

1. Open the extension popup
2. Click "🔍 Check Results" button
3. You should see a message like:
   - "Checking X bets for results..."
   - "Found Y result(s)"
   - Or "No bets ready for lookup yet" (if no events have finished + 30 min)

## How It Works

### Automatic Checks (Every Hour)
- Extension checks all pending bets hourly in the background
- Only looks up bets where:
  - Event finished at least 30 minutes ago
  - Less than 5 lookup attempts made
  - Appropriate delay has passed between retries
- If results found, bet is automatically settled
- You'll get a notification when results are found

### Manual Checks (Any Time)
- Click "🔍 Check Results" button
- Same eligibility rules apply
- Useful if you want immediate feedback

### Retry Logic
When a result isn't found:
1. **Attempt 1**: Check 30 min after event ends
2. **Attempt 2**: Check 1 hour after first attempt (if failed)
3. **Attempt 3**: Check 2 hours after second attempt
4. **Attempt 4**: Check 4 hours after third attempt
5. **Attempt 5**: Check 8 hours after fourth attempt
6. **Max reached**: After 5 attempts, bet stays pending - settle manually

This ensures we don't waste API quota on events that might not have data available yet.

## Supported Sports & Markets

### Football/Soccer (API-Football)
- **1X2**: Home win, Draw, Away win
- **Over/Under**: Goals (0.5, 1.5, 2.5, 3.5, 4.5, etc.)
- **Asian Handicap**: AH1, AH2 with positive/negative values
- **Cards**: Total yellow/red cards
- **Lay Bets**: Automatically inverts outcome logic

### Other Sports (The Odds API)
- **Tennis**: Match winner
- **Basketball**: Match winner, spreads, totals
- **American Football**: Match winner, spreads, totals
- **Ice Hockey**: Match winner, spreads, totals
- **Baseball**: Match winner, spreads, totals

## Troubleshooting

### "No API keys configured"
- Check that you replaced BOTH placeholder keys in `apiService.js`
- Make sure you saved the file
- Reload the extension

### "No bets ready for lookup yet"
- Event must have finished at least 30 minutes ago
- Check event time is correct in bet details
- Retry count hasn't reached 5 yet

### "Found 0 result(s)"
- API might not have data for that league/competition yet
- Event might not have finished yet (even if scheduled time passed)
- Try again later or settle manually

### Rate Limit Errors
- **API-Football**: 100 requests/day - resets at midnight UTC
- **The Odds API**: 500 requests/month - resets monthly
- Wait for quota to reset or upgrade to paid plan

## Privacy & Security

- API keys are stored locally in the extension files (not uploaded anywhere)
- API requests only sent when you click "Check Results" or hourly auto-check runs
- No bet data is sent to external servers except event names for matching
- All bet data stays in your browser's local storage

## Optional: Use Only One API

If you only bet on football/soccer:
- Only set up API-Football key
- Leave The Odds API key as placeholder

If you don't bet on football/soccer:
- Only set up The Odds API key
- Leave API-Football key as placeholder

The extension will work with whichever keys are configured.

## Need Help?

Check the browser console (F12 → Console tab) for detailed error messages when checking results.

Common console messages:
- `"Checking X bets for results..."` - Check started
- `"Incremented retry count for [event]: X/5"` - Retry counter increased
- `"Auto-settled [event] as won/lost"` - Result found and bet updated
- `"API request failed: [error]"` - API error (check key, quota, network)
