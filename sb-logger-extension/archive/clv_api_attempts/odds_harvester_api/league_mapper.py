"""
League Mapper Module
====================

Maps team names and tournament names from surebet.com to OddsHarvester
league slugs for efficient batch scraping.

Includes:
- Static league aliases for common tournaments
- Dynamic team-to-league detection via fuzzy matching
- Custom mappings file for user-contributed edge cases
- Logging of unmatched leagues for future improvement
"""

import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from fuzzy_matcher import find_best_match, normalize_string

logger = logging.getLogger("LeagueMapper")

# Path to custom mappings file (user-editable)
CUSTOM_MAPPINGS_PATH = Path(__file__).parent / "custom_league_mappings.json"
UNMAPPED_LOG_PATH = Path(__file__).parent / "unmapped_leagues.json"


# === Static League Aliases ===
# Maps common surebet.com tournament names to OddsHarvester league slugs

LEAGUE_ALIASES = {
    # Football - England
    "premier league": "england-premier-league",
    "epl": "england-premier-league",
    "english premier league": "england-premier-league",
    "championship": "england-championship",
    "english championship": "england-championship",
    "league one": "england-league-one",
    "league two": "england-league-two",
    "fa cup": "england-fa-cup",
    "efl cup": "england-efl-cup",
    "league cup": "england-efl-cup",
    "carabao cup": "england-efl-cup",
    
    # Football - Spain
    "la liga": "spain-laliga",
    "laliga": "spain-laliga",
    "spanish la liga": "spain-laliga",
    "segunda division": "spain-segunda-division",
    "la liga 2": "spain-segunda-division",
    "copa del rey": "spain-copa-del-rey",
    
    # Football - Italy
    "serie a": "italy-serie-a",
    "italian serie a": "italy-serie-a",
    "serie b": "italy-serie-b",
    "coppa italia": "italy-coppa-italia",
    
    # Football - Germany
    "bundesliga": "germany-bundesliga",
    "german bundesliga": "germany-bundesliga",
    "2. bundesliga": "germany-2-bundesliga",
    "bundesliga 2": "germany-2-bundesliga",
    "dfb pokal": "germany-dfb-pokal",
    "dfb-pokal": "germany-dfb-pokal",
    
    # Football - France
    "ligue 1": "france-ligue-1",
    "french ligue 1": "france-ligue-1",
    "ligue 2": "france-ligue-2",
    "coupe de france": "france-coupe-de-france",
    
    # Football - Other Top Leagues
    "eredivisie": "netherlands-eredivisie",
    "dutch eredivisie": "netherlands-eredivisie",
    "primeira liga": "portugal-primeira-liga",
    "liga portugal": "portugal-primeira-liga",
    "scottish premiership": "scotland-premiership",
    "spfl": "scotland-premiership",
    "scottish championship": "scotland-championship",
    "super lig": "turkey-super-lig",
    "turkish super lig": "turkey-super-lig",
    "belgian pro league": "belgium-jupiler-pro-league",
    "jupiler pro league": "belgium-jupiler-pro-league",
    "belgian first division b": "belgium-first-division-b",
    "russian premier league": "russia-premier-league",
    "austrian bundesliga": "austria-bundesliga",
    "swiss super league": "switzerland-super-league",
    "swiss challenge league": "switzerland-challenge-league",
    "danish superliga": "denmark-superliga",
    "norwegian eliteserien": "norway-eliteserien",
    "swedish allsvenskan": "sweden-allsvenskan",
    
    # Football - Mid-Tier European Leagues
    "greek super league": "greece-super-league",
    "super league greece": "greece-super-league",
    "ekstraklasa": "poland-ekstraklasa",
    "polish ekstraklasa": "poland-ekstraklasa",
    "czech first league": "czech-republic-first-league",
    "fortuna liga": "czech-republic-first-league",
    "croatian hnl": "croatia-hnl",
    "prva hnl": "croatia-hnl",
    "romanian liga 1": "romania-liga-1",
    "liga 1 romania": "romania-liga-1",
    "ukrainian premier league": "ukraine-premier-league",
    "serbian superliga": "serbia-super-liga",
    "bulgarian first league": "bulgaria-first-league",
    "hungarian nb i": "hungary-nb-i",
    "slovak super liga": "slovakia-super-liga",
    
    # Football - South America
    "brasileirao": "brazil-serie-a",
    "brasileiro serie a": "brazil-serie-a",
    "brazilian serie a": "brazil-serie-a",
    "argentine primera division": "argentina-primera-division",
    "liga profesional": "argentina-primera-division",
    
    # Football - International
    "champions league": "europe-champions-league",
    "uefa champions league": "europe-champions-league",
    "ucl": "europe-champions-league",
    "europa league": "europe-europa-league",
    "uefa europa league": "europe-europa-league",
    "uel": "europe-europa-league",
    "conference league": "europe-conference-league",
    "europa conference league": "europe-conference-league",
    "world cup": "world-world-cup",
    "fifa world cup": "world-world-cup",
    "euro": "europe-euro",
    "european championship": "europe-euro",
    "nations league": "europe-nations-league",
    "uefa nations league": "europe-nations-league",
    "copa america": "south-america-copa-america",
    
    # Football - USA
    "mls": "usa-mls",
    "major league soccer": "usa-mls",
    
    # Tennis - Grand Slams
    "australian open": "atp-australian-open",
    "french open": "atp-french-open",
    "roland garros": "atp-french-open",
    "wimbledon": "atp-wimbledon",
    "us open": "atp-us-open",
    
    # Tennis - Other
    "atp tour": "atp-tour",
    "wta tour": "wta-tour",
    "atp 1000": "atp-masters-1000",
    "atp 500": "atp-500",
    "atp 250": "atp-250",
    
    # Basketball - NBA
    "nba": "usa-nba",
    "national basketball association": "usa-nba",
    
    # Basketball - Europe
    "euroleague": "europe-euroleague",
    "eurocup": "europe-eurocup",
    "acb": "spain-acb",
    "spanish acb": "spain-acb",
    
    # Ice Hockey
    "nhl": "usa-nhl",
    "national hockey league": "usa-nhl",
    "khl": "russia-khl",
    "shl": "sweden-shl",
    "liiga": "finland-liiga",
    
    # Baseball
    "mlb": "usa-mlb",
    "major league baseball": "usa-mlb",
    "npb": "japan-npb",
    "kbo": "korea-kbo",
    
    # Rugby
    "six nations": "europe-six-nations",
    "rugby championship": "world-rugby-championship",
    "premiership rugby": "england-premiership-rugby",
    "top 14": "france-top-14",
    "super rugby": "world-super-rugby",
    "nrl": "australia-nrl",
    "super league": "europe-super-league-rugby",
}


