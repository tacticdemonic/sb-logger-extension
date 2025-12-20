// API service for fetching sports results
// Uses API-Sports.io for multiple sports (all share same API key) and The Odds API as fallback

const API_CONFIG = {
  apiFootball: {
    baseUrl: 'https://v3.football.api-sports.io',
    rateLimit: 100 // requests per day
  },
  oddsApi: {
    baseUrl: 'https://api.the-odds-api.com/v4',
    rateLimit: 500 // requests per month
  }
};

// ========== MULTI-SPORT API ENDPOINTS (api-sports.io) ==========
// All use the same API key from dashboard.api-football.com
// Each sport has 100 requests/day on free tier
const API_SPORTS_ENDPOINTS = {
  football: {
    baseUrl: 'https://v3.football.api-sports.io',
    fixturesEndpoint: '/fixtures',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v3.football.api-sports.io'
  },
  basketball: {
    baseUrl: 'https://v1.basketball.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.basketball.api-sports.io'
  },
  hockey: {
    baseUrl: 'https://v1.hockey.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.hockey.api-sports.io'
  },
  baseball: {
    baseUrl: 'https://v1.baseball.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.baseball.api-sports.io'
  },
  volleyball: {
    baseUrl: 'https://v1.volleyball.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.volleyball.api-sports.io'
  },
  handball: {
    baseUrl: 'https://v1.handball.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.handball.api-sports.io'
  },
  rugby: {
    baseUrl: 'https://v1.rugby.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.rugby.api-sports.io'
  },
  afl: {
    baseUrl: 'https://v1.afl.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.afl.api-sports.io'
  },
  nfl: {
    baseUrl: 'https://v1.american-football.api-sports.io',
    fixturesEndpoint: '/games',
    dateParam: 'date',
    rateLimit: 100,
    host: 'v1.american-football.api-sports.io'
  }
};

// Sports that fallback to The Odds API (not available via API-Sports.io)
// See: https://the-odds-api.com/sports-odds-data/sports-apis.html
const ODDS_API_FALLBACK_SPORTS = {
  tennis: ['tennis_atp_french_open', 'tennis_wta_french_open', 'tennis_atp_wimbledon', 'tennis_wta_wimbledon', 
           'tennis_atp_us_open', 'tennis_wta_us_open', 'tennis_atp_aus_open_singles', 'tennis_wta_aus_open_singles'],
  cricket: ['cricket_icc_world_cup', 'cricket_ipl', 'cricket_test_match', 'cricket_big_bash', 'cricket_psl'],
  golf: ['golf_masters_tournament_winner', 'golf_pga_championship_winner', 'golf_us_open_winner', 'golf_the_open_championship_winner'],
  mma: ['mma_mixed_martial_arts'],
  boxing: ['boxing_boxing'],
  darts: [],  // Limited support
  snooker: ['snooker'],
  motorsport: [],  // F1, NASCAR via different keys
  cycling: []
};

// Sports truly without ANY API support - show manual settlement message
const UNSUPPORTED_SPORTS = [
  'esports',     // No reliable API
  'e-sports',
  'table tennis',
  'badminton'
];

// Tournament/event keywords for sport detection when bet.sport is "Other"
const SPORT_DETECTION_KEYWORDS = {
  football: [
    'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
    'champions league', 'europa league', 'fa cup', 'world cup',
    'mls', 'eredivisie', 'liga portugal', 'primeira liga',
    'copa', 'super league', 'championship', 'league one', 'league two',
    'carabao', 'efl', 'uefa', 'concacaf', 'conmebol', 'afc',
    'football', 'soccer', ' fc', 'fc ', 'united', 'city '
  ],
  basketball: [
    'nba', 'euroleague', 'ncaa basketball', 'fiba', 'basketball',
    'acb', 'vtb', 'bbl', 'lnb', 'serie a basketball', 'beko',
    'turkish airlines', 'eurocup', 'wnba', 'cba', 'pba'
  ],
  hockey: [
    'nhl', 'khl', 'shl', 'liiga', 'del', 'ice hockey', 'hockey',
    'iihf', 'world championship hockey', 'ahl', 'ohl', 'whl'
  ],
  baseball: [
    'mlb', 'npb', 'kbo', 'baseball', 'world series', 'minor league'
  ],
  volleyball: [
    'volleyball', 'cev', 'fivb', 'plusliga', 'superlega',
    'beach volleyball'
  ],
  handball: [
    'handball', 'ehf', 'bundesliga handball', 'liga asobal'
  ],
  rugby: [
    'rugby', 'super rugby', 'six nations', 'premiership rugby',
    'pro14', 'top 14', 'nrl', 'world rugby', 'rugby league', 'rugby union'
  ],
  afl: [
    'afl', 'australian football', 'aussie rules'
  ],
  nfl: [
    'nfl', 'american football', 'ncaa football', 'super bowl',
    'college football'
  ],
  // Unsupported sports (for detection - will return null)
  tennis: [
    'atp', 'wta', 'tennis', 'wimbledon', 'us open tennis',
    'australian open', 'french open', 'roland garros', 'itf'
  ],
  esports: [
    'esports', 'e-sports', 'cs:go', 'dota', 'league of legends',
    'lol', 'csgo', 'valorant', 'overwatch', 'counter-strike'
  ]
};

// ========== SPORT DETECTION ==========
/**
 * Detect sport from bet data (sport field, tournament, event name)
 * Returns normalized sport key or null if unsupported
 * @param {Object} bet - The bet object
 * @returns {string|null} - Sport key (e.g., 'football', 'basketball') or null if unsupported
 */
function detectSportFromBet(bet) {
  if (!bet) return { api: null, sport: null };
  
  const sport = (bet.sport || '').toLowerCase().trim();
  
  // Direct mapping from bet.sport values to API-Sports.io endpoints
  const apiSportsMap = {
    'football': 'football',
    'soccer': 'football',
    'basketball': 'basketball',
    'ice hockey': 'hockey',
    'hockey': 'hockey',
    'baseball': 'baseball',
    'volleyball': 'volleyball',
    'handball': 'handball',
    'rugby': 'rugby',
    'rugby league': 'rugby',
    'rugby union': 'rugby',
    'australian rules': 'afl',
    'australian football': 'afl',
    'afl': 'afl',
    'american football': 'nfl',
    'nfl': 'nfl'
  };
  
  // Sports that use The Odds API as fallback
  const oddsApiMap = {
    'tennis': 'tennis',
    'cricket': 'cricket',
    'golf': 'golf',
    'boxing': 'boxing',
    'mma': 'mma',
    'darts': 'darts',
    'snooker': 'snooker'
  };
  
  // Truly unsupported sports
  const unsupportedMap = {
    'esports': true,
    'e-sports': true,
    'table tennis': true,
    'badminton': true
  };

  // Check for unsupported first
  if (sport && sport in unsupportedMap) {
    console.log(`🏆 Sport detected: "${sport}" → UNSUPPORTED (no API available)`);
    return { api: 'unsupported', sport: sport };
  }
  
  // Check API-Sports.io mapping
  if (sport && sport in apiSportsMap) {
    const result = apiSportsMap[sport];
    console.log(`🏆 Sport detected: "${sport}" → api-sports:${result}`);
    return { api: 'api-sports', sport: result };
  }
  
  // Check Odds API fallback mapping
  if (sport && sport in oddsApiMap) {
    const result = oddsApiMap[sport];
    console.log(`🏆 Sport detected: "${sport}" → odds-api:${result}`);
    return { api: 'odds-api', sport: result };
  }

  // Fall back to keyword detection from tournament and event
  const searchText = `${bet.tournament || ''} ${bet.event || ''}`.toLowerCase();
  
  // Check supported API-Sports sports
  for (const [sportKey, keywords] of Object.entries(SPORT_DETECTION_KEYWORDS)) {
    if (sportKey === 'tennis' || sportKey === 'esports') continue; // Handle separately
    
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // Verify this sport has an API endpoint
        if (sportKey in API_SPORTS_ENDPOINTS) {
          console.log(`🏆 Sport detected from keywords: "${keyword}" → api-sports:${sportKey}`);
          return { api: 'api-sports', sport: sportKey };
        }
      }
    }
  }
  
  // Check for tennis keywords (use Odds API)
  for (const keyword of SPORT_DETECTION_KEYWORDS.tennis || []) {
    if (searchText.includes(keyword.toLowerCase())) {
      console.log(`🏆 Sport detected from keywords: "${keyword}" → odds-api:tennis`);
      return { api: 'odds-api', sport: 'tennis' };
    }
  }
  
  // Check for esports keywords (unsupported)
  for (const keyword of SPORT_DETECTION_KEYWORDS.esports || []) {
    if (searchText.includes(keyword.toLowerCase())) {
      console.log(`🏆 Sport detected from keywords: "${keyword}" → UNSUPPORTED`);
      return { api: 'unsupported', sport: 'esports' };
    }
  }
  
  // Default to football if no match (legacy behavior for "Other" sports)
  console.log(`🏆 Sport not detected, defaulting to api-sports:football for: ${bet.event?.substring(0, 40)}...`);
  return { api: 'api-sports', sport: 'football' };
}

