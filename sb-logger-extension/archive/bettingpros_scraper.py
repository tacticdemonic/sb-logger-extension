import argparse
import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

def get_player_prop_odds(player_name, prop_type, sport="nba"):
    """
    Scrapes BettingPros for player prop odds.
    """
    options = Options()
    options.add_argument("--headless")  # Run in headless mode
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3") # Suppress logs

    driver = webdriver.Chrome(options=options)
    
    try:
        # Format player name for URL (e.g., "LeBron James" -> "lebron-james")
        formatted_name = player_name.lower().replace(" ", "-")
        
        # Construct URL (This is a guess at the structure, we might need to search first)
        # BettingPros structure: https://www.bettingpros.com/nba/props/lebron-james/points/
        # Note: This URL structure is hypothetical and needs verification.
        # A more robust way is to search or go to the player page.
        
        # Let's try a direct URL approach first as it's faster if it works.
        url = f"https://www.bettingpros.com/{sport}/props/{formatted_name}/{prop_type.lower()}/"
        
        print(f"Navigating to: {url}")
        driver.get(url)

        # Wait for the odds table to load
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "props-table")) 
                # Note: "props-table" is a placeholder class name. We need to inspect the site.
                # For now, we'll dump the page source if we fail to find a specific element
                # so we can debug the structure.
            )
        except:
            print("Timeout waiting for table. Page might be different or player not found.")
            # Continue to parse whatever we have
        
        # Save page text for debugging (optional, commented out for production)
        body_text = driver.find_element(By.TAG_NAME, "body").text
        # with open("debug_text.txt", "w", encoding="utf-8") as f:
        #     f.write(body_text)
            
        # Parse text for Consensus Line
        # Pattern: "18.5 (O -120.0 / U -125.0)"
        import re
        
        consensus_pattern = r"Consensus Line\s*\n\s*([\d\.]+)\s*\(O\s*([-\+]?\d+\.?\d*)\s*/\s*U\s*([-\+]?\d+\.?\d*)\)"
        match = re.search(consensus_pattern, body_text)
        
        if match:
            line = match.group(1)
            over_odds = match.group(2)
            under_odds = match.group(3)
            
            return {
                "player": player_name,
                "prop": prop_type,
                "line": line,
                "over_odds": over_odds,
                "under_odds": under_odds,
                "source": "Consensus Line Text Match",
                "status": "success"
            }
            
        return {
            "player": player_name,
            "prop": prop_type,
            "status": "consensus_not_found",
            "error": "Could not find Consensus Line pattern in page text"
        }

    except Exception as e:
        return {"error": str(e)}
    finally:
        driver.quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape BettingPros Player Props")
    parser.add_argument("player", help="Player Name (e.g. 'LeBron James')")
    parser.add_argument("prop", help="Prop Type (e.g. 'Points')")
    parser.add_argument("--sport", default="nba", help="Sport (default: nba)")
    
    args = parser.parse_args()
    
    result = get_player_prop_odds(args.player, args.prop, args.sport)
    print(json.dumps(result, indent=2))