# === Team to League Mapping ===
# Known teams and their primary leagues

TEAM_LEAGUES = {
    # Premier League
    "arsenal": "england-premier-league",
    "aston villa": "england-premier-league",
    "bournemouth": "england-premier-league",
    "brentford": "england-premier-league",
    "brighton": "england-premier-league",
    "burnley": "england-premier-league",
    "chelsea": "england-premier-league",
    "crystal palace": "england-premier-league",
    "everton": "england-premier-league",
    "fulham": "england-premier-league",
    "liverpool": "england-premier-league",
    "luton": "england-premier-league",
    "manchester city": "england-premier-league",
    "manchester united": "england-premier-league",
    "newcastle": "england-premier-league",
    "nottingham forest": "england-premier-league",
    "sheffield united": "england-premier-league",
    "tottenham": "england-premier-league",
    "west ham": "england-premier-league",
    "wolverhampton": "england-premier-league",
    "wolves": "england-premier-league",
    
    # Championship (English Second Tier)
    "leeds united": "england-championship",
    "leeds": "england-championship",
    "leicester city": "england-championship",
    "leicester": "england-championship",
    "southampton": "england-championship",
    "ipswich town": "england-championship",
    "ipswich": "england-championship",
    "west bromwich albion": "england-championship",
    "west brom": "england-championship",
    "norwich city": "england-championship",
    "norwich": "england-championship",
    "middlesbrough": "england-championship",
    "coventry city": "england-championship",
    "coventry": "england-championship",
    "bristol city": "england-championship",
    "swansea city": "england-championship",
    "swansea": "england-championship",
    "hull city": "england-championship",
    "hull": "england-championship",
    "preston north end": "england-championship",
    "preston": "england-championship",
    "cardiff city": "england-championship",
    "cardiff": "england-championship",
    "stoke city": "england-championship",
    "stoke": "england-championship",
    "millwall": "england-championship",
    "blackburn rovers": "england-championship",
    "blackburn": "england-championship",
    "queens park rangers": "england-championship",
    "qpr": "england-championship",
    "watford": "england-championship",
    "plymouth argyle": "england-championship",
    "plymouth": "england-championship",
    "birmingham city": "england-championship",
    "birmingham": "england-championship",
    "rotherham united": "england-championship",
    "rotherham": "england-championship",
    "sheffield wednesday": "england-championship",
    
    # La Liga
    "barcelona": "spain-laliga",
    "real madrid": "spain-laliga",
    "atletico madrid": "spain-laliga",
    "sevilla": "spain-laliga",
    "real sociedad": "spain-laliga",
    "villarreal": "spain-laliga",
    "athletic bilbao": "spain-laliga",
    "real betis": "spain-laliga",
    "valencia": "spain-laliga",
    "getafe": "spain-laliga",
    "osasuna": "spain-laliga",
    "celta vigo": "spain-laliga",
    "mallorca": "spain-laliga",
    "las palmas": "spain-laliga",
    "girona": "spain-laliga",
    "rayo vallecano": "spain-laliga",
    "almeria": "spain-laliga",
    "cadiz": "spain-laliga",
    "alaves": "spain-laliga",
    "granada": "spain-laliga",
    
    # Segunda División (Spanish Second Tier)
    "espanyol": "spain-segunda-division",
    "real zaragoza": "spain-segunda-division",
    "zaragoza": "spain-segunda-division",
    "real valladolid": "spain-segunda-division",
    "valladolid": "spain-segunda-division",
    "sporting gijon": "spain-segunda-division",
    "sporting": "spain-segunda-division",
    "real oviedo": "spain-segunda-division",
    "oviedo": "spain-segunda-division",
    "levante": "spain-segunda-division",
    "eibar": "spain-segunda-division",
    "elche": "spain-segunda-division",
    "leganes": "spain-segunda-division",
    "burgos": "spain-segunda-division",
    "racing santander": "spain-segunda-division",
    "racing": "spain-segunda-division",
    "tenerife": "spain-segunda-division",
    "albacete": "spain-segunda-division",
    "mirandes": "spain-segunda-division",
    "huesca": "spain-segunda-division",
    "cartagena": "spain-segunda-division",
    "amorebieta": "spain-segunda-division",
    "villarreal b": "spain-segunda-division",
    "andorra": "spain-segunda-division",
    "racing ferrol": "spain-segunda-division",
    "alcorcon": "spain-segunda-division",
    
    # Serie A
    "inter milan": "italy-serie-a",
    "inter": "italy-serie-a",
    "ac milan": "italy-serie-a",
    "milan": "italy-serie-a",
    "juventus": "italy-serie-a",
    "napoli": "italy-serie-a",
    "roma": "italy-serie-a",
    "lazio": "italy-serie-a",
    "atalanta": "italy-serie-a",
    "fiorentina": "italy-serie-a",
    "bologna": "italy-serie-a",
    "torino": "italy-serie-a",
    "monza": "italy-serie-a",
    "udinese": "italy-serie-a",
    "sassuolo": "italy-serie-a",
    "empoli": "italy-serie-a",
    "lecce": "italy-serie-a",
    "genoa": "italy-serie-a",
    "cagliari": "italy-serie-a",
    "frosinone": "italy-serie-a",
    "verona": "italy-serie-a",
    "salernitana": "italy-serie-a",
    
    # Serie B (Italian Second Tier)
    "parma": "italy-serie-b",
    "como": "italy-serie-b",
    "venezia": "italy-serie-b",
    "cremonese": "italy-serie-b",
    "palermo": "italy-serie-b",
    "sampdoria": "italy-serie-b",
    "brescia": "italy-serie-b",
    "catanzaro": "italy-serie-b",
    "sudtirol": "italy-serie-b",
    "cittadella": "italy-serie-b",
    "modena": "italy-serie-b",
    "pisa": "italy-serie-b",
    "spezia": "italy-serie-b",
    "reggiana": "italy-serie-b",
    "cosenza": "italy-serie-b",
    "ternana": "italy-serie-b",
    "bari": "italy-serie-b",
    "ascoli": "italy-serie-b",
    "feralpisalo": "italy-serie-b",
    "lecco": "italy-serie-b",
    
    # Bundesliga
    "bayern munich": "germany-bundesliga",
    "bayern": "germany-bundesliga",
    "borussia dortmund": "germany-bundesliga",
    "dortmund": "germany-bundesliga",
    "bayer leverkusen": "germany-bundesliga",
    "leverkusen": "germany-bundesliga",
    "rb leipzig": "germany-bundesliga",
    "leipzig": "germany-bundesliga",
    "eintracht frankfurt": "germany-bundesliga",
    "frankfurt": "germany-bundesliga",
    "wolfsburg": "germany-bundesliga",
    "freiburg": "germany-bundesliga",
    "hoffenheim": "germany-bundesliga",
    "borussia monchengladbach": "germany-bundesliga",
    "monchengladbach": "germany-bundesliga",
    "union berlin": "germany-bundesliga",
    "koln": "germany-bundesliga",
    "cologne": "germany-bundesliga",
    "mainz": "germany-bundesliga",
    "augsburg": "germany-bundesliga",
    "werder bremen": "germany-bundesliga",
    "bremen": "germany-bundesliga",
    "bochum": "germany-bundesliga",
    "heidenheim": "germany-bundesliga",
    "darmstadt": "germany-bundesliga",
    
    # 2. Bundesliga (German Second Tier)
    "schalke": "germany-2-bundesliga",
    "schalke 04": "germany-2-bundesliga",
    "hamburger sv": "germany-2-bundesliga",
    "hamburg": "germany-2-bundesliga",
    "hertha berlin": "germany-2-bundesliga",
    "hertha": "germany-2-bundesliga",
    "fortuna dusseldorf": "germany-2-bundesliga",
    "dusseldorf": "germany-2-bundesliga",
    "hannover 96": "germany-2-bundesliga",
    "hannover": "germany-2-bundesliga",
    "st pauli": "germany-2-bundesliga",
    "fc st pauli": "germany-2-bundesliga",
    "kaiserslautern": "germany-2-bundesliga",
    "karlsruher sc": "germany-2-bundesliga",
    "karlsruhe": "germany-2-bundesliga",
    "nurnberg": "germany-2-bundesliga",
    "magdeburg": "germany-2-bundesliga",
    "paderborn": "germany-2-bundesliga",
    "holstein kiel": "germany-2-bundesliga",
    "kiel": "germany-2-bundesliga",
    "greuther furth": "germany-2-bundesliga",
    "furth": "germany-2-bundesliga",
    "hansa rostock": "germany-2-bundesliga",
    "rostock": "germany-2-bundesliga",
    "wehen wiesbaden": "germany-2-bundesliga",
    "wiesbaden": "germany-2-bundesliga",
    "eintracht braunschweig": "germany-2-bundesliga",
    "braunschweig": "germany-2-bundesliga",
    
    # Ligue 1
    "paris saint-germain": "france-ligue-1",
    "psg": "france-ligue-1",
    "marseille": "france-ligue-1",
    "monaco": "france-ligue-1",
    "lyon": "france-ligue-1",
    "lille": "france-ligue-1",
    "lens": "france-ligue-1",
    "nice": "france-ligue-1",
    "rennes": "france-ligue-1",
    "strasbourg": "france-ligue-1",
    "nantes": "france-ligue-1",
    "toulouse": "france-ligue-1",
    "montpellier": "france-ligue-1",
    "brest": "france-ligue-1",
    "reims": "france-ligue-1",
    "le havre": "france-ligue-1",
    "lorient": "france-ligue-1",
    "metz": "france-ligue-1",
    "clermont": "france-ligue-1",
    
    # Ligue 2 (French Second Tier)
    "bordeaux": "france-ligue-2",
    "saint-etienne": "france-ligue-2",
    "st etienne": "france-ligue-2",
    "auxerre": "france-ligue-2",
    "laval": "france-ligue-2",
    "grenoble": "france-ligue-2",
    "annecy": "france-ligue-2",
    "paris fc": "france-ligue-2",
    "amiens": "france-ligue-2",
    "pau": "france-ligue-2",
    "rodez": "france-ligue-2",
    "bastia": "france-ligue-2",
    "valenciennes": "france-ligue-2",
    "guingamp": "france-ligue-2",
    "dunkerque": "france-ligue-2",
    "quevilly rouen": "france-ligue-2",
    "rouen": "france-ligue-2",
    "caen": "france-ligue-2",
    "troyes": "france-ligue-2",
    "concarneau": "france-ligue-2",
    "angers": "france-ligue-2",
}


