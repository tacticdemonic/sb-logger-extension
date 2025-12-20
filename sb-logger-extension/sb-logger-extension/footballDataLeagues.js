/**
 * Football Data League Mapping System
 * Maps tournament names from surebet.com to football-data.co.uk CSV league codes
 * 
 * Supports 22 European football leagues with Pinnacle closing odds
 */

const FOOTBALL_DATA_LEAGUES = {
  E0: {
    code: 'E0',
    name: 'Premier League',
    country: 'England',
    aliases: [
      'premier league',
      'epl',
      'english premier league',
      'england premier league',
      'barclays premier league',
      'england - premier league',
      'england: premier league'
    ]
  },
  E1: {
    code: 'E1',
    name: 'Championship',
    country: 'England',
    aliases: [
      'championship',
      'english championship',
      'efl championship',
      'england - championship',
      'england: championship',
      'england championship'
    ]
  },
  E2: {
    code: 'E2',
    name: 'League One',
    country: 'England',
    aliases: [
      'league one',
      'league 1',
      'efl league one',
      'english league one',
      'england - league one',
      'england: league one',
      'england league 1'
    ]
  },
  E3: {
    code: 'E3',
    name: 'League Two',
    country: 'England',
    aliases: [
      'league two',
      'league 2',
      'efl league two',
      'english league two',
      'england - league two',
      'england: league two',
      'england league 2'
    ]
  },
  EC: {
    code: 'EC',
    name: 'National League',
    country: 'England',
    aliases: [
      'national league',
      'conference',
      'vanarama national league',
      'england - national league',
      'england: national league'
    ]
  },
  SC0: {
    code: 'SC0',
    name: 'Premiership',
    country: 'Scotland',
    aliases: [
      'scottish premiership',
      'scotland premiership',
      'spfl premiership',
      'scotland - premiership',
      'scotland: premiership'
    ]
  },
  SC1: {
    code: 'SC1',
    name: 'Championship',
    country: 'Scotland',
    aliases: [
      'scottish championship',
      'scotland championship',
      'spfl championship',
      'scotland - championship',
      'scotland: championship'
    ]
  },
  SC2: {
    code: 'SC2',
    name: 'League One',
    country: 'Scotland',
    aliases: [
      'scottish league one',
      'scotland league one',
      'spfl league one',
      'scotland - league one',
      'scotland: league one',
      'scotland league 1'
    ]
  },
  SC3: {
    code: 'SC3',
    name: 'League Two',
    country: 'Scotland',
    aliases: [
      'scottish league two',
      'scotland league two',
      'spfl league two',
      'scotland - league two',
      'scotland: league two',
      'scotland league 2'
    ]
  },
  D1: {
    code: 'D1',
    name: 'Bundesliga',
    country: 'Germany',
    aliases: [
      'bundesliga',
      'german bundesliga',
      'germany bundesliga',
      'germany - bundesliga',
      'germany: bundesliga',
      'bundesliga 1'
    ]
  },
  D2: {
    code: 'D2',
    name: 'Bundesliga 2',
    country: 'Germany',
    aliases: [
      'bundesliga 2',
      '2. bundesliga',
      'german bundesliga 2',
      'germany bundesliga 2',
      'germany - bundesliga 2',
      'germany: bundesliga 2',
      'zweite bundesliga'
    ]
  },
  SP1: {
    code: 'SP1',
    name: 'La Liga',
    country: 'Spain',
    aliases: [
      'la liga',
      'laliga',
      'spanish la liga',
      'spain la liga',
      'primera division',
      'spain - la liga',
      'spain: la liga',
      'liga santander'
    ]
  },
  SP2: {
    code: 'SP2',
    name: 'Segunda Division',
    country: 'Spain',
    aliases: [
      'segunda division',
      'la liga 2',
      'laliga 2',
      'spanish segunda',
      'spain segunda',
      'spain - segunda',
      'spain: segunda division',
      'segunda'
    ]
  },
  I1: {
    code: 'I1',
    name: 'Serie A',
    country: 'Italy',
    aliases: [
      'serie a',
      'italian serie a',
      'italy serie a',
      'italy - serie a',
      'italy: serie a',
      'serie a tim'
    ]
  },
  I2: {
    code: 'I2',
    name: 'Serie B',
    country: 'Italy',
    aliases: [
      'serie b',
      'italian serie b',
      'italy serie b',
      'italy - serie b',
      'italy: serie b',
      'serie b tim'
    ]
  },
  F1: {
    code: 'F1',
    name: 'Ligue 1',
    country: 'France',
    aliases: [
      'ligue 1',
      'french ligue 1',
      'france ligue 1',
      'france - ligue 1',
      'france: ligue 1',
      'ligue 1 uber eats'
    ]
  },
  F2: {
    code: 'F2',
    name: 'Ligue 2',
    country: 'France',
    aliases: [
      'ligue 2',
      'french ligue 2',
      'france ligue 2',
      'france - ligue 2',
      'france: ligue 2',
      'ligue 2 bkt'
    ]
  },
  N1: {
    code: 'N1',
    name: 'Eredivisie',
    country: 'Netherlands',
    aliases: [
      'eredivisie',
      'dutch eredivisie',
      'netherlands eredivisie',
      'netherlands - eredivisie',
      'netherlands: eredivisie',
      'holland eredivisie'
    ]
  },
  B1: {
    code: 'B1',
    name: 'First Division',
    country: 'Belgium',
    aliases: [
      'belgian first division',
      'belgium first division',
      'jupiler pro league',
      'pro league',
      'belgium - first division',
      'belgium: first division',
      'belgian pro league'
    ]
  },
  P1: {
    code: 'P1',
    name: 'Primeira Liga',
    country: 'Portugal',
    aliases: [
      'primeira liga',
      'portuguese primeira liga',
      'portugal primeira liga',
      'portugal - primeira liga',
      'portugal: primeira liga',
      'liga portugal',
      'liga nos'
    ]
  },
  G1: {
    code: 'G1',
    name: 'Super League',
    country: 'Greece',
    aliases: [
      'greek super league',
      'greece super league',
      'super league greece',
      'greece - super league',
      'greece: super league',
      'super league 1'
    ]
  },
  T1: {
    code: 'T1',
    name: 'Super Lig',
    country: 'Turkey',
    aliases: [
      'super lig',
      'turkish super lig',
      'turkey super lig',
      'turkey - super lig',
      'turkey: super lig',
      'süper lig'
    ]
  }
};