// ========== RATE LIMIT TRACKING ==========
/**
 * Load rate limit counters from storage
 * @returns {Promise<Object>} Rate limit data
 */
async function loadRateLimits() {
  return new Promise((resolve) => {
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.get({ apiRateLimits: {} }, (res) => {
      resolve(res.apiRateLimits || {});
    });
  });
}

/**
 * Save rate limit counters to storage
 * @param {Object} limits - Rate limit data to save
 */
async function saveRateLimits(limits) {
  return new Promise((resolve) => {
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.set({ apiRateLimits: limits }, resolve);
  });
}

/**
 * Get available API calls for a sport (handles daily/monthly reset)
 * @param {string} sport - Sport key or 'oddsApi'
 * @returns {Promise<number>} Available calls remaining
 */
async function getAvailableApiCalls(sport) {
  const limits = await loadRateLimits();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7); // "YYYY-MM"
  
  if (sport === 'oddsApi') {
    // Monthly reset for Odds API
    const data = limits.oddsApi || { count: 0, resetMonth: thisMonth };
    if (data.resetMonth !== thisMonth) {
      console.log(`📊 Odds API monthly reset: ${data.resetMonth} → ${thisMonth}`);
      data.count = 0;
      data.resetMonth = thisMonth;
      limits.oddsApi = data;
      await saveRateLimits(limits);
    }
    return 500 - data.count;
  } else {
    // Daily reset for api-sports.io
    const data = limits[sport] || { count: 0, resetDate: today };
    if (data.resetDate !== today) {
      console.log(`📊 ${sport} API daily reset: ${data.resetDate} → ${today}`);
      data.count = 0;
      data.resetDate = today;
      limits[sport] = data;
      await saveRateLimits(limits);
    }
    const maxCalls = API_SPORTS_ENDPOINTS[sport]?.rateLimit || 100;
    return maxCalls - data.count;
  }
}

/**
 * Increment API call counter for a sport
 * @param {string} sport - Sport key or 'oddsApi'
 * @param {number} amount - Number of calls to add (default 1)
 */
async function incrementApiCallCount(sport, amount = 1) {
  const limits = await loadRateLimits();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);
  
  if (sport === 'oddsApi') {
    if (!limits.oddsApi) {
      limits.oddsApi = { count: 0, resetMonth: thisMonth };
    }
    limits.oddsApi.count += amount;
    console.log(`📊 Odds API call count: ${limits.oddsApi.count}/500 (month: ${thisMonth})`);
  } else {
    if (!limits[sport]) {
      limits[sport] = { count: 0, resetDate: today };
    }
    limits[sport].count += amount;
    const maxCalls = API_SPORTS_ENDPOINTS[sport]?.rateLimit || 100;
    console.log(`📊 ${sport} API call count: ${limits[sport].count}/${maxCalls} (date: ${today})`);
  }
  
  await saveRateLimits(limits);
}

/**
 * Get all rate limit stats for display
 * @returns {Promise<Object>} Rate limits for all sports
 */
async function getAllRateLimitStats() {
  const limits = await loadRateLimits();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);
  
  const stats = {};
  
  // Check each sport
  for (const sport of Object.keys(API_SPORTS_ENDPOINTS)) {
    const data = limits[sport] || { count: 0, resetDate: today };
    const isToday = data.resetDate === today;
    const maxCalls = API_SPORTS_ENDPOINTS[sport]?.rateLimit || 100;
    stats[sport] = {
      used: isToday ? data.count : 0,
      limit: maxCalls,
      remaining: isToday ? maxCalls - data.count : maxCalls,
      resetDate: today,
      nearLimit: isToday && data.count >= maxCalls * 0.9 // 90% threshold
    };
  }
  
  // Odds API (monthly)
  const oddsData = limits.oddsApi || { count: 0, resetMonth: thisMonth };
  const isThisMonth = oddsData.resetMonth === thisMonth;
  stats.oddsApi = {
    used: isThisMonth ? oddsData.count : 0,
    limit: 500,
    remaining: isThisMonth ? 500 - oddsData.count : 500,
    resetMonth: thisMonth,
    nearLimit: isThisMonth && oddsData.count >= 450 // 90% threshold
  };
  
  return stats;
}

// ========== DIAGNOSTIC LOGGING ==========
const MAX_DIAGNOSTIC_ENTRIES = 500;
const MAX_VERBOSE_ENTRIES = 50; // Keep fewer verbose entries due to size

// Verbose mode stores full API responses and fixture data for debugging
let verboseDiagnosticMode = false;

/**
 * Enable/disable verbose diagnostic mode
 * When enabled, stores full fixture data for match failures
 * @param {boolean} enabled - Whether to enable verbose mode
 */