# === Custom Mappings ===


def load_custom_mappings() -> dict:
    """Load user-contributed custom mappings."""
    if CUSTOM_MAPPINGS_PATH.exists():
        try:
            with open(CUSTOM_MAPPINGS_PATH) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def save_custom_mappings(mappings: dict):
    """Save custom mappings to file."""
    with open(CUSTOM_MAPPINGS_PATH, "w") as f:
        json.dump(mappings, f, indent=2)


def update_custom_mappings(new_mappings: dict):
    """Update custom mappings with new entries."""
    current = load_custom_mappings()
    current.update(new_mappings)
    save_custom_mappings(current)


def get_league_mappings() -> dict:
    """Get all league mappings (static + custom)."""
    custom = load_custom_mappings()
    return {
        "static": LEAGUE_ALIASES,
        "teams": TEAM_LEAGUES,
        "custom": custom,
    }


# === Unmapped Logging ===


def log_unmapped_league(
    home_team: str,
    away_team: str,
    tournament: str,
    sport: str,
    suggested_league: str = None,
):
    """Log an unmapped league for future improvement."""
    try:
        entries = []
        if UNMAPPED_LOG_PATH.exists():
            with open(UNMAPPED_LOG_PATH) as f:
                entries = json.load(f)

        # Check if already logged (avoid duplicates)
        key = f"{sport}|{tournament}|{home_team}|{away_team}"
        for entry in entries:
            if entry.get("key") == key:
                return

        entries.append({
            "key": key,
            "timestamp": datetime.now().isoformat(),
            "sport": sport,
            "tournament": tournament,
            "home_team": home_team,
            "away_team": away_team,
            "suggested_league": suggested_league,
        })

        # Keep last 1000 entries
        entries = entries[-1000:]

        with open(UNMAPPED_LOG_PATH, "w") as f:
            json.dump(entries, f, indent=2)

    except Exception as e:
        logger.warning(f"Failed to log unmapped league: {e}")


