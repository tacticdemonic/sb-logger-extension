"""
OddsHarvester API Server for CLV Tracking
==========================================

A FastAPI server that wraps OddsHarvester to provide historical closing odds
data for the Surebet Helper browser extension.

Endpoints:
- GET  /health                    - Server status, version, database info
- POST /api/batch-closing-odds    - Submit batch of bets for CLV lookup
- GET  /api/job-status/{job_id}   - Get job progress and results
- DELETE /api/clear-cache         - Clear old cached data
- GET  /api/check-updates         - Check for OddsHarvester updates
- POST /api/update-harvester      - Pull latest OddsHarvester code
- GET  /api/cache-stats           - Get cache statistics
- GET  /api/league-mappings       - Get current league mappings
- POST /api/league-mappings       - Update custom league mappings
"""

import asyncio
import json
import logging
import os
import requests
import subprocess
import sys
import threading
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import Database
from fuzzy_matcher import find_best_match
from league_mapper import detect_league, get_league_mappings, log_unmapped_league

# Configuration from environment variables
ODDS_HARVESTER_PATH = os.getenv(
    "ODDS_HARVESTER_PATH", str(Path(__file__).parent / "OddsHarvester")
)
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "3"))
CACHE_RETENTION_DAYS = int(os.getenv("CACHE_RETENTION_DAYS", "30"))
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8765"))

# Shared config directory (accessible by both extension and server)
if os.name == 'nt':  # Windows
    SHARED_CONFIG_DIR = Path(os.getenv('LOCALAPPDATA')) / 'SurebetHelper'
else:  # macOS/Linux
    SHARED_CONFIG_DIR = Path.home() / '.surebethelper'

SHARED_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
SHARED_CONFIG_PATH = SHARED_CONFIG_DIR / 'config.json'

# Try to get The Odds API key from multiple sources (PRIORITY ORDER)
# 1. Shared config.json (preferred - used by extension)
# 2. Local config.json (legacy support)
# 3. Environment variable (fallback)
THE_ODDS_API_KEY = ""
config_source = None

# Priority 1: Shared config directory
if SHARED_CONFIG_PATH.exists():
    try:
        with open(SHARED_CONFIG_PATH) as f:
            config = json.load(f)
            THE_ODDS_API_KEY = config.get("THE_ODDS_API_KEY", "")
            if THE_ODDS_API_KEY:
                config_source = f"shared config ({SHARED_CONFIG_PATH})"
    except Exception as e:
        pass  # Will try next source

# Priority 2: Local config.json (legacy)
if not THE_ODDS_API_KEY:
    local_config_path = Path(__file__).parent / "config.json"
    if local_config_path.exists():
        try:
            with open(local_config_path) as f:
                config = json.load(f)
                THE_ODDS_API_KEY = config.get("THE_ODDS_API_KEY", "")
                if THE_ODDS_API_KEY:
                    config_source = f"local config ({local_config_path})"
        except Exception as e:
            pass  # Will try next source

# Priority 3: Environment variable
if not THE_ODDS_API_KEY:
    THE_ODDS_API_KEY = os.getenv("THE_ODDS_API_KEY", "")
    if THE_ODDS_API_KEY:
        config_source = "environment variable"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# Global state
db: Optional[Database] = None
job_processor: Optional["JobProcessor"] = None
scheduler: Optional[BackgroundScheduler] = None


# === Helper Functions ===

def map_to_odds_api_sport(sport: str, league: str) -> Optional[str]:
    """Map sport/league to The Odds API sport key."""
    sport_lower = sport.lower()
    league_lower = league.lower()
    
    if sport_lower in ['football', 'soccer']:
        if 'premier' in league_lower or 'epl' in league_lower:
            return 'soccer_epl'
        elif 'la liga' in league_lower or 'spain' in league_lower:
            return 'soccer_spain_la_liga'
        elif 'bundesliga' in league_lower or 'germany' in league_lower:
            return 'soccer_germany_bundesliga'
        elif 'serie a' in league_lower or 'italy' in league_lower:
            return 'soccer_italy_serie_a'
        elif 'ligue 1' in league_lower or 'france' in league_lower:
            return 'soccer_france_ligue_one'
        elif 'champions' in league_lower:
            return 'soccer_uefa_champs_league'
        else:
            return 'soccer_epl'
    elif sport_lower == 'basketball':
        return 'basketball_nba'
    elif sport_lower == 'tennis':
        return 'tennis_atp' if 'atp' in league_lower or 'men' in league_lower else 'tennis_wta'
    elif sport_lower in ['american football', 'nfl']:
        return 'americanfootball_nfl'
    elif sport_lower in ['ice hockey', 'hockey']:
        return 'icehockey_nhl'
    elif sport_lower == 'baseball':
        return 'baseball_mlb'
    
    return None


