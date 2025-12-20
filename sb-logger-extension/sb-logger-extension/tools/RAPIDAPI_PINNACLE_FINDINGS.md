# RapidAPI Pinnacle Odds - Test Results

**Date**: December 9, 2025  
**API Key**: Configured and working  
**Free Tier**: BASIC $0/month

## ✅ What Works

### 1. Sports List (`/kit/v1/sports`)
- Returns 11 sports including Soccer (ID: 1)
- No issues

### 2. Leagues List (`/kit/v1/leagues`)
- Returns 2,476 soccer leagues
- Includes all major leagues (Premier League, Championship, La Liga, etc.)
- No issues

### 3. Markets Endpoint (`/kit/v1/markets`)
- ✅ **Works perfectly** for CURRENT/UPCOMING matches
- Found 967 matches with live odds
- 245 English league matches available
- Returns full odds data (1X2, spreads, totals)
- Example odds structure:
  ```json
  {
    "event_id": 1618604891,
    "home": "Newcastle United",
    "away": "Fulham",
    "league_name": "England - EFL Cup",
    "starts": "2025-12-17T20:15:00",
    "periods": {
      "num_0": {
        "money_line": {
          "home": 1.694,
          "draw": 3.95,
          "away": 4.75
        }
      }
    }
  }
  ```

## ⚠️ Limitations / Issues

### 1. Archive Endpoint (`/kit/v1/archive`)
- **Status**: Partially working
- Returns 100 events per page (page_num must be >= 1)
- **Problem**: Only shows events from July 14, 2025 (old cached data?)
- Cannot find recent December matches (Birmingham vs Watford, etc.)
- May be free tier limitation or data caching issue

### 2. Event Details Endpoint (`/kit/v1/details`)
- **Status**: Returns empty/minimal data
- Response format: `{"events": [...]}`instead of `{"event": {...}}`
- For current matches: Returns empty data
- For archived matches: Returns minimal/no odds data
- **Likely free tier limitation** - closing odds may require paid plan

## 🎯 Integration Strategy for CLV

### Current Limitations
**The free tier CANNOT access historical closing odds** for CLV tracking. Archive endpoint shows old data, and details endpoint doesn't return odds for finished matches.

### Possible Solutions

#### Option 1: Hybrid Approach (Recommended)
1. **Track opening odds** when bet is placed (from markets endpoint)
2. **Poll for line movement** as match approaches (markets endpoint every 6-12 hours)
3. **Manually enter closing odds** from OddsPortal after match finishes
4. System stores: Opening, current (from polling), closing (manual)

#### Option 2: Upgrade to Paid Tier
- **PRO**: $10/month - May unlock archive access
- **ULTRA**: $39/month - Full historical data?
- **MEGA**: $99/month - Enterprise features
- Need to contact tipsters@rapi.one to confirm what each tier includes

#### Option 3: Pre-Match Monitoring Only
- Focus on **line movement tracking** instead of CLV
- Track how odds change from opening to kickoff
- Useful for identifying sharp money, but not true CLV

## 💡 Recommended Next Steps

### Immediate (Free Tier)
1. **Implement opening odds capture**: When user saves bet, fetch current Pinnacle odds from markets endpoint
2. **Add polling service**: Check odds changes every 6-12 hours before match
3. **Manual closing odds entry**: Add UI field for users to enter Pinnacle closing odds from OddsPortal

### Future (If Budget Allows)
1. **Test PRO tier** ($10/month) - May unlock archive/details endpoints
2. **Compare with Betfair** - Their Historical Data API is £20/month but guaranteed to work

## 📊 Free Tier Quota

From API headers:
- Not visible in current tests
- Need to monitor `x-requests-remaining` header
- BASIC tier likely 100-500 requests/month
- PRO tier mentioned as 10,000+ requests

## 🔧 Technical Notes

### Working Endpoints
```python
# Get current matches with odds
GET /kit/v1/markets?sport_id=1&is_have_odds=1&event_type=prematch

# Get sports
GET /kit/v1/sports

# Get leagues
GET /kit/v1/leagues?sport_id=1
```

### Non-Working Endpoints (Free Tier)
```python
# Archive returns old data
GET /kit/v1/archive?sport_id=1&page_num=1

# Details returns empty for closing odds
GET /kit/v1/details?event_id={event_id}
```

### Rate Limits
- Not tested yet
- Should implement exponential backoff
- Monitor response headers

## 🎯 Conclusion

**RapidAPI Pinnacle Odds is excellent for CURRENT odds but cannot provide historical closing odds on the free tier.**

**Best path forward**:
1. Use it for opening odds capture + line movement tracking (free)
2. Keep manual closing odds entry as fallback
3. Consider upgrading to PRO tier ($10/month) if it unlocks archive access
4. Alternative: Betfair Historical Data API (£20/month, guaranteed to work)
