#!/usr/bin/env python3
"""
Deprecated: test_clv_async

This script previously tested the CLV API server using async polling while
OddsHarvester scraped OddsPortal. With OddsHarvester removed, this script is
no longer applicable and has been deprecated.
"""

raise SystemExit("OddsHarvester removed — test_clv_async is deprecated.")

import httpx
import asyncio
import json
from datetime import datetime

# Recent match from actual bet data
TEST_BET = {
    "betId": "birmingham-test",
    "sport": "Football",
    "tournament": "England Championship",  
    "homeTeam": "Birmingham City",
    "awayTeam": "Watford",
    "market": "1X2",
    "eventDate": "2025-12-01",
    "bookmaker": "pinnacle"
}

async def test_with_async_polling():
    """Submit job and poll for results"""
    
    print("=" * 80)
    print("🧪 TESTING CLV WITH ASYNC POLLING")
    print("=" * 80)
    
    print(f"\n📊 Test Match:")
    print(f"   Event: {TEST_BET['homeTeam']} vs {TEST_BET['awayTeam']}")
    print(f"   Tournament: {TEST_BET['tournament']}")
    print(f"   Date: {TEST_BET['eventDate']}")
    print(f"   Market: {TEST_BET['market']}")
    
    payload = {"bets": [TEST_BET]}
    
    print(f"\n📤 Submitting job...")
    
    try:
        # WORKAROUND: For batches <= 20, the server processes synchronously
        # So we need a longer timeout for the initial request
        async with httpx.AsyncClient(timeout=120.0) as client:
            print(f"   (This will take 30-90s while OddsHarvester scrapes OddsPortal...)")
            start = datetime.now()
            
            response = await client.post(
                "http://127.0.0.1:8765/api/batch-closing-odds",
                json=payload
            )
            
            elapsed = (datetime.now() - start).total_seconds()
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ Response received in {elapsed:.1f}s")
                print(f"   Job ID: {result.get('job_id')}")
                print(f"   Status: {result.get('status')}")
                print(f"   Total bets: {result.get('total_bets')}")
                
                if result.get("status") == "completed":
                    # Job completed synchronously
                    print(f"\n📊 Results:")
                    print(f"   Processed: {result.get('processed', 0)}")
                    print(f"   Failed: {result.get('failed', 0)}")
                    
                    if result.get("results"):
                        for bet_result in result["results"]:
                            print(f"\n   Bet ID: {bet_result.get('bet_id')}")
                            print(f"   Success: {bet_result.get('success')}")
                            print(f"   Closing Odds: {bet_result.get('closing_odds')}")
                            print(f"   Match Score: {bet_result.get('match_score')}")
                            print(f"   Bookmaker: {bet_result.get('bookmaker_used')}")
                            print(f"   Fallback Type: {bet_result.get('fallback_type')}")
                            print(f"   Confidence: {bet_result.get('confidence')}")
                            
                            if bet_result.get('error'):
                                print(f"   Error: {bet_result.get('error')}")
                        
                        return result.get("results")[0].get("success", False)
                    else:
                        print(f"\n⚠️  No results returned")
                        return False
                        
                else:
                    # Job queued for async processing
                    job_id = result.get("job_id")
                    print(f"\n⏳ Job queued, polling for completion...")
                    
                    for i in range(30):  # Poll for up to 150 seconds
                        await asyncio.sleep(5)
                        
                        status_response = await client.get(
                            f"http://127.0.0.1:8765/api/job-status/{job_id}"
                        )
                        
                        if status_response.status_code == 200:
                            status = status_response.json()
                            current = status.get("progress", {}).get("current", 0)
                            total = status.get("progress", {}).get("total", 0)
                            
                            print(f"   Poll {i+1}: {status['status']} ({current}/{total})")
                            
                            if status["status"] == "completed":
                                print(f"\n✅ Job completed!")
                                results = status.get("results", [])
                                
                                if results:
                                    for bet_result in results:
                                        print(f"\n   Bet ID: {bet_result.get('bet_id')}")
                                        print(f"   Closing Odds: {bet_result.get('closing_odds')}")
                                        print(f"   Success: {bet_result.get('success')}")
                                
                                return len(results) > 0
                            
                            elif status["status"] == "failed":
                                print(f"\n❌ Job failed: {status.get('error')}")
                                return False
                    
                    print(f"\n⏱️  Job still running after 150s")
                    return False
            else:
                print(f"\n❌ Request failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print(f"\n⏱️  Request timed out (>120s)")
        print(f"   This means OddsPortal scraping is taking very long")
        print(f"   The job may still be processing in the background")
        return False
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False

async def main():
    print(f"\n🚀 Starting CLV test...")
    print(f"⏰ Current time: {datetime.now().isoformat()}")
    
    # Check server health
    print(f"\n🔍 Checking server...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            health = await client.get("http://127.0.0.1:8765/health")
            if health.status_code == 200:
                print(f"✅ Server is healthy")
            else:
                print(f"⚠️  Server returned {health.status_code}")
                return
    except Exception as e:
        print(f"❌ Server unreachable: {e}")
        return
    
    # Run test
    success = await test_with_async_polling()
    
    print(f"\n" + "=" * 80)
    if success:
        print(f"✅ TEST PASSED - Closing odds retrieved successfully!")
    else:
        print(f"❌ TEST INCOMPLETE - Check output above")
        print(f"\nNote: OddsPortal scraping can take 30-90+ seconds per league.")
        print(f"If this times out, the match may not be in OddsPortal yet,")
        print(f"or the league mapping needs to be added to league_mapper.py")
    print(f"=" * 80)

if __name__ == "__main__":
    raise SystemExit("OddsHarvester removed — test_clv_async is deprecated.")
