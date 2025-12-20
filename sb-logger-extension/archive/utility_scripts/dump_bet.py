import json

file_path = r"c:\Local\SB Logger\sb-logger-extension\Temp Files\surebet-bets-2025-12-02T12-47-16.json"
output_path = "first_bet.json"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if data.get('bets'):
        with open("first_5_bets.json", 'w', encoding='utf-8') as f:
            json.dump(data['bets'][:5], f, indent=2)
        print("Dumped first 5 bets to first_5_bets.json")
    else:
        print("No bets found.")

except Exception as e:
    print(f"Error: {e}")
