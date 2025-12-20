#!/usr/bin/env python3
"""
Deprecated: debug_oddsharvester_direct

OddsHarvester has been removed. This script previously performed direct
debug scraping with OddsHarvester and is now deprecated. Use the CSV CLV
service or player props poller for testing and debugging CLV behaviors.
"""

raise SystemExit("OddsHarvester removed — debug_oddsharvester_direct is deprecated.")
    
    # Test with England Championship
    sport = "football"
    league = "england-championship"
    
    # Test with Dec 1, 2025 (Birmingham vs Watford)
    event_date = "2025-12-01"
    
    print(f"\n📊 Test Parameters:")
    print(f"   Sport: {sport}")
    print(f"   League: {league}")
    print(f"   Event Date: {event_date}")
    
    print(f"\n🌐 Initializing OddsHarvester...")
    harvester = OddsHarvester()
    
    try:
        print(f"🚀 Starting scrape (this will take 30-90 seconds)...")
        start = datetime.now()
        
        results = await harvester.scrape_closing_odds(
            sport=sport,
            league=league,
            event_date=event_date
        )
        
        elapsed = (datetime.now() - start).total_seconds()
        
        print(f"\n✅ Scrape completed in {elapsed:.1f}s")
        print(f"\n📦 Results:")
        print(f"   Type: {type(results)}")
        
        if results:
            print(f"   Total matches found: {len(results) if isinstance(results, list) else 'N/A'}")
            
            if isinstance(results, dict):
                print(f"\n   Keys: {list(results.keys())}")
                
                if 'matches' in results:
                    matches = results['matches']
                    print(f"   Matches count: {len(matches)}")
                    
                    # Show first 3 matches
                    for i, match in enumerate(matches[:3]):
                        print(f"\n   Match {i+1}:")
                        print(f"      {match}")
                
                elif 'data' in results:
                    print(f"   Data: {results['data']}")
                else:
                    print(f"   Full result: {results}")
            
            elif isinstance(results, list):
                print(f"\n   First 3 matches:")
                for i, match in enumerate(results[:3]):
                    print(f"\n   Match {i+1}:")
                    if isinstance(match, dict):
                        print(f"      Home: {match.get('home_team', 'N/A')}")
                        print(f"      Away: {match.get('away_team', 'N/A')}")
                        print(f"      Odds: {match.get('closing_odds', 'N/A')}")
                    else:
                        print(f"      {match}")
        else:
            print(f"   ⚠️  No results returned (None or empty)")
            
    except Exception as e:
        print(f"\n❌ Error during scraping:")
        print(f"   {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        print(f"\n🔒 Closing harvester...")
        await harvester.close()
        print(f"✅ Closed")

if __name__ == "__main__":
    raise SystemExit("OddsHarvester removed — debug_oddsharvester_direct is deprecated.")