def map_to_oddsharvester_params(sport: str, league: str) -> Optional[tuple]:
    """Map sport/league to OddsHarvester format (sport, league)."""
    sport_map = {
        'football': 'football',
        'soccer': 'football',
        'basketball': 'basketball',
        'tennis': 'tennis',
        'ice hockey': 'ice-hockey',
        'baseball': 'baseball'
    }
    
    league_map = {
        'premier league': 'england-premier-league',
        'epl': 'england-premier-league',
        'england-premier-league': 'england-premier-league',
        'la liga': 'spain-primera-division',
        'serie a': 'italy-serie-a',
        'bundesliga': 'germany-bundesliga',
        'ligue 1': 'france-ligue-1',
        'champions league': 'europe-champions-league',
        'nba': 'nba',  # OddsHarvester expects just 'nba', not 'usa-nba'
        'usa-nba': 'nba',  # Map our internal format to OddsHarvester format
        'atp': 'atp-singles',
        'wta': 'wta-singles'
    }
    
    oh_sport = sport_map.get(sport.lower())
    oh_league = league_map.get(league.lower(), league.lower().replace(' ', '-'))
    
    return (oh_sport, oh_league) if oh_sport else None


# === Pydantic Models ===


class BetRequest(BaseModel):
    """Single bet request for CLV lookup."""

    betId: str
    sport: str
    tournament: Optional[str] = ""
    homeTeam: str
    awayTeam: str
    market: str
    eventDate: str  # ISO format date
    bookmaker: str


class BatchRequest(BaseModel):
    """Batch of bets for CLV lookup."""

    bets: list[BetRequest]
    fallbackStrategy: str = Field(
        default="pinnacle", pattern="^(exact|pinnacle|weighted_avg)$"
    )


class JobResponse(BaseModel):
    """Response for batch job creation."""

    job_id: str
    total_bets: int
    status: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""

    job_id: str
    status: str
    progress: dict
    results: list[dict]
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    odds_harvester_version: str
    db_size: float
    cache_age: Optional[int]
    pending_jobs: int
    failure_rate: float
    active_concurrency: int
    recommended_concurrency: int
    health_state: str


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""

    total_size_mb: float
    league_cache_count: int
    odds_cache_count: int
    oldest_entry: Optional[str]
    newest_entry: Optional[str]


class UpdateCheckResponse(BaseModel):
    """Update check response."""

    update_available: bool
    local_version: str
    remote_version: str
    commits_behind: int


# === Job Processing ===


