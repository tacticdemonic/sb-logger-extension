/**
 * Fuzzy Matcher Module (JavaScript)
 * ==================================
 * 
 * Provides fuzzy string matching for:
 * - Team name normalization and matching
 * - Bookmaker name normalization
 * - Market type normalization
 * - Finding best matches with confidence scores
 * 
 * This is the JavaScript equivalent of fuzzy_matcher.py in the API server.
 * Both implementations should produce identical results for consistency.
 * 
 * Used by:
 * - import.js for CSV bet matching
 * - popup.js for CLV data matching
 * - background.js for CLV API requests
 */

// === Team Name Abbreviations ===
// Common abbreviations found on surebet.com

const TEAM_ABBREVIATIONS = {
  // English Teams
  'man city': 'manchester city',
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'spurs': 'tottenham hotspur',
  'tottenham': 'tottenham hotspur',
  'wolves': 'wolverhampton wanderers',
  'wolverhampton': 'wolverhampton wanderers',
  'newcastle utd': 'newcastle united',
  'newcastle': 'newcastle united',
  'west ham utd': 'west ham united',
  'west ham': 'west ham united',
  'sheffield utd': 'sheffield united',
  'nottm forest': 'nottingham forest',
  'nottingham': 'nottingham forest',
  'brighton': 'brighton hove albion',
  'crystal palace': 'crystal palace',
  'leicester': 'leicester city',
  'leeds': 'leeds united',
  
  // Spanish Teams
  'atletico': 'atletico madrid',
  'atleti': 'atletico madrid',
  'real': 'real madrid',
  'barca': 'barcelona',
  'sociedad': 'real sociedad',
  'betis': 'real betis',
  'athletic': 'athletic bilbao',
  'celta': 'celta vigo',
  
  // Italian Teams
  'inter': 'inter milan',
  'internazionale': 'inter milan',
  'milan': 'ac milan',
  'juve': 'juventus',
  
  // German Teams
  'bayern': 'bayern munich',
  'dortmund': 'borussia dortmund',
  'bvb': 'borussia dortmund',
  'gladbach': 'borussia monchengladbach',
  'bmg': 'borussia monchengladbach',
  'leverkusen': 'bayer leverkusen',
  'leipzig': 'rb leipzig',
  'frankfurt': 'eintracht frankfurt',
  'koln': 'fc koln',
  'cologne': 'fc koln',
  'bremen': 'werder bremen',
  
  // French Teams
  'psg': 'paris saint-germain',
  'paris sg': 'paris saint-germain',
  'paris': 'paris saint-germain',
  'om': 'olympique marseille',
  'marseille': 'olympique marseille',
  'ol': 'olympique lyonnais',
  'lyon': 'olympique lyonnais',
  
  // Other European
  'ajax': 'ajax amsterdam',
  'psv': 'psv eindhoven',
  'sporting': 'sporting lisbon',
  'benfica': 'sl benfica',
  'porto': 'fc porto',
  
  // Serbian/Balkan teams (from import.js)
  'crvena zvezda': 'red star belgrade',
  'roter stern belgrad': 'red star belgrade',
  'rode ster belgrado': 'red star belgrade',
  'partizan beograd': 'partizan belgrade',
  'fk crvena zvezda': 'red star belgrade',
  'gnk dinamo zagreb': 'dinamo zagreb',
  'hnk hajduk split': 'hajduk split',
  
  // Turkish teams
  'fenerbahçe': 'fenerbahce',
  'beşiktaş': 'besiktas',
  
  // Hungarian
  'ferencvárosi': 'ferencvaros',
  'ferencvarosi': 'ferencvaros',
  
  // Greek
  'olympiakos': 'olympiacos',
  'piräus': 'piraeus',
  'piraus': 'piraeus',
  
  // Austrian
  'sk puntigamer sturm graz': 'sturm graz',
  'sk sturm graz': 'sturm graz',
};


// === Bookmaker Aliases ===
// Maps various bookmaker name formats to canonical names

