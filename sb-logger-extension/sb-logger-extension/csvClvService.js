/**
 * CSV-Based CLV Tracking Service
 * Downloads, parses, and caches Pinnacle closing odds from football-data.co.uk
 * Calculates Closing Line Value (CLV) for football bets
 * 
 * Dependencies:
 * - footballDataLeagues.js (must be imported first)
 * - fuzzyMatcher.js (for team name matching)
 * - chrome.storage.local API
 */

/**
 * Convert event date to football-data.co.uk season format
 * @param {string|Date} eventDate - ISO date or Date object
 * @returns {string} Season code (e.g., "2425" for 2024-2025)
 */
function detectSeason(eventDate) {
  const date = new Date(eventDate);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  
  // European football season: typically June/July-May
  // Many leagues start in July, so use June (month 5) as cutoff
  // If month is June-Dec (5-11), season starts this year
  // If month is Jan-May (0-4), season started last year
  let startYear, endYear;
  
  if (month >= 5) { // June onwards (month 5 = June)
    startYear = year;
    endYear = year + 1;
  } else { // Jan-May
    startYear = year - 1;
    endYear = year;
  }
  
  // Format: "YYZZ" (last 2 digits of each year)
  const yy = String(startYear).slice(-2);
  const zz = String(endYear).slice(-2);
  
  return `${yy}${zz}`;
}

/**
 * Download CSV from football-data.co.uk
 * @param {string} leagueCode - E0, E1, SP1, etc.
 * @param {string} season - "2425", "2324", etc.
 * @returns {Promise<string>} CSV text content or null if failed
 */
async function downloadCSV(leagueCode, season) {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${leagueCode}.csv`;
  
  console.log(`[CSV CLV] 📥 Downloading CSV: ${leagueCode} ${season} from ${url}`);
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      cache: 'no-cache', // Always get fresh data
      headers: {
        'Accept': 'text/csv'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[CSV CLV] ⚠️ CSV not found: ${url} (league/season may not exist yet)`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      console.warn(`[CSV CLV] ⚠️ Empty CSV received: ${url}`);
      return null;
    }
    
    console.log(`[CSV CLV] ✅ Downloaded ${csvText.length} bytes for ${leagueCode} ${season}`);
    return csvText;
    
  } catch (error) {
    console.error(`[CSV CLV] ❌ CSV download failed for ${leagueCode} ${season}:`, error.message);
    return null;
  }
}

/**
 * Parse football-data.co.uk CSV into structured rows
 * @param {string} csvText - Raw CSV content
 * @returns {Array<Object>} Parsed rows with columns as properties
 */
