import sqlite3
import gzip
import json
import os

DB_PATH = r"c:\Local\SB Logger\sb-logger-extension\sb-logger-extension\tools\odds_harvester_api\clv_cache.db"

def inspect():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("--- League Cache Entries ---")
    cursor.execute("SELECT sport, league, season, event_date, length(oddsportal_data) FROM league_cache")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
    
    if not rows:
        print("No league cache data found.")
        return

    # Inspect the first entry's data
    print("\n--- Inspecting First Entry ---")
    cursor.execute("SELECT oddsportal_data FROM league_cache LIMIT 1")
    data_blob = cursor.fetchone()[0]
    
    try:
        if isinstance(data_blob, bytes):
            try:
                json_data = gzip.decompress(data_blob)
            except:
                json_data = data_blob # Maybe not compressed?
        else:
            json_data = data_blob
            
        data = json.loads(json_data)
        print(f"Matches found: {len(data.get('matches', []))}")
        for match in data.get('matches', [])[:5]:
            print(f"  {match.get('home_team')} vs {match.get('away_team')} ({match.get('date')})")
            
    except Exception as e:
        print(f"Error reading data: {e}")

    conn.close()

if __name__ == "__main__":
    inspect()
