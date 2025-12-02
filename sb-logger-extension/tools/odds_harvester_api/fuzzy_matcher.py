"""
Fuzzy Matcher Module (Python)
=============================

Provides fuzzy string matching for:
- Team name normalization and matching
- Bookmaker name normalization
- Market type normalization
- Finding best matches with confidence scores

This is the Python equivalent of fuzzyMatcher.js in the browser extension.
Both implementations should produce identical results for consistency.
"""

import re
import unicodedata
from typing import Optional


# === Team Name Abbreviations ===
# Common abbreviations found on surebet.com

TEAM_ABBREVIATIONS = {
    # English Teams
    "man city": "manchester city",
    "man utd": "manchester united",
    "man united": "manchester united",
    "spurs": "tottenham hotspur",
    "tottenham": "tottenham hotspur",
    "wolves": "wolverhampton wanderers",
    "wolverhampton": "wolverhampton wanderers",
    "newcastle utd": "newcastle united",
    "newcastle": "newcastle united",
    "west ham utd": "west ham united",
    "west ham": "west ham united",
    "sheffield utd": "sheffield united",
    "nottm forest": "nottingham forest",
    "nottingham": "nottingham forest",
    "brighton": "brighton hove albion",
    "crystal palace": "crystal palace",
    "leicester": "leicester city",
    "leeds": "leeds united",
    
    # Spanish Teams
    "atletico": "atletico madrid",
    "atleti": "atletico madrid",
    "real": "real madrid",
    "barca": "barcelona",
    "sociedad": "real sociedad",
    "betis": "real betis",
    "athletic": "athletic bilbao",
    "celta": "celta vigo",
    
    # Italian Teams
    "inter": "inter milan",
    "internazionale": "inter milan",
    "milan": "ac milan",
    "juve": "juventus",
    
    # German Teams
    "bayern": "bayern munich",
    "dortmund": "borussia dortmund",
    "bvb": "borussia dortmund",
    "gladbach": "borussia monchengladbach",
    "bmg": "borussia monchengladbach",
    "leverkusen": "bayer leverkusen",
    "leipzig": "rb leipzig",
    "frankfurt": "eintracht frankfurt",
    "koln": "fc koln",
    "cologne": "fc koln",
    "bremen": "werder bremen",
    
    # French Teams
    "psg": "paris saint-germain",
    "paris sg": "paris saint-germain",
    "paris": "paris saint-germain",
    "om": "olympique marseille",
    "marseille": "olympique marseille",
    "ol": "olympique lyonnais",
    "lyon": "olympique lyonnais",
    
    # Other European
    "ajax": "ajax amsterdam",
    "psv": "psv eindhoven",
    "sporting": "sporting lisbon",
    "benfica": "sl benfica",
    "porto": "fc porto",
}


# === Bookmaker Aliases ===
# Maps various bookmaker name formats to canonical names

BOOKMAKER_ALIASES = {
    # Bet365
    "bet365": "bet365",
    "bet 365": "bet365",
    "b365": "bet365",
    
    # Betfair
    "betfair": "betfair",
    "betfair exchange": "betfair",
    "betfair ex": "betfair",
    
    # Pinnacle
    "pinnacle": "pinnacle",
    "pinnaclesports": "pinnacle",
    "pinnacle sports": "pinnacle",
    "pinnacle.com": "pinnacle",
    
    # Smarkets
    "smarkets": "smarkets",
    
    # Matchbook
    "matchbook": "matchbook",
    "matchbook.com": "matchbook",
    
    # Betdaq
    "betdaq": "betdaq",
    
    # William Hill
    "william hill": "williamhill",
    "williamhill": "williamhill",
    "hills": "williamhill",
    
    # Paddy Power
    "paddy power": "paddypower",
    "paddypower": "paddypower",
    "paddy": "paddypower",
    
    # Betfred
    "betfred": "betfred",
    
    # Ladbrokes
    "ladbrokes": "ladbrokes",
    
    # Coral
    "coral": "coral",
    
    # Unibet
    "unibet": "unibet",
    
    # 888sport
    "888sport": "888sport",
    "888": "888sport",
    
    # Betway
    "betway": "betway",
    
    # Sky Bet
    "sky bet": "skybet",
    "skybet": "skybet",
    
    # Betvictor
    "betvictor": "betvictor",
    "bet victor": "betvictor",
    
    # Stan James
    "stan james": "stanjames",
    "stanjames": "stanjames",
    
    # Sporting Bet
    "sportingbet": "sportingbet",
    "sporting bet": "sportingbet",
    
    # 10Bet
    "10bet": "10bet",
    
    # Bwin
    "bwin": "bwin",
    
    # Betclic
    "betclic": "betclic",
    
    # Marathon Bet
    "marathonbet": "marathonbet",
    "marathon": "marathonbet",
    
    # 1xbet
    "1xbet": "1xbet",
    "1x bet": "1xbet",
}


