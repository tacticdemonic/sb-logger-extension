# API Setup Instructions

The Surebet Helper extension can automatically check bet results using free sports APIs. Follow these steps to set up API access:

## Overview

The extension uses **two APIs** for comprehensive sports coverage:

### Primary API: API-Sports.io (Single Key for 9 Sports)
| Sport | API | Requests/Day | Endpoint |
|-------|-----|--------------|----------|
| ⚽ Football/Soccer | API-Football | 100/day | v3.football.api-sports.io |
| 🏀 Basketball | API-Basketball | 100/day | v1.basketball.api-sports.io |
| 🏒 Ice Hockey | API-Hockey | 100/day | v1.hockey.api-sports.io |
| ⚾ Baseball | API-Baseball | 100/day | v1.baseball.api-sports.io |
| 🏈 American Football (NFL) | API-NFL | 100/day | v1.american-football.api-sports.io |
| 🏉 Rugby | API-Rugby | 100/day | v1.rugby.api-sports.io |
| 🏐 Volleyball | API-Volleyball | 100/day | v1.volleyball.api-sports.io |
| 🤾 Handball | API-Handball | 100/day | v1.handball.api-sports.io |
| 🏈 AFL | API-AFL | 100/day | v1.afl.api-sports.io |

### Fallback API: The Odds API (All Other Sports)
The Odds API covers sports NOT available via API-Sports.io:

| Sport | Coverage |
|-------|----------|
| 🎾 Tennis | ATP, WTA, Grand Slams |
| 🏏 Cricket | ICC, IPL, Test Matches |
| ⛳ Golf | PGA, Majors |
| 🥊 Boxing/MMA | UFC, Major Fights |
| 🎯 Darts | PDC Events |
| 🎱 Snooker | World Championship, etc. |
| + More | See the-odds-api.com for full list |

**Free Tier**: 500 requests/month

### Unsupported Sports (Require Manual Settlement)
🎮 Esports | 🏓 Table Tennis | 🏸 Badminton

These sports have no reliable API coverage and must be settled manually.

## Automatic Checking Features

- ✅ **Batch Optimization**: Groups bets by sport and date to minimize API calls
- ✅ **Per-Sport Rate Limits**: Tracks daily usage for each sport independently
- ✅ **30-Minute Delay**: Only checks results 30 minutes after event ends
- ✅ **Smart Retries**: Maximum 5 attempts with exponential backoff (1hr, 2hr, 4hr, 8hr, 24hr)
- ✅ **Unsupported Sport Detection**: Automatically marks unsupported sports for manual settlement
- ✅ **Diagnostic Logging**: Records API responses and match failures for debugging
- ✅ **Hourly Background Checks**: Automatically checks eligible pending bets every hour
- ✅ **Manual Check Button**: Use "🔍 Check Results" button anytime

## Step 1: Get API-Sports Key (Single Key for All Sports)

1. Visit: https://www.api-football.com/
2. Click "Get Free Trial" or "Register"
3. Create a free account
4. Go to your dashboard: https://dashboard.api-football.com/
5. Copy your API key from the dashboard

**Free Tier Limits:**
- 100 requests per day **per sport**
- Single key works for all 10 sports
- Total: 1,000 requests/day across all sports
- Sufficient for ~50-100 bet checks per day

## Step 2: Get The Odds API Key (Optional Fallback)

1. Visit: https://the-odds-api.com/
2. Click "Get API Key"
3. Create a free account
4. Copy your API key from the dashboard

**Free Tier Limits:**
- 500 requests per month
- Covers additional sports not in api-sports.io
- Useful for tennis, minor leagues, etc.

## Step 3: Configure API Keys

1. Click the **⚙️ Settings** button in the extension popup
2. Navigate to the **🔑 API Setup** tab
3. Paste your API-Football key in the first field
4. (Optional) Paste your Odds API key in the second field
5. Click **Test Connection** to verify
6. Click **Save Changes**

## Step 4: Verify Setup

