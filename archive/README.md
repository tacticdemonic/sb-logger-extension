# Archived Experimental Code

This folder contains experimental code that was developed during the project but was ultimately not integrated into the final extension implementation.

## Files

### `bettingpros_scraper.py`

**Status**: Abandoned  
**Date Archived**: December 7, 2025  
**Purpose**: Experimental Selenium-based scraper for player prop odds from BettingPros.com

**Why Archived**:
- BettingPros "Consensus Line" does not represent true closing odds (just aggregated opening lines)
- Fragile HTML scraping approach using placeholder class names that break when site updates
- High maintenance overhead compared to API-based solutions
- Player prop CLV requires historical closing data, not consensus opening lines

**Key Code Snippet** (lines 40-98 - Consensus Line Extraction):
```python
# Parse text for Consensus Line
# Pattern: "18.5 (O -120.0 / U -125.0)"
import re

consensus_pattern = r"Consensus Line\s*\n\s*([\d\.]+)\s*\(O\s*([-\+]?\d+\.?\d*)\s*/\s*U\s*([-\+]?\d+\.?\d*)\)"
match = re.search(consensus_pattern, body_text)

if match:
    line = match.group(1)
    over_odds = match.group(2)
    under_odds = match.group(3)
    
    return {
        "player": player_name,
        "prop": prop_type,
        "line": line,
        "over_odds": over_odds,
        "under_odds": under_odds,
        "source": "Consensus Line Text Match",
        "status": "success"
    }
```

**Alternative Solution**: The extension now uses line movement tracking via The Odds API for player props, and OddsHarvester for game odds CLV.

---

### `oddsharvester_wrapper.py`

**Status**: Superseded  
**Date Archived**: December 7, 2025  
**Purpose**: Early prototype wrapper for calling OddsHarvester CLI via subprocess

**Why Archived**:
-- Replaced by comprehensive FastAPI server (archived at `archive/clv_api_attempts/odds_harvester_api/server.py`)
- Lacked job queue management and concurrent scrape limits
- No SQLite caching for results
- Single-bet interface inefficient compared to batch processing

**Key Code Snippet** (lines 50-68 - Subprocess CLI Execution):
```python
def get_odds_portal_clv(bet_data):
    """
    Submits a single bet to OddsHarvester API and waits for result.
    Note: For efficiency, batch processing should be used, but this wrapper 
    adapts the single-bet interface for now.
    """
    # Wrap single bet in batch request
    payload = {
        "bets": [
            {
                "betId": str(bet_data.get("id", "unknown")),
                "sport": bet_data.get("sport", "Football"),
                "tournament": bet_data.get("tournament", ""),
                "homeTeam": bet_data.get("teams", ["Home", "Away"])[0],
                "awayTeam": bet_data.get("teams", ["Home", "Away"])[1],
                "market": bet_data.get("market", ""),
                "eventDate": bet_data.get("eventTime", ""),
                "bookmaker": bet_data.get("bookmaker", "pinnacle")
            }
        ],
        "fallbackStrategy": "pinnacle"
    }
```

**Current Solution**: `archive/clv_api_attempts/odds_harvester_api/server.py` (archived) provides:
- FastAPI REST endpoints (`/api/batch-closing-odds`, `/api/job-status/{job_id}`)
- Job queue with concurrency limits (max 3 concurrent scrapes)
- SQLite caching with 30-day retention
- Batch processing optimization
- Automated installers for Windows/Linux/Mac

---

## When to Use These Files

**Do NOT** integrate these files into the extension. They are preserved for:
1. **Historical reference** - Understanding approaches that were explored
2. **Code examples** - Patterns that might inform future experiments
3. **Documentation** - Explaining why certain approaches were rejected

---

## Current CLV Implementation

For the production CLV tracking system, see:
- **Game Odds CLV**: CSV-based CLV (football-data.co.uk) — OddsHarvester archived at `archive/clv_api_attempts/odds_harvester_api`
- **Player Props**: `prop_poller.js` (line movement tracking via The Odds API)
- **Documentation**: `CLV_SETUP_GUIDE.md`, `CLV_TROUBLESHOOTING.md`

---

*Last Updated: December 7, 2025*
