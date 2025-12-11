#!/usr/bin/env python3
"""Deprecated quick CLV API test — OddsHarvester removed. Use CSV-based tests instead."""

raise SystemExit("OddsHarvester removed — quick_test_clv is deprecated.")
import requests
import json
import time

API_URL = "http://localhost:8765"

# Simple test bet
test_request = {
    'bets': [{
        'betId': 'quick-test-1',
        'sport': 'football',
        'tournament': 'Premier League',
        'homeTeam': 'Manchester City',
        'awayTeam': 'Liverpool', 
        'market': '1X2',
        'eventDate': '2025-11-03',
        'bookmaker': 'Betfair'
    }]
}

print("=" * 70)
print("Quick CLV API Test")
print("=" * 70)
print(f"\nAPI URL: {API_URL}")
print(f"Test bet: {json.dumps(test_request, indent=2)}")
print("\n" + "-" * 70)

try:
    print("\n📤 Submitting batch job...")
    r = requests.post(f"{API_URL}/api/batch-closing-odds", json=test_request, timeout=60)
    
    if r.status_code != 200:
        print(f"❌ Error {r.status_code}: {r.text}")
        exit(1)
    
    result = r.json()
    print(f"✅ Response received:")
    print(json.dumps(result, indent=2))
    
    # Check if results are immediate (small batch)
    if result.get('results'):
        print("\n" + "=" * 70)
        print("IMMEDIATE RESULTS")
        print("=" * 70)
        for bet in result['results']:
            print(f"\nBet ID: {bet.get('bet_id')}")
            print(f"  Closing Odds: {bet.get('closing_odds')}")
            print(f"  Match Score: {bet.get('match_score')}")
            print(f"  Bookmaker: {bet.get('bookmaker_used')}")
            print(f"  Fallback Type: {bet.get('fallback_type')}")
    else:
        print(f"\n🔄 Job queued with ID: {result.get('job_id')}")
        print("   (Job will be processed in background)")
    
    print("\n✅ Test completed successfully!")

except requests.exceptions.ConnectionError:
    print(f"\n❌ Could not connect to {API_URL}")
    print("Make sure the CLV API server is running")
    exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
