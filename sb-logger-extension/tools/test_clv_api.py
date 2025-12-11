#!/usr/bin/env python3
"""
Deprecated: test_clv_api

This script used to test the local CLV API server (OddsHarvester). The server
has been removed and replaced by a CSV-based CLV system and a player props
poller. This test is deprecated and will not run against the new system.
"""

raise SystemExit("OddsHarvester removed — test_clv_api is deprecated.")
import json
import time
import sys

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

API_URL = "http://localhost:8765"

def test_batch_closing_odds():
    """Test the batch-closing-odds endpoint with a sample bet."""
    
    # Test with a real Premier League match
    test_bet = {
        'bets': [{
            'betId': 'test-123',
            'sport': 'football',
            'homeTeam': 'Chelsea',
            'awayTeam': 'Manchester United',
            'market': '1X2',
            'eventDate': '2024-12-01',
            'bookmaker': 'Betfair'
        }],
        'fallback_strategy': 'pinnacle',
        'max_concurrency': 1
    }
    
    print(f"Testing CLV API at {API_URL}")
    print(f"Test bet: {json.dumps(test_bet, indent=2)}")
    print("-" * 50)
    
    # Submit the job
    try:
        print("Submitting job...")
        r = requests.post(f"{API_URL}/api/batch-closing-odds", json=test_bet, timeout=30)
        print(f"Response status: {r.status_code}")
        
        if r.status_code != 200:
            print(f"Error: {r.text}")
            return False
        
        result = r.json()
        print(f"Job created: {result}")
        
        job_id = result.get('jobId')
        if not job_id:
            print("Error: No job ID returned")
            return False
        
        # Poll for results
        print(f"\nPolling job {job_id}...")
        for i in range(36):  # Poll for up to 3 minutes
            time.sleep(5)
            r = requests.get(f"{API_URL}/api/batch-closing-odds/{job_id}", timeout=10)
            data = r.json()
            
            status = data.get('status', 'unknown')
            processed = data.get('processed', 0)
            failed = data.get('failed', 0)
            
            print(f"  Poll {i+1}: status={status}, processed={processed}, failed={failed}")
            
            if status == 'completed':
                print("\n" + "=" * 50)
                print("RESULTS:")
                print("=" * 50)
                print(json.dumps(data, indent=2))
                return True
            
            if status == 'error':
                print(f"\nError: {json.dumps(data, indent=2)}")
                return False
        
        print("\nTimeout: Job did not complete within 3 minutes")
        return False
        
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to {API_URL}")
        print("Make sure the CLV API server is running:")
        print("  cd $env:LOCALAPPDATA\\SurebetHelper\\OddsHarvesterAPI")
        print("  .\\venv\\Scripts\\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8765")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    raise SystemExit("OddsHarvester removed — test_clv_api is deprecated.")