function parseFootballDataCSV(csvText) {
  if (!csvText) return [];
  
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    console.warn('[CSV CLV] ⚠️ CSV has no data rows');
    return [];
  }
  
  // Extract header (first line)
  const header = lines[0].split(',').map(col => col.trim());
  
  // Find required column indices
  const colIndices = {
    Div: header.indexOf('Div'),
    Date: header.indexOf('Date'),
    Time: header.indexOf('Time'),
    HomeTeam: header.indexOf('HomeTeam'),
    AwayTeam: header.indexOf('AwayTeam'),
    FTHG: header.indexOf('FTHG'), // Full-time home goals
    FTAG: header.indexOf('FTAG'), // Full-time away goals
    FTR: header.indexOf('FTR'),   // Full-time result (H/D/A)
    PSH: header.indexOf('PSH'),   // Pinnacle opening home odds
    PSD: header.indexOf('PSD'),   // Pinnacle opening draw odds
    PSA: header.indexOf('PSA'),   // Pinnacle opening away odds
    PSCH: header.indexOf('PSCH'), // Pinnacle CLOSING home odds
    PSCD: header.indexOf('PSCD'), // Pinnacle CLOSING draw odds
    PSCA: header.indexOf('PSCA'), // Pinnacle CLOSING away odds
    // Over/Under 2.5 goals
    'P>2.5': header.indexOf('P>2.5'),   // Pinnacle opening over 2.5
    'P<2.5': header.indexOf('P<2.5'),   // Pinnacle opening under 2.5
    'PC>2.5': header.indexOf('PC>2.5'), // Pinnacle CLOSING over 2.5 (if exists)
    'PC<2.5': header.indexOf('PC<2.5'), // Pinnacle CLOSING under 2.5 (if exists)
    // Asian Handicap
    PAHH: header.indexOf('PAHH'),   // Pinnacle opening Asian handicap home
    PAHA: header.indexOf('PAHA'),   // Pinnacle opening Asian handicap away
    PAH: header.indexOf('PAH'),     // Pinnacle handicap size (e.g., -0.5, +1.0)
    PCAHH: header.indexOf('PCAHH'), // Pinnacle CLOSING Asian handicap home (if exists)
    PCAHA: header.indexOf('PCAHA')  // Pinnacle CLOSING Asian handicap away (if exists)
  };
  
  // Validate CORE columns exist (O/U and Asian Handicap are optional)
  const requiredCols = ['Div', 'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR', 'PSCH', 'PSCD', 'PSCA'];
  const missingCols = requiredCols.filter(col => colIndices[col] === -1);
  
  if (missingCols.length > 0) {
    console.error(`[CSV CLV] ❌ CSV missing required columns: ${missingCols.join(', ')}`);
    return [];
  }
  
  // Log available optional markets
  const availableMarkets = [];
  if (colIndices['P>2.5'] !== -1 && colIndices['P<2.5'] !== -1) availableMarkets.push('O/U 2.5');
  if (colIndices.PAHH !== -1 && colIndices.PAHA !== -1) availableMarkets.push('Asian Handicap');
  if (availableMarkets.length > 0) {
    console.log(`[CSV CLV] 📊 Available markets: 1X2, ${availableMarkets.join(', ')}`);
  }
  
  // Parse data rows (skip header)
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(',').map(val => val.trim());
    
    // Build row object
    const row = {};
    for (const [col, idx] of Object.entries(colIndices)) {
      row[col] = values[idx] || null;
    }
    
    // Parse date (dd/mm/yy → ISO format)
    if (row.Date) {
      const [day, month, year] = row.Date.split('/');
      // Handle 2-digit years: 00-49 = 2000-2049, 50-99 = 1950-1999
      let fullYear;
      if (year.length === 2) {
        const yearNum = parseInt(year, 10);
        fullYear = yearNum >= 50 ? `19${year}` : `20${year}`;
      } else {
        fullYear = year;
      }
      row.DateISO = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Parse odds as floats (all market types)
    const oddsColumns = ['PSH', 'PSD', 'PSA', 'PSCH', 'PSCD', 'PSCA', 
                        'P>2.5', 'P<2.5', 'PC>2.5', 'PC<2.5',
                        'PAHH', 'PAHA', 'PCAHH', 'PCAHA'];
    oddsColumns.forEach(col => {
      if (row[col] && row[col] !== '') {
        const parsed = parseFloat(row[col]);
        if (!isNaN(parsed)) {
          row[col] = parsed;
        }
      }
    });
    
    // Parse handicap size (can be negative)
    if (row.PAH && row.PAH !== '') {
      const parsed = parseFloat(row.PAH);
      if (!isNaN(parsed)) {
        row.PAH = parsed;
      }
    }
    
    rows.push(row);
  }
  
  console.log(`[CSV CLV] ✅ Parsed ${rows.length} matches from CSV`);
  return rows;
}

/**
 * Get cached CSV rows from storage
 * @param {string} leagueCode - E0, E1, etc.
 * @param {string} season - "2425", etc.
 * @returns {Promise<Array|null>} Cached rows or null if expired/missing
 */
async function getCachedCSV(leagueCode, season) {
  const cacheKey = `csv_cache_${leagueCode}_${season}`;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([cacheKey], (result) => {
      const cache = result[cacheKey];
      
      if (!cache) {
        console.log(`[CSV CLV] 💾 No cache for ${leagueCode} ${season}`);
        resolve(null);
        return;
      }
      
      // Smart expiry strategy:
      // - Current season: refresh every 7 days (data updates weekly)
      // - Historical seasons: never expire (data is immutable)
      const currentSeason = detectSeason(new Date());
      const isHistorical = season !== currentSeason;
      
      if (isHistorical) {
        console.log(`[CSV CLV] ✅ Cache hit (historical): ${leagueCode} ${season} (${cache.rows.length} rows, permanent)`);
        resolve(cache.rows);
        return;
      }
      
      // Current season: check 7-day expiry
      const now = Date.now();
      const age = now - cache.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (age > maxAge) {
        console.log(`[CSV CLV] 💾 Cache expired for ${leagueCode} ${season} (${Math.floor(age / 86400000)} days old)`);
        resolve(null);
        return;
      }
      
      console.log(`[CSV CLV] ✅ Cache hit (current season): ${leagueCode} ${season} (${cache.rows.length} rows, ${Math.floor(age / 3600000)}h old)`);
      resolve(cache.rows);
    });
  });
}