/**
 * Unsupported tournaments (no CSV data available from football-data.co.uk)
 * These tournaments are logged but won't prevent CLV checking for other bets
 */
const UNSUPPORTED_TOURNAMENTS = [
  // International Competitions
  'europe - uefa champions league',
  'uefa champions league',
  'champions league',
  'europe - uefa europa league',
  'uefa europa league',
  'europa league',
  'europe - uefa conference league',
  'uefa conference league',
  'world cup',
  'euro',
  'copa america',
  'africa cup of nations',
  
  // Cup Competitions (not covered by football-data.co.uk)
  'chile - chile cup',
  'chile cup',
  'egypt - egypt league cup',
  'egypt league cup',
  'fa cup',
  'efl cup',
  'copa del rey',
  'coupe de france',
  'coppa italia',
  'dfb pokal',
  
  // Women's Football
  "women's champions league",
  "uefa women's champions league",
  
  // Asian Competitions
  'asia - afc champions league 2',
  'afc champions league 2',
  'afc champions league two',
  
  // Non-European Leagues (no CSV data)
  'mls',
  'j-league',
  'k-league',
  'chinese super league',
  'indian super league',
  'australia a-league',
  'saudi pro league',
  'kenyan premier league',
  'kenya premier league',
  'saudi arabia - saudi arabia league division 1',
  'saudi arabia league division 1',
  'serbia - serbia superliga',
  'serbia superliga',
  'romanian liga 1',
  'romania - romania liga 1',
  'romania liga 1',
  'portugal liga 2',
  'portuguese liga 2',
  
  // South American Leagues (no CSV data)
  'guatemala - guatemala liga nacional',
  'guatemalan liga nacional',
  'guatemala liga nacional',
  'bolivia - bolivia primera division',
  'bolivia primera division',
  'bolivia primera'
];

/**
 * Check if tournament is known to be unsupported
 * @param {string} tournamentName - Tournament name from bet data
 * @returns {boolean} True if tournament is in unsupported list
 */
function isUnsupportedTournament(tournamentName) {
  if (!tournamentName) return false;
  const normalized = tournamentName.toLowerCase().trim();
  
  for (const unsupported of UNSUPPORTED_TOURNAMENTS) {
    if (normalized.includes(unsupported) || unsupported.includes(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Map tournament name from surebet.com to league code
 * @param {string} tournamentName - Tournament name from bet data
 * @returns {string|null} League code (E0, SP1, etc.) or null if not found
 */
function mapTournamentToLeague(tournamentName) {
  if (!tournamentName) return null;
  
  const normalized = tournamentName.toLowerCase().trim();
  
  // Exact match first (fastest)
  for (const [code, league] of Object.entries(FOOTBALL_DATA_LEAGUES)) {
    if (league.aliases.includes(normalized)) {
      return code;
    }
  }
  
  // Fuzzy match (partial substring) - but check for false positives
  for (const [code, league] of Object.entries(FOOTBALL_DATA_LEAGUES)) {
    for (const alias of league.aliases) {
      // Match if tournament contains alias AND (alias contains country OR tournament contains country)
      if (normalized.includes(alias)) {
        const country = league.country.toLowerCase();
        // Accept if country is mentioned OR if it's a very specific league name (20+ chars)
        if (normalized.includes(country) || alias.length > 20) {
          return code;
        }
      }
      // Also match if alias contains the full tournament name (for short tournament names)
      if (alias.includes(normalized) && normalized.length > 10) {
        return code;
      }
    }
  }
  
  return null;
}

/**
 * Get league metadata by code
 * @param {string} leagueCode - League code (E0, SP1, etc.)
 * @returns {Object|null} League info object or null
 */
function getLeagueInfo(leagueCode) {
  return FOOTBALL_DATA_LEAGUES[leagueCode] || null;
}

/**
 * Get all supported league codes
 * @returns {Array<string>} Array of league codes
 */
function getAllLeagueCodes() {
  return Object.keys(FOOTBALL_DATA_LEAGUES);
}

/**
 * Get all supported leagues with metadata
 * @returns {Array<Object>} Array of league info objects
 */
function getAllLeagues() {
  return Object.values(FOOTBALL_DATA_LEAGUES);
}

// Export for background service worker (importScripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FOOTBALL_DATA_LEAGUES,
    UNSUPPORTED_TOURNAMENTS,
    mapTournamentToLeague,
    getLeagueInfo,
    getAllLeagueCodes,
    getAllLeagues,
    isUnsupportedTournament
  };
}