# === Market Type Mappings ===
# Maps surebet.com market formats to OddsHarvester formats

MARKET_MAPPINGS = {
    # Match Winner / 1X2
    "1x2": "match_winner",
    "match winner": "match_winner",
    "full time result": "match_winner",
    "ft result": "match_winner",
    "home": "match_winner",
    "draw": "match_winner",
    "away": "match_winner",
    
    # Both Teams to Score
    "btts": "both_teams_to_score",
    "both teams to score": "both_teams_to_score",
    "gg": "both_teams_to_score",
    "btts yes": "both_teams_to_score",
    "btts no": "both_teams_to_score",
    
    # Over/Under
    "over": "over_under",
    "under": "over_under",
    "over/under": "over_under",
    "o/u": "over_under",
    "totals": "over_under",
    "total goals": "over_under",
    "over 0.5": "over_under_0_5",
    "under 0.5": "over_under_0_5",
    "over 1.5": "over_under_1_5",
    "under 1.5": "over_under_1_5",
    "over 2.5": "over_under_2_5",
    "under 2.5": "over_under_2_5",
    "over 3.5": "over_under_3_5",
    "under 3.5": "over_under_3_5",
    "over 4.5": "over_under_4_5",
    "under 4.5": "over_under_4_5",
    
    # Double Chance
    "double chance": "double_chance",
    "dc": "double_chance",
    "1x": "double_chance",
    "12": "double_chance",
    "x2": "double_chance",
    
    # Draw No Bet
    "draw no bet": "draw_no_bet",
    "dnb": "draw_no_bet",
    
    # Handicap
    "handicap": "handicap",
    "asian handicap": "asian_handicap",
    "ah": "asian_handicap",
    "european handicap": "european_handicap",
    "eh": "european_handicap",
    
    # Correct Score
    "correct score": "correct_score",
    "cs": "correct_score",
    "exact score": "correct_score",
    
    # Half Time
    "half time": "half_time",
    "ht": "half_time",
    "1st half": "half_time",
    "first half": "half_time",
    
    # Half Time / Full Time
    "ht/ft": "half_time_full_time",
    "htft": "half_time_full_time",
    
    # Tennis specific
    "match result": "match_winner",
    "set betting": "set_betting",
    "total sets": "total_sets",
    "total games": "total_games",
    
    # Basketball specific
    "moneyline": "moneyline",
    "ml": "moneyline",
    "spread": "spread",
    "point spread": "spread",
}


# === Core Normalization Functions ===


def normalize_string(s: str) -> str:
    """
    Normalize a string for matching.
    
    - Converts to lowercase
    - Removes accents/diacritics
    - Removes special characters
    - Trims whitespace
    - Collapses multiple spaces
    """
    if not s:
        return ""
    
    # Convert to lowercase
    s = s.lower()
    
    # Remove accents using unicode normalization
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    
    # Remove special characters (keep letters, numbers, spaces)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    
    # Collapse multiple spaces and trim
    s = re.sub(r"\s+", " ", s).strip()
    
    return s


def normalize_team_name(team: str) -> str:
    """
    Normalize a team name for matching.
    
    Expands common abbreviations and standardizes format.
    """
    normalized = normalize_string(team)
    
    # Check abbreviations map
    if normalized in TEAM_ABBREVIATIONS:
        return TEAM_ABBREVIATIONS[normalized]
    
    # Also check if any abbreviation is a prefix
    for abbrev, full in TEAM_ABBREVIATIONS.items():
        if normalized.startswith(abbrev + " "):
            return full + normalized[len(abbrev):]
    
    return normalized