/**
 * Save CSV rows to cache
 * @param {string} leagueCode
 * @param {string} season
 * @param {Array} rows - Parsed CSV rows
 */
async function cacheCSV(leagueCode, season, rows) {
  const cacheKey = `csv_cache_${leagueCode}_${season}`;
  const cache = {
    leagueCode,
    season,
    rows,
    timestamp: Date.now()
  };
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [cacheKey]: cache }, () => {
      console.log(`[CSV CLV] 💾 Cached ${rows.length} rows for ${leagueCode} ${season}`);
      resolve();
    });
  });
}

/**
 * Clear all CSV caches
 */
async function clearAllCSVCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (allData) => {
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith('csv_cache_'));
      
      if (cacheKeys.length === 0) {
        console.log('[CSV CLV] 💾 No CSV caches to clear');
        resolve();
        return;
      }
      
      chrome.storage.local.remove(cacheKeys, () => {
        console.log(`[CSV CLV] 💾 Cleared ${cacheKeys.length} CSV caches`);
        resolve();
      });
    });
  });
}

/**
 * Match bet to CSV row using fuzzy team name matching
 * @param {Object} bet - Bet object with event, eventTime fields
 * @param {Array} csvRows - Parsed CSV rows
 * @returns {Object|null} { row, confidence } or null if no match
 */
function matchBetToCSVRow(bet, csvRows) {
  if (!bet.event || !csvRows || csvRows.length === 0) {
    return null;
  }
  
  // Parse event name into home/away teams
  // Formats: "TeamA vs TeamB", "TeamA - TeamB", "TeamA v TeamB"
  const eventNormalized = bet.event.toLowerCase().trim();
  const vsPatterns = [' vs ', ' v ', ' - ', ' @ '];
  
  let homeTeam = null;
  let awayTeam = null;
  
  for (const pattern of vsPatterns) {
    if (eventNormalized.includes(pattern)) {
      const parts = eventNormalized.split(pattern);
      if (parts.length === 2) {
        homeTeam = parts[0].trim();
        awayTeam = parts[1].trim();
        break;
      }
    }
  }
  
  if (!homeTeam || !awayTeam) {
    console.warn(`[CSV CLV] ⚠️ Could not parse event: "${bet.event}"`);
    return null;
  }
  
  // Normalize team names using existing fuzzyMatcher.js functions
  // normalizeTeamName() and similarityScore() are expected to be loaded from fuzzyMatcher.js
  // in the background service worker context (see manifest.json)
  if (typeof normalizeTeamName === 'function') {
    homeTeam = normalizeTeamName(homeTeam);
    awayTeam = normalizeTeamName(awayTeam);
  } else {
    console.warn('[CSV CLV] ⚠️ normalizeTeamName not available - basic matching only');
  }
  
  // Get event date
  const betDate = new Date(bet.eventTime || bet.timestamp);
  
  // Search CSV rows for best match
  let bestMatch = null;
  let bestScore = 0;
  
  if (csvRows.length === 0) {
    console.warn(`[CSV CLV] ⚠️ CSV has no rows to match against for: ${bet.event}`);
    return null;
  }
  
  for (const row of csvRows) {
    if (!row.HomeTeam || !row.AwayTeam || !row.DateISO) continue;
    
    // Normalize CSV team names
    let csvHome = row.HomeTeam.toLowerCase().trim();
    let csvAway = row.AwayTeam.toLowerCase().trim();
    
    if (typeof normalizeTeamName === 'function') {
      csvHome = normalizeTeamName(csvHome);
      csvAway = normalizeTeamName(csvAway);
    }
    
    // Calculate similarity scores using fuzzyMatcher.js similarityScore()
    // Falls back to exact string match if function not available
    const homeSimilarity = typeof similarityScore === 'function' 
      ? similarityScore(homeTeam, csvHome)
      : (homeTeam === csvHome ? 1.0 : 0.0);
      
    const awaySimilarity = typeof similarityScore === 'function'
      ? similarityScore(awayTeam, csvAway)
      : (awayTeam === csvAway ? 1.0 : 0.0);
    
    // Date proximity (±1 day tolerance)
    const csvDate = new Date(row.DateISO);
    const daysDiff = Math.abs((betDate - csvDate) / (1000 * 60 * 60 * 24));
    const dateScore = daysDiff <= 1 ? 1.0 : Math.max(0, 1.0 - (daysDiff - 1) * 0.2);
    
    // Combined score (teams: 80%, date: 20%)
    const score = (homeSimilarity * 0.4 + awaySimilarity * 0.4 + dateScore * 0.2);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }
  
  // Require minimum 50% confidence (lowered from 70% to capture more valid matches)
  if (bestScore < 0.50) {
    console.warn(`[CSV CLV] ⚠️ Low confidence match (${(bestScore * 100).toFixed(1)}%) for: ${bet.event}`);
    console.warn(`[CSV CLV] ⚠️ Best match was: "${bestMatch?.HomeTeam} vs ${bestMatch?.AwayTeam}" on ${bestMatch?.DateISO}`);
    console.warn(`[CSV CLV] ⚠️ Parsed teams: Home="${homeTeam}", Away="${awayTeam}"`);
    return null;
  }
  
  console.log(`[CSV CLV] ✅ Matched "${bet.event}" → "${bestMatch.HomeTeam} vs ${bestMatch.AwayTeam}" (${(bestScore * 100).toFixed(1)}% confidence)`);
  
  return {
    row: bestMatch,
    confidence: bestScore
  };
}

