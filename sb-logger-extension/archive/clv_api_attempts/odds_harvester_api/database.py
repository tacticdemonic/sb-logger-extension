"""
SQLite Database Module for CLV Cache
=====================================

Provides persistent storage for:
- Job tracking and progress
- Bet requests and results
- Cached league/odds data
- Failure logging for diagnostics

Uses WAL mode for better concurrency and includes auto-cleanup.
"""

import gzip
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional


class Database:
    """SQLite database wrapper with connection pooling and WAL mode."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._local = threading.local()
        self._init_schema()
        self._run_migrations()
        self._create_indices()

    def _get_connection(self) -> sqlite3.Connection:
        """Get thread-local database connection."""
        if not hasattr(self._local, "connection"):
            self._local.connection = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=30.0,
            )
            self._local.connection.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrency
            self._local.connection.execute("PRAGMA journal_mode=WAL")
            self._local.connection.execute("PRAGMA busy_timeout=5000")
            self._local.connection.execute("PRAGMA synchronous=NORMAL")
        return self._local.connection

    @contextmanager
    def _cursor(self):
        """Get a cursor with automatic commit/rollback."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def _init_schema(self):
        """Initialize database schema."""
        with self._cursor() as cursor:
            # Jobs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    completed_at TEXT,
                    status TEXT NOT NULL DEFAULT 'queued',
                    total_bets INTEGER NOT NULL,
                    processed_bets INTEGER NOT NULL DEFAULT 0,
                    error_log TEXT,
                    scraper_version TEXT
                )
            """)

            # Bet requests table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bet_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    bet_id TEXT NOT NULL,
                    sport TEXT NOT NULL,
                    tournament TEXT,
                    home_team TEXT NOT NULL,
                    away_team TEXT NOT NULL,
                    market TEXT NOT NULL,
                    event_date TEXT NOT NULL,
                    bookmaker TEXT NOT NULL,
                    result_odds REAL,
                    result_bookmaker TEXT,
                    confidence REAL,
                    fallback_type TEXT,
                    match_score REAL,
                    FOREIGN KEY (job_id) REFERENCES jobs(id)
                )
            """)

            # Closing odds cache
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS closing_odds_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sport TEXT NOT NULL,
                    league TEXT NOT NULL,
                    event_date TEXT NOT NULL,
                    match_key TEXT NOT NULL,
                    bookmaker TEXT NOT NULL,
                    closing_odds REAL NOT NULL,
                    scraped_at INTEGER NOT NULL,
                    raw_json BLOB,
                    UNIQUE(sport, league, event_date, match_key, bookmaker)
                )
            """)

            # League cache (stores full scrape results)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS league_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sport TEXT NOT NULL,
                    league TEXT NOT NULL,
                    season TEXT NOT NULL,
                    event_date TEXT,
                    last_scraped INTEGER NOT NULL,
                    oddsportal_data BLOB,
                    size_bytes INTEGER,
                    UNIQUE(sport, league, season, event_date)
                )
            """)

            # Metadata table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)

            # Failure log for diagnostics
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS failure_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    job_id TEXT,
                    error_type TEXT NOT NULL,
                    error_message TEXT,
                    FOREIGN KEY (job_id) REFERENCES jobs(id)
                )
            """)

    def _create_indices(self):
        """Create database indices for performance."""
        with self._cursor() as cursor:
            # Create indices for performance (with error handling for schema mismatches)
            try:
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_bet_requests_job_id ON bet_requests(job_id)"
                )
            except sqlite3.OperationalError:
                pass  # Column doesn't exist in this schema version
            
            try:
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_closing_odds_lookup ON closing_odds_cache(sport, league, event_date)"
                )
            except sqlite3.OperationalError:
                pass
            
            try:
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_league_cache_lookup ON league_cache(sport, league, event_date)"
                )
            except sqlite3.OperationalError:
                pass
            
            try:
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)"
                )
            except sqlite3.OperationalError:
                pass
            
            try:
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_failure_log_timestamp ON failure_log(timestamp)"
                )
            except sqlite3.OperationalError:
                pass

    def _run_migrations(self):
        """Run database migrations for schema updates."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Check current schema version
        schema_version = self.get_metadata("schema_version")
        if schema_version is None:
            schema_version = 1  # Initial version
        else:
            # Handle both integer and float string versions
            try:
                schema_version = int(float(schema_version))
            except (ValueError, TypeError):
                schema_version = 1

        # Migration 1 -> 2: Add tournament column to bet_requests
        if schema_version < 2:
            try:
                # Check if tournament column exists
                cursor.execute("PRAGMA table_info(bet_requests)")
                columns = [row[1] for row in cursor.fetchall()]
                
                if "tournament" not in columns:
                    cursor.execute("ALTER TABLE bet_requests ADD COLUMN tournament TEXT")
                    conn.commit()
                    print("✅ Migration 1→2: Added tournament column to bet_requests")
                
                self.set_metadata("schema_version", 2)
            except Exception as e:
                print(f"⚠️  Migration 1→2 failed: {e}")
                conn.rollback()

    def close(self):
        """Close database connection."""
        if hasattr(self._local, "connection"):
            self._local.connection.close()
            del self._local.connection

    # === Job Operations ===

    def create_job(self, job_id: str, total_bets: int):
        """Create a new job record."""
        with self._cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO jobs (id, created_at, status, total_bets, scraper_version)
                VALUES (?, ?, 'queued', ?, ?)
            """,
                (job_id, datetime.now().isoformat(), total_bets, self.get_metadata("scraper_version")),
            )

    def get_job(self, job_id: str) -> Optional[dict]:
        """Get job by ID."""
        with self._cursor() as cursor:
            cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_jobs_by_status(self, status: str) -> list[dict]:
        """Get all jobs with given status."""
        with self._cursor() as cursor:
            cursor.execute("SELECT * FROM jobs WHERE status = ?", (status,))
            return [dict(row) for row in cursor.fetchall()]

    def update_job_status(self, job_id: str, status: str, error: str = None):
        """Update job status."""
        with self._cursor() as cursor:
            if status in ("completed", "failed"):
                cursor.execute(
                    """
                    UPDATE jobs 
                    SET status = ?, completed_at = ?, error_log = ?
                    WHERE id = ?
                """,
                    (status, datetime.now().isoformat(), error, job_id),
                )
            else:
                cursor.execute(
                    "UPDATE jobs SET status = ? WHERE id = ?",
                    (status, job_id),
                )

    def update_job_progress(self, job_id: str, processed: int):
        """Update job progress."""
        with self._cursor() as cursor:
            cursor.execute(
                "UPDATE jobs SET processed_bets = ? WHERE id = ?",
                (processed, job_id),
            )

    # === Bet Request Operations ===

    def create_bet_request(
        self,
        job_id: str,
        bet_id: str,
        sport: str,
        tournament: str,
        home_team: str,
        away_team: str,
        market: str,
        event_date: str,
        bookmaker: str,
    ):
        """Create a bet request record."""
        with self._cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO bet_requests 
                (job_id, bet_id, sport, tournament, home_team, away_team, market, event_date, bookmaker)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (job_id, bet_id, sport, tournament, home_team, away_team, market, event_date, bookmaker),
            )

    def get_bet_requests(self, job_id: str) -> list[dict]:
        """Get all bet requests for a job."""
        with self._cursor() as cursor:
            cursor.execute(
                "SELECT * FROM bet_requests WHERE job_id = ?", (job_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def update_bet_result(self, request_id: int, result: dict):
        """Update bet request with CLV result."""
        with self._cursor() as cursor:
            cursor.execute(
                """
                UPDATE bet_requests 
                SET result_odds = ?, result_bookmaker = ?, confidence = ?, 
                    fallback_type = ?, match_score = ?
                WHERE id = ?
            """,
                (
                    result.get("closingOdds"),
                    result.get("bookmakerUsed"),
                    result.get("confidence"),
                    result.get("fallbackType"),
                    result.get("matchScore"),
                    request_id,
                ),
            )

    def get_bet_results(self, job_id: str) -> list[dict]:
        """Get bet results for a job."""
        with self._cursor() as cursor:
            cursor.execute(
                """
                SELECT bet_id, result_odds as closingOdds, result_bookmaker as bookmakerUsed,
                       confidence, fallback_type as fallbackType, match_score as matchScore
                FROM bet_requests 
                WHERE job_id = ? AND result_odds IS NOT NULL
            """,
                (job_id,),
            )
            return [dict(row) for row in cursor.fetchall()]

    # === Cache Operations ===

    def get_cached_league_data(
        self, sport: str, league: str, event_date: str
    ) -> Optional[dict]:
        """Get cached league data if fresh enough (within 7 days)."""
        with self._cursor() as cursor:
            cutoff = int((datetime.now() - timedelta(days=7)).timestamp())
            cursor.execute(
                """
                SELECT oddsportal_data FROM league_cache 
                WHERE sport = ? AND league = ? AND event_date = ? AND last_scraped > ?
            """,
                (sport, league, event_date, cutoff),
            )
            row = cursor.fetchone()
            if row and row["oddsportal_data"]:
                try:
                    # Decompress if needed
                    data = row["oddsportal_data"]
                    if isinstance(data, bytes):
                        try:
                            data = gzip.decompress(data)
                        except gzip.BadGzipFile:
                            pass
                    return json.loads(data)
                except (json.JSONDecodeError, Exception):
                    return None
            return None

    def cache_league_data(
        self, sport: str, league: str, event_date: str, data: dict
    ):
        """Cache league data with compression."""
        with self._cursor() as cursor:
            json_data = json.dumps(data)
            compressed = gzip.compress(json_data.encode())

            # Determine season from event_date
            date_obj = datetime.fromisoformat(event_date.replace("Z", "+00:00"))
            if date_obj.month >= 7:
                season = f"{date_obj.year}-{date_obj.year + 1}"
            else:
                season = f"{date_obj.year - 1}-{date_obj.year}"

            cursor.execute(
                """
                INSERT OR REPLACE INTO league_cache 
                (sport, league, season, event_date, last_scraped, oddsportal_data, size_bytes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    sport,
                    league,
                    season,
                    event_date,
                    int(datetime.now().timestamp()),
                    compressed,
                    len(compressed),
                ),
            )

    # === Metadata Operations ===

    def get_metadata(self, key: str) -> Optional[str]:
        """Get metadata value."""
        with self._cursor() as cursor:
            cursor.execute("SELECT value FROM metadata WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row["value"] if row else None

    def set_metadata(self, key: str, value: str):
        """Set metadata value."""
        with self._cursor() as cursor:
            cursor.execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
                (key, value),
            )

    # === Failure Logging ===

    def log_failure(self, job_id: str, error_type: str, error_message: str):
        """Log a failure for diagnostics."""
        with self._cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO failure_log (timestamp, job_id, error_type, error_message)
                VALUES (?, ?, ?, ?)
            """,
                (int(datetime.now().timestamp()), job_id, error_type, error_message),
            )

    def get_failure_count(self, hours: int = 24) -> int:
        """Get failure count in last N hours."""
        with self._cursor() as cursor:
            cutoff = int((datetime.now() - timedelta(hours=hours)).timestamp())
            cursor.execute(
                "SELECT COUNT(*) as count FROM failure_log WHERE timestamp > ?",
                (cutoff,),
            )
            row = cursor.fetchone()
            return row["count"] if row else 0


# === Module-level Helper Functions ===


def init_db(db: Database):
    """Initialize database (schema is auto-created)."""
    db.set_metadata("schema_version", "1.0")
    db.set_metadata("created_at", datetime.now().isoformat())


def get_db_size(db: Database) -> float:
    """Get database file size in MB."""
    try:
        size = os.path.getsize(db.db_path)
        return round(size / (1024 * 1024), 2)
    except Exception:
        return 0.0


def get_failure_rate(db: Database) -> float:
    """Calculate failure rate in last 24 hours."""
    with db._cursor() as cursor:
        cutoff = int((datetime.now() - timedelta(hours=24)).timestamp())

        # Get total jobs in period
        cursor.execute(
            "SELECT COUNT(*) as count FROM jobs WHERE created_at > ?",
            (datetime.fromtimestamp(cutoff).isoformat(),),
        )
        total = cursor.fetchone()["count"]

        if total == 0:
            return 0.0

        # Get failures
        failures = db.get_failure_count(24)
        return round(failures / max(total, 1), 3)


# Removed duplicate get_cache_stats - use the one in server.py instead


def cleanup_old_cache(db: Database, retention_days: int = 30) -> dict:
    """Clean up old cache entries."""
    cutoff = int((datetime.now() - timedelta(days=retention_days)).timestamp())
    deleted = {"leagues": 0, "odds": 0, "failures": 0, "freed_mb": 0.0}

    size_before = get_db_size(db)

    with db._cursor() as cursor:
        # Delete old league cache
        cursor.execute(
            "DELETE FROM league_cache WHERE last_scraped < ?", (cutoff,)
        )
        deleted["leagues"] = cursor.rowcount

        # Delete old odds cache
        cursor.execute(
            "DELETE FROM closing_odds_cache WHERE scraped_at < ?", (cutoff,)
        )
        deleted["odds"] = cursor.rowcount

        # Delete old failure logs (keep 7 days)
        failure_cutoff = int((datetime.now() - timedelta(days=7)).timestamp())
        cursor.execute(
            "DELETE FROM failure_log WHERE timestamp < ?", (failure_cutoff,)
        )
        deleted["failures"] = cursor.rowcount

        # Vacuum to reclaim space
        cursor.execute("VACUUM")

    size_after = get_db_size(db)
    deleted["freed_mb"] = round(size_before - size_after, 2)

    return deleted