class JobProcessor:
    """Background processor for CLV jobs."""

    def __init__(self, database: Database, max_workers: int = 3):
        self.db = database
        self.max_workers = max_workers
        self.current_workers = max_workers
        self.running = False
        self._lock = asyncio.Lock()
        self._active_jobs: dict[str, dict] = {}
        self._background_tasks: set = set()

    async def start(self):
        """Start the job processor."""
        self.running = True
        # Start background processing loop
        asyncio.create_task(self._process_loop())
        logger.info(f"Job processor started with max {self.max_workers} workers")

    async def stop(self):
        """Stop the job processor."""
        self.running = False
        # Wait for all background tasks to complete
        if self._background_tasks:
            await asyncio.gather(*self._background_tasks, return_exceptions=True)
        logger.info("Job processor stopped")

    def get_active_concurrency(self) -> int:
        """Get current active concurrency level."""
        return self.current_workers

    def get_recommended_concurrency(self) -> int:
        """Calculate recommended concurrency based on available RAM."""
        try:
            mem = psutil.virtual_memory()
            available_gb = mem.available / (1024 ** 3)
            # Each OddsHarvester process can use ~1-2GB
            recommended = max(1, min(self.max_workers, int(available_gb / 2)))
            return recommended
        except Exception:
            return self.max_workers

    def _adjust_concurrency(self):
        """Adjust concurrency based on system resources."""
        recommended = self.get_recommended_concurrency()
        if recommended != self.current_workers:
            logger.info(
                f"Adjusting concurrency: {self.current_workers} -> {recommended}"
            )
            self.current_workers = recommended

    async def _process_loop(self):
        """Main processing loop."""
        while self.running:
            try:
                # Adjust concurrency every iteration
                self._adjust_concurrency()

                # Get queued jobs
                queued_jobs = self.db.get_jobs_by_status("queued")

                for job in queued_jobs:
                    if not self.running:
                        break

                    job_id = job["id"]
                    if job_id in self._active_jobs:
                        continue

                    # Mark as processing
                    self.db.update_job_status(job_id, "processing")
                    async with self._lock:
                        self._active_jobs[job_id] = {"started": time.time()}

                    # Create async task for job processing
                    task = asyncio.create_task(self._process_job(job_id))
                    self._background_tasks.add(task)
                    task.add_done_callback(self._background_tasks.discard)

                # Sleep before next poll
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Error in process loop: {e}")
                await asyncio.sleep(60)

    async def _process_job(self, job_id: str):
        """Process a single job."""
        try:
            logger.info(f"🚀 Starting _process_job for {job_id}")
            logger.info(f"Processing job {job_id}")
            bet_requests = self.db.get_bet_requests(job_id)
            logger.info(f"📦 Retrieved {len(bet_requests)} bet requests from database")

            if not bet_requests:
                logger.warning(f"⚠️ No bet requests found for job {job_id}")
                self.db.update_job_status(job_id, "completed")
                return
            
            logger.info(f"🔄 About to call _group_bets with {len(bet_requests)} bets")
            # Group bets by league/date for efficient scraping
            groups = self._group_bets(bet_requests)
            logger.info(f"📊 Grouping returned {len(groups)} groups")
            total_processed = 0

            for group_key, group_bets in groups.items():
                if not self.running:
                    break

                sport, league, event_date = group_key
                
                logger.info(f"🔍 Processing group: {sport}/{league} on {event_date} ({len(group_bets)} bets)")

                # Check cache first
                cached_data = self.db.get_cached_league_data(sport, league, event_date)

                if not cached_data:
                    logger.info(f"💾 No cache found, scraping {sport}/{league}...")
                    # Scrape from OddsHarvester (now async)
                    scraped_data = await self._scrape_league(sport, league, event_date)
                    if scraped_data:
                        logger.info(f"✅ Scraped {len(scraped_data.get('matches', []))} matches")
                        self.db.cache_league_data(
                            sport, league, event_date, scraped_data
                        )
                        cached_data = scraped_data
                    else:
                        logger.warning(f"⚠️ No data from scraping")
                else:
                    logger.info(f"📦 Using cached data for {sport}/{league}")

                # Match bets to scraped data
                logger.info(f"🎯 Matching {len(group_bets)} bets to odds data...")
                for bet in group_bets:
                    logger.info(f"   Processing: {bet.get('home_team')} vs {bet.get('away_team')}")
                    result = self._match_bet_to_odds(bet, cached_data)
                    logger.info(f"   Result: closingOdds={result.get('closingOdds')}, score={result.get('matchScore')}")
                    self.db.update_bet_result(bet["id"], result)
                    total_processed += 1
                    self.db.update_job_progress(job_id, total_processed)

            self.db.update_job_status(job_id, "completed")
            logger.info(f"Job {job_id} completed: {total_processed} bets processed")

        except Exception as e:
            logger.error(f"❌ Error processing job {job_id}: {e}")
            logger.error(f"❌ Exception type: {type(e).__name__}")
            logger.error(f"❌ Traceback:", exc_info=True)
            self.db.update_job_status(job_id, "failed", str(e))
            self.db.log_failure(job_id, "processing_error", str(e))

        finally:
            async with self._lock:
                self._active_jobs.pop(job_id, None)

    def _group_bets(
        self, bets: list[dict]
    ) -> dict[tuple[str, str, str], list[dict]]:
        """Group bets by sport, league, and date for batch scraping."""
        groups: dict[tuple[str, str, str], list[dict]] = {}

        logger.info(f"📊 Grouping {len(bets)} bets by sport/league/date...")

        for bet in bets:
            # Detect league from team names
            league_info = detect_league(
                bet["home_team"],
                bet["away_team"],
                bet.get("tournament", ""),
                bet["sport"],
            )

            if league_info:
                league = league_info["league"]
                inferred_sport = league_info.get("sport", bet["sport"])  # Use inferred sport if available
                logger.info(f"   ✅ {bet['home_team']} vs {bet['away_team']} -> {inferred_sport}/{league}")
            else:
                league = "unknown"
                inferred_sport = bet["sport"]
                logger.warning(f"   ⚠️ {bet['home_team']} vs {bet['away_team']} -> UNKNOWN league")

            key = (inferred_sport, league, bet["event_date"])  # Use inferred_sport instead of bet["sport"]

            if key not in groups:
                groups[key] = []
            groups[key].append(bet)

        logger.info(f"✅ Created {len(groups)} groups: {list(groups.keys())}")
        return groups

    async def _scrape_league_with_oddsharvester(self, sport: str, league: str, event_date: str) -> Optional[dict]:
        """
        Try to fetch odds using OddsHarvester (async).
        Returns None if OddsHarvester fails or is blocked.
        """
        try:
            # Import OddsHarvester components
            sys.path.insert(0, str(Path(ODDS_HARVESTER_PATH) / "src"))
            from core.odds_portal_scraper import OddsPortalScraper
            from core.playwright_manager import PlaywrightManager
            from core.browser_helper import BrowserHelper
            from core.odds_portal_market_extractor import OddsPortalMarketExtractor
            
            logger.info(f"🕷️ Attempting OddsHarvester scrape for {sport}/{league}")
            
            # Map to OddsHarvester format
            oh_params = map_to_oddsharvester_params(sport, league)
            if not oh_params:
                logger.warning(f"⚠️ No OddsHarvester mapping for {sport}/{league}")
                return None
            
            oh_sport, oh_league = oh_params
            date_obj = datetime.fromisoformat(event_date.replace("Z", "+00:00"))
            oh_date = date_obj.strftime("%Y%m%d")
            
            # Determine season for historic scraping
            # Most football leagues run Aug-May, so season spans two years
            # E.g., Dec 2024 is in 2024-2025 season, Aug 2025 is in 2025-2026 season
            year = date_obj.year
            month = date_obj.month
            
            if month >= 8:  # August onwards = new season starting
                season = f"{year}-{year+1}"
            else:  # Jan-July = second half of season that started previous year
                season = f"{year-1}-{year}"
            
            logger.info(f"🔑 OddsHarvester: {oh_sport}/{oh_league} season {season}")
            
            # Initialize components
            playwright_manager = PlaywrightManager()
            browser_helper = BrowserHelper()
            market_extractor = OddsPortalMarketExtractor(browser_helper)
            
            scraper = OddsPortalScraper(
                playwright_manager=playwright_manager,
                browser_helper=browser_helper,
                market_extractor=market_extractor,
                preview_submarkets_only=False
            )
            
            # Start browser with timeout
            await asyncio.wait_for(
                scraper.start_playwright(headless=True),
                timeout=30
            )
            
            try:
                # Scrape HISTORIC matches (not upcoming) to get closing odds
                logger.info(f"🕒 Scraping historic matches for season {season}...")
                results = await asyncio.wait_for(
                    scraper.scrape_historic(
                        sport=oh_sport,
                        league=oh_league,
                        season=season,
                        markets=['home_away_draw', 'over_under_goals_2_5'],  # OddsHarvester market names
                        scrape_odds_history=False,
                        target_bookmaker='pinnacle',  # Focus on Pinnacle for CLV
                        max_pages=1  # Only scrape first page for performance
                    ),
                    timeout=120  # 2 minute timeout per scrape
                )
                
                if not results:
                    logger.warning(f"⚠️ OddsHarvester returned no results for {season}")
                    return None
                
                logger.info(f"📊 OddsHarvester found {len(results)} matches in season, filtering by date {event_date}...")
                
                # Filter results to only include matches from the target date
                target_date = date_obj.date()
                filtered_results = []
                
                for match_data in results:
                    match_date_str = match_data.get('start_date', '')
                    if match_date_str:
                        try:
                            # Parse match date (format varies: "2025-12-01" or "01.12.2025" or timestamp)
                            if isinstance(match_date_str, str):
                                if '-' in match_date_str:
                                    match_date = datetime.fromisoformat(match_date_str.split('T')[0]).date()
                                elif '.' in match_date_str:
                                    # DD.MM.YYYY format
                                    parts = match_date_str.split('.')
                                    match_date = datetime(int(parts[2]), int(parts[1]), int(parts[0])).date()
                                else:
                                    continue
                                
                                if match_date == target_date:
                                    filtered_results.append(match_data)
                        except Exception as e:
                            logger.debug(f"Failed to parse date '{match_date_str}': {e}")
                            continue
                
                if not filtered_results:
                    logger.warning(f"⚠️ No matches found for date {target_date} (checked {len(results)} season matches)")
                    return None
                
                logger.info(f"✅ Found {len(filtered_results)} matches for {target_date}")
                results = filtered_results
                
                # Transform to expected format
                matches = []
                for match_data in results:
                    match = {
                        'home_team': match_data.get('home_team', ''),
                        'away_team': match_data.get('away_team', ''),
                        'date': match_data.get('start_date', event_date),
                        'odds': {}
                    }
                    
                    markets_data = match_data.get('markets', {})
                    for market_name, market_data in markets_data.items():
                        if not isinstance(market_data, dict):
                            continue
                        
                        formatted_market = {
                            '1x2': '1X2',
                            'over_under_2_5': 'Over/Under 2.5',
                            'btts': 'Both Teams to Score'
                        }.get(market_name, market_name)
                        
                        match['odds'][formatted_market] = {'bookmakers': {}}
                        
                        # Extract bookmaker odds from market data
                        for key, value in market_data.items():
                            if isinstance(value, list):
                                for entry in value:
                                    if isinstance(entry, dict):
                                        bookie = entry.get('bookmaker_name', '').lower()
                                        
                                        # Get odds value
                                        odds_val = None
                                        if '1' in entry:
                                            odds_val = float(entry['1'])
                                        elif 'odds_over' in entry:
                                            odds_val = float(entry['odds_over'])
                                        else:
                                            for k, v in entry.items():
                                                if k not in ['bookmaker_name', 'period'] and isinstance(v, (int, float, str)):
                                                    try:
                                                        odds_val = float(v)
                                                        break
                                                    except:
                                                        pass
                                        
                                        if odds_val and bookie:
                                            match['odds'][formatted_market]['bookmakers'][bookie] = odds_val
                    
                    if match['odds']:
                        matches.append(match)
                
                logger.info(f"✅ OddsHarvester: {len(matches)} matches scraped")
                
                return {
                    'matches': matches,
                    'sport': sport,
                    'league': league,
                    'season': f"{date_obj.year}-{date_obj.year + 1}",
                    'scraped_at': datetime.now().isoformat(),
                    'source': 'oddsharvester'
                } if matches else None
            
            finally:
                await scraper.stop_playwright()
        
        except asyncio.TimeoutError:
            logger.warning("⏱️ OddsHarvester timeout - trying fallback")
            return None
        except ImportError as e:
            logger.warning(f"⚠️ OddsHarvester import failed: {e}")
            return None
        except Exception as e:
            logger.warning(f"⚠️ OddsHarvester error: {e}")
            return None

    async def _scrape_with_odds_api(self, sport: str, league: str, event_date: str) -> Optional[dict]:
        """Fallback: Fetch odds from The Odds API (async to avoid blocking event loop)."""
        try:
            if not THE_ODDS_API_KEY:
                logger.warning("⚠️ THE_ODDS_API_KEY not configured")
                return None
            
            sport_key = map_to_odds_api_sport(sport, league)
            if not sport_key:
                logger.warning(f"⚠️ No API mapping for {sport}/{league}")
                return None
            
            logger.info(f"🌐 Fetching from The Odds API: {sport_key}")
            
            url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds"
            params = {
                'apiKey': THE_ODDS_API_KEY,
                'regions': 'us,uk,eu',
                'markets': 'h2h,spreads,totals',
                'oddsFormat': 'decimal',
                'dateFormat': 'iso'
            }
            
            # Use async httpx instead of blocking requests
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params)
                remaining = response.headers.get('x-requests-remaining', 'unknown')
                logger.info(f"📊 API Quota: {remaining} remaining")
                
                response.raise_for_status()
                events = response.json()
            
            if not events:
                return None
            
            # Filter and transform
            target_date = datetime.fromisoformat(event_date.replace("Z", "+00:00")).date()
            matches = []
            
            for event in events:
                event_date_obj = datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00'))
                if abs((event_date_obj.date() - target_date).days) > 1:
                    continue
                
                match = {
                    'home_team': event['home_team'],
                    'away_team': event['away_team'],
                    'date': event['commence_time'],
                    'odds': {}
                }
                
                for bookmaker in event.get('bookmakers', []):
                    bookie_key = bookmaker['key'].lower()
                    bookie_map = {
                        'pinnacle': 'pinnacle',
                        'betfair': 'betfair',
                        'smarkets': 'smarkets',
                        'bet365': 'bet365'
                    }
                    normalized_bookie = bookie_map.get(bookie_key, bookie_key)
                    
                    for market in bookmaker.get('markets', []):
                        market_name = {
                            'h2h': '1X2',
                            'spreads': 'Spread',
                            'totals': 'Over/Under 2.5'
                        }.get(market['key'], market['key'])
                        
                        if market_name not in match['odds']:
                            match['odds'][market_name] = {'bookmakers': {}}
                        
                        for outcome in market.get('outcomes', []):
                            if outcome['name'] == event['home_team']:
                                match['odds'][market_name]['bookmakers'][normalized_bookie] = outcome['price']
                                break
                
                if match['odds']:
                    matches.append(match)
            
            logger.info(f"✅ The Odds API: {len(matches)} matches fetched")
            
            return {
                'matches': matches,
                'sport': sport,
                'league': league,
                'season': f"{target_date.year}-{target_date.year + 1}",
                'scraped_at': datetime.now().isoformat(),
                'source': 'the_odds_api'
            } if matches else None
        
        except Exception as e:
            logger.error(f"❌ The Odds API error: {e}")
            return None

    async def _scrape_league(self, sport: str, league: str, event_date: str) -> Optional[dict]:
        """
        Try to fetch odds using OddsHarvester first, fallback to The Odds API.
        Returns scraped data or None if both fail.
        """
        logger.info(f"🌐 Fetching odds for {sport}/{league} on {event_date}")
        
        # Skip OddsHarvester if league is unknown (it will error out)
        if league == "unknown":
            logger.info(f"⚠️ League unknown - skipping OddsHarvester, using The Odds API only")
        else:
            # Strategy 1: Try OddsHarvester (free, unlimited)
            try:
                result = await self._scrape_league_with_oddsharvester(sport, league, event_date)
                
                if result:
                    logger.info(f"✅ OddsHarvester succeeded for {sport}/{league}")
                    return result
                    
            except Exception as e:
                logger.warning(f"⚠️ OddsHarvester failed: {e}")
        
        # Strategy 2: Fallback to The Odds API (reliable, quota-limited)
        logger.info(f"🔄 Falling back to The Odds API...")
        try:
            result = await self._scrape_with_odds_api(sport, league, event_date)
            if result:
                logger.info(f"✅ The Odds API succeeded for {sport}/{league}")
                return result
        except Exception as e:
            logger.warning(f"⚠️ The Odds API failed: {e}")
        
        # Strategy 3: Both failed
        logger.error(f"❌ Both OddsHarvester and The Odds API failed for {sport}/{league}")
        return None
    
    def _match_bet_to_odds(
        self, bet: dict, scraped_data: Optional[dict]
    ) -> dict:
        """Match a bet to closing odds from scraped data."""
        result = {
            "closingOdds": None,
            "bookmakerUsed": None,
            "fallbackType": "failed",
            "confidence": 0.0,
            "matchScore": 0.0,
        }

        if not scraped_data:
            return result

        # Normalize team names for matching
        home_normalized = normalize_team_name(bet["home_team"])
        away_normalized = normalize_team_name(bet["away_team"])
        target_bookmaker = normalize_bookmaker(bet["bookmaker"])

        matches = scraped_data.get("matches", [])

        # Find matching event
        best_match = None
        best_score = 0.0

        for match in matches:
            match_home = normalize_team_name(match.get("home_team", ""))
            match_away = normalize_team_name(match.get("away_team", ""))

            # Calculate match score
            home_result = find_best_match(home_normalized, [match_home])
            away_result = find_best_match(away_normalized, [match_away])

            if home_result and away_result:
                score = (home_result["score"] + away_result["score"]) / 2
                if score > best_score:
                    best_score = score
                    best_match = match

        if not best_match or best_score < 0.5:  # Lowered from 0.75 for testing
            logger.warning(f"❌ No match found for {bet['home_team']} vs {bet['away_team']} (best score: {best_score:.2f})")
            return result

        logger.info(f"✅ Matched {bet['home_team']} vs {bet['away_team']} with score {best_score:.2f}")
        result["matchScore"] = best_score

        # Get odds from matched event
        odds_data = best_match.get("odds", {})
        market_odds = odds_data.get(bet["market"], {})

        if not market_odds:
            logger.warning(f"Market '{bet['market']}' not found. Available: {list(odds_data.keys())}")
            return result

        # Apply fallback hierarchy: exact -> pinnacle -> weighted average
        bookmaker_odds = market_odds.get("bookmakers", {})

        # Try exact bookmaker match
        if target_bookmaker in bookmaker_odds:
            result["closingOdds"] = bookmaker_odds[target_bookmaker]
            result["bookmakerUsed"] = bet["bookmaker"]
            result["fallbackType"] = "exact"
            result["confidence"] = 0.95
            return result

        # Try Pinnacle
        pinnacle_variants = ["pinnacle", "pinnaclesports", "pinnacle.com"]
        for variant in pinnacle_variants:
            if variant in bookmaker_odds:
                result["closingOdds"] = bookmaker_odds[variant]
                result["bookmakerUsed"] = "Pinnacle"
                result["fallbackType"] = "pinnacle"
                result["confidence"] = 0.85
                return result

        # Weighted average fallback
        if bookmaker_odds:
            weights = {
                "pinnacle": 3.0,
                "betfair": 2.5,
                "smarkets": 2.0,
                "bet365": 1.5,
                "matchbook": 1.5,
            }

            total_weight = 0.0
            weighted_sum = 0.0

            for bookie, odds_value in bookmaker_odds.items():
                if isinstance(odds_value, (int, float)) and odds_value > 1.01:
                    weight = weights.get(bookie.lower(), 1.0)
                    weighted_sum += odds_value * weight
                    total_weight += weight

            if total_weight > 0:
                result["closingOdds"] = round(weighted_sum / total_weight, 3)
                result["bookmakerUsed"] = "Weighted Average"
                result["fallbackType"] = "weighted_avg"
                result["confidence"] = 0.7
                result["bookmakerCount"] = len(bookmaker_odds)

        return result