/**
 * Detect market type from bet data
 * @param {Object} bet - Bet object with market field
 * @returns {Object} { type: '1X2'|'OU'|'AH'|'unknown', details: {...} }
 */
function detectMarketType(bet) {
  if (!bet || !bet.market) {
    return { type: 'unknown', details: null };
  }
  
  const market = bet.market.toLowerCase().trim();
  
  // Over/Under 2.5 patterns
  const ouPatterns = [
    /over.*2\.?5/i,
    /under.*2\.?5/i,
    /o\/u.*2\.?5/i,
    /total.*goals.*2\.?5/i,
    /\bover\b/i,  // Generic "over"
    /\bunder\b/i  // Generic "under"
  ];
  
  for (const pattern of ouPatterns) {
    if (pattern.test(market)) {
      const isOver = /over|o\/u/i.test(market) && !/under/i.test(market);
      return { 
        type: 'OU', 
        details: { 
          direction: isOver ? 'over' : 'under',
          line: 2.5 // Currently only 2.5 supported
        } 
      };
    }
  }
  
  // Asian Handicap patterns
  const ahPatterns = [
    /asian.*handicap/i,
    /\bah\b/i,
    /handicap.*[-+]?\d+\.?\d*/i,
    /[-+]\d+\.?\d*.*handicap/i
  ];
  
  for (const pattern of ahPatterns) {
    if (pattern.test(market)) {
      // Try to extract handicap value (e.g., "-0.5", "+1.0")
      const handicapMatch = market.match(/([-+]?\d+\.?\d*)/);
      const handicap = handicapMatch ? parseFloat(handicapMatch[1]) : null;
      
      return { 
        type: 'AH', 
        details: { 
          handicap: handicap,
          team: market.includes('home') ? 'home' : market.includes('away') ? 'away' : null
        } 
      };
    }
  }
  
  // 1X2 (Match Odds) - most common, default assumption
  const matchOddsPatterns = [
    /\bhome\b/i,
    /\bdraw\b/i,
    /\baway\b/i,
    /\b1x2\b/i,
    /\bwin\b/i,
    /\btie\b/i,
    /^[hxda12]$/i  // Single character markets
  ];
  
  for (const pattern of matchOddsPatterns) {
    if (pattern.test(market)) {
      let selection = 'unknown';
      if (/home|^1$|^h$/i.test(market)) selection = 'home';
      else if (/draw|^x$|^d$|tie/i.test(market)) selection = 'draw';
      else if (/away|^2$|^a$/i.test(market)) selection = 'away';
      
      return { type: '1X2', details: { selection } };
    }
  }
  
  // Default: assume 1X2 if no other pattern matches
  return { type: '1X2', details: { selection: 'unknown' } };
}

/**
 * Extract closing odds from CSV row based on bet market
 * @param {Object} csvRow - Matched CSV row
 * @param {Object} bet - Full bet object (for market detection)
 * @returns {number|null} Closing odds or null
 */
