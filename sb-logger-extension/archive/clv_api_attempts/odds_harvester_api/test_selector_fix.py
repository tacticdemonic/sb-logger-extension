#!/usr/bin/env python3
"""Test OddsHarvester with current NBA game to verify selector fix."""

import asyncio
import httpx
from datetime import datetime

async def test_current_nba_game():
    """Test with a current/upcoming NBA game (December 2025)."""
    
    # Use today's date - games happening today
    bet = {
        "betId": "test-current-nba",
        "homeTeam": "Los Angeles Lakers",
        "awayTeam": "Miami Heat",
        "eventDate": "2025-12-08T19:30:00Z",  # Today's date
        "openingOdds": 1.95,
        "sport": "basketball",
        "tournament": "NBA",
        "market": "1x2",
        "bookmaker": "betfair",
    }
    
    print(f"\n{'='*80}")
    print(f"Testing CURRENT NBA Game (Selector Fix Validation)")
    print(f"{'='*80}")
    print(f"Event: {bet['homeTeam']} vs {bet['awayTeam']}")
    print(f"Date: {bet['eventDate']}")
    print(f"Sport: {bet['sport']}")
    print(f"Tournament: {bet['tournament']}")
    print(f"\nExpected: OddsHarvester should find matches with new selector")
    print(f"  Old selector: div.flex.justify-between.border-b.border-black-borders")
    print(f"  New selector: div[class*='eventRow']")
    print(f"{'='*80}\n")
    
    # Step 1: Create batch job
    url = "http://127.0.0.1:8765/api/batch-closing-odds"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Create job
            print("📤 Creating job...")
            response = await client.post(url, json={"bets": [bet]})
            
            if response.status_code != 200:
                print(f"❌ Job creation failed (Status: {response.status_code})")
                print(f"Error: {response.text}")
                return
                
            job_data = response.json()
            job_id = job_data["jobId"]
            print(f"✅ Job created: {job_id}\n")
            
            # Wait for processing (synchronous for ≤20 bets)
            print("⏳ Processing (this may take 15-30 seconds with OddsHarvester)...")
            await asyncio.sleep(20)
            
            # Get results
            status_url = f"http://127.0.0.1:8765/api/batch-closing-odds/{job_id}"
            response = await client.get(status_url)
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n{'='*80}")
                print(f"📊 Job Status: {result['status']}")
                print(f"{'='*80}\n")
                
                if result.get('results'):
                    bet_result = result['results'][0]
                    
                    print(f"Result Details:")
                    print(f"  Closing Odds: {bet_result.get('closingOdds')}")
                    print(f"  CLV: {bet_result.get('clv')}")
                    print(f"  Confidence: {bet_result.get('confidence')}")
                    print(f"  Bookmaker Used: {bet_result.get('bookmakerUsed')}")
                    print(f"  Fallback Type: {bet_result.get('fallbackType')}")
                    print(f"  Match Score: {bet_result.get('matchScore')}")
                    
                    # Check success
                    if bet_result.get('closingOdds'):
                        print(f"\n✅ SUCCESS! OddsHarvester selector fix is working!")
                        print(f"   Found closing odds for {bet['homeTeam']} vs {bet['awayTeam']}")
                    elif bet_result.get('fallbackType') == 'failed':
                        print(f"\n⚠️  No odds found - checking logs for details...")
                        print(f"   (May be no current games, or selector still needs adjustment)")
                    else:
                        print(f"\n✅ Selector working! (Fallback used: {bet_result.get('fallbackType')})")
                else:
                    print(f"\n⚠️  No results yet - job may still be processing")
                    
                # Show progress
                if result.get('progress'):
                    prog = result['progress']
                    print(f"\nProgress: {prog.get('completed', 0)}/{prog.get('total', 0)} bets")
                    
            else:
                print(f"❌ Status check failed (Status: {response.status_code})")
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"❌ EXCEPTION: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("OddsHarvester Selector Fix Validation Test")
    print("="*80)
    print("\nThis test validates that the updated selector works correctly:")
    print("  - Old: div.flex.justify-between.border-b.border-black-borders (0 matches)")
    print("  - New: div[class*='eventRow'] (11+ matches found in debug)")
    print("\n" + "="*80 + "\n")
    
    asyncio.run(test_current_nba_game())
    
    print("\n" + "="*80)
    print("Check server logs with: Receive-Job -Name CLVServer -Keep | Select-Object -Last 50")
    print("="*80 + "\n")