# === Lifespan Management ===


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    global db, job_processor, scheduler

    # Startup
    logger.info("Starting OddsHarvester API server...")
    logger.info(f"📁 Shared config directory: {SHARED_CONFIG_DIR}")
    
    # Log API configuration status
    if THE_ODDS_API_KEY:
        logger.info(f"✅ The Odds API key configured from {config_source}")
        logger.info(f"   Key preview: {THE_ODDS_API_KEY[:10]}...{THE_ODDS_API_KEY[-4:]}")
    else:
        logger.warning("⚠️ The Odds API key not configured - fallback will not work")
        logger.warning(f"   📋 Setup instructions:")
        logger.warning(f"   1. Open extension settings and add your API key")
        logger.warning(f"   2. Click 'Export Config' button to save to: {SHARED_CONFIG_PATH}")
        logger.warning(f"   3. Restart this server")
        logger.warning(f"   Alternative: Set environment variable $env:THE_ODDS_API_KEY='your_key'")

    # Initialize database
    db_path = Path(__file__).parent / "clv_cache.db"
    db = Database(str(db_path))
    logger.info(f"Database initialized at {db_path}")

    # Start job processor
    job_processor = JobProcessor(db, max_workers=MAX_CONCURRENCY)
    await job_processor.start()

    # Start scheduler for cleanup
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        lambda: cleanup_old_cache(db, CACHE_RETENTION_DAYS),
        "interval",
        hours=24,
        id="cache_cleanup",
    )
    scheduler.add_job(
        lambda: run_health_check(),
        "interval",
        hours=6,
        id="health_check",
    )
    scheduler.start()
    logger.info("Scheduler started")

    # Check for OddsHarvester updates
    try:
        logger.info("🔍 Checking for OddsHarvester updates...")
        local_version = get_odds_harvester_version()
        logger.info(f"   Local version: {local_version}")
        
        # Try to get remote version
        import urllib.request
        url = "https://api.github.com/repos/jordantete/OddsHarvester/commits/main"
        req = urllib.request.Request(url, headers={"User-Agent": "OddsHarvester-CLV-API"})
        
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            remote_sha = data["sha"][:7]
            
            if local_version != remote_sha and local_version != "unknown":
                logger.warning(f"⚠️  OddsHarvester update available!")
                logger.warning(f"   Current: {local_version} | Latest: {remote_sha}")
                logger.warning(f"   Update with: cd {ODDS_HARVESTER_PATH} && git pull")
            else:
                logger.info(f"✅ OddsHarvester is up to date ({local_version})")
    except Exception as e:
        logger.info(f"ℹ️  Could not check for updates (offline or rate limited): {str(e)[:50]}")

    # Run initial health check
    run_health_check()

    yield

    # Shutdown
    logger.info("Shutting down...")
    if job_processor:
        await job_processor.stop()
    if scheduler:
        scheduler.shutdown()
    if db:
        db.close()