function setVerboseDiagnosticMode(enabled) {
  verboseDiagnosticMode = !!enabled;
  console.log(`🔍 Verbose diagnostic mode: ${verboseDiagnosticMode ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current verbose diagnostic mode state
 * @returns {boolean}
 */
function getVerboseDiagnosticMode() {
  return verboseDiagnosticMode;
}

/**
 * Log diagnostic entry to storage for later analysis
 * @param {Object} entry - Diagnostic entry to log
 */
async function logApiDiagnostics(entry) {
  return new Promise((resolve) => {
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.get({ apiDiagnosticLog: [] }, (res) => {
      let log = res.apiDiagnosticLog || [];
      
      // Add timestamp and entry
      const logEntry = {
        ...entry,
        timestamp: new Date().toISOString()
      };
      
      log.push(logEntry);
      
      // Prune to max entries
      if (log.length > MAX_DIAGNOSTIC_ENTRIES) {
        log = log.slice(-MAX_DIAGNOSTIC_ENTRIES);
      }
      
      api.storage.local.set({ apiDiagnosticLog: log }, () => {
        console.log(`📝 Diagnostic logged: ${entry.type}`);
        resolve();
      });
    });
  });
}

/**
 * Get diagnostic log entries
 * @param {string} type - Optional filter by type
 * @param {number} limit - Max entries to return
 * @returns {Promise<Array>} Diagnostic entries
 */
async function getDiagnosticLog(type = null, limit = 100) {
  return new Promise((resolve) => {
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.get({ apiDiagnosticLog: [] }, (res) => {
      let log = res.apiDiagnosticLog || [];
      
      // Filter by type if specified
      if (type) {
        log = log.filter(e => e.type === type);
      }
      
      // Return most recent entries
      resolve(log.slice(-limit));
    });
  });
}

/**
 * Clear diagnostic log
 */
async function clearDiagnosticLog() {
  return new Promise((resolve) => {
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.set({ apiDiagnosticLog: [] }, resolve);
  });
}

// ========== BATCH PROCESSING ==========
/**
 * Group bets by date and sport for batch optimization
 * @param {Array} bets - Array of pending bets
 * @returns {Map<string, Array>} Map of "sport_date" => bets
 */
function groupBetsForBatchProcessing(bets) {
  const groups = new Map();
  
  for (const bet of bets) {
    // Detect sport - returns { api: 'api-sports'|'odds-api'|'unsupported', sport: string }
    const detection = detectSportFromBet(bet);
    
    if (detection.api === 'unsupported') {
      // Mark as truly unsupported
      const unsupportedKey = 'unsupported';
      if (!groups.has(unsupportedKey)) {
        groups.set(unsupportedKey, []);
      }
      bet._detectedSport = detection.sport;
      groups.get(unsupportedKey).push(bet);
      continue;
    }
    
    // Get date from eventTime
    let eventDate;
    if (bet.eventTime) {
      eventDate = new Date(bet.eventTime).toISOString().split('T')[0];
    } else {
      eventDate = new Date().toISOString().split('T')[0];
    }
    
    // Create group key: "api_sport_YYYY-MM-DD" (e.g., "api-sports_football_2025-11-25" or "odds-api_tennis_2025-11-25")
    const groupKey = `${detection.api}_${detection.sport}_${eventDate}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    bet._detectedSport = detection.sport;
    bet._detectedApi = detection.api;
    groups.get(groupKey).push(bet);
  }
  
  console.log(`📦 Batch grouping: ${groups.size} groups from ${bets.length} bets`);
  for (const [key, groupBets] of groups) {
    console.log(`  - ${key}: ${groupBets.length} bet(s)`);
  }
  
  return groups;
}

function getBetKey(bet) {
  if (!bet) return '';
  if (bet.uid) return String(bet.uid);
  const idPart = bet.id !== undefined && bet.id !== null ? String(bet.id) : '';
  const tsPart = bet.timestamp ? String(bet.timestamp) : '';
  if (idPart && tsPart) return `${idPart}::${tsPart}`;
  return idPart || tsPart || '';
}

class ApiService {
  constructor(apiFootballKey = '', apiOddsKey = '') {
    this.apiFootballKey = apiFootballKey || '';
    this.apiOddsKey = apiOddsKey || '';
    this.cache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
  }

  // Check if APIs are configured
  isConfigured() {
    const config = {
      football: !!this.apiFootballKey,
      other: !!this.apiOddsKey
    };
    console.log('🔧 API Configuration:', config);
    return config;
  }

