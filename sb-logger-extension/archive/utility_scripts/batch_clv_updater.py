import json
import re
import time
from bettingpros_scraper import get_player_prop_odds as scrape_player_prop
from oddsharvester_wrapper import get_odds_portal_clv

# File paths
input_file = r"c:\Local\SB Logger\sb-logger-extension\Temp Files\surebet-bets-2025-12-02T12-47-16.json"
output_file = r"c:\Local\SB Logger\sb-logger-extension\Temp Files\surebet-bets-updated.json"

def parse_bet_name(bet_name):
    # Expected format: "Points (Player Name) - including overtime"
    # or "Rebounds (Player Name)..."
    # Regex: ^(\w+)\s*\(([^)]+)\)
    
    match = re.search(r"^(\w+)\s*\(([^)]+)\)", bet_name)
    if match:
        prop_type = match.group(1)
        player_name = match.group(2)
        return player_name, prop_type
    return None, None

def is_player_prop(bet):
    market = bet.get('market', '').lower()
    # Basic check: does it contain prop keywords?
    # Adjust this based on actual data structure
    return "points" in market or "rebounds" in market or "assists" in market

def main():
    print(f"Reading bets from {input_file}...")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    bets = data.get('bets', [])
    print(f"Found {len(bets)} bets.")
    
    updated_count = 0
    processed_count = 0
    
    # Limit for testing
    LIMIT = 5 
    
    for bet in bets:
        if processed_count >= LIMIT:
            break
            
        bet_name = bet.get('market', '') # Using 'market' as it seems more descriptive in this file
        
        if is_player_prop(bet):
            # --- Player Prop Strategy (BettingPros) ---
            print(f"Processing Prop: {bet_name}")
            
            # Need to parse player name from market string
            # Market ex: "Total over 225.5 - points scored including overtime" -> Not a player prop!
            # Real player prop ex needed. Assuming we find one or skip.
            
            # If we can't parse player, skip
            # For now, just print we found a prop-like bet
            print("  > Detected as Prop (Logic needs refinement for specific player extraction)")
            
        else:
            # --- Main Market Strategy (OddsHarvester) ---
            print(f"Processing Main Market: {bet_name}")
            
            # Pass full bet object to wrapper
            clv_data = get_odds_portal_clv(bet)
            
            if clv_data.get('status') == 'success':
                print(f"  > Success: {clv_data.get('clv_odds')}")
                bet['clv_data'] = clv_data
                updated_count += 1
            else:
                print(f"  > Failed: {clv_data.get('error')}")
                
        processed_count += 1
        time.sleep(1) 
            
    print(f"Processed {processed_count} bets. Updated {updated_count}.")
    
    # Save updated file
    print(f"Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    main()