const BOOKMAKER_ALIASES = {
  // Bet365
  'bet365': 'bet365',
  'bet 365': 'bet365',
  'b365': 'bet365',
  
  // Betfair
  'betfair': 'betfair',
  'betfair exchange': 'betfair',
  'betfair ex': 'betfair',
  
  // Pinnacle
  'pinnacle': 'pinnacle',
  'pinnaclesports': 'pinnacle',
  'pinnacle sports': 'pinnacle',
  'pinnacle.com': 'pinnacle',
  
  // Smarkets
  'smarkets': 'smarkets',
  
  // Matchbook
  'matchbook': 'matchbook',
  'matchbook.com': 'matchbook',
  
  // Betdaq
  'betdaq': 'betdaq',
  
  // William Hill
  'william hill': 'williamhill',
  'williamhill': 'williamhill',
  'hills': 'williamhill',
  
  // Paddy Power
  'paddy power': 'paddypower',
  'paddypower': 'paddypower',
  'paddy': 'paddypower',
  
  // Betfred
  'betfred': 'betfred',
  
  // Ladbrokes
  'ladbrokes': 'ladbrokes',
  
  // Coral
  'coral': 'coral',
  
  // Unibet
  'unibet': 'unibet',
  
  // 888sport
  '888sport': '888sport',
  '888': '888sport',
  
  // Betway
  'betway': 'betway',
  
  // Sky Bet
  'sky bet': 'skybet',
  'skybet': 'skybet',
  
  // Betvictor
  'betvictor': 'betvictor',
  'bet victor': 'betvictor',
  
  // Stan James
  'stan james': 'stanjames',
  'stanjames': 'stanjames',
  
  // Sporting Bet
  'sportingbet': 'sportingbet',
  'sporting bet': 'sportingbet',
  
  // 10Bet
  '10bet': '10bet',
  
  // Bwin
  'bwin': 'bwin',
  
  // Betclic
  'betclic': 'betclic',
  
  // Marathon Bet
  'marathonbet': 'marathonbet',
  'marathon': 'marathonbet',
  
  // 1xbet
  '1xbet': '1xbet',
  '1x bet': '1xbet',
};


// === Market Type Mappings ===
// Maps surebet.com market formats to the extension's normalized market identifiers
// These normalized identifiers are used to match markets against CSV-based CLV data

const MARKET_MAPPINGS = {
  // Match Winner / 1X2
  '1x2': 'match_winner',
  'match winner': 'match_winner',
  'full time result': 'match_winner',
  'ft result': 'match_winner',
  'home': 'match_winner',
  'draw': 'match_winner',
  'away': 'match_winner',
  
  // Both Teams to Score
  'btts': 'both_teams_to_score',
  'both teams to score': 'both_teams_to_score',
  'gg': 'both_teams_to_score',
  'btts yes': 'both_teams_to_score',
  'btts no': 'both_teams_to_score',
  
  // Over/Under
  'over': 'over_under',
  'under': 'over_under',
  'over/under': 'over_under',
  'o/u': 'over_under',
  'totals': 'over_under',
  'total goals': 'over_under',
  'over 0.5': 'over_under_0_5',
  'under 0.5': 'over_under_0_5',
  'over 1.5': 'over_under_1_5',
  'under 1.5': 'over_under_1_5',
  'over 2.5': 'over_under_2_5',
  'under 2.5': 'over_under_2_5',
  'over 3.5': 'over_under_3_5',
  'under 3.5': 'over_under_3_5',
  'over 4.5': 'over_under_4_5',
  'under 4.5': 'over_under_4_5',
  
  // Double Chance
  'double chance': 'double_chance',
  'dc': 'double_chance',
  '1x': 'double_chance',
  '12': 'double_chance',
  'x2': 'double_chance',
  
  // Draw No Bet
  'draw no bet': 'draw_no_bet',
  'dnb': 'draw_no_bet',
  
  // Handicap
  'handicap': 'handicap',
  'asian handicap': 'asian_handicap',
  'ah': 'asian_handicap',
  'european handicap': 'european_handicap',
  'eh': 'european_handicap',
  
  // Correct Score
  'correct score': 'correct_score',
  'cs': 'correct_score',
  'exact score': 'correct_score',
  
  // Half Time
  'half time': 'half_time',
  'ht': 'half_time',
  '1st half': 'half_time',
  'first half': 'half_time',
  
  // Half Time / Full Time
  'ht/ft': 'half_time_full_time',
  'htft': 'half_time_full_time',
  
  // Tennis specific
  'match result': 'match_winner',
  'set betting': 'set_betting',
  'total sets': 'total_sets',
  'total games': 'total_games',
  
  // Basketball specific
  'moneyline': 'moneyline',
  'ml': 'moneyline',
  'spread': 'spread',
  'point spread': 'spread',
};