  // Cache helper
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('💾 Cache hit:', key);
      return cached.data;
    }
    this.cache.delete(key);
    console.log('❌ Cache miss:', key);
    return null;
  }

  setCached(key, data) {
    console.log('💾 Caching data:', key);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Football API - fetch fixtures for a date
  async fetchFootballFixtures(date) {
    if (!this.apiFootballKey) {
      throw new Error('API-Football key not configured');
    }

    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheKey = `football_${dateStr}`;
    console.log('⚽ Fetching football fixtures for:', dateStr);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      console.log('🌐 Making API-Football request...');
      const response = await fetch(
        `${API_CONFIG.apiFootball.baseUrl}/fixtures?date=${dateStr}`,
        {
          headers: {
            'x-rapidapi-key': this.apiFootballKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        }
      );

      if (!response.ok) {
        console.error('❌ API-Football error:', response.status);
        throw new Error(`API-Football error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API-Football response:', data.response?.length || 0, 'fixtures');
      this.setCached(cacheKey, data.response);
      return data.response;
    } catch (error) {
      console.error('Football API error:', error);
      throw error;
    }
  }

  // The Odds API - fetch completed games
  async fetchOtherSportsResults(sport, date) {
    if (!this.apiOddsKey) {
      throw new Error('The Odds API key not configured');
    }

    // Map sport names to Odds API sport keys
    // Note: The Odds API may not have all tennis events or may return 404
    // See https://the-odds-api.com/sports-odds-data/sports-apis.html for available sports
    const sportMap = {
      'Tennis': ['tennis_atp', 'tennis_wta', 'tennis_atp_aus_open_singles', 'tennis_wta_aus_open_singles'],
      'Basketball': ['basketball_nba'],
      'Ice Hockey': ['icehockey_nhl'],
      'American Football': ['americanfootball_nfl'],
      'Baseball': ['baseball_mlb']
    };

    const sportKeys = sportMap[sport];
    if (!sportKeys || sportKeys.length === 0) {
      console.warn(`Sport ${sport} not supported by Odds API`);
      return [];
    }

    const cacheKey = `other_${sportKeys[0]}_${date.toISOString().split('T')[0]}`;
    console.log('🏀 Fetching results for:', sport, '(', sportKeys.join(', '), ')');
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Try each sport key until one works (for sports like Tennis with multiple leagues)
    let allResults = [];
    for (const sportKey of sportKeys) {
      try {
        console.log(`🌐 Making Odds API request for ${sportKey}...`);
        const response = await fetch(
          `${API_CONFIG.oddsApi.baseUrl}/sports/${sportKey}/scores?apiKey=${this.apiOddsKey}&daysFrom=3`,
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`⚠️ Odds API 404: No events available for ${sportKey}, trying next...`);
            continue; // Try next sport key
          }
          console.error('❌ Odds API error:', response.status, 'for', sportKey);
          continue; // Try next sport key
        }

        const data = await response.json();
        console.log(`✅ Odds API response for ${sportKey}:`, data?.length || 0, 'events');
        if (data && data.length > 0) {
          allResults = allResults.concat(data);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${sportKey}:`, error.message);
        // Continue to next sport key
      }
    }

    if (allResults.length === 0) {
      console.warn(`⚠️ No results found for ${sport} across any sport keys`);
    }
    
    this.setCached(cacheKey, allResults);
    return allResults;
  }

  // Normalize team names for better matching (remove special characters, etc.)
  normalizeTeamName(name) {
    return name.toLowerCase()
      .normalize('NFD') // Decompose unicode characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/ø/g, 'o') // Handle special Nordic characters
      .replace(/æ/g, 'ae')
      .replace(/[^a-z0-9\s]/g, '') // Remove remaining special characters
      .trim();
  }

  // Match bet event to API fixture
  matchFootballEvent(bet, fixtures) {
    console.log('🔍 Matching football event:', bet.event);
    const betEvent = bet.event.toLowerCase().trim();
    // Split on 'vs', 'v', 'at', or 'versus' with surrounding spaces
    const betTeams = betEvent.split(/\s+(?:vs\.?|v\.?|versus|at)\s+/i);
    
    if (betTeams.length !== 2) {
      console.warn('⚠️ Could not parse team names from:', bet.event);
      
      // Log parse failure for diagnostics
      logApiDiagnostics({
        type: 'match_failure',
        sport: 'football',
        reason: 'Could not parse team names from event string',
        bet: { 
          id: bet.id,
          event: bet.event, 
          tournament: bet.tournament, 
          sport: bet.sport, 
          eventTime: bet.eventTime,
          market: bet.market
        },
        parseAttempt: {
          input: bet.event,
          splitResult: betTeams,
          splitPattern: '/\\s+(?:vs\\.?|v\\.?|versus|at)\\s+/i'
        }
      });
      
      return null;
    }

    const [team1Raw, team2Raw] = betTeams.map(t => t.trim());
    const team1 = this.normalizeTeamName(team1Raw);
    const team2 = this.normalizeTeamName(team2Raw);
    console.log('🔍 Looking for:', team1, 'vs', team2);

    // Track candidates for diagnostic logging
    const candidates = [];

    for (const fixture of fixtures) {
      const homeTeam = this.normalizeTeamName(fixture.teams.home.name);
      const awayTeam = this.normalizeTeamName(fixture.teams.away.name);

      // Calculate all similarity scores for this fixture
      const sim1Home = this.stringSimilarity(team1, homeTeam);
      const sim2Away = this.stringSimilarity(team2, awayTeam);
      const sim1Away = this.stringSimilarity(team1, awayTeam);
      const sim2Home = this.stringSimilarity(team2, homeTeam);
      const score = Math.max(sim1Home + sim2Away, sim1Away + sim2Home) / 2;
      
      // Track candidate
      candidates.push({
        home: fixture.teams.home.name,
        away: fixture.teams.away.name,
        homeNormalized: homeTeam,
        awayNormalized: awayTeam,
        score: score.toFixed(3),
        sim1Home: sim1Home.toFixed(3),
        sim2Away: sim2Away.toFixed(3),
        sim1Away: sim1Away.toFixed(3),
        sim2Home: sim2Home.toFixed(3),
        fixture
      });

      // Try exact match first
      if (homeTeam.includes(team1) && awayTeam.includes(team2)) {
        console.log('✅ Exact match found:', fixture.teams.home.name, 'vs', fixture.teams.away.name);
        
        logApiDiagnostics({
          type: 'match_success',
          sport: 'football',
          betEvent: bet.event,
          matchedFixture: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          matchType: 'exact',
          searchedTeams: { team1, team2 }
        });
        
        return fixture;
      }

      // Try fuzzy match
      if (sim1Home > 0.7 && sim2Away > 0.7) {
        console.log('✅ Fuzzy match found:', fixture.teams.home.name, 'vs', fixture.teams.away.name, `(${(sim1Home*100).toFixed(0)}%, ${(sim2Away*100).toFixed(0)}%)`);
        
        logApiDiagnostics({
          type: 'match_success',
          sport: 'football',
          betEvent: bet.event,
          matchedFixture: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          matchType: 'fuzzy',
          similarity: `${(score * 100).toFixed(0)}%`,
          searchedTeams: { team1, team2 }
        });
        
        return fixture;
      }
    }

    console.warn('❌ No match found for:', bet.event);
    
    // Sort candidates by score and log detailed failure
    candidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    
    const failureEntry = {
      type: 'match_failure',
      sport: 'football',
      reason: 'No suitable match found',
      bet: { 
        id: bet.id,
        event: bet.event, 
        tournament: bet.tournament, 
        sport: bet.sport, 
        eventTime: bet.eventTime,
        market: bet.market,
        odds: bet.odds
      },
      searchedTeams: {
        team1: { raw: team1Raw, normalized: team1 },
        team2: { raw: team2Raw, normalized: team2 }
      },
      topCandidates: candidates.slice(0, 10).map(c => ({
        fixture: `${c.home} vs ${c.away}`,
        homeNormalized: c.homeNormalized,
        awayNormalized: c.awayNormalized,
        score: c.score,
        sim1Home: c.sim1Home,
        sim2Away: c.sim2Away,
        sim1Away: c.sim1Away,
        sim2Home: c.sim2Home
      })),
      totalFixturesSearched: fixtures.length,
      matchThreshold: 0.7
    };
    
    // In verbose mode, store more fixture data
    if (verboseDiagnosticMode) {
      failureEntry.verboseData = {
        allFixtureTeams: fixtures.slice(0, 30).map(f => ({
          home: f.teams.home.name,
          away: f.teams.away.name,
          status: f.fixture?.status?.short
        }))
      };
    }
    
    logApiDiagnostics(failureEntry);
    
    return null;
  }

  // Simple string similarity (Dice coefficient)
  stringSimilarity(str1, str2) {
    const bigrams1 = this.getBigrams(str1.toLowerCase());
    const bigrams2 = this.getBigrams(str2.toLowerCase());
    if (bigrams1.length === 0 || bigrams2.length === 0) return 0;
    const intersection = bigrams1.filter(b => bigrams2.includes(b));
    return (2.0 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  getBigrams(str) {
    const bigrams = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  // Determine bet outcome from fixture result
  determineFootballOutcome(bet, fixture) {
    console.log('📊 Determining outcome for:', bet.event, '| Market:', bet.market);
    console.log('📊 Match status:', fixture.fixture.status.short, '| Score:', fixture.goals.home, '-', fixture.goals.away);
    
    if (fixture.fixture.status.short !== 'FT' && fixture.fixture.status.short !== 'AET' && fixture.fixture.status.short !== 'PEN') {
      console.log('⏳ Match not finished yet:', fixture.fixture.status.short);
      return null; // Not finished yet
    }

    const homeScore = fixture.goals.home;
    const awayScore = fixture.goals.away;
    const market = bet.market.toLowerCase();

    // Handle different market types
    if (market.includes('over') || market.includes('under')) {
      console.log('🎯 Checking Over/Under market');
      const result = this.checkOverUnder(bet, homeScore, awayScore, fixture);
      console.log('🎯 Over/Under result:', result === true ? '✅ WON' : result === false ? '❌ LOST' : '❓ UNKNOWN');
      return result;
    } else if (market.includes('cards')) {
      console.log('🎯 Checking Cards market');
      const result = this.checkCards(bet, fixture);
      console.log('🎯 Cards result:', result === true ? '✅ WON' : result === false ? '❌ LOST' : '❓ UNKNOWN');
      return result;
    } else if (market.includes('ah') || market.includes('handicap')) {
      console.log('🎯 Checking Handicap market');
      const result = this.checkHandicap(bet, homeScore, awayScore);
      console.log('🎯 Handicap result:', result === true ? '✅ WON' : result === false ? '❌ LOST' : '❓ UNKNOWN');
      return result;
    } else if (market.includes('home') || market.includes('away') || market.includes('draw') || market.includes('1') || market.includes('2') || market.includes('x')) {
      console.log('🎯 Checking 1X2 market');
      const result = this.check1x2(bet, homeScore, awayScore);
      console.log('🎯 1X2 result:', result === true ? '✅ WON' : result === false ? '❌ LOST' : '❓ UNKNOWN');
      return result;
    }

    console.warn('⚠️ Unknown market type:', market);
    return null; // Unknown market type
  }

  checkOverUnder(bet, homeScore, awayScore, fixture) {
    const market = bet.market.toLowerCase();
    const isLay = market.includes('- lay');
    const isUnder = market.includes('under');
    
    // Extract threshold
    const match = market.match(/(\d+\.?\d*)/);
    if (!match) {
      console.warn('⚠️ Could not extract threshold from market:', market);
      return null;
    }
    
    const threshold = parseFloat(match[1]);
    console.log('📊 Over/Under threshold:', threshold, '| Is Under:', isUnder, '| Is Lay:', isLay);

    if (market.includes('cards')) {
      // Cards - need card data from fixture.statistics
      let totalCards = 0;
      if (fixture.statistics && fixture.statistics.length > 0) {
        fixture.statistics.forEach(team => {
          const yellowCards = team.statistics?.find(s => s.type === 'Yellow Cards')?.value || 0;
          const redCards = team.statistics?.find(s => s.type === 'Red Cards')?.value || 0;
          totalCards += parseInt(yellowCards) + parseInt(redCards);
        });
      }
      
      const result = isUnder ? (totalCards < threshold) : (totalCards > threshold);
      return isLay ? !result : result;
    } else {
      // Goals
      const totalGoals = homeScore + awayScore;
      console.log('⚽ Total goals:', totalGoals, '| Threshold:', threshold);
      const result = isUnder ? (totalGoals < threshold) : (totalGoals > threshold);
      console.log('📊 Base result:', result, '| After lay adjustment:', isLay ? !result : result);
      return isLay ? !result : result;
    }
  }

  checkCards(bet, fixture) {
    return this.checkOverUnder(bet, 0, 0, fixture);
  }

  checkHandicap(bet, homeScore, awayScore) {
    const market = bet.market.toLowerCase();
    const isLay = market.includes('- lay');
    
    // Extract handicap value (e.g., AH1(+1.5) or AH2(-1))
    const match = market.match(/ah([12])\(([+-]?\d+\.?\d*)\)/i);
    if (!match) return null;
    
    const team = parseInt(match[1]); // 1 = home, 2 = away
    const handicap = parseFloat(match[2]);

    const adjustedHome = homeScore + (team === 1 ? handicap : 0);
    const adjustedAway = awayScore + (team === 2 ? handicap : 0);

    const won = team === 1 ? adjustedHome > adjustedAway : adjustedAway > adjustedHome;
    return isLay ? !won : won;
  }

  check1x2(bet, homeScore, awayScore) {
    const market = bet.market.toLowerCase();
    const isLay = market.includes('- lay');
    
    let won = false;
    if (market.includes('home') || (market.match(/\b1\b/) && !market.includes('1st'))) {
      won = homeScore > awayScore;
    } else if (market.includes('away') || (market.match(/\b2\b/) && !market.includes('2nd'))) {
      won = awayScore > homeScore;
    } else if (market.includes('draw') || market.includes('x')) {
      won = homeScore === awayScore;
    }

    return isLay ? !won : won;
  }

  // Check if bet is ready to be looked up (30 minutes after event end)
  isReadyForLookup(bet) {
    if (!bet.eventTime) {
      console.warn('⚠️ Bet has no eventTime:', bet.event);
      return false;
    }
    
    const eventTime = new Date(bet.eventTime);
    const now = new Date();
    
    // Assume average match duration + 30 min buffer
    // Football: 90min + 15min halftime + 30min = 135min = 2h 15min
    // Other sports vary, but 2.5h is reasonable for most
    const lookupTime = new Date(eventTime.getTime() + (2.25 * 60 * 60 * 1000));
    
    const isReady = now >= lookupTime;
    const timeUntilReady = lookupTime - now;
    const minutesUntilReady = Math.round(timeUntilReady / 60000);
    
    if (!isReady) {
      console.log('⏳', bet.event, 'not ready - check in', minutesUntilReady, 'minutes');
    } else {
      console.log('✅', bet.event, 'ready for lookup');
    }
    
    return isReady;
  }

  // ========== MULTI-SPORT FIXTURE FETCHING ==========
  
  /**
   * Fetch fixtures for any supported sport from api-sports.io
   * Uses the unified API key from dashboard.api-football.com
   * @param {string} sport - Sport key (football, basketball, hockey, etc.)
   * @param {Date} date - Event date
   * @returns {Promise<Array>} Fixtures/games
   */
  async fetchSportFixtures(sport, date) {
    if (!this.apiFootballKey) {
      throw new Error('API-Sports key not configured');
    }
    
    const endpoint = API_SPORTS_ENDPOINTS[sport];
    if (!endpoint) {
      throw new Error(`Unsupported sport: ${sport}`);
    }
    
    const dateStr = date.toISOString().split('T')[0];
    const cacheKey = `${sport}_${dateStr}`;
    
    console.log(`🏟️ Fetching ${sport} fixtures for: ${dateStr}`);
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    try {
      const url = `${endpoint.baseUrl}${endpoint.fixturesEndpoint}?${endpoint.dateParam}=${dateStr}`;
      console.log(`🌐 Making ${sport} API request: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-key': this.apiFootballKey,
          'x-rapidapi-host': endpoint.host
        }
      });
      
      if (!response.ok) {
        console.error(`❌ ${sport} API error:`, response.status);
        throw new Error(`${sport} API error: ${response.status}`);
      }
      
      const data = await response.json();
      const fixtures = data.response || [];
      
      console.log(`✅ ${sport} API response: ${fixtures.length} fixtures`);
      
      // Log sample for diagnostics
      await logApiDiagnostics({
        type: 'api_response',
        sport,
        date: dateStr,
        fixtureCount: fixtures.length,
        sampleFixtures: fixtures.slice(0, 3).map(f => ({
          id: f.id || f.game?.id,
          teams: this.extractTeamNames(f, sport),
          status: this.extractGameStatus(f, sport)
        }))
      });
      
      this.setCached(cacheKey, fixtures);
      return fixtures;
    } catch (error) {
      console.error(`❌ ${sport} API error:`, error);
      
      await logApiDiagnostics({
        type: 'api_error',
        sport,
        date: dateStr,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Extract team names from fixture (handles different API response structures)
   */
  extractTeamNames(fixture, sport) {
    if (sport === 'football') {
      return {
        home: fixture.teams?.home?.name,
        away: fixture.teams?.away?.name
      };
    }
    // Other sports use slightly different structures
    return {
      home: fixture.teams?.home?.name || fixture.home?.name,
      away: fixture.teams?.away?.name || fixture.away?.name
    };
  }
  
  /**
   * Extract game status from fixture
   */
  extractGameStatus(fixture, sport) {
    if (sport === 'football') {
      return fixture.fixture?.status?.short;
    }
    return fixture.status?.short || fixture.game?.status?.short;
  }
  
  /**
   * Extract scores from fixture (handles different API response structures)
   */
  extractScores(fixture, sport) {
    if (sport === 'football') {
      return {
        home: fixture.goals?.home,
        away: fixture.goals?.away,
        total: (fixture.goals?.home || 0) + (fixture.goals?.away || 0)
      };
    }
    
    // Basketball, Hockey, Baseball, NFL use scores object
    if (fixture.scores) {
      const home = fixture.scores.home?.total ?? fixture.scores.home?.points ?? fixture.scores.home;
      const away = fixture.scores.away?.total ?? fixture.scores.away?.points ?? fixture.scores.away;
      return {
        home: typeof home === 'number' ? home : parseInt(home) || 0,
        away: typeof away === 'number' ? away : parseInt(away) || 0,
        total: (parseInt(home) || 0) + (parseInt(away) || 0)
      };
    }
    
    return { home: 0, away: 0, total: 0 };
  }
  
  /**
   * Check if game is finished (handles different status formats)
   */
  isGameFinished(fixture, sport) {
    const finishedStatuses = ['FT', 'AET', 'PEN', 'AOT', 'AP', 'FINAL', 'F', 'POST'];
    
    if (sport === 'football') {
      const status = fixture.fixture?.status?.short;
      return finishedStatuses.includes(status);
    }
    
    const status = fixture.status?.short || fixture.game?.status?.short;
    return finishedStatuses.includes(status);
  }
  
  /**
   * Match bet to fixture for any sport
   */
  matchSportEvent(bet, fixtures, sport) {
    console.log(`🔍 Matching ${sport} event:`, bet.event);
    const betEvent = bet.event.toLowerCase().trim();
    const betTeams = betEvent.split(/\s+(?:vs\.?|v\.?|versus|at|@)\s+/i);
    
    if (betTeams.length !== 2) {
      console.warn('⚠️ Could not parse team names from:', bet.event);
      
      // Log match failure for diagnostics
      logApiDiagnostics({
        type: 'match_failure',
        sport,
        reason: 'Could not parse team names',
        bet: { event: bet.event, tournament: bet.tournament, sport: bet.sport }
      });
      
      return null;
    }

    const [team1Raw, team2Raw] = betTeams.map(t => t.trim());
    const team1 = this.normalizeTeamName(team1Raw);
    const team2 = this.normalizeTeamName(team2Raw);
    console.log(`🔍 Looking for: "${team1}" vs "${team2}"`);

    // Track best candidates for diagnostic logging
    const candidates = [];

    for (const fixture of fixtures) {
      const teams = this.extractTeamNames(fixture, sport);
      if (!teams.home || !teams.away) continue;
      
      const homeTeam = this.normalizeTeamName(teams.home);
      const awayTeam = this.normalizeTeamName(teams.away);
      
      // Calculate similarities
      const sim1Home = this.stringSimilarity(team1, homeTeam);
      const sim2Away = this.stringSimilarity(team2, awayTeam);
      const sim1Away = this.stringSimilarity(team1, awayTeam);
      const sim2Home = this.stringSimilarity(team2, homeTeam);
      
      // Track candidate
      const score = Math.max(sim1Home + sim2Away, sim1Away + sim2Home) / 2;
      candidates.push({
        home: teams.home,
        away: teams.away,
        score: score.toFixed(2),
        fixture
      });

      // Try exact match first (contains)
      if ((homeTeam.includes(team1) && awayTeam.includes(team2)) ||
          (homeTeam.includes(team2) && awayTeam.includes(team1))) {
        console.log(`✅ Exact match found: ${teams.home} vs ${teams.away}`);
        
        logApiDiagnostics({
          type: 'match_success',
          sport,
          betEvent: bet.event,
          matchedFixture: `${teams.home} vs ${teams.away}`,
          matchType: 'exact'
        });
        
        return fixture;
      }

      // Try fuzzy match
      if ((sim1Home > 0.65 && sim2Away > 0.65) || (sim1Away > 0.65 && sim2Home > 0.65)) {
        console.log(`✅ Fuzzy match found: ${teams.home} vs ${teams.away} (${(score*100).toFixed(0)}%)`);
        
        logApiDiagnostics({
          type: 'match_success',
          sport,
          betEvent: bet.event,
          matchedFixture: `${teams.home} vs ${teams.away}`,
          matchType: 'fuzzy',
          similarity: (score * 100).toFixed(0) + '%'
        });
        
        return fixture;
      }
    }

    console.warn(`❌ No match found for: ${bet.event}`);
    
    // Log failure with top candidates for analysis
    candidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    
    // Build detailed failure entry
    const failureEntry = {
      type: 'match_failure',
      sport,
      reason: 'No suitable match found',
      bet: { 
        id: bet.id,
        event: bet.event, 
        tournament: bet.tournament, 
        sport: bet.sport, 
        eventTime: bet.eventTime,
        market: bet.market,
        odds: bet.odds
      },
      searchedTeams: {
        team1: { raw: team1Raw, normalized: team1 },
        team2: { raw: team2Raw, normalized: team2 }
      },
      topCandidates: candidates.slice(0, 10).map(c => ({
        fixture: `${c.home} vs ${c.away}`,
        homeNormalized: this.normalizeTeamName(c.home),
        awayNormalized: this.normalizeTeamName(c.away),
        score: c.score,
        sim1Home: this.stringSimilarity(team1, this.normalizeTeamName(c.home)).toFixed(3),
        sim2Away: this.stringSimilarity(team2, this.normalizeTeamName(c.away)).toFixed(3),
        sim1Away: this.stringSimilarity(team1, this.normalizeTeamName(c.away)).toFixed(3),
        sim2Home: this.stringSimilarity(team2, this.normalizeTeamName(c.home)).toFixed(3)
      })),
      totalFixturesSearched: fixtures.length,
      matchThreshold: 0.65
    };
    
    // In verbose mode, also store sample fixtures for debugging
    if (verboseDiagnosticMode) {
      failureEntry.verboseData = {
        allFixtureTeams: fixtures.slice(0, 30).map(f => {
          const teams = this.extractTeamNames(f, sport);
          return {
            home: teams.home,
            away: teams.away,
            status: this.extractGameStatus(f, sport)
          };
        })
      };
    }
    
    logApiDiagnostics(failureEntry);
    
    return null;
  }
  
  /**
   * Determine outcome for non-football sports
   * Supports: winner (moneyline), spread/handicap, totals (over/under)
   */
  determineSportOutcome(bet, fixture, sport) {
    const scores = this.extractScores(fixture, sport);
    const isFinished = this.isGameFinished(fixture, sport);
    
    console.log(`📊 Determining ${sport} outcome for: ${bet.event}`);
    console.log(`📊 Scores: ${scores.home} - ${scores.away} | Finished: ${isFinished}`);
    
    if (!isFinished) {
      console.log('⏳ Game not finished yet');
      return null;
    }
    
    const market = (bet.market || '').toLowerCase();
    const isLay = market.includes('- lay') || market.includes('lay ');
    
    // Over/Under (Totals)
    if (market.includes('over') || market.includes('under')) {
      const match = market.match(/(\d+\.?\d*)/);
      if (!match) return null;
      
      const threshold = parseFloat(match[1]);
      const total = scores.total;
      const isUnder = market.includes('under');
      
      console.log(`🎯 Totals: ${total} vs threshold ${threshold} (${isUnder ? 'Under' : 'Over'})`);
      
      const result = isUnder ? (total < threshold) : (total > threshold);
      return isLay ? !result : result;
    }
    
    // Spread/Handicap
    if (market.includes('spread') || market.includes('handicap') || market.match(/[+-]\d+\.?\d*/)) {
      const match = market.match(/([+-]?\d+\.?\d*)/);
      if (!match) return null;
      
      const spread = parseFloat(match[1]);
      // Determine which team the spread applies to
      const isHome = market.includes('home') || market.includes('1') || spread > 0;
      
      const adjustedHome = scores.home + (isHome ? spread : 0);
      const adjustedAway = scores.away + (!isHome ? Math.abs(spread) : 0);
      
      console.log(`🎯 Spread: ${spread} | Adjusted: ${adjustedHome} - ${adjustedAway}`);
      
      const result = isHome ? (adjustedHome > adjustedAway) : (adjustedAway > adjustedHome);
      return isLay ? !result : result;
    }
    
    // Moneyline / Winner (default)
    const homeWin = scores.home > scores.away;
    const awayWin = scores.away > scores.home;
    
    let result = null;
    if (market.includes('home') || market.includes('1') || market.match(/\bhome\b/i)) {
      result = homeWin;
    } else if (market.includes('away') || market.includes('2') || market.match(/\baway\b/i)) {
      result = awayWin;
    } else if (market.includes('draw') || market.includes('x') || market.includes('tie')) {
      result = scores.home === scores.away;
    } else {
      // Try to infer from team name in market
      const betTeams = bet.event.toLowerCase().split(/\s+(?:vs\.?|v\.?|versus|at|@)\s+/i);
      if (betTeams.length === 2) {
        const team1 = this.normalizeTeamName(betTeams[0]);
        const normalizedMarket = this.normalizeTeamName(market);
        
        if (normalizedMarket.includes(team1)) {
          result = homeWin; // First team in event is usually home
        } else {
          result = awayWin;
        }
      }
    }
    
    console.log(`🎯 Winner result: ${result === true ? 'WON' : result === false ? 'LOST' : 'UNKNOWN'}`);
    return result !== null ? (isLay ? !result : result) : null;
  }

  // ========== BATCHED RESULT CHECKING ==========
  
  /**
   * Process bets in batches - one API call per sport per date
   * Optimizes API usage by grouping bets
   * @param {Array} bets - Pending bets to check
   * @returns {Array} Results array
   */
  async checkBetsForResultsBatched(bets) {
    console.log('\n🔍 ========== CHECKING BETS FOR RESULTS (BATCHED) ==========');
    console.log('📋 Total bets to check:', bets.length);
    
    const results = [];
    const groups = groupBetsForBatchProcessing(bets);
    
    // Handle unsupported sports first
    if (groups.has('unsupported')) {
      const unsupportedBets = groups.get('unsupported');
      console.log(`\n⚠️ ${unsupportedBets.length} bet(s) with truly unsupported sports (no API available)`);
      
      for (const bet of unsupportedBets) {
        const detectedSport = bet._detectedSport || bet.sport || 'Unknown';
        console.log(`  - ${bet.event} (${detectedSport})`);
        
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          matchFound: false,
          unsupportedSport: true,
          message: `Sport "${detectedSport}" is not supported for automatic result checking. Please settle manually.`
        });
        
        await logApiDiagnostics({
          type: 'unsupported_sport',
          sport: detectedSport,
          bet: { event: bet.event, tournament: bet.tournament }
        });
      }
      groups.delete('unsupported');
    }
    
    // Process each api_sport_date group
    for (const [groupKey, groupBets] of groups) {
      // Parse group key: "api-sports_football_2025-11-25" or "odds-api_tennis_2025-11-25"
      const parts = groupKey.split('_');
      const apiType = parts[0];
      const sport = parts[1];
      const dateStr = parts.slice(2).join('_'); // In case date has underscores
      const eventDate = new Date(dateStr);
      
      console.log(`\n📋 Processing group: ${groupKey} (${groupBets.length} bets)`);
      console.log(`   API: ${apiType}, Sport: ${sport}, Date: ${dateStr}`);
      
      // Route to appropriate API
      if (apiType === 'api-sports') {
        // Use API-Sports.io
        await this._processApiSportsGroup(sport, eventDate, groupBets, results);
      } else if (apiType === 'odds-api') {
        // Use The Odds API as fallback
        await this._processOddsApiGroup(sport, eventDate, groupBets, results);
      }
    }
    
    console.log('\n✅ ========== BATCH CHECK COMPLETE ==========');
    console.log('📊 Results summary:');
    console.log('  - Total processed:', results.length);
    console.log('  - Won:', results.filter(r => r.outcome === 'won').length);
    console.log('  - Lost:', results.filter(r => r.outcome === 'lost').length);
    console.log('  - Pending/Retry:', results.filter(r => r.incrementRetry).length);
    console.log('  - Unsupported:', results.filter(r => r.unsupportedSport).length);
    console.log('  - Rate Limited:', results.filter(r => r.rateLimited).length);
    console.log('==========================================\n');
    
    return results;
  }
  
  /**
   * Process bets using API-Sports.io
   */
  async _processApiSportsGroup(sport, eventDate, groupBets, results) {
    // Check rate limit before making API call
    const available = await getAvailableApiCalls(sport);
    if (available <= 0) {
      console.warn(`⚠️ Rate limit reached for ${sport} (0/${API_SPORTS_ENDPOINTS[sport]?.rateLimit || 100})`);
      
      for (const bet of groupBets) {
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          matchFound: false,
          rateLimited: true,
          incrementRetry: false, // Don't count as retry
          message: `Rate limit reached for ${sport}. Will retry when limit resets.`
        });
      }
      return;
    }
    
    // Fetch fixtures for this sport+date
    let fixtures;
    try {
      fixtures = await this.fetchSportFixtures(sport, eventDate);
      await incrementApiCallCount(sport);
    } catch (error) {
      console.error(`❌ API error for ${sport}:`, error);
      
      for (const bet of groupBets) {
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          error: error.message,
          incrementRetry: true
        });
      }
      return;
    }
    
    // Match each bet against fixtures
    for (const bet of groupBets) {
      await this._matchBetAgainstFixtures(bet, fixtures, sport, results);
    }
  }
  
  /**
   * Process bets using The Odds API (fallback)
   */
  async _processOddsApiGroup(sport, eventDate, groupBets, results) {
    // Check rate limit for Odds API
    const available = await getAvailableApiCalls('oddsApi');
    if (available <= 0) {
      console.warn(`⚠️ Rate limit reached for Odds API (0/500/month)`);
      
      for (const bet of groupBets) {
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          matchFound: false,
          rateLimited: true,
          incrementRetry: false,
          message: `Odds API monthly limit reached. Will retry next month.`
        });
      }
      return;
    }
    
    // Map sport name to Odds API sport key
    const sportKeyMap = ODDS_API_FALLBACK_SPORTS[sport] || [];
    if (sportKeyMap.length === 0) {
      console.warn(`⚠️ No Odds API sport keys configured for ${sport}`);
      
      for (const bet of groupBets) {
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          matchFound: false,
          unsupportedSport: true,
          message: `Sport "${sport}" has no configured Odds API endpoints. Please settle manually.`
        });
      }
      return;
    }
    
    // Fetch scores from The Odds API
    let allScores = [];
    try {
      // Try to get actual sport name for the API
      const capitalizedSport = sport.charAt(0).toUpperCase() + sport.slice(1);
      allScores = await this.fetchOtherSportResults(capitalizedSport, eventDate);
      await incrementApiCallCount('oddsApi');
    } catch (error) {
      console.error(`❌ Odds API error for ${sport}:`, error);
      
      for (const bet of groupBets) {
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          error: error.message,
          incrementRetry: true
        });
      }
      return;
    }
    
    // Match each bet against scores
    for (const bet of groupBets) {
      await this._matchBetAgainstOddsApiScores(bet, allScores, sport, results);
    }
  }
  
  /**
   * Match a bet against API-Sports fixtures
   */
  async _matchBetAgainstFixtures(bet, fixtures, sport, results) {
    // Skip if not ready for lookup
    if (!this.isReadyForLookup(bet)) {
      return;
    }
    
    // Skip if already settled
    if (bet.status && bet.status !== 'pending') {
      console.log(`⏭️ Skipping ${bet.event} - already ${bet.status}`);
      return;
    }
    
    // Check retry count
    const retryCount = bet.apiRetryCount || 0;
    if (retryCount >= 5) {
      console.log(`❌ Max retries reached for ${bet.event}`);
      return;
    }
    
    // Try to match
    let fixture = null;
    let outcome = null;
    
    if (sport === 'football') {
      fixture = this.matchFootballEvent(bet, fixtures);
      if (fixture) {
        outcome = this.determineFootballOutcome(bet, fixture);
      }
    } else {
      fixture = this.matchSportEvent(bet, fixtures, sport);
      if (fixture) {
        outcome = this.determineSportOutcome(bet, fixture, sport);
      }
    }
    
    if (fixture && outcome !== null) {
      console.log(`✅ RESULT DETERMINED: ${bet.event} → ${outcome ? 'WON' : 'LOST'}`);
      
      const scores = this.extractScores(fixture, sport);
      await logApiDiagnostics({
        type: 'result_determined',
        sport,
        bet: { event: bet.event, market: bet.market },
        outcome: outcome ? 'won' : 'lost',
        score: `${scores.home} - ${scores.away}`
      });
      
      results.push({
        betId: getBetKey(bet),
        outcome: outcome ? 'won' : 'lost',
        confidence: 'high',
        matchFound: true
      });
    } else if (fixture) {
      // Match found but not finished or unknown market
      console.log(`⏳ Match found but not finished/unknown market: ${bet.event}`);
      results.push({
        betId: getBetKey(bet),
        outcome: null,
        matchFound: true,
        notFinished: true
      });
    } else {
      // No match found
      console.log(`❌ No match found for: ${bet.event}`);
      results.push({
        betId: getBetKey(bet),
        outcome: null,
        matchFound: false,
        incrementRetry: true
      });
    }
  }
  
  /**
   * Match a bet against Odds API scores
   */
  async _matchBetAgainstOddsApiScores(bet, scores, sport, results) {
    // Skip if not ready for lookup
    if (!this.isReadyForLookup(bet)) {
      return;
    }
    
    // Skip if already settled
    if (bet.status && bet.status !== 'pending') {
      console.log(`⏭️ Skipping ${bet.event} - already ${bet.status}`);
      return;
    }
    
    // Check retry count
    const retryCount = bet.apiRetryCount || 0;
    if (retryCount >= 5) {
      console.log(`❌ Max retries reached for ${bet.event}`);
      return;
    }
    
    // Try to match using existing Odds API matching logic
    const match = this.matchOtherSportEvent(bet, scores);
    
    if (match && match.completed) {
      const outcome = this.determineOtherSportOutcome(bet, match);
      
      if (outcome !== null) {
        console.log(`✅ RESULT DETERMINED (Odds API): ${bet.event} → ${outcome ? 'WON' : 'LOST'}`);
        
        await logApiDiagnostics({
          type: 'result_determined',
          sport,
          api: 'odds-api',
          bet: { event: bet.event, market: bet.market },
          outcome: outcome ? 'won' : 'lost',
          match: { home: match.home_team, away: match.away_team }
        });
        
        results.push({
          betId: getBetKey(bet),
          outcome: outcome ? 'won' : 'lost',
          confidence: 'high',
          matchFound: true
        });
      } else {
        // Unknown market
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          matchFound: true,
          notFinished: true
        });
      }
    } else if (match) {
      // Match found but not completed
      console.log(`⏳ Match found but not completed: ${bet.event}`);
      results.push({
        betId: getBetKey(bet),
        outcome: null,
        matchFound: true,
        notFinished: true
      });
    } else {
      // No match found
      console.log(`❌ No match found (Odds API): ${bet.event}`);
      results.push({
        betId: getBetKey(bet),
        outcome: null,
        matchFound: false,
        incrementRetry: true
      });
    }
  }

  // Process a batch of bets and check for results (legacy - kept for compatibility)
  async checkBetsForResults(bets) {
    console.log('\n🔍 ========== CHECKING BETS FOR RESULTS ==========');
    console.log('📋 Total bets to check:', bets.length);
    const results = [];
    const config = this.isConfigured();

    for (const bet of bets) {
      console.log('\n--- Processing bet:', bet.event, '---');
      
      // Skip if not pending
      if (bet.status && bet.status !== 'pending') {
        console.log('⏭️ Skipping - already settled as:', bet.status);
        continue;
      }

      // Skip if not ready for lookup yet
      if (!this.isReadyForLookup(bet)) {
        continue;
      }

      // Check retry count
      const retryCount = bet.apiRetryCount || 0;
      console.log('🔄 Retry count:', retryCount, '/ 5');
      if (retryCount >= 5) {
        console.log('❌ Max retries reached - skipping');
        continue;
      }

      try {
        let outcome = null;
        const eventDate = new Date(bet.eventTime);

        if (bet.sport === 'Football' && config.football) {
          console.log('⚽ Processing as Football bet');
          const fixtures = await this.fetchFootballFixtures(eventDate);
          const fixture = this.matchFootballEvent(bet, fixtures);
          
          if (fixture) {
            outcome = this.determineFootballOutcome(bet, fixture);
            
            if (outcome !== null) {
              console.log('✅ RESULT DETERMINED:', outcome ? 'WON' : 'LOST');
              results.push({
                betId: getBetKey(bet),
                outcome: outcome ? 'won' : 'lost',
                confidence: 'high',
                matchFound: true
              });
            } else {
              // Match found but not finished or unknown market
              console.log('⏳ Match found but not finished or unknown market');
              results.push({
                betId: getBetKey(bet),
                outcome: null,
                matchFound: true,
                notFinished: true
              });
            }
          } else {
            // No match found - increment retry
            console.log('❌ No match found - will retry later');
            results.push({
              betId: getBetKey(bet),
              outcome: null,
              matchFound: false,
              incrementRetry: true
            });
          }
        } else if (config.other && bet.sport !== 'Football') {
          const scores = await this.fetchOtherSportsResults(bet.sport, eventDate);
          
          // TODO: Implement matching for other sports
          // For now, just increment retry
          results.push({
            betId: getBetKey(bet),
            outcome: null,
            matchFound: false,
            incrementRetry: true
          });
        } else {
          // API not configured for this sport
          console.log(`No API configured for ${bet.sport}`);
        }
      } catch (error) {
        console.error(`Error checking bet ${bet.event}:`, error);
        // Increment retry on error
        results.push({
          betId: getBetKey(bet),
          outcome: null,
          error: error.message,
          incrementRetry: true
        });
      }
    }

    console.log('\n✅ ========== CHECK COMPLETE ==========');
    console.log('📊 Results summary:');
    console.log('  - Total processed:', results.length);
    console.log('  - Won:', results.filter(r => r.outcome === 'won').length);
    console.log('  - Lost:', results.filter(r => r.outcome === 'lost').length);
    console.log('  - Pending/Retry:', results.filter(r => r.incrementRetry).length);
    console.log('==========================================\n');
    
    return results;
  }
}

// Expose globally so MV2 background scripts and UI pages can access it
if (typeof self !== 'undefined') {
  self.API_CONFIG = API_CONFIG;
  self.API_SPORTS_ENDPOINTS = API_SPORTS_ENDPOINTS;
  self.UNSUPPORTED_SPORTS = UNSUPPORTED_SPORTS;
  self.ApiService = ApiService;
  // Expose utility functions for background script
  self.detectSportFromBet = detectSportFromBet;
  self.getAllRateLimitStats = getAllRateLimitStats;
  self.getDiagnosticLog = getDiagnosticLog;
  self.clearDiagnosticLog = clearDiagnosticLog;
  self.logApiDiagnostics = logApiDiagnostics;
  // Verbose diagnostic mode controls
  self.setVerboseDiagnosticMode = setVerboseDiagnosticMode;
  self.getVerboseDiagnosticMode = getVerboseDiagnosticMode;
  console.log('✅ ApiService class and multi-sport utilities loaded');
}

// Provide CommonJS fallback for tests or tooling if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ApiService, 
    API_CONFIG, 
    API_SPORTS_ENDPOINTS,
    UNSUPPORTED_SPORTS,
    detectSportFromBet,
    getAllRateLimitStats,
    getDiagnosticLog,
    clearDiagnosticLog,
    logApiDiagnostics,
    setVerboseDiagnosticMode,
    getVerboseDiagnosticMode
  };
}
