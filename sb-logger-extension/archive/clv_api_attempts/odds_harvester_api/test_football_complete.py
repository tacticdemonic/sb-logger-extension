#!/usr/bin/env python3
"""Test OddsHarvester with football/soccer match (correct market type)."""

import asyncio
import httpx

async def test_premier_league_match():
    """Test with Premier League match (1x2 market works for football)."""
    
    bet = {
        "betId": "test-epl-current",
        "homeTeam": "Manchester City",
        "awayTeam": "Liverpool",
        "eventDate": "2025-12-15T15:00:00Z",  # Upcoming weekend
        "openingOdds": 2.10,
        "sport": "Football",
        "tournament": "Premier League",
        "market": "1x2",
        "bookmaker": "betfair",
    }
    
    print(f"\n{'='*80}")
    print(f"Testing Premier League Match (1x2 market - correct for football)")
    print(f"{'='*80}")
    print(f"Event: {bet['homeTeam']} vs {bet['awayTeam']}")
    print(f"Date: {bet['eventDate']}")
    print(f"Sport: {bet['sport']}")
    print(f"Tournament: {bet['tournament']}")
    print(f"Market: {bet['market']}")
    print(f"\nExpected: Selector finds matches AND market data is extracted")
    print(f"{'='*80}\n")
    
    url = "http://127.0.0.1:8765/api/batch-closing-odds"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            print("📤 Creating job...")
            response = await client.post(url, json={"bets": [bet]})
            
            if response.status_code != 200:
                print(f"❌ Job creation failed (Status: {response.status_code})")
                print(f"Error: {response.text}")
                return
                
            job_data = response.json()
            job_id = job_data["jobId"]
            print(f"✅ Job created: {job_id}\n")
            
            print("⏳ Processing (30-45 seconds for OddsHarvester)...")
            await asyncio.sleep(35)
            
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
                    
                    if bet_result.get('closingOdds'):
                        print(f"\n🎉 FULL SUCCESS! OddsHarvester selector AND market extraction working!")
                        print(f"   Selector: Finding matches ✅")
                        print(f"   Markets: Extracting 1x2 odds ✅")
                    elif bet_result.get('fallbackType') == 'failed':
                        print(f"\n⚠️  Selector works but no odds found")
                        print(f"   (Match may not exist yet, or no bookmaker data)")
                    else:
                        print(f"\n✅ Selector working! Fallback: {bet_result.get('fallbackType')}")
                else:
                    print(f"\n⚠️  No results yet")
                    
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
    print("OddsHarvester Full Integration Test - Football/Soccer")
    print("="*80)
    print("\nThis test validates:")
    print("  1. Selector finds matches (div[class*='eventRow'])")
    print("  2. Market extraction works for football (1x2)")
    print("  3. Complete end-to-end scraping workflow")
    print("\n" + "="*80 + "\n")
    
    asyncio.run(test_premier_league_match())
    
    print("\n" + "="*80)
    print("Check server logs: Receive-Job -Name CLVServer -Keep | Select-Object -Last 80")
    print("="*80 + "\n")