1. Open the extension popup
2. Click "🔍 Check Results" button
3. You should see a message like:
   - "Checking X bets for results (batched)..."
   - "Found Y result(s)"
   - Or "No bets ready for lookup yet" (if no events have finished + 30 min)

## How Batch Processing Works

The extension groups bets by sport and date to minimize API calls:

**Example**: If you have 5 football bets from November 25th and 3 basketball bets from November 25th:
- ❌ Old behavior: 8 API calls (one per bet)
- ✅ New behavior: 2 API calls (one for football+date, one for basketball+date)

**Cache**: Results are cached for 10 minutes to prevent duplicate calls.

## Viewing API Diagnostics

To debug why bets aren't being auto-settled:

1. Click **⚙️ Settings** in the extension popup
2. Navigate to the **🔍 API Diagnostics** tab
3. View:
   - **Rate Limits**: See usage for each sport (resets daily)
   - **Diagnostic Log**: Recent API calls, matches, and failures
4. Click **📥 Export JSON** to download logs for analysis

### Diagnostic Log Types

| Type | Description |
|------|-------------|
| `api_response` | Raw API response with fixture count and samples |
| `match_success` | Bet successfully matched to fixture |
| `match_failure` | Bet could not be matched (shows top candidates) |
| `api_error` | API call failed (rate limit, network, etc.) |
| `unsupported_sport` | Sport not supported for auto-checking |
| `result_determined` | Outcome calculated from fixture scores |

## Supported Markets

### Football/Soccer (API-Football)
- **1X2**: Home win, Draw, Away win
- **Over/Under**: Goals (0.5, 1.5, 2.5, 3.5, 4.5, etc.)
- **Asian Handicap**: AH1, AH2 with positive/negative values
- **Cards**: Total yellow/red cards
- **Lay Bets**: Automatically inverts outcome logic

### Other Sports (Basketball, Hockey, Baseball, NFL, etc.)
- **Moneyline/Winner**: Home/Away win
- **Spread/Handicap**: Point spreads
- **Totals**: Over/Under total points/goals
- **Lay Bets**: Automatically inverts outcome logic

## Rate Limit Warnings

When any sport reaches 90% of its daily limit, you'll see:
- ⚠️ Warning banner in the API Diagnostics section
- Bets for that sport will be skipped until the limit resets

Rate limits reset at **midnight UTC**.

## Troubleshooting

### "No API keys configured"
- Check that you saved the API key in Settings → API Setup
- Reload the extension after saving

### "No bets ready for lookup yet"
- Event must have finished at least 30 minutes ago
- Check event time is correct in bet details
- Retry count hasn't reached 5 yet

### "Found 0 result(s)"
- Check the Diagnostic Log for match failures
- API might not have data for that league/competition
- Try again later or settle manually

### "Unsupported sport"
- Some sports (tennis, esports, etc.) don't have API support
- These bets are automatically marked for manual settlement
- Settle them manually using the Won/Lost buttons

### Rate Limit Errors
- Check API Diagnostics → Rate Limits
- Wait for daily reset (midnight UTC) or upgrade to paid plan

### Match Failures
- Check Diagnostic Log → Filter by "Match Failures"
- Common causes:
  - Team name mismatch (abbreviations, translations)
  - Event not in API (minor leagues, friendlies)
  - Wrong date (timezone issues)

## Privacy & Security

- API keys are stored locally in your browser (not uploaded anywhere)
- API requests only sent when you click "Check Results" or hourly auto-check runs
- No bet data is sent to external servers except event names for matching
- All bet data stays in your browser's local storage

## Optional: Use Only One API

If you only bet on football/soccer:
- Only set up API-Football key
- Leave The Odds API key empty

If you only bet on other sports:
- Only set up The Odds API key (limited support)
- Leave API-Football key empty

The extension will work with whichever keys are configured.

## Need Help?

1. Check the Diagnostic Log in Settings → API Diagnostics
2. Export diagnostics JSON for detailed analysis
3. Check the browser console (F12 → Console tab) for error messages



