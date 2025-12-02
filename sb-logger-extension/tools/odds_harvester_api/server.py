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
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import psutil
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import (
    Database,
    cleanup_old_cache,
    get_cache_stats,
    get_db_size,
    get_failure_rate,
    init_db,
)
from fuzzy_matcher import find_best_match, normalize_bookmaker, normalize_team_name
from league_mapper import detect_league, get_league_mappings, update_custom_mappings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("odds_harvester_api.log"),
    ],
)
logger = logging.getLogger("OddsHarvesterAPI")

# Configuration
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8765"))
ODDS_HARVESTER_PATH = os.getenv(
    "ODDS_HARVESTER_PATH", str(Path(__file__).parent / "OddsHarvester")
)
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "3"))
CACHE_RETENTION_DAYS = int(os.getenv("CACHE_RETENTION_DAYS", "30"))

# Global state
db: Optional[Database] = None
job_processor: Optional["JobProcessor"] = None
scheduler: Optional[BackgroundScheduler] = None


# === Pydantic Models ===


class BetRequest(BaseModel):
    """Single bet request for CLV lookup."""

    betId: str
    sport: str
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

    jobId: str
    totalBets: int
    status: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""

    jobId: str
    status: str
    progress: dict
    results: list[dict]
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    oddsHarvesterVersion: str
    dbSize: float
    cacheAge: Optional[int]
    pendingJobs: int
    failureRate: float
    activeConcurrency: int
    recommendedConcurrency: int
    healthState: str


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""

    totalSizeMB: float
    leagueCacheCount: int
    oddsCacheCount: int
    oldestEntry: Optional[str]
    newestEntry: Optional[str]


class UpdateCheckResponse(BaseModel):
    """Update check response."""

    updateAvailable: bool
    localVersion: str
    remoteVersion: str
    commitsBehind: int


# === Job Processing ===


class JobProcessor:
    """Background processor for CLV jobs."""

    def __init__(self, database: Database, max_workers: int = 3):
        self.db = database
        self.max_workers = max_workers
        self.current_workers = max_workers
        self.executor: Optional[ThreadPoolExecutor] = None
        self.running = False
        self._lock = threading.Lock()
        self._active_jobs: dict[str, dict] = {}

    def start(self):
        """Start the job processor."""
        self.running = True
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers)
        self._processor_thread = threading.Thread(target=self._process_loop, daemon=True)
        self._processor_thread.start()
        logger.info(f"Job processor started with max {self.max_workers} workers")

    def stop(self):
        """Stop the job processor."""
        self.running = False
        if self.executor:
            self.executor.shutdown(wait=True)
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

    def _process_loop(self):
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
                    self._active_jobs[job_id] = {"started": time.time()}

                    # Submit to thread pool
                    self.executor.submit(self._process_job, job_id)

                # Sleep before next poll
                time.sleep(30)

            except Exception as e:
                logger.error(f"Error in process loop: {e}")
                time.sleep(60)

    def _process_job(self, job_id: str):
        """Process a single job."""
        try:
            logger.info(f"Processing job {job_id}")
            bet_requests = self.db.get_bet_requests(job_id)

            if not bet_requests:
                self.db.update_job_status(job_id, "completed")
                return

            # Group bets by league/date for efficient scraping
            groups = self._group_bets(bet_requests)
            total_processed = 0

            for group_key, group_bets in groups.items():
                if not self.running:
                    break

                sport, league, event_date = group_key

                # Check cache first
                cached_data = self.db.get_cached_league_data(sport, league, event_date)

                if not cached_data:
                    # Scrape from OddsHarvester
                    scraped_data = self._scrape_league(sport, league, event_date)
                    if scraped_data:
                        self.db.cache_league_data(
                            sport, league, event_date, scraped_data
                        )
                        cached_data = scraped_data

                # Match bets to scraped data
                for bet in group_bets:
                    result = self._match_bet_to_odds(bet, cached_data)
                    self.db.update_bet_result(bet["id"], result)
                    total_processed += 1
                    self.db.update_job_progress(job_id, total_processed)

            self.db.update_job_status(job_id, "completed")
            logger.info(f"Job {job_id} completed: {total_processed} bets processed")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            self.db.update_job_status(job_id, "failed", str(e))
            self.db.log_failure(job_id, "processing_error", str(e))

        finally:
            with self._lock:
                self._active_jobs.pop(job_id, None)

    def _group_bets(
        self, bets: list[dict]
    ) -> dict[tuple[str, str, str], list[dict]]:
        """Group bets by sport, league, and date for batch scraping."""
        groups: dict[tuple[str, str, str], list[dict]] = {}

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
            else:
                league = "unknown"

            key = (bet["sport"], league, bet["event_date"])

            if key not in groups:
                groups[key] = []
            groups[key].append(bet)

        return groups

    def _scrape_league(
        self, sport: str, league: str, event_date: str
    ) -> Optional[dict]:
        """Scrape league data using OddsHarvester."""
        try:
            logger.info(f"Scraping {sport}/{league} for {event_date}")

            # Parse date to get season
            date_obj = datetime.fromisoformat(event_date.replace("Z", "+00:00"))
            
            # Determine season format based on sport
            if date_obj.month >= 7:
                season = f"{date_obj.year}-{date_obj.year + 1}"
            else:
                season = f"{date_obj.year - 1}-{date_obj.year}"

            # Build OddsHarvester command
            cmd = [
                sys.executable,
                "-m",
                "src.main",
                "scrape_historic",
                "--sport",
                sport.lower(),
                "--leagues",
                league,
                "--season",
                season,
                "--headless",
                "--format",
                "json",
                "--scrape_odds_history",
            ]

            # Run OddsHarvester
            result = subprocess.run(
                cmd,
                cwd=ODDS_HARVESTER_PATH,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode != 0:
                logger.error(f"OddsHarvester error: {result.stderr}")
                return None

            # Parse output (OddsHarvester outputs to file)
            output_file = Path(ODDS_HARVESTER_PATH) / "output.json"
            if output_file.exists():
                with open(output_file) as f:
                    data = json.load(f)
                output_file.unlink()  # Clean up
                return data

            return None

        except subprocess.TimeoutExpired:
            logger.error(f"Scraping timed out for {sport}/{league}")
            return None
        except Exception as e:
            logger.error(f"Scraping error: {e}")
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

        if not best_match or best_score < 0.75:
            return result

        result["matchScore"] = best_score

        # Get odds from matched event
        odds_data = best_match.get("odds", {})
        market_odds = odds_data.get(bet["market"], {})

        if not market_odds:
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

    # Initialize database
    db_path = Path(__file__).parent / "clv_cache.db"
    db = Database(str(db_path))
    init_db(db)
    logger.info(f"Database initialized at {db_path}")

    # Start job processor
    job_processor = JobProcessor(db, max_workers=MAX_CONCURRENCY)
    job_processor.start()

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

    # Run initial health check
    run_health_check()

    yield

    # Shutdown
    logger.info("Shutting down...")
    if job_processor:
        job_processor.stop()
    if scheduler:
        scheduler.shutdown()
    if db:
        db.close()


# === Helper Functions ===


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
        oddsHarvesterVersion=get_odds_harvester_version(),
        dbSize=get_db_size(db),
        cacheAge=cache_age,
        pendingJobs=pending_jobs,
        failureRate=get_failure_rate(db),
        activeConcurrency=job_processor.get_active_concurrency() if job_processor else 0,
        recommendedConcurrency=job_processor.get_recommended_concurrency() if job_processor else MAX_CONCURRENCY,
        healthState=calculate_health_state(),
    )