function extractClosingOdds(csvRow, bet) {
  if (!csvRow || !bet) return null;
  
  const marketInfo = detectMarketType(bet);
  console.log(`[CSV CLV] 📊 Detected market: ${marketInfo.type}`, marketInfo.details);
  
  let closingOdds = null;
  
  if (marketInfo.type === '1X2') {
    // Match odds (Home/Draw/Away)
    const selection = marketInfo.details?.selection?.toLowerCase();
    
    if (selection === 'home') {
      closingOdds = csvRow.PSCH; // Pinnacle Closing Home
    } else if (selection === 'draw') {
      closingOdds = csvRow.PSCD; // Pinnacle Closing Draw
    } else if (selection === 'away') {
      closingOdds = csvRow.PSCA; // Pinnacle Closing Away
    }
    
    if (!closingOdds) {
      console.warn(`[CSV CLV] ⚠️ No 1X2 closing odds for selection: "${bet.market}"`);
    }
    
  } else if (marketInfo.type === 'OU') {
    // Over/Under 2.5 goals
    const direction = marketInfo.details?.direction;
    
    if (direction === 'over') {
      // Try closing first (PC>2.5), fall back to opening (P>2.5)
      closingOdds = csvRow['PC>2.5'] || csvRow['P>2.5'];
    } else if (direction === 'under') {
      // Try closing first (PC<2.5), fall back to opening (P<2.5)
      closingOdds = csvRow['PC<2.5'] || csvRow['P<2.5'];
    }
    
    if (!closingOdds) {
      console.warn(`[CSV CLV] ⚠️ No O/U 2.5 odds available for "${bet.market}" (CSV may not include this market)`);
      return null;
    }
    
    if (closingOdds === csvRow['P>2.5'] || closingOdds === csvRow['P<2.5']) {
      console.log(`[CSV CLV] ℹ️ Using opening odds for O/U (no closing odds in CSV)`);
    }
    
  } else if (marketInfo.type === 'AH') {
    // Asian Handicap
    const team = marketInfo.details?.team;
    const handicap = marketInfo.details?.handicap;
    
    // Check if CSV row's handicap matches bet's handicap
    if (csvRow.PAH !== undefined && handicap !== null && Math.abs(csvRow.PAH - handicap) > 0.01) {
      console.warn(`[CSV CLV] ⚠️ Handicap mismatch: bet has ${handicap}, CSV has ${csvRow.PAH}`);
      return null;
    }
    
    if (team === 'home') {
      // Try closing first (PCAHH), fall back to opening (PAHH)
      closingOdds = csvRow.PCAHH || csvRow.PAHH;
    } else if (team === 'away') {
      // Try closing first (PCAHA), fall back to opening (PAHA)
      closingOdds = csvRow.PCAHA || csvRow.PAHA;
    }
    
    if (!closingOdds) {
      console.warn(`[CSV CLV] ⚠️ No Asian Handicap odds available for "${bet.market}" (CSV may not include this market)`);
      return null;
    }
    
    if (closingOdds === csvRow.PAHH || closingOdds === csvRow.PAHA) {
      console.log(`[CSV CLV] ℹ️ Using opening odds for AH (no closing odds in CSV)`);
    }
    
  } else {
    console.warn(`[CSV CLV] ⚠️ Unknown market type: "${bet.market}"`);
    return null;
  }
  
  if (!closingOdds || isNaN(closingOdds)) {
    console.warn(`[CSV CLV] ⚠️ Invalid closing odds for market: "${bet.market}"`);
    return null;
  }
  
  return closingOdds;
}

/**
 * Calculate Closing Line Value (CLV)
 * @param {number} openingOdds - Odds when bet was placed
 * @param {number} closingOdds - Pinnacle closing odds from CSV
 * @returns {number} CLV percentage (positive = beat closing line)
 */
function calculateCLV(openingOdds, closingOdds) {
  if (!openingOdds || !closingOdds || openingOdds <= 0 || closingOdds <= 0) {
    return null;
  }
  
  // Formula: ((opening / closing) - 1) × 100
  const clv = ((openingOdds / closingOdds) - 1) * 100;
  
  return parseFloat(clv.toFixed(2));
}

/**
 * Fetch CLV for a bet using CSV data
 * @param {Object} bet - Bet object
 * @returns {Promise<Object|null>} { closingOdds, clv, source: 'csv' } or { error: string }
 */
