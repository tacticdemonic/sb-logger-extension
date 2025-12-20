#!/usr/bin/env python3
"""
Test The Odds API directly to verify it can retrieve closing odds
"""

import httpx
import asyncio
from datetime import datetime

# Test with a free API key (limited to 500 requests/month)
# Get your free key at: https://the-odds-api.com/
TEST_API_KEY = "YOUR_API_KEY_HERE"  # Replace with actual key

async def test_odds_api():
    """Test The Odds API for historical/current odds"""
    
    print("=" * 80)
    print("🧪 TESTING THE ODDS API")
    print("=" * 80)
    
    if TEST_API_KEY == "YOUR_API_KEY_HERE":
        print("\n⚠️  No API key configured!")
        print("\n📋 To get a FREE API key:")
        print("   1. Go to: https://the-odds-api.com/")
        print("   2. Click 'Get API Access'")
        print("   3. Sign up for free tier (500 requests/month)")
        print("   4. Copy your API key")
        print("   5. Paste it into this script or set $env:THE_ODDS_API_KEY='your_key'")
        return
    
    # Test endpoints
    base_url = "https://api.the-odds-api.com/v4"
    
    print(f"\n🔑 API Key: {TEST_API_KEY[:10]}...{TEST_API_KEY[-4:]}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Get available sports
        print(f"\n📊 Step 1: Fetching available sports...")
        
        try:
            response = await client.get(
                f"{base_url}/sports",
                params={"apiKey": TEST_API_KEY}
            )
            
            if response.status_code == 200:
                sports = response.json()
                print(f"✅ Found {len(sports)} sports")
                
                # Show football leagues
                football_sports = [s for s in sports if 'soccer' in s.get('group', '').lower() or 'football' in s.get('title', '').lower()]
                print(f"\n⚽ Football/Soccer leagues available:")
                for sport in football_sports[:10]:
                    print(f"   • {sport['title']} (key: {sport['key']})")
            else:
                print(f"❌ Error: {response.status_code}")
                print(f"   Response: {response.text}")
                return
                
        except Exception as e:
            print(f"❌ Failed to fetch sports: {e}")
            return
        
        # 2. Test getting odds for a specific league
        print(f"\n📊 Step 2: Fetching odds for English Championship...")
        
        try:
            response = await client.get(
                f"{base_url}/sports/soccer_efl_champ/odds",
                params={
                    "apiKey": TEST_API_KEY,
                    "regions": "uk",
                    "markets": "h2h",  # Head to head (1X2)
                    "oddsFormat": "decimal",
                    "bookmakers": "pinnacle"
                }
            )
            
            if response.status_code == 200:
                events = response.json()
                print(f"✅ Found {len(events)} upcoming matches")
                
                if events:
                    print(f"\n📋 First 3 matches:")
                    for event in events[:3]:
                        home = event['home_team']
                        away = event['away_team']
                        commence_time = event['commence_time']
                        
                        print(f"\n   {home} vs {away}")
                        print(f"   Time: {commence_time}")
                        
                        if event.get('bookmakers'):
                            bookmaker = event['bookmakers'][0]
                            market = bookmaker['markets'][0]
                            outcomes = market['outcomes']
                            
                            for outcome in outcomes:
                                print(f"   {outcome['name']}: {outcome['price']}")
                        else:
                            print(f"   (No odds available)")
                
                print(f"\n✅ The Odds API is working!")
                print(f"\n💡 Note: This API provides CURRENT/UPCOMING odds, not historical closing odds.")
                print(f"   For CLV tracking, you would need to:")
                print(f"   1. Poll odds regularly and store them")
                print(f"   2. OR use the 'historical' endpoint if available with premium tier")
                print(f"   3. OR use opening odds as a baseline")
                
            else:
                print(f"❌ Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
                if response.status_code == 401:
                    print(f"\n⚠️  Invalid API key!")
                elif response.status_code == 429:
                    print(f"\n⚠️  Rate limit exceeded (500 requests/month on free tier)")
                    
        except Exception as e:
            print(f"❌ Failed to fetch odds: {e}")
            return
        
        # 3. Check remaining quota
        print(f"\n📊 Step 3: Checking API quota...")
        
        if 'x-requests-remaining' in response.headers:
            remaining = response.headers['x-requests-remaining']
            used = response.headers.get('x-requests-used', 'unknown')
            print(f"✅ Requests remaining: {remaining}")
            print(f"   Requests used: {used}")
        
        print(f"\n" + "=" * 80)
        print(f"✅ THE ODDS API TEST COMPLETE")
        print(f"=" * 80)

if __name__ == "__main__":
    asyncio.run(test_odds_api())