@app.post("/api/batch-closing-odds", response_model=JobResponse)
async def create_batch_job(request: BatchRequest):
    """Create a batch job for CLV lookup."""
    global db

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
            home_team=bet.homeTeam,
            away_team=bet.awayTeam,
            market=bet.market,
            event_date=bet.eventDate,
            bookmaker=bet.bookmaker,
        )

    logger.info(f"Created job {job_id} with {len(request.bets)} bets")

    return JobResponse(
        jobId=job_id,
        totalBets=len(request.bets),
        status="queued",
    )


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
        jobId=job_id,
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
        "deletedLeagues": deleted.get("leagues", 0),
        "deletedOdds": deleted.get("odds", 0),
        "freedSpaceMB": deleted.get("freed_mb", 0),
        "newSizeMB": get_db_size(db),
    }


@app.get("/api/cache-stats", response_model=CacheStatsResponse)
async def get_cache_statistics():
    """Get cache statistics."""
    global db

    if not db:
        raise HTTPException(status_code=503, detail="Database not initialized")

    stats = get_cache_stats(db)

    return CacheStatsResponse(
        totalSizeMB=get_db_size(db),
        leagueCacheCount=stats.get("league_count", 0),
        oddsCacheCount=stats.get("odds_count", 0),
        oldestEntry=stats.get("oldest_timestamp"),
        newestEntry=stats.get("newest_timestamp"),
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
            updateAvailable=update_available,
            localVersion=local_version,
            remoteVersion=remote_sha,
            commitsBehind=1 if update_available else 0,  # Simplified
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
            raise HTTPException(status_code=500, detail=result.stderr)

        # Run uv sync to update dependencies
        subprocess.run(
            ["uv", "sync"],
            cwd=ODDS_HARVESTER_PATH,
            capture_output=True,
            text=True,
        )

        new_version = get_odds_harvester_version()

        return {
            "success": True,
            "newVersion": new_version,
            "message": "Update complete. Please restart the service for changes to take effect.",
        }

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


# === Main Entry Point ===


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting server on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)
