#!/usr/bin/env python3
"""Deprecated: check_clv_db — OddsHarvester removed. Use extension Diagnostics / Local Storage to inspect CSV cache."""

raise SystemExit("OddsHarvester removed — check_clv_db is deprecated.")
import json
import os
import sqlite3
import sys

db_path = os.path.join(os.environ['LOCALAPPDATA'], 'SurebetHelper', 'OddsHarvesterAPI', 'clv_cache.db')
print(f"Database: {db_path}")

conn = sqlite3.connect(db_path)
c = conn.cursor()

# List tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print(f"\nTables: {tables}")

# Check jobs
print("\n=== JOBS ===")
c.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 5")
cols = [d[0] for d in c.description]
rows = c.fetchall()
for row in rows:
    job = dict(zip(cols, row))
    print(f"  {job['id'][:8]}... status={job['status']}, processed={job['processed_bets']}/{job['total_bets']}")

# Find Chelsea test bet
print("\n=== CHELSEA BETS ===")
c.execute("SELECT * FROM bet_requests WHERE home_team LIKE '%Chelsea%' ORDER BY id DESC LIMIT 5")
cols = [d[0] for d in c.description]
for row in c.fetchall():
    print(json.dumps(dict(zip(cols, row)), indent=2))

# Find most recent test bet
print("\n=== MOST RECENT BET REQUESTS ===")
c.execute("SELECT * FROM bet_requests ORDER BY id DESC LIMIT 3")
cols = [d[0] for d in c.description]
for row in c.fetchall():
    print(json.dumps(dict(zip(cols, row)), indent=2))

# Check league cache
print("\n=== LEAGUE CACHE ===")
c.execute("SELECT sport, league, date, total_matches FROM league_cache ORDER BY date DESC LIMIT 10")
for row in c.fetchall():
    print(f"  {row[0]}/{row[1]} on {row[2]}: {row[3]} matches")

conn.close()
