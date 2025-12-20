import json

file_path = r"c:\Local\SB Logger\sb-logger-extension\Temp Files\surebet-bets-2025-12-02T12-47-16.json"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total bets: {len(data.get('bets', []))}")
    
    if not data.get('bets'):
        print("No bets found.")
        exit()
        
    first_bet = data['bets'][0]
    print("\n--- Keys in a Bet Object ---")
    print(list(first_bet.keys()))
    
    print("\n--- Searching for 'points' in values of ALL bets (case-insensitive, str conversion) ---")
    found = False
    for i, bet in enumerate(data['bets']):
        for k, v in bet.items():
            val_str = str(v).lower()
            if "points" in val_str or "rebounds" in val_str or "assists" in val_str:
                print(f"Bet {i}: Found keyword in key '{k}': {v}")
                found = True
                break
        if found:
            break
            
    if not found:
        print("No keywords found even with str conversion.")
                
except Exception as e:
    print(f"Error: {e}")