// === Core Normalization Functions ===


/**
 * Normalize a string for matching.
 * 
 * - Converts to lowercase
 * - Removes accents/diacritics
 * - Removes special characters
 * - Trims whitespace
 * - Collapses multiple spaces
 * 
 * @param {string} s - Input string
 * @returns {string} Normalized string
 */
function normalizeString(s) {
  if (!s) return '';
  
  // Convert to lowercase
  let result = s.toLowerCase();
  
  // Remove accents using unicode normalization
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove special characters (keep letters, numbers, spaces)
  result = result.replace(/[^a-z0-9\s]/g, ' ');
  
  // Collapse multiple spaces and trim
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}


/**
 * Normalize a team name for matching.
 * Expands common abbreviations and standardizes format.
 * 
 * @param {string} team - Team name
 * @returns {string} Normalized team name
 */
function normalizeTeamName(team) {
  let normalized = normalizeString(team);
  
  // Check abbreviations map
  if (TEAM_ABBREVIATIONS[normalized]) {
    return TEAM_ABBREVIATIONS[normalized];
  }
  
  // Also check if any abbreviation is a prefix
  for (const [abbrev, full] of Object.entries(TEAM_ABBREVIATIONS)) {
    if (normalized.startsWith(abbrev + ' ')) {
      return full + normalized.substring(abbrev.length);
    }
  }
  
  return normalized;
}


/**
 * Normalize a bookmaker name to canonical format.
 * 
 * @param {string} name - Bookmaker name
 * @returns {string} Normalized bookmaker name
 */
function normalizeBookmaker(name) {
  let normalized = normalizeString(name);
  
  // Check aliases map
  if (BOOKMAKER_ALIASES[normalized]) {
    return BOOKMAKER_ALIASES[normalized];
  }
  
  // Remove common suffixes
  const suffixes = ['.com', '.co.uk', ' exchange', ' ex'];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  
  // Check again after suffix removal
  if (BOOKMAKER_ALIASES[normalized]) {
    return BOOKMAKER_ALIASES[normalized];
  }
  
  return normalized;
}


/**
 * Normalize a market type to the extension's normalized market identifier format.
 * 
 * @param {string} market - Market type string
 * @returns {string} Normalized market type
 */
