import sys
import logging
from league_mapper import detect_league

# Setup logging to see debug output
logging.basicConfig(level=logging.INFO)

def test_mapping(tournament, sport, home, away):
    print(f"Testing: {tournament} ({sport}) - {home} vs {away}")
    result = detect_league(home, away, tournament, sport)
    print(f"Result: {result}")
    print("-" * 50)

if __name__ == "__main__":
    # Test cases from first_5_bets.json
    test_mapping("", "Football", "Real Oviedo", "Osasuna")
    test_mapping("", "Football", "Sassuolo", "Genoa")
    test_mapping("", "Tennis", "Alexandre Muller", "Jan-Lennard Struff")