# === Helper Functions ===


def normalize_team_name(team: str) -> str:
    """Normalize team name for matching."""
    if not team:
        return ""
    
    # Convert to lowercase and remove common prefixes/suffixes
    normalized = team.lower().strip()
    
    # Remove common suffixes
    suffixes = [" fc", " afc", " united", " city", " town", " athletic", " wanderers"]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)].strip()
    
    # Remove special characters
    normalized = "".join(c for c in normalized if c.isalnum() or c.isspace())
    
    return normalized.strip()


def normalize_bookmaker(bookmaker: str) -> str:
    """Normalize bookmaker name for matching."""
    if not bookmaker:
        return ""
    
    # Common mappings
    mappings = {
        "betfair": "betfair",
        "bet365": "bet365", 
        "pinnacle": "pinnacle",
        "smarkets": "smarkets",
        "matchbook": "matchbook",
        "betdaq": "betdaq",
        "williamhill": "williamhill",
        "ladbrokes": "ladbrokes",
        "coral": "coral",
        "paddy power": "paddypower",
        "paddypower": "paddypower",
        "10bet": "10bet",
        "unibet": "unibet",
    }
    
    normalized = bookmaker.lower().strip().replace(" ", "")
    return mappings.get(normalized, normalized)


def get_odds_harvester_version() -> str:
    """Get OddsHarvester git commit hash."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ODDS_HARVESTER_PATH,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def run_health_check():
    """Run a health check scrape to verify OddsHarvester is working."""
    global db

    try:
        logger.info("Running health check...")

        # Try to scrape a known completed match (recent Premier League)
        # This is a lightweight check to verify the scraper works
        test_cmd = [
            sys.executable,
            "-m",
            "src.main",
            "--help",
        ]

        result = subprocess.run(
            test_cmd,
            cwd=ODDS_HARVESTER_PATH,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode == 0:
            if db:
                db.set_metadata("last_health_check", datetime.now().isoformat())
                db.set_metadata("health_status", "healthy")
            logger.info("Health check passed")
        else:
            if db:
                db.set_metadata("health_status", "degraded")
            logger.warning("Health check failed: OddsHarvester not responding properly")

    except Exception as e:
        logger.error(f"Health check error: {e}")
        if db:
            db.set_metadata("health_status", "critical")


def calculate_health_state() -> str:
    """Calculate overall health state."""
    if not db:
        return "unknown"

    failure_rate = get_failure_rate(db)
    health_status = db.get_metadata("health_status") or "unknown"

    if health_status == "critical" or failure_rate > 0.5:
        return "critical"
    elif health_status == "degraded" or failure_rate > 0.1:
        return "degraded"
    else:
        return "healthy"


def get_cache_stats(db: Database) -> dict:
    """Get cache statistics."""
    conn = db._get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM closing_odds_cache")
    total_odds = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM league_cache")
    total_leagues = cursor.fetchone()[0]
    
    cursor.execute("SELECT MIN(scraped_at) FROM closing_odds_cache")
    oldest = cursor.fetchone()[0]
    
    # Convert Unix timestamp to ISO format if exists
    if oldest:
        oldest = datetime.fromtimestamp(oldest).isoformat()
    
    return {
        "total_odds": total_odds,
        "total_leagues": total_leagues,
        "oldest_timestamp": oldest
    }


def get_db_size(db: Database) -> float:
    """Get database file size in MB."""
    db_path = Path(db.db_path)
    if db_path.exists():
        return round(db_path.stat().st_size / (1024 * 1024), 2)
    return 0.0


def get_failure_rate(db: Database) -> float:
    """Calculate recent failure rate."""
    conn = db._get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*) FROM jobs 
        WHERE status = 'failed' 
        AND created_at > datetime('now', '-24 hours')
    """)
    failed = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM jobs 
        WHERE created_at > datetime('now', '-24 hours')
    """)
    total = cursor.fetchone()[0]
    
    return failed / total if total > 0 else 0.0


# === FastAPI App ===


app = FastAPI(
    title="OddsHarvester CLV API",
    description="Local API for fetching historical closing odds data",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Endpoints ===


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Get server health status."""
    global db, job_processor

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    pending_jobs = len(db.get_jobs_by_status("queued")) + len(
        db.get_jobs_by_status("processing")
    )

    cache_stats = get_cache_stats(db)
    oldest_timestamp = cache_stats.get("oldest_timestamp")
    cache_age = None
    if oldest_timestamp:
        cache_age = int(
            (datetime.now() - datetime.fromisoformat(oldest_timestamp)).total_seconds()
            / 86400
        )

    return HealthResponse(
        status="ok",
        version="1.0.0",
        odds_harvester_version=get_odds_harvester_version(),
        db_size=get_db_size(db),
        cache_age=cache_age,
        pending_jobs=pending_jobs,
        failure_rate=get_failure_rate(db),
        active_concurrency=job_processor.get_active_concurrency() if job_processor else 0,
        recommended_concurrency=job_processor.get_recommended_concurrency() if job_processor else MAX_CONCURRENCY,
        health_state=calculate_health_state(),
    )


