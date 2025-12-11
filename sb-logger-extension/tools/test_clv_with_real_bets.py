#!/usr/bin/env python3
"""
Deprecated: test_clv_with_real_bets

This script used to test the local CLV API endpoint with real bets. OddsHarvester
has been removed; use CSV-based CLV fetch testing tools instead.
"""

raise SystemExit("OddsHarvester removed — test_clv_with_real_bets is deprecated.")
import json
import time
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

API_URL = "http://localhost:8765"

def load_real_bets():
    """Load real bets from the exported JSON file."""
    # Path to real bet export
    export_file = Path(__file__).parent.parent.parent / 'surebet-bets-2025-11-17T15-23-17-799Z.json'
    
    if not export_file.exists():
        print(f"❌ Export file not found: {export_file}")
        return []
    
    with open(export_file) as f:
        all_bets = json.load(f)
    
    print(f"📂 Loaded {len(all_bets)} bets from {export_file.name}")
    return all_bets

def convert_to_clv_format(bet):
    """Convert extension bet format to CLV API format."""
    # Extract teams from event string (e.g., "Real Oviedo vs Osasuna")
    event = bet.get('event', '')
    teams = event.split(' vs ')
    
    return {
        'betId': bet.get('uid', bet.get('id', 'unknown')),
        'sport': bet.get('sport', 'football').lower(),
        'tournament': bet.get('tournament', ''),
        'homeTeam': teams[0] if len(teams) >= 1 else 'Unknown',
        'awayTeam': teams[1] if len(teams) >= 2 else 'Unknown',
        'market': bet.get('market', '1X2'),
        'eventDate': bet.get('eventTime', '')[:10],  # Extract date from ISO timestamp
        'bookmaker': bet.get('bookmaker', 'unknown')
    }

def test_with_real_bets():
    """Test CLV API with real historical bets."""
    print("=" * 70)
    print("CLV API Test with Real Historical Bets")
    print("=" * 70)
    
    # Load real bets
    real_bets = load_real_bets()
    if not real_bets:
        return False
    
    # Select 3 test cases from different sports/scenarios
    test_cases = []
    
    # 1. Football bet
    football_bets = [b for b in real_bets if b.get('sport') == 'Football']
    if football_bets:
        test_cases.append(('Football', football_bets[0]))
    
    # 2. Tennis bet
    tennis_bets = [b for b in real_bets if b.get('sport') == 'Tennis']
    if tennis_bets:
        test_cases.append(('Tennis', tennis_bets[0]))
    
    # 3. Basketball/Other bet
    other_bets = [b for b in real_bets if b.get('sport') not in ['Football', 'Tennis']]
    if other_bets:
        test_cases.append(('Other Sport', other_bets[0]))
    
    if not test_cases:
        print("❌ No suitable test cases found")
        return False
    
    print(f"\n🧪 Testing {len(test_cases)} bet scenarios:")
    print("-" * 70)
    
    for scenario_name, bet in test_cases:
        print(f"\n📊 Test Case: {scenario_name}")
        print(f"   Event: {bet.get('event')}")
        print(f"   Date: {bet.get('eventTime')}")
        print(f"   Market: {bet.get('market')}")
        print(f"   Bookmaker: {bet.get('bookmaker')}")
        print(f"   Status: {bet.get('status', 'unknown')}")
        
        # Convert to CLV API format
        clv_bet = convert_to_clv_format(bet)
        print(f"   CLV format: {json.dumps(clv_bet, indent=6)}")
    
    # Create batch request
    batch_request = {
        'bets': [convert_to_clv_format(bet) for _, bet in test_cases],
        'fallback_strategy': 'weighted_avg',
        'max_concurrency': 2
    }
    
    print("\n" + "=" * 70)
    print("Submitting batch job to CLV API...")
    print("=" * 70)
    
    try:
        # Submit the job
        print(f"\n📤 POST {API_URL}/api/batch-closing-odds")
        r = requests.post(f"{API_URL}/api/batch-closing-odds", json=batch_request, timeout=30)
        
        if r.status_code != 200:
            print(f"❌ Error {r.status_code}: {r.text}")
            return False
        
        result = r.json()
        job_id = result.get('job_id')
        
        print(f"✅ Job created: {job_id}")
        print(f"   Total bets: {result.get('total_bets')}")
        print(f"   Status: {result.get('status')}")
        
        # If small batch, results may be immediate
        if result.get('results'):
            print("\n" + "=" * 70)
            print("IMMEDIATE RESULTS (Small Batch)")
            print("=" * 70)
            for idx, bet_result in enumerate(result['results'], 1):
                print(f"\nBet {idx}:")
                print(f"  Bet ID: {bet_result.get('bet_id')}")
                print(f"  Closing Odds: {bet_result.get('closing_odds')}")
                print(f"  Match Score: {bet_result.get('match_score')}")
                print(f"  Bookmaker: {bet_result.get('bookmaker_used')}")
                print(f"  Fallback: {bet_result.get('fallback_type')}")
            return True
        
        # Poll for results
        print(f"\n🔄 Polling job status...")
        for i in range(36):  # Poll for up to 3 minutes
            time.sleep(5)
            r = requests.get(f"{API_URL}/api/job-status/{job_id}", timeout=10)
            data = r.json()
            
            status = data.get('status', 'unknown')
            progress = data.get('progress', {})
            current = progress.get('current', 0)
            total = progress.get('total', 0)
            
            print(f"  Poll {i+1}: {status} ({current}/{total} completed)")
            
            if status == 'completed':
                print("\n" + "=" * 70)
                print("FINAL RESULTS")
                print("=" * 70)
                
                for idx, bet_result in enumerate(data.get('results', []), 1):
                    print(f"\nBet {idx}:")
                    print(f"  Bet ID: {bet_result.get('bet_id')}")
                    print(f"  Closing Odds: {bet_result.get('closing_odds')}")
                    print(f"  Match Score: {bet_result.get('match_score')}")
                    print(f"  Bookmaker: {bet_result.get('bookmaker_used')}")
                    print(f"  Fallback: {bet_result.get('fallback_type')}")
                
                print("\n✅ Test completed successfully!")
                return True
            
            if status == 'failed':
                print(f"\n❌ Job failed: {data}")
                return False
        
        print("\n⏱️  Timeout: Job did not complete within 3 minutes")
        return False
        
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Could not connect to {API_URL}")
        print("Make sure the CLV API server is running:")
        print(f"  cd {Path(__file__).parent / 'odds_harvester_api'}")
        print("  python server.py")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    raise SystemExit("OddsHarvester removed — test_clv_with_real_bets is deprecated.")
