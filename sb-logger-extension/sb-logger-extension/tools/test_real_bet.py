#!/usr/bin/env python3
"""
Quick test with actual historical bet data from surebet-bets-2025-11-17T15-23-17-799Z.json
Testing Real Oviedo vs Osasuna bet from Nov 3, 2025
"""

import httpx
import asyncio
import json
from datetime import datetime

# Real bet from actual data
TEST_BET = {
    "tournament": "Spanish La Liga",
    "teams": ["Real Oviedo", "Osasuna"],
    "event": "Real Oviedo vs Osasuna",
    "sport": "Football",
    "eventTime": "2025-11-03T20:00:00",
    "market": "Total over 8.5 - shot on target",
    "odds": 2.32,
    "probability": 45.8,
    "bookmaker": "smarkets",
    "status": "lost"  # Known result from data
}

async def test_clv_endpoint():
    """Test CLV endpoint with real historical bet"""
    
    print("=" * 80)
    print("🧪 TESTING WITH REAL HISTORICAL BET")
    print("=" * 80)
    
    print(f"\n📊 Bet Details:")
    print(f"   Event: {TEST_BET['event']}")
    print(f"   Tournament: {TEST_BET['tournament']}")
    print(f"   Market: {TEST_BET['market']}")
    print(f"   Sport: {TEST_BET['sport']}")
    print(f"   Event Time: {TEST_BET['eventTime']}")
    print(f"   Odds: {TEST_BET['odds']}")
    print(f"   Expected Result: {TEST_BET['status']}")
    
    # Prepare request payload for batch endpoint
    payload = {
        "bets": [{
            "betId": "test-bet-1",
            "sport": TEST_BET["sport"],
            "tournament": TEST_BET["tournament"],
            "homeTeam": TEST_BET["teams"][0],
            "awayTeam": TEST_BET["teams"][1],
            "market": TEST_BET["market"],
            "eventDate": TEST_BET["eventTime"].split("T")[0],  # Just the date
            "bookmaker": TEST_BET["bookmaker"]
        }]
    }
    
    print(f"\n📤 Sending request to CLV API...")
    print(f"   URL: http://127.0.0.1:8765/api/batch-closing-odds")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:  # Short timeout for job creation
            response = await client.post(
                "http://127.0.0.1:8765/api/batch-closing-odds",
                json=payload
            )
            
            print(f"\n📥 Response received:")
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ SUCCESS!")
                print(f"   Response: {json.dumps(result, indent=2)}")
                
                # Check job was created
                if "job_id" in result:
                    job_id = result["job_id"]
                    print(f"\n📋 Job created: {job_id}")
                    print(f"   Total bets: {result.get('total_bets', 0)}")
                    print(f"   Status: {result.get('status', 'unknown')}")
                    
                    # Poll for results
                    print(f"\n⏳ Waiting for job to complete...")
                    async with httpx.AsyncClient(timeout=10.0) as poll_client:
                        for i in range(20):  # Wait up to 100 seconds
                            await asyncio.sleep(5)
                            status_response = await poll_client.get(
                                f"http://127.0.0.1:8765/api/job-status/{job_id}"
                            )
                        
                            if status_response.status_code == 200:
                                status = status_response.json()
                                print(f"   Poll {i+1}: {status['status']} ({status.get('completed', 0)}/{status.get('total_bets', 0)} bets)")
                                
                                if status["status"] == "completed":
                                    print(f"\n✅ Job completed!")
                                    if status.get("results"):
                                        for bet_result in status["results"]:
                                            print(f"\n   Bet ID: {bet_result['bet_id']}")
                                            print(f"   League: {bet_result.get('league', 'unknown')}")
                                            print(f"   Closing Odds: {bet_result.get('closing_odds', 'N/A')}")
                                            print(f"   CLV: {bet_result.get('clv', 'N/A')}")
                                            print(f"   Source: {bet_result.get('source', 'unknown')}")
                                    return True
                                elif status["status"] == "failed":
                                    print(f"\n❌ Job failed!")
                                    print(f"   Error: {status.get('error', 'Unknown error')}")
                                    return False
                        
                        print(f"\n⏱️  Job still running after 100 seconds")
                        return False
            else:
                print(f"\n❌ FAILED!")
                print(f"   Error: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print(f"\n⏱️  TIMEOUT!")
        print(f"   Request took >30 seconds (likely scraping OddsPortal)")
        return False
    except Exception as e:
        print(f"\n❌ ERROR!")
        print(f"   Exception: {str(e)}")
        return False

async def main():
    print("\n🚀 Starting test...")
    print(f"⏰ Current time: {datetime.now().isoformat()}")
    
    print("OddsHarvester removed. This test is now deprecated. Use the CSV-based CLV tests or a new Python harness that reads CSV data and performs CLV calculations if needed.")
    return
    
    # Run the test
    success = await test_clv_endpoint()
    
    print("\n" + "=" * 80)
    if success:
        print("✅ TEST PASSED - Real bet data processed successfully")
    else:
        print("❌ TEST FAILED - Check output above for details")
    print("=" * 80)

if __name__ == "__main__":
    raise SystemExit("OddsHarvester removed — test_real_bet is deprecated.")