@app.post("/api/batch-closing-odds")
async def create_batch_job(request: BatchRequest):
    """Create a batch job for CLV lookup and return results immediately for small batches."""
    global db, job_processor

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    job_id = str(uuid.uuid4())

    # Create job record
    db.create_job(job_id, len(request.bets))

    # Create bet request records
    for bet in request.bets:
        db.create_bet_request(
            job_id=job_id,
            bet_id=bet.betId,
            sport=bet.sport,
            tournament=bet.tournament or "",
            home_team=bet.homeTeam,
            away_team=bet.awayTeam,
            market=bet.market,
            event_date=bet.eventDate,
            bookmaker=bet.bookmaker,
        )

    logger.info(f"Created job {job_id} with {len(request.bets)} bets")

    # For small batches (<= 20 bets), process immediately and return results
    # This provides synchronous response for browser extension compatibility
    if len(request.bets) <= 20:
        logger.info(f"Processing job {job_id} synchronously (small batch)")
        
        # Call the actual job processing logic (includes grouping, scraping, matching)
        await job_processor._process_job(job_id)
        
        # Retrieve results from database
        bet_requests = db.get_bet_requests(job_id)
        results = []
        
        for bet_req in bet_requests:
            results.append({
                "bet_id": bet_req["bet_id"],
                "success": bet_req.get("result_odds") is not None,
                "error": bet_req.get("error"),
                "closing_odds": bet_req.get("result_odds"),
                "match_score": bet_req.get("match_score"),
                "bookmaker_used": bet_req.get("result_bookmaker"),
                "fallback_type": bet_req.get("fallback_type"),
                "confidence": bet_req.get("confidence")
            })
        
        # Job status already updated by _process_job
        job_status = db.get_job(job_id)
        
        return {
            "job_id": job_id,
            "total_bets": len(request.bets),
            "status": "completed",
            "processed": len(results),
            "failed": len([r for r in results if not r.get("success")]),
            "results": results
        }
    
    # For large batches, return job ID for async polling
    return {
        "job_id": job_id,
        "total_bets": len(request.bets),
        "status": "queued",
        "message": "Job queued for processing. Use /api/job-status/{job_id} to check progress."
    }