function normalizeMarket(market) {
  let normalized = normalizeString(market);
  
  // Check direct mapping
  if (MARKET_MAPPINGS[normalized]) {
    return MARKET_MAPPINGS[normalized];
  }
  
  // Check if any mapping key is contained in the market
  for (const [key, value] of Object.entries(MARKET_MAPPINGS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  // Handle over/under with numbers
  const overUnderMatch = normalized.match(/^(over|under)\s*(\d+\.?\d*)$/);
  if (overUnderMatch) {
    const line = overUnderMatch[2].replace('.', '_');
    return `over_under_${line}`;
  }
  
  return normalized;
}


// === Levenshtein Distance ===


/**
 * Calculate the Levenshtein (edit) distance between two strings.
 * 
 * This is the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into the other.
 * 
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(s1, s2) {
  if (s1.length < s2.length) {
    return levenshteinDistance(s2, s1);
  }
  
  if (s2.length === 0) {
    return s1.length;
  }
  
  let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  
  for (let i = 0; i < s1.length; i++) {
    const c1 = s1[i];
    let currentRow = [i + 1];
    
    for (let j = 0; j < s2.length; j++) {
      const c2 = s2[j];
      // Cost is 0 if characters match, 1 otherwise
      const cost = c1 === c2 ? 0 : 1;
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + cost;
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    
    previousRow = currentRow;
  }
  
  return previousRow[previousRow.length - 1];
}


/**
 * Calculate similarity score between two strings (0.0 to 1.0).
 * Based on Levenshtein distance normalized by the maximum possible distance.
 * 
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Similarity score (0.0 to 1.0)
 */
function similarityScore(s1, s2) {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1.0 - (distance / maxLen);
}


// === Best Match Finding ===


/**
 * Find the best matching candidate for a target string.
 * 
 * @param {string} target - The string to match
 * @param {string[]} candidates - List of possible matches
 * @param {number} [minScore=0.75] - Minimum similarity score to accept (0.0 to 1.0)
 * @returns {Object|null} Match result or null if no match meets minimum score
 */
function findBestMatch(target, candidates, minScore = 0.75) {
  if (!target || !candidates || candidates.length === 0) {
    return null;
  }
  
  const targetNormalized = normalizeString(target);
  let bestMatch = null;
  let bestScore = 0.0;
  let bestIndex = -1;
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateNormalized = normalizeString(candidate);
    
    // Check for exact match first
    if (targetNormalized === candidateNormalized) {
      return {
        match: candidate,
        score: 1.0,
        index: i,
      };
    }
    
    // Calculate similarity score
    let score = similarityScore(targetNormalized, candidateNormalized);
    
    // Also check if one contains the other (bonus for substring matches)
    if (targetNormalized.includes(candidateNormalized) || 
        candidateNormalized.includes(targetNormalized)) {
      const minLen = Math.min(targetNormalized.length, candidateNormalized.length);
      const maxLen = Math.max(targetNormalized.length, candidateNormalized.length);
      const containmentBonus = Math.min(0.2, minLen / maxLen);
      score = Math.min(1.0, score + containmentBonus);
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
      bestIndex = i;
    }
  }
  
  if (bestScore >= minScore) {
    return {
      match: bestMatch,
      score: Math.round(bestScore * 10000) / 10000,
      index: bestIndex,
    };
  }
  
  return null;
}


/**
 * Find all matching candidates above a minimum score.
 * 
 * @param {string} target - The string to match
 * @param {string[]} candidates - List of possible matches
 * @param {number} [minScore=0.5] - Minimum similarity score
 * @param {number} [maxResults=5] - Maximum number of results to return
 * @returns {Object[]} Array of match results sorted by score descending
 */
function findAllMatches(target, candidates, minScore = 0.5, maxResults = 5) {
  if (!target || !candidates || candidates.length === 0) {
    return [];
  }
  
  const targetNormalized = normalizeString(target);
  const matches = [];
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateNormalized = normalizeString(candidate);
    const score = similarityScore(targetNormalized, candidateNormalized);
    
    if (score >= minScore) {
      matches.push({
        match: candidate,
        score: Math.round(score * 10000) / 10000,
        index: i,
      });
    }
  }
  
  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  
  return matches.slice(0, maxResults);
}


/**
 * Calculate confidence level string from numeric score
 * 
 * @param {number} confidence - Confidence score (0.0 to 1.0)
 * @returns {string} Confidence level: 'high', 'medium', or 'low'
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}


/**
 * Get star rating for confidence display
 * 
 * @param {number} confidence - Confidence score (0.0 to 1.0)
 * @returns {string} Star rating: '★★★', '⭐⭐', or '⭐'
 */
function getConfidenceStars(confidence) {
  if (confidence >= 0.9) return '★★★';
  if (confidence >= 0.7) return '⭐⭐';
  return '⭐';
}


// === Exports ===
// Use both CommonJS and ES module compatible export

if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = {
    normalizeString,
    normalizeTeamName,
    normalizeBookmaker,
    normalizeMarket,
    levenshteinDistance,
    similarityScore,
    findBestMatch,
    findAllMatches,
    getConfidenceLevel,
    getConfidenceStars,
    TEAM_ABBREVIATIONS,
    BOOKMAKER_ALIASES,
    MARKET_MAPPINGS,
  };
}

// For browser usage - attach to window if available
if (typeof window !== 'undefined') {
  window.FuzzyMatcher = {
    normalizeString,
    normalizeTeamName,
    normalizeBookmaker,
    normalizeMarket,
    levenshteinDistance,
    similarityScore,
    findBestMatch,
    findAllMatches,
    getConfidenceLevel,
    getConfidenceStars,
    TEAM_ABBREVIATIONS,
    BOOKMAKER_ALIASES,
    MARKET_MAPPINGS,
  };
}
