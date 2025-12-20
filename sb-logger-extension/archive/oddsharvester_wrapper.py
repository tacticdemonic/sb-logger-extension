import requests
import time
import json

API_URL = "http://localhost:8766/api"

def get_odds_portal_clv(bet_data):
    """
    Submits a single bet to OddsHarvester API and waits for result.
    Note: For efficiency, batch processing should be used, but this wrapper 
    adapts the single-bet interface for now.
    """
    # Wrap single bet in batch request
    payload = {
        "bets": [
            {
                "betId": str(bet_data.get("id", "unknown")),
                "sport": bet_data.get("sport", "Football"), # Default to Football if missing
                "tournament": bet_data.get("tournament", ""), # Added tournament
                "homeTeam": bet_data.get("teams", ["Home", "Away"])[0],
                "awayTeam": bet_data.get("teams", ["Home", "Away"])[1],
                "market": bet_data.get("market", ""),
                "eventDate": bet_data.get("eventTime", ""), # ISO format expected
                "bookmaker": bet_data.get("bookmaker", "pinnacle")
            }
        ],
        "fallbackStrategy": "pinnacle"
    }
    
    try:
        # Submit Job
        response = requests.post(f"{API_URL}/batch-closing-odds", json=payload)
        response.raise_for_status()
        job_data = response.json()
        job_id = job_data["jobId"]
        
        print(f"[OddsHarvester] Job submitted: {job_id}")
        
        # Poll for completion
        max_retries = 30
        for _ in range(max_retries):
            status_resp = requests.get(f"{API_URL}/job-status/{job_id}")
            status_resp.raise_for_status()
            status_data = status_resp.json()
            
            if status_data["status"] == "completed":
                results = status_data.get("results", [])
                if results:
                    result = results[0]
                    return {
                        "status": "success",
                        "clv_odds": result.get("closingOdds"),
                        "source": "OddsHarvester API",
                        "details": result
                    }
                else:
                    return {"status": "failed", "error": "No results returned"}
                    
            elif status_data["status"] == "failed":
                return {"status": "failed", "error": status_data.get("error")}
                
            time.sleep(2)
            
        return {"status": "timeout", "error": "Job timed out"}
        
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    # Test payload
    test_bet = {
        "id": "123",
        "sport": "Football",
        "teams": ["Arsenal", "Chelsea"],
        "market": "1x2",
        "eventTime": "2024-01-01T15:00:00Z",
        "bookmaker": "pinnacle"
    }
    print(get_odds_portal_clv(test_bet))
