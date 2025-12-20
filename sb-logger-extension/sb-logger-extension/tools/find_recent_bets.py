#!/usr/bin/env python3
"""Find recent bets for CLV testing"""

import json
from datetime import datetime

# Load bet data
with open(r'c:\Local\SB Logger\sb-logger-extension\surebet-bets-updated.json', 'r') as f:
    data = json.load(f)

bets = data['bets']
print(f"Total bets: {len(bets)}\n")

# Find recent matches (November 20+ or December)
recent = []
for bet in bets:
    event_time = bet.get('eventTime', '')
    if event_time:
        # Check if date is Nov 20+ or December
        if '2025-12' in event_time or '2025-11-2' in event_time or '2025-11-3' in event_time:
            recent.append(bet)

print(f"Recent matches (Nov 20+, Dec): {len(recent)}\n")

# Group by date and show top 10
recent_sorted = sorted(recent, key=lambda x: x.get('eventTime', ''), reverse=True)

print("=" * 80)
print("RECENT MATCHES (Most Recent First)")
print("=" * 80)

for i, bet in enumerate(recent_sorted[:15]):
    event_time = bet.get('eventTime', 'Unknown')[:16]
    event = bet.get('event', 'Unknown')
    tournament = bet.get('tournament', 'Unknown')
    sport = bet.get('sport', 'Unknown')
    market = bet.get('market', '1X2')
    teams = bet.get('teams', [])
    
    print(f"\n{i+1}. {event_time}")
    print(f"   Event: {event}")
    print(f"   Tournament: {tournament}")
    print(f"   Sport: {sport}")
    print(f"   Market: {market}")
    print(f"   Teams: {teams}")

# Find the most recent completed match for testing
print("\n" + "=" * 80)
print("BEST CANDIDATE FOR CLV TEST (Most recent, likely completed)")
print("=" * 80)

if recent_sorted:
    bet = recent_sorted[0]
    print(f"\nEvent: {bet['event']}")
    print(f"Time: {bet['eventTime']}")
    print(f"Tournament: {bet['tournament']}")
    print(f"Sport: {bet['sport']}")
    print(f"Teams: {bet['teams']}")
    print(f"Market: {bet.get('market', '1X2')}")
    print(f"Bookmaker: {bet.get('bookmaker', 'Unknown')}")
    print(f"\nTest payload:")
    print(f"{{")
    print(f'  "betId": "recent-test-1",')
    print(f'  "sport": "{bet["sport"]}",')
    print(f'  "tournament": "{bet["tournament"]}",')
    print(f'  "homeTeam": "{bet["teams"][0]}",')
    print(f'  "awayTeam": "{bet["teams"][1]}",')
    print(f'  "market": "{bet.get("market", "1X2")}",')
    print(f'  "eventDate": "{bet["eventTime"][:10]}",')
    print(f'  "bookmaker": "{bet.get("bookmaker", "pinnacle")}"')
    print(f"}}")