def normalize_bookmaker(name: str) -> str:
    """
    Normalize a bookmaker name to canonical format.
    """
    normalized = normalize_string(name)
    
    # Check aliases map
    if normalized in BOOKMAKER_ALIASES:
        return BOOKMAKER_ALIASES[normalized]
    
    # Remove common suffixes
    for suffix in [".com", ".co.uk", " exchange", " ex"]:
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    
    # Check again after suffix removal
    if normalized in BOOKMAKER_ALIASES:
        return BOOKMAKER_ALIASES[normalized]
    
    return normalized


def normalize_market(market: str) -> str:
    """
    Normalize a market type to OddsHarvester format.
    """
    normalized = normalize_string(market)
    
    # Check direct mapping
    if normalized in MARKET_MAPPINGS:
        return MARKET_MAPPINGS[normalized]
    
    # Check if any mapping key is contained in the market
    for key, value in MARKET_MAPPINGS.items():
        if key in normalized:
            return value
    
    # Handle over/under with numbers
    over_under_match = re.match(r"(over|under)\s*(\d+\.?\d*)", normalized)
    if over_under_match:
        direction = over_under_match.group(1)
        line = over_under_match.group(2).replace(".", "_")
        return f"over_under_{line}"
    
    return normalized


# === Levenshtein Distance ===


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate the Levenshtein (edit) distance between two strings.
    
    This is the minimum number of single-character edits (insertions,
    deletions, or substitutions) required to change one string into the other.
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        
        for j, c2 in enumerate(s2):
            # Cost is 0 if characters match, 1 otherwise
            cost = 0 if c1 == c2 else 1
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + cost
            current_row.append(min(insertions, deletions, substitutions))
        
        previous_row = current_row
    
    return previous_row[-1]


def similarity_score(s1: str, s2: str) -> float:
    """
    Calculate similarity score between two strings (0.0 to 1.0).
    
    Based on Levenshtein distance normalized by the maximum possible distance.
    """
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    
    max_len = max(len(s1), len(s2))
    distance = levenshtein_distance(s1, s2)
    
    return 1.0 - (distance / max_len)


# === Best Match Finding ===


def find_best_match(
    target: str,
    candidates: list[str],
    min_score: float = 0.75,
) -> Optional[dict]:
    """
    Find the best matching candidate for a target string.
    
    Args:
        target: The string to match
        candidates: List of possible matches
        min_score: Minimum similarity score to accept (0.0 to 1.0)
    
    Returns:
        {
            "match": "matched string",
            "score": 0.95,
            "index": 3
        }
        or None if no match meets the minimum score
    """
    if not target or not candidates:
        return None
    
    target_normalized = normalize_string(target)
    best_match = None
    best_score = 0.0
    best_index = -1
    
    for i, candidate in enumerate(candidates):
        candidate_normalized = normalize_string(candidate)
        
        # Check for exact match first
        if target_normalized == candidate_normalized:
            return {
                "match": candidate,
                "score": 1.0,
                "index": i,
            }
        
        # Calculate similarity score
        score = similarity_score(target_normalized, candidate_normalized)
        
        # Also check if one contains the other (bonus for substring matches)
        if target_normalized in candidate_normalized or candidate_normalized in target_normalized:
            # Boost score for containment
            containment_bonus = min(0.2, len(min(target_normalized, candidate_normalized)) / len(max(target_normalized, candidate_normalized)))
            score = min(1.0, score + containment_bonus)
        
        if score > best_score:
            best_score = score
            best_match = candidate
            best_index = i
    
    if best_score >= min_score:
        return {
            "match": best_match,
            "score": round(best_score, 4),
            "index": best_index,
        }
    
    return None


def find_all_matches(
    target: str,
    candidates: list[str],
    min_score: float = 0.5,
    max_results: int = 5,
) -> list[dict]:
    """
    Find all matching candidates above a minimum score.
    
    Returns list of matches sorted by score descending.
    """
    if not target or not candidates:
        return []
    
    target_normalized = normalize_string(target)
    matches = []
    
    for i, candidate in enumerate(candidates):
        candidate_normalized = normalize_string(candidate)
        score = similarity_score(target_normalized, candidate_normalized)
        
        if score >= min_score:
            matches.append({
                "match": candidate,
                "score": round(score, 4),
                "index": i,
            })
    
    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    
    return matches[:max_results]
