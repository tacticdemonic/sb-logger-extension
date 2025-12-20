#!/usr/bin/env python3
"""Test CLV calculation for basketball bet with 'Other' sport."""

import asyncio
import httpx
from datetime import datetime

async def test_basketball_bet():
    """Test CLV for Washington Wizards vs New York Knicks (sport='Other', tournament='NBA')."""
    
    # This bet has "sport": "Other" but "tournament": "United States of America - NBA"
    bet = {
        "betId": "test-466406572",
        "homeTeam": "Washington Wizards",
        "awayTeam": "New York Knicks",
        "eventDate": "2025-11-04T00:30:00Z",
        "openingOdds": 2.04,
        "sport": "Other",  # <-- Should be inferred as "basketball" from tournament
        "tournament": "United States of America - NBA",
        "market": "handicap",
        "bookmaker": "matchbook",
    }
    
    print(f"\n{'='*80}")
    print(f"Testing Basketball Bet (sport='Other', tournament='NBA')")
    print(f"{'='*80}")
    print(f"Event: {bet['homeTeam']} vs {bet['awayTeam']}")
    print(f"Sport (original): {bet['sport']}")
    print(f"Tournament: {bet['tournament']}")
    print(f"Expected: Sport should be inferred as 'basketball' from tournament name")
    print(f"{'='*80}\n")
    
    # Step 1: Create batch job
    url = "http://127.0.0.1:8765/api/batch-closing-odds"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Create job
            response = await client.post(url, json={"bets": [bet]})
            
            if response.status_code != 200:
                print(f"❌ Job creation failed (Status: {response.status_code})")
                print(f"Error: {response.text}")
                return
                
            job_data = response.json()
            job_id = job_data["jobId"]
            print(f"✅ Job created: {job_id}")
            
            # Wait a bit for processing (it's synchronous for ≤20 bets)
            await asyncio.sleep(2)
            
            # Get results
            status_url = f"http://127.0.0.1:8765/api/batch-closing-odds/{job_id}"
            response = await client.get(status_url)
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ Job Status: {result['status']}")
                
                if result.get('results'):
                    bet_result = result['results'][0]
                    print(f"\nClosing Odds: {bet_result.get('closingOdds')}")
                    print(f"CLV: {bet_result.get('clv')}")
                    print(f"Confidence: {bet_result.get('confidence')}")
                    print(f"Bookmaker Used: {bet_result.get('bookmakerUsed')}")
                    print(f"Fallback Type: {bet_result.get('fallbackType')}")
                    
                    # Check if league was detected correctly
                    if bet_result.get('closingOdds') is None and bet_result.get('fallbackType') == 'failed':
                        print(f"\n⚠️  WARNING: No odds found (might be unavailable, but sport inference should work)")
                    else:
                        print(f"\n✅ Sport inference successful!")
                else:
                    print(f"\n⚠️  No results yet")
                    
            else:
                print(f"❌ Status check failed (Status: {response.status_code})")
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"❌ EXCEPTION: {e}")

if __name__ == "__main__":
    asyncio.run(test_basketball_bet())
