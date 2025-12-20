"""
Test RapidAPI Pinnacle - Markets Endpoint
==========================================

The archive endpoint seems to only show old/scheduled events.
Let's try the markets endpoint to find CURRENT matches we can query for closing odds.
"""

import requests
import json
import os
import sys

RAPIDAPI_KEY = sys.argv[1] if len(sys.argv) > 1 else None
if not RAPIDAPI_KEY:
    print("Usage: python test_pinnacle_markets.py YOUR_API_KEY")
    sys.exit(1)

RAPIDAPI_HOST = "pinnacle-odds.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"

HEADERS = {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST
}

print("\n" + "="*60)
print("Testing Markets Endpoint")
print("="*60)

# Get current matches
url = f"{BASE_URL}/kit/v1/markets"
params = {
    'sport_id': 1,  # Soccer
    'is_have_odds': 1,  # Only events with odds
    'event_type': 'prematch'  # Pre-match events
}

print(f"\n🔍 Fetching current pre-match soccer markets...")
response = requests.get(url, headers=HEADERS, params=params, timeout=15)
print(f"Status Code: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    events = data.get('events', [])
    
    print(f"\n✅ Found {len(events)} current matches with odds")
    
    # Look for English leagues
    english_matches = []
    for event in events:
        league = event.get('league_name', '').lower()
        if any(x in league for x in ['england', 'premier', 'championship', 'league one', 'league two']):
            english_matches.append(event)
    
    print(f"\n🏴󐁧󐁢󐁥󐁮󐁧󐁿 Found {len(english_matches)} English league matches:")
    
    for i, event in enumerate(english_matches[:10]):
        print(f"\n{i+1}. {event.get('home')} vs {event.get('away')}")
        print(f"   Event ID: {event.get('event_id')}")
        print(f"   League: {event.get('league_name')}")
        print(f"   Starts: {event.get('starts')}")
        
        # Check if it has odds
        periods = event.get('periods', {})
        if periods:
            num_0 = periods.get('num_0', {})
            money_line = num_0.get('money_line', {})
            
            if money_line:
                print(f"   💰 Current Odds (1X2):")
                print(f"      Home: {money_line.get('home')}")
                print(f"      Draw: {money_line.get('draw')}")
                print(f"      Away: {money_line.get('away')}")
    
    if english_matches:
        # Test event details for first match
        test_event = english_matches[0]
        event_id = test_event.get('event_id')
        
        print(f"\n" + "="*60)
        print(f"Testing Event Details for: {test_event.get('home')} vs {test_event.get('away')}")
        print("="*60)
        
        details_url = f"{BASE_URL}/kit/v1/details"
        details_params = {'event_id': event_id}
        
        details_response = requests.get(details_url, headers=HEADERS, params=details_params, timeout=15)
        print(f"Status Code: {details_response.status_code}")
        
        if details_response.status_code == 200:
            details_data = details_response.json()
            
            # Check if we got the full event data
            event_data = details_data.get('event', {})
            if event_data:
                print(f"\n✅ Event details retrieved!")
                print(f"   Home: {event_data.get('home')}")
                print(f"   Away: {event_data.get('away')}")
                print(f"   League: {event_data.get('league_name')}")
                
                periods = event_data.get('periods', {})
                if periods:
                    print(f"\n📊 Odds data available:")
                    for period_key, period_data in periods.items():
                        print(f"\n   Period: {period_key} ({period_data.get('description')})")
                        
                        ml = period_data.get('money_line', {})
                        if ml:
                            print(f"      1X2: Home={ml.get('home')}, Draw={ml.get('draw')}, Away={ml.get('away')}")
                else:
                    print(f"\n⚠️ No periods/odds data in event details")
                    
                # Save full response for inspection
                with open('pinnacle_event_details_sample.json', 'w') as f:
                    json.dump(details_data, f, indent=2)
                print(f"\n💾 Full response saved to: pinnacle_event_details_sample.json")
            else:
                print(f"\n⚠️ Event details response was empty")
                print(f"Response keys: {list(details_data.keys())}")
        else:
            print(f"\n❌ Failed: {details_response.status_code}")
            print(f"Response: {details_response.text[:500]}")

else:
    print(f"\n❌ Failed to fetch markets: {response.status_code}")
    print(f"Response: {response.text[:500]}")

print("\n" + "="*60)
print("🎯 KEY INSIGHTS")
print("="*60)
print("\n1. Markets endpoint gives CURRENT matches (pre-match & live)")
print("2. Archive endpoint shows OLD/FINISHED matches")
print("3. For CLV, we need FINISHED matches with CLOSING odds")
print("4. Strategy:")
print("   - Use markets endpoint to find event_id for upcoming matches")
print("   - Track those event_ids in database")
print("   - After match finishes, query details endpoint for closing odds")
print("   - OR use archive endpoint page by page to find recent finished matches")