@app.get("/api/job-status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get status of a batch job."""
    global db

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    bet_results = db.get_bet_results(job_id)

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress={
            "current": job["processed_bets"],
            "total": job["total_bets"],
        },
        results=bet_results,
        error=job.get("error_log"),
    )


@app.delete("/api/clear-cache")
async def clear_cache(retention_days: int = 0):
    """Clear cached data."""
    global db

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    deleted = cleanup_old_cache(db, retention_days)

    return {
        "success": True,
        "deleted_leagues": deleted.get("leagues", 0),
        "deleted_odds": deleted.get("odds", 0),
        "freed_space_mb": deleted.get("freed_mb", 0),
        "new_size_mb": get_db_size(db),
    }


@app.get("/api/cache-stats", response_model=CacheStatsResponse)
async def get_cache_statistics():
    """Get cache statistics."""
    global db

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    stats = get_cache_stats(db)

    return CacheStatsResponse(
        total_size_mb=get_db_size(db),
        league_cache_count=stats.get("total_leagues", 0),
        odds_cache_count=stats.get("total_odds", 0),
        oldest_entry=stats.get("oldest_timestamp"),
        newest_entry=stats.get("oldest_timestamp"),  # Only have oldest in current implementation
    )


@app.get("/api/check-updates", response_model=UpdateCheckResponse)
async def check_for_updates():
    """Check for OddsHarvester updates."""
    import urllib.request

    try:
        # Get local version
        local_version = get_odds_harvester_version()

        # Get remote version from GitHub
        url = "https://api.github.com/repos/jordantete/OddsHarvester/commits/main"
        req = urllib.request.Request(
            url, headers={"User-Agent": "OddsHarvester-CLV-API"}
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            remote_sha = data["sha"][:7]

        # Check if different
        update_available = local_version != remote_sha and local_version != "unknown"

        return UpdateCheckResponse(
            update_available=update_available,
            local_version=local_version,
            remote_version=remote_sha,
            commits_behind=1 if update_available else 0,  # Simplified
        )

    except Exception as e:
        logger.error(f"Update check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-harvester")
async def update_harvester():
    """Pull latest OddsHarvester code."""
    try:
        # Git pull
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=ODDS_HARVESTER_PATH,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            raise Exception(result.stderr)
            
        return {"success": True, "output": result.stdout}
        
    except Exception as e:
        logger.error(f"Update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/league-mappings")
async def get_mappings():
    """Get current league mappings."""
    return get_league_mappings()

@app.post("/api/league-mappings")
async def update_mappings(mappings: dict):
    """Update custom league mappings."""
    update_custom_mappings(mappings)
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)