async function fetchClvForBet(bet) {
  console.log(`[CSV CLV] 📈 Fetching CLV for: ${bet.event}`);
  
  // 0. Check if CLV tracking is enabled in settings
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get({ clvSettings: { enabled: false } }, resolve);
  });
  
  if (!settings.clvSettings?.enabled) {
    console.log(`[CSV CLV] ⚠️ CLV tracking disabled in settings`);
    return { error: 'clv_disabled' };
  }
  
  // 1. Check if football
  if (bet.sport !== 'Football') {
    console.log(`[CSV CLV] ⚠️ Sport "${bet.sport}" not supported (football only)`);
    return { error: 'non_football_sport' };
  }
  
  // 2. Check if tournament is known to be unsupported
  if (typeof isUnsupportedTournament === 'function' && isUnsupportedTournament(bet.tournament)) {
    console.log(`[CSV CLV] ℹ️ Tournament "${bet.tournament}" is not covered by CSV data (international/cup competition)`);
    console.log(`[CSV CLV] ℹ️ Event: ${bet.event}`);
    return { error: 'league_not_supported', message: 'International/cup competitions not covered', details: { tournament: bet.tournament, event: bet.event } };
  }
  
  // 3. Map tournament to league code
  const leagueCode = mapTournamentToLeague(bet.tournament);
  if (!leagueCode) {
    console.warn(`[CSV CLV] ⚠️ Tournament "${bet.tournament}" not mapped to CSV league`);
    console.warn(`[CSV CLV] ℹ️ Event: ${bet.event}`);
    return { error: 'league_not_supported', message: 'League mapping not found', details: { tournament: bet.tournament, event: bet.event } };
  }
  
  console.log(`[CSV CLV] ✅ Mapped "${bet.tournament}" → ${leagueCode}`);
  
  // 4. Detect season
  const season = detectSeason(bet.eventTime || bet.timestamp);
  console.log(`[CSV CLV] ✅ Season: ${season}`);
  
  // 5. Get CSV (cached or download)
  let csvRows = await getCachedCSV(leagueCode, season);
  
  if (!csvRows) {
    const csvText = await downloadCSV(leagueCode, season);
    if (!csvText) {
      console.error(`[CSV CLV] ❌ Failed to download CSV for ${leagueCode} ${season}`);
      return { error: 'csv_download_failed' };
    }
    
    csvRows = parseFootballDataCSV(csvText);
    if (!csvRows || csvRows.length === 0) {
      console.error(`[CSV CLV] ❌ Failed to parse CSV for ${leagueCode} ${season}`);
      return { error: 'csv_parse_failed' };
    }
    
    // Cache for future use
    await cacheCSV(leagueCode, season, csvRows);
  }
  
  // 6. Match bet to CSV row
  const match = matchBetToCSVRow(bet, csvRows);
  if (!match) {
    console.warn(`[CSV CLV] ⚠️ No match found in CSV for: ${bet.event} (${bet.tournament})`);
    console.warn(`[CSV CLV] ⚠️ Searched ${csvRows.length} rows in ${leagueCode} ${season}`);
    return { error: 'match_not_found', details: { event: bet.event, tournament: bet.tournament, league: leagueCode } };
  }
  
  // 7. Extract closing odds (pass full bet object for market detection)
  const closingOdds = extractClosingOdds(match.row, bet);
  if (!closingOdds) {
    console.warn(`[CSV CLV] ⚠️ No closing odds for market: ${bet.market}`);
    return { error: 'closing_odds_missing' };
  }
  
  console.log(`[CSV CLV] ✅ Closing odds: ${closingOdds} (opened: ${bet.odds})`);
  
  // 8. Calculate CLV
  const clv = calculateCLV(bet.odds, closingOdds);
  if (clv === null) {
    console.error(`[CSV CLV] ❌ Failed to calculate CLV`);
    return { error: 'clv_calculation_failed' };
  }
  
  console.log(`[CSV CLV] ✅ CLV: ${clv > 0 ? '+' : ''}${clv}%`);
  
  return {
    closingOdds,
    clv,
    source: 'csv',
    confidence: match.confidence,
    csvMatch: {
      homeTeam: match.row.HomeTeam,
      awayTeam: match.row.AwayTeam,
      date: match.row.Date
    }
  };
}

// Export functions for background service worker (importScripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectSeason,
    downloadCSV,
    parseFootballDataCSV,
    getCachedCSV,
    cacheCSV,
    clearAllCSVCache,
    matchBetToCSVRow,
    extractClosingOdds,
    calculateCLV,
    fetchClvForBet
  };
}
