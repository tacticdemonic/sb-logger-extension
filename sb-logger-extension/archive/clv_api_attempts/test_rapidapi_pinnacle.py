"""
Test RapidAPI Pinnacle Odds API
================================

Tests the RapidAPI Pinnacle Odds endpoints to verify:
1. API key works
2. Can fetch sports list
3. Can get archive/historical events
4. Can retrieve event details with closing odds
"""

import requests
import json
import os
import sys
from datetime import datetime, timedelta

# ========== CONFIGURATION ==========
# Get API key from environment variable or command line
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_PINNACLE_KEY') or (sys.argv[1] if len(sys.argv) > 1 else None)

if not RAPIDAPI_KEY:
    print("\n❌ ERROR: No API key provided!")
    print("\nUsage:")
    print("  Set environment variable: $env:RAPIDAPI_PINNACLE_KEY='your-key-here'")
    print("  Or pass as argument: python test_rapidapi_pinnacle.py YOUR_API_KEY")
    sys.exit(1)

RAPIDAPI_HOST = "pinnacle-odds.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"

HEADERS = {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST
}

def test_sports_list():
    """Test 1: Get list of available sports"""
    print("\n" + "="*60)
    print("TEST 1: Fetching Sports List")
    print("="*60)
    
    url = f"{BASE_URL}/kit/v1/sports"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # API returns array directly, not wrapped in object
            sports = data if isinstance(data, list) else data.get('sports', [])
            print(f"\n✅ SUCCESS! Found {len(sports)} sports")
            
            # Show soccer/football details
            for sport in sports:
                if sport.get('name', '').lower() in ['soccer', 'football']:
                    print(f"\n🔍 Soccer/Football Details:")
                    print(f"   Sport ID: {sport.get('id')}")
                    print(f"   Name: {sport.get('name')}")
                    print(f"   Has Matchups: {sport.get('has_matchups')}")
                    return sport.get('id')
            
            # Fallback: show all sports
            print("\n📋 All Available Sports:")
            for sport in sports:
                print(f"   - {sport.get('name')} (ID: {sport.get('id')})")
                
            return sports[0].get('id') if sports else None
        else:
            print(f"\n❌ FAILED: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return None


def test_leagues(sport_id):
    """Test 2: Get leagues for a sport"""
    print("\n" + "="*60)
    print(f"TEST 2: Fetching Leagues for Sport ID {sport_id}")
    print("="*60)
    
    url = f"{BASE_URL}/kit/v1/leagues"
    params = {'sport_id': sport_id}
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            leagues = data.get('leagues', [])
            print(f"\n✅ SUCCESS! Found {len(leagues)} leagues")
            
            # Look for Premier League or Championship
            target_leagues = ['premier league', 'championship', 'bundesliga', 'la liga']
            found_league = None
            
            print("\n📋 Sample Leagues:")
            for i, league in enumerate(leagues[:20]):  # Show first 20
                name = league.get('name', '').lower()
                print(f"   {i+1}. {league.get('name')} (ID: {league.get('id')})")
                
                if not found_league:
                    for target in target_leagues:
                        if target in name:
                            found_league = league
                            print(f"      👆 Found target league!")
                            break
            
            return found_league or leagues[0] if leagues else None
        else:
            print(f"\n❌ FAILED: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return None


def test_archive_events(sport_id):
    """Test 3: Get archive/finished events"""
    print("\n" + "="*60)
    print(f"TEST 3: Fetching Archive Events for Sport ID {sport_id}")
    print("="*60)
    
    url = f"{BASE_URL}/kit/v1/archive"
    params = {
        'sport_id': sport_id,
        'page_num': 1  # Page numbers start at 1
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            events = data.get('events', [])
            print(f"\n✅ SUCCESS! Found {len(events)} archived events")
            
            if events:
                print("\n📋 Sample Archived Events (last 10):")
                for i, event in enumerate(events[:10]):
                    print(f"\n   {i+1}. {event.get('home')} vs {event.get('away')}")
                    print(f"      Event ID: {event.get('event_id')}")
                    print(f"      League: {event.get('league_name')}")
                    print(f"      Date: {event.get('starts')}")
                    print(f"      Status: Period {event.get('period_status')}")
                
                # Return first event for detailed testing
                return events[0]
            else:
                print("\n⚠️  No archived events found")
                return None
        else:
            print(f"\n❌ FAILED: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return None


def test_event_details(event_id):
    """Test 4: Get event details with historical odds"""
    print("\n" + "="*60)
    print(f"TEST 4: Fetching Event Details for Event ID {event_id}")
    print("="*60)
    
    url = f"{BASE_URL}/kit/v1/details"
    params = {'event_id': event_id}
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ SUCCESS! Got event details")
            
            event = data.get('event', {})
            print(f"\n🏟️  Event: {event.get('home')} vs {event.get('away')}")
            print(f"   League: {event.get('league_name')}")
            print(f"   Date: {event.get('starts')}")
            
            # Check for periods (markets)
            periods = event.get('periods', {})
            if periods:
                print(f"\n📊 Available Periods/Markets:")
                for period_key, period_data in periods.items():
                    print(f"\n   Period: {period_key} ({period_data.get('description')})")
                    
                    # Money line (1X2) odds
                    money_line = period_data.get('money_line', {})
                    if money_line:
                        print(f"      Money Line (1X2):")
                        print(f"         Home: {money_line.get('home')}")
                        print(f"         Draw: {money_line.get('draw')}")
                        print(f"         Away: {money_line.get('away')}")
                    
                    # Spreads
                    spreads = period_data.get('spreads', {})
                    if spreads:
                        print(f"      Spreads: {len(spreads)} lines available")
                    
                    # Totals
                    totals = period_data.get('totals', {})
                    if totals:
                        print(f"      Totals (O/U): {len(totals)} lines available")
                
                print(f"\n🎯 This is the CLOSING ODDS data we need for CLV!")
                return data
            else:
                print("\n⚠️  No periods/odds data found")
                return None
        else:
            print(f"\n❌ FAILED: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return None


def test_match_real_bet(sport_id):
    """Test 5: Try to find a specific real bet from our database"""
    print("\n" + "="*60)
    print("TEST 5: Searching for Real Bet Match")
    print("="*60)
    
    # Example: Birmingham City vs Watford (Dec 1, 2025)
    test_cases = [
        {
            'home': 'Birmingham City',
            'away': 'Watford',
            'date': '2025-12-01',
            'league': 'championship'
        },
        {
            'home': 'Athletic Bilbao',
            'away': 'Real Madrid',
            'date': '2025-12-03',
            'league': 'la liga'
        }
    ]
    
    print("\n🔍 Looking for recent matches...")
    print("   - Birmingham City vs Watford (Dec 1)")
    print("   - Athletic Bilbao vs Real Madrid (Dec 3)")
    
    # Try archive endpoint with league filter if possible
    url = f"{BASE_URL}/kit/v1/archive"
    params = {
        'sport_id': sport_id,
        'page_num': 1
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            events = data.get('events', [])
            
            print(f"\n📋 Searching {len(events)} archived events...")
            
            for test_case in test_cases:
                found = False
                for event in events:
                    home = event.get('home', '').lower()
                    away = event.get('away', '').lower()
                    
                    if (test_case['home'].lower() in home or home in test_case['home'].lower()) and \
                       (test_case['away'].lower() in away or away in test_case['away'].lower()):
                        print(f"\n✅ FOUND: {event.get('home')} vs {event.get('away')}")
                        print(f"   Event ID: {event.get('event_id')}")
                        print(f"   League: {event.get('league_name')}")
                        print(f"   Date: {event.get('starts')}")
                        found = True
                        return event.get('event_id')
                
                if not found:
                    print(f"\n⚠️  Not found: {test_case['home']} vs {test_case['away']}")
            
            print(f"\n💡 Tip: Archive may only show events from last few days")
            print(f"   First archived event: {events[0].get('home')} vs {events[0].get('away')} ({events[0].get('starts')})")
            return None
        else:
            print(f"\n❌ Archive search failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return None


def main():
    """Run all tests"""
    print("\n" + "🏁"*30)
    print("RapidAPI Pinnacle Odds API Test Suite")
    print("🏁"*30)
    
    # Test 1: Sports list
    sport_id = test_sports_list()
    if not sport_id:
        print("\n❌ Cannot continue without sport ID")
        return
    
    # Test 2: Leagues
    league = test_leagues(sport_id)
    
    # Test 3: Archive events
    event = test_archive_events(sport_id)
    
    # Test 4: Event details (if we found an event)
    if event and event.get('event_id'):
        event_details = test_event_details(event.get('event_id'))
    
    # Test 5: Try to find a real bet
    real_event_id = test_match_real_bet(sport_id)
    if real_event_id:
        print(f"\n🎯 Testing real bet event details...")
        test_event_details(real_event_id)
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print("\nKey Findings:")
    print("✅ If all tests passed, RapidAPI Pinnacle Odds is viable!")
    print("📈 Event details endpoint provides closing odds")
    print("🔄 Next step: Integrate into server.py")
    print("\n💡 Integration Notes:")
    print("   1. Add RAPIDAPI_PINNACLE_KEY to config")
    print("   2. Create helper to match team names to event_id")
    print("   3. Use /kit/v1/details endpoint for closing odds")
    print("   4. Parse money_line, spreads, totals from response")
    print("   5. Monitor free tier rate limits")


if __name__ == "__main__":
    main()