# === Main Detection Function ===


def detect_league(
    home_team: str,
    away_team: str,
    tournament: str,
    sport: str,
) -> Optional[dict]:
    """
    Detect the OddsHarvester league slug from match information.
    
    Returns:
        {
            "league": "england-premier-league",
            "sport": "basketball",  # Inferred sport (if originally "other")
            "confidence": 0.95,
            "source": "team_lookup" | "tournament_alias" | "fuzzy_match" | "custom"
        }
        or None if no match found
    """
    # Normalize inputs
    home_normalized = normalize_string(home_team)
    away_normalized = normalize_string(away_team)
    tournament_normalized = normalize_string(tournament)
    sport_normalized = normalize_string(sport)
    original_sport = sport_normalized  # Save original before inference

    # 0. Infer actual sport if sport is "other" (check tournament name for clues)
    if sport_normalized == "other":
        if "nba" in tournament_normalized:
            sport_normalized = "basketball"
        elif "nfl" in tournament_normalized:
            sport_normalized = "americanfootball"
        elif "nhl" in tournament_normalized:
            sport_normalized = "icehockey"
        elif "mlb" in tournament_normalized:
            sport_normalized = "baseball"
        elif "atp" in tournament_normalized or "wta" in tournament_normalized:
            sport_normalized = "tennis"

    # Helper to add sport to result
    def make_result(league: str, confidence: float, source: str) -> dict:
        return {
            "league": league,
            "sport": sport_normalized,  # Include inferred sport
            "confidence": confidence,
            "source": source,
        }

    # 1. Check custom mappings first (highest priority)
    custom = load_custom_mappings()
    if tournament_normalized in custom:
        return make_result(custom[tournament_normalized], 1.0, "custom")

    # 2. Special handling for Tennis ATP/WTA tournaments
    if sport_normalized == "tennis":
        # Pattern: "Country - ATP/WTA City" -> "atp-tour" or "wta-tour"
        if "atp" in tournament_normalized or "wta" in tournament_normalized:
            # Extract tournament type
            if "atp" in tournament_normalized:
                tour_type = "atp"
            else:
                tour_type = "wta"
            
            # Check for specific tournament levels
            if "masters" in tournament_normalized or "1000" in tournament_normalized:
                return make_result(f"{tour_type}-masters-1000", 0.90, "tournament_pattern")
            elif "500" in tournament_normalized:
                return make_result(f"{tour_type}-500", 0.90, "tournament_pattern")
            elif "250" in tournament_normalized:
                return make_result(f"{tour_type}-250", 0.90, "tournament_pattern")
            else:
                # Generic ATP/WTA tour event
                return make_result(f"{tour_type}-tour", 0.85, "tournament_pattern")

    # 3. Check tournament aliases
    if tournament_normalized:
        for alias, league_slug in LEAGUE_ALIASES.items():
            if alias in tournament_normalized or tournament_normalized in alias:
                return make_result(league_slug, 0.95, "tournament_alias")

    # 4. Check team lookups
    home_league = TEAM_LEAGUES.get(home_normalized)
    away_league = TEAM_LEAGUES.get(away_normalized)

    if home_league and away_league and home_league == away_league:
        return make_result(home_league, 0.95, "team_lookup")
    elif home_league:
        return make_result(home_league, 0.80, "team_lookup")
    elif away_league:
        return make_result(away_league, 0.80, "team_lookup")

    # 4. Fuzzy match on tournament name
    all_leagues = list(LEAGUE_ALIASES.keys())
    match_result = find_best_match(tournament_normalized, all_leagues, min_score=0.7)

    if match_result:
        matched_alias = match_result["match"]
        return make_result(LEAGUE_ALIASES[matched_alias], match_result["score"], "fuzzy_match")

    # 5. Try to infer from sport + country patterns
    country_patterns = {
        "england": "england",
        "english": "england",
        "spain": "spain",
        "spanish": "spain",
        "italy": "italy",
        "italian": "italy",
        "germany": "germany",
        "german": "germany",
        "france": "france",
        "french": "france",
    }

    for pattern, country in country_patterns.items():
        if pattern in tournament_normalized:
            # Try to find a matching league for this sport + country
            for alias, league_slug in LEAGUE_ALIASES.items():
                if country in league_slug and sport_normalized in alias:
                    return make_result(league_slug, 0.6, "country_inference")

    # No match found - log for future improvement
    log_unmapped_league(home_team, away_team, tournament, sport)
    return None
