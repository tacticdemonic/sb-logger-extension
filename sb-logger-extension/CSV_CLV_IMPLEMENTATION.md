# CSV-Based CLV Tracking Implementation Plan

## Overview
Replace the OddsHarvester API approach with FREE CSV downloads from football-data.co.uk as the **only** CLV tracking method. This provides Pinnacle closing odds for 22 major European football leagues at no cost.

## Goals
- ✅ Eliminate dependency on local Python API server
- ✅ Provide FREE CLV tracking for football bets
- ✅ Leverage existing extension infrastructure (fuzzy matching, storage, retry logic)
- ✅ Cover 22 European football leagues (90%+ of user bets)
- ✅ Maintain existing CLV UI (badges, charts, analysis)

## Data Source: football-data.co.uk

### CSV Format
```
Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,PSH,PSD,PSA,PSCH,PSCD,PSCA,...
E0,15/08/2025,15:00,Arsenal,Crystal Palace,2,1,H,1.50,4.50,7.00,1.45,4.75,7.50,...
```

**Key Columns:**
- `Div` - Division/League code (E0, E1, SP1, etc.)
- `Date` - Match date (dd/mm/yy format)
- `HomeTeam` / `AwayTeam` - Team names
- `PSH` / `PSD` / `PSA` - Pinnacle opening odds (Home/Draw/Away)
- `PSCH` / `PSCD` / `PSCA` - Pinnacle **closing odds** (Home/Draw/Away) ✅

### URL Pattern
```
https://www.football-data.co.uk/mmz4281/{season}/{league}.csv
```

**Examples:**
- Premier League 2024-2025: `https://www.football-data.co.uk/mmz4281/2425/E0.csv`
- La Liga 2024-2025: `https://www.football-data.co.uk/mmz4281/2425/SP1.csv`

**Season Format:** "YYZZ" where YY=start year suffix, ZZ=end year suffix
- 2024-2025 season = "2425"
- 2023-2024 season = "2324"

### Supported Leagues (22 Total)

| Code | League | Country |
|------|--------|---------|
| E0 | Premier League | England |
| E1 | Championship | England |
| E2 | League One | England |
| E3 | League Two | England |
| EC | National League | England |
| SC0 | Premiership | Scotland |
| SC1 | Championship | Scotland |
| SC2 | League One | Scotland |
| SC3 | League Two | Scotland |
| D1 | Bundesliga | Germany |
| D2 | Bundesliga 2 | Germany |
| SP1 | La Liga | Spain |
| SP2 | Segunda Division | Spain |
| I1 | Serie A | Italy |
| I2 | Serie B | Italy |
| F1 | Ligue 1 | France |
| F2 | Ligue 2 | France |
| N1 | Eredivisie | Netherlands |
| B1 | First Division | Belgium |
| P1 | Primeira Liga | Portugal |
| G1 | Super League | Greece |
| T1 | Super Lig | Turkey |

## Implementation Steps

### 1. Create League Mapping System

**File:** `sb-logger-extension/footballDataLeagues.js` (new)

**Purpose:** Map tournament names from surebet.com to CSV league codes

**Structure:**
```javascript
// League database with fuzzy matching keywords
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
      'england - premier league'
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
      'england - championship'
    ]
  },
  // ... 20 more leagues
};

// Main function: tournament name → league code
function mapTournamentToLeague(tournamentName) {
  if (!tournamentName) return null;
  
  const normalized = tournamentName.toLowerCase().trim();
  
  // Exact match first
  for (const [code, league] of Object.entries(FOOTBALL_DATA_LEAGUES)) {
    if (league.aliases.includes(normalized)) {
      return code;
    }
  }
  
  // Fuzzy match (partial substring)
  for (const [code, league] of Object.entries(FOOTBALL_DATA_LEAGUES)) {
    for (const alias of league.aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return code;
      }
    }
  }
  
  return null;
}

// Helper: Get league metadata
function getLeagueInfo(leagueCode) {
  return FOOTBALL_DATA_LEAGUES[leagueCode] || null;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapTournamentToLeague, getLeagueInfo, FOOTBALL_DATA_LEAGUES };
}
```

**Testing:**
```javascript
mapTournamentToLeague('Premier League') // → 'E0'
mapTournamentToLeague('EPL') // → 'E0'
mapTournamentToLeague('La Liga') // → 'SP1'
mapTournamentToLeague('England - Championship') // → 'E1'
```

---

### 2. Build CSV Fetcher & Parser

**File:** `sb-logger-extension/csvClvService.js` (new)

**Purpose:** Download, parse, cache CSV files; match bets to CSV rows; calculate CLV

#### 2.1 Season Detection

```javascript
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

// Examples:
// detectSeason('2024-07-15') → '2425' (July 2024 = 2024-2025 season start)
// detectSeason('2024-09-15') → '2425' (Sept 2024 = 2024-2025 season)
// detectSeason('2025-03-20') → '2425' (March 2025 = 2024-2025 season)
// detectSeason('2025-06-10') → '2526' (June 2025 = 2025-2026 season prep)
// detectSeason('2025-08-10') → '2526' (Aug 2025 = 2025-2026 season)
```

#### 2.2 CSV Download

```javascript
/**
 * Download CSV from football-data.co.uk
 * @param {string} leagueCode - E0, E1, SP1, etc.
 * @param {string} season - "2425", "2324", etc.
 * @returns {Promise<string>} CSV text content
 */
async function downloadCSV(leagueCode, season) {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${leagueCode}.csv`;
  
  console.log(`📥 Downloading CSV: ${leagueCode} ${season} from ${url}`);
  
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
        console.warn(`⚠️ CSV not found: ${url} (league/season may not exist yet)`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      console.warn(`⚠️ Empty CSV received: ${url}`);
      return null;
    }
    
    console.log(`✅ Downloaded ${csvText.length} bytes for ${leagueCode} ${season}`);
    return csvText;
    
  } catch (error) {
    console.error(`❌ CSV download failed for ${leagueCode} ${season}:`, error.message);
    return null;
  }
}
```

#### 2.3 CSV Parsing

```javascript
/**
 * Parse football-data.co.uk CSV into structured rows
 * @param {string} csvText - Raw CSV content
 * @returns {Array<Object>} Parsed rows with columns as properties
 */
function parseFootballDataCSV(csvText) {
  if (!csvText) return [];
  
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    console.warn('⚠️ CSV has no data rows');
    return [];
  }
  
  // NOTE: Simple comma-split parser (sufficient for football-data.co.uk)
  // Limitation: Does not handle quoted fields with embedded commas
  // football-data.co.uk uses simple format without quotes, so this works
  // If format changes to include team names like "Arsenal, FC", upgrade to RFC 4180 parser
  
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
    PSCH: header.indexOf('PSCH'), // Pinnacle CLOSING home odds ✅
    PSCD: header.indexOf('PSCD'), // Pinnacle CLOSING draw odds ✅
    PSCA: header.indexOf('PSCA')  // Pinnacle CLOSING away odds ✅
  };
  
  // Validate required columns exist
  const missingCols = Object.entries(colIndices)
    .filter(([col, idx]) => idx === -1)
    .map(([col]) => col);
  
  if (missingCols.length > 0) {
    console.error(`❌ CSV missing required columns: ${missingCols.join(', ')}`);
    return [];
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
      // This supports football-data.co.uk historical data back to 1998
      let fullYear;
      if (year.length === 2) {
        const yearNum = parseInt(year, 10);
        fullYear = yearNum >= 50 ? `19${year}` : `20${year}`;
      } else {
        fullYear = year;
      }
      row.DateISO = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Parse odds as floats
    ['PSH', 'PSD', 'PSA', 'PSCH', 'PSCD', 'PSCA'].forEach(col => {
      if (row[col]) {
        row[col] = parseFloat(row[col]);
      }
    });
    
    rows.push(row);
  }
  
  console.log(`✅ Parsed ${rows.length} matches from CSV`);
  return rows;
}
```

#### 2.4 CSV Caching

```javascript
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
        console.log(`💾 No cache for ${leagueCode} ${season}`);
        resolve(null);
        return;
      }
      
      // Smart expiry strategy:
      // - Current season: refresh every 7 days (data updates weekly)
      // - Historical seasons: never expire (data is immutable)
      const currentSeason = detectSeason(new Date());
      const isHistorical = season !== currentSeason;
      
      if (isHistorical) {
        console.log(`✅ Cache hit (historical): ${leagueCode} ${season} (${cache.rows.length} rows, permanent)`);
        resolve(cache.rows);
        return;
      }
      
      // Current season: check 7-day expiry
      const now = Date.now();
      const age = now - cache.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (age > maxAge) {
        console.log(`💾 Cache expired for ${leagueCode} ${season} (${Math.floor(age / 86400000)} days old)`);
        resolve(null);
        return;
      }
      
      console.log(`✅ Cache hit (current season): ${leagueCode} ${season} (${cache.rows.length} rows, ${Math.floor(age / 3600000)}h old)`);
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
      console.log(`💾 Cached ${rows.length} rows for ${leagueCode} ${season}`);
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
        console.log('💾 No CSV caches to clear');
        resolve();
        return;
      }
      
      chrome.storage.local.remove(cacheKeys, () => {
        console.log(`💾 Cleared ${cacheKeys.length} CSV caches`);
        resolve();
      });
    });
  });
}
```

#### 2.5 Team Name Matching

**Dependencies:** This function requires `fuzzyMatcher.js` to be loaded in the background service worker context (via `importScripts()` in background.js). The following functions must be available:
- `normalizeTeamName(teamName)` - Expands abbreviations ("Man City" → "Manchester City"), normalizes casing
- `stringSimilarity(str1, str2)` - Returns 0.0-1.0 similarity score using Levenshtein distance

If these functions are not available, the matcher falls back to basic exact string comparison.

```javascript
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
    console.warn(`⚠️ Could not parse event: "${bet.event}"`);
    return null;
  }
  
  // Normalize team names using existing fuzzyMatcher.js functions
  // normalizeTeamName() and stringSimilarity() are expected to be loaded from fuzzyMatcher.js
  // in the background service worker context (see manifest.json)
  if (typeof normalizeTeamName === 'function') {
    homeTeam = normalizeTeamName(homeTeam);
    awayTeam = normalizeTeamName(awayTeam);
  } else {
    console.warn('⚠️ normalizeTeamName not available - basic matching only');
  }
  
  // Get event date
  const betDate = new Date(bet.eventTime || bet.timestamp);
  
  // Search CSV rows for best match
  let bestMatch = null;
  let bestScore = 0;
  
  for (const row of csvRows) {
    if (!row.HomeTeam || !row.AwayTeam || !row.DateISO) continue;
    
    // Normalize CSV team names
    let csvHome = row.HomeTeam.toLowerCase().trim();
    let csvAway = row.AwayTeam.toLowerCase().trim();
    
    if (typeof normalizeTeamName === 'function') {
      csvHome = normalizeTeamName(csvHome);
      csvAway = normalizeTeamName(csvAway);
    }
    
    // Calculate similarity scores using fuzzyMatcher.js stringSimilarity()
    // Falls back to exact string match if function not available
    const homeSimilarity = typeof stringSimilarity === 'function' 
      ? stringSimilarity(homeTeam, csvHome)
      : (homeTeam === csvHome ? 1.0 : 0.0);
      
    const awaySimilarity = typeof stringSimilarity === 'function'
      ? stringSimilarity(awayTeam, csvAway)
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
  
  // Require minimum 70% confidence
  if (bestScore < 0.70) {
    console.warn(`⚠️ Low confidence match (${(bestScore * 100).toFixed(1)}%) for: ${bet.event}`);
    return null;
  }
  
  console.log(`✅ Matched "${bet.event}" → "${bestMatch.HomeTeam} vs ${bestMatch.AwayTeam}" (${(bestScore * 100).toFixed(1)}% confidence)`);
  
  return {
    row: bestMatch,
    confidence: bestScore
  };
}
```

#### 2.6 Extract Closing Odds

```javascript
/**
 * Extract closing odds from CSV row based on bet market
 * @param {Object} csvRow - Matched CSV row
 * @param {string} betMarket - Bet selection (e.g., "Home", "Draw", "Away", "1", "X", "2")
 * @returns {number|null} Closing odds or null
 */
function extractClosingOdds(csvRow, betMarket) {
  if (!csvRow || !betMarket) return null;
  
  const marketNormalized = betMarket.toLowerCase().trim();
  
  // Map market to closing odds column
  let closingOdds = null;
  
  // Home market
  if (['home', '1', 'h', 'home win'].includes(marketNormalized)) {
    closingOdds = csvRow.PSCH; // Pinnacle Closing Home
  }
  // Draw market
  else if (['draw', 'x', 'd', 'tie'].includes(marketNormalized)) {
    closingOdds = csvRow.PSCD; // Pinnacle Closing Draw
  }
  // Away market
  else if (['away', '2', 'a', 'away win'].includes(marketNormalized)) {
    closingOdds = csvRow.PSCA; // Pinnacle Closing Away
  }
  // Complex markets (partial match)
  else if (marketNormalized.includes('home')) {
    closingOdds = csvRow.PSCH;
  } else if (marketNormalized.includes('draw')) {
    closingOdds = csvRow.PSCD;
  } else if (marketNormalized.includes('away')) {
    closingOdds = csvRow.PSCA;
  }
  
  if (!closingOdds || isNaN(closingOdds)) {
    console.warn(`⚠️ No closing odds for market: "${betMarket}" - only 1X2 (Home/Draw/Away) markets supported`);
    return null;
  }
  
  return closingOdds;
}

// NOTE: Currently only supports 1X2 (Match Odds) markets
// Other markets (Over/Under, Both Teams to Score, Correct Score, etc.) are NOT supported
// These bets will show "CLV: N/A" in the UI
```

#### 2.7 Calculate CLV

```javascript
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
  // Example: Bet at 2.00, closed at 1.80 → ((2.00/1.80)-1)×100 = +11.1% CLV
  const clv = ((openingOdds / closingOdds) - 1) * 100;
  
  return parseFloat(clv.toFixed(2));
}

// Examples:
// calculateCLV(2.00, 1.80) → +11.11 (positive CLV - beat closing line)
// calculateCLV(1.95, 2.10) → -7.14 (negative CLV - worse than closing)
```

#### 2.8 Main CLV Fetch Function

```javascript
/**
 * Fetch CLV for a bet using CSV data
 * @param {Object} bet - Bet object
 * @returns {Promise<Object|null>} { closingOdds, clv, source: 'csv' } or null
 */
async function fetchClvForBet(bet) {
  console.log(`📈 Fetching CLV for: ${bet.event}`);
  
  // 0. Check if CLV tracking is enabled in settings
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get({ clvEnabled: false }, resolve);
  });
  
  if (!settings.clvEnabled) {
    console.log(`⚠️ CLV tracking disabled in settings`);
    return { error: 'clv_disabled' };
  }
  
  // 1. Check if football
  if (bet.sport !== 'Football') {
    console.log(`⚠️ Sport "${bet.sport}" not supported (football only)`);
    return { error: 'non_football_sport' };
  }
  
  // 2. Map tournament to league code
  const leagueCode = mapTournamentToLeague(bet.tournament);
  if (!leagueCode) {
    console.warn(`⚠️ Tournament "${bet.tournament}" not mapped to CSV league`);
    return { error: 'league_not_supported' };
  }
  
  console.log(`✅ Mapped "${bet.tournament}" → ${leagueCode}`);
  
  // 3. Detect season
  const season = detectSeason(bet.eventTime || bet.timestamp);
  console.log(`✅ Season: ${season}`);
  
  // 4. Get CSV (cached or download)
  let csvRows = await getCachedCSV(leagueCode, season);
  
  if (!csvRows) {
    const csvText = await downloadCSV(leagueCode, season);
    if (!csvText) {
      console.error(`❌ Failed to download CSV for ${leagueCode} ${season}`);
      return { error: 'csv_download_failed' };
    }
    
    csvRows = parseFootballDataCSV(csvText);
    if (!csvRows || csvRows.length === 0) {
      console.error(`❌ Failed to parse CSV for ${leagueCode} ${season}`);
      return { error: 'csv_parse_failed' };
    }
    
    // Cache for future use
    await cacheCSV(leagueCode, season, csvRows);
  }
  
  // 5. Match bet to CSV row
  const match = matchBetToCSVRow(bet, csvRows);
  if (!match) {
    console.warn(`⚠️ No match found in CSV for: ${bet.event}`);
    return { error: 'match_not_found' };
  }
  
  // 6. Extract closing odds
  const closingOdds = extractClosingOdds(match.row, bet.market);
  if (!closingOdds) {
    console.warn(`⚠️ No closing odds for market: ${bet.market}`);
    return { error: 'closing_odds_missing' };
  }
  
  console.log(`✅ Closing odds: ${closingOdds} (opened: ${bet.odds})`);
  
  // 7. Calculate CLV
  const clv = calculateCLV(bet.odds, closingOdds);
  if (clv === null) {
    console.error(`❌ Failed to calculate CLV`);
    return { error: 'clv_calculation_failed' };
  }
  
  console.log(`✅ CLV: ${clv > 0 ? '+' : ''}${clv}%`);
  
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
```

---

### 3. Integrate with Background.js

**File:** `sb-logger-extension/background.js`

**Changes:**

1. **Add CSV service script to manifest** (already done via import)

2. **Replace existing CLV fetch logic** (around line 1471-1650)

**Before:**
```javascript
async function fetchClvForBet(bet) {
  // OLD: Call localhost:8765 API server
  const response = await fetch('http://127.0.0.1:8765/api/clv', { ... });
  // ... OddsHarvester scraping logic
}
```

**After:**
```javascript
async function fetchClvForBet(bet) {
  // NEW: Use CSV service
  const result = await csvClvService.fetchClvForBet(bet);
  
  if (result && !result.error) {
    return {
      closingOdds: result.closingOdds,
      clv: result.clv,
      clvSource: 'csv',
      clvFetchedAt: new Date().toISOString(),
      csvConfidence: result.confidence
    };
  }
  
  // Handle errors
  console.error('❌ CLV fetch failed:', result?.error);
  return null;
}
```

3. **Update CLV check alarm** (keep existing retry logic)

```javascript
// Triggered every 4 hours (configurable)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'clv-check') {
    console.log('⏰ CLV check alarm triggered');
    
    // Check if CLV tracking is enabled
    const settings = await new Promise((resolve) => {
      chrome.storage.local.get({ clvEnabled: false }, resolve);
    });
    
    if (!settings.clvEnabled) {
      console.log('⏰ CLV tracking disabled - skipping check');
      return;
    }
    
    // Get all settled bets without CLV
    const bets = await getBets();
    const needsClv = bets.filter(bet => 
      bet.status !== 'pending' && 
      bet.sport === 'Football' && // Only football supported
      !bet.closingOdds &&
      (bet.clvRetryCount || 0) < 3 // Max 3 retries
    );
    
    console.log(`📊 Found ${needsClv.length} bets needing CLV`);
    
    for (const bet of needsClv) {
      const result = await fetchClvForBet(bet);
      
      if (result) {
        bet.closingOdds = result.closingOdds;
        bet.clv = result.clv;
        bet.clvSource = result.clvSource;
        bet.clvFetchedAt = result.clvFetchedAt;
        bet.csvConfidence = result.csvConfidence;
        bet.clvRetryCount = 0; // Reset on success
      } else {
        bet.clvRetryCount = (bet.clvRetryCount || 0) + 1;
        bet.clvLastRetry = new Date().toISOString();
      }
    }
    
    await saveBets(bets);
    console.log(`✅ CLV check complete`);
  }
});
```

---

### 4. Update Settings UI

**File:** `sb-logger-extension/settings.html`

**Add new CLV section (minimal):**

```html
<!-- CLV Tracking Section -->
<div id="clv-section" class="section-container">
  <h2>CLV Tracking (Closing Line Value)</h2>
  
  <div class="info-box">
    <strong>What is CLV?</strong><br>
    CLV measures if you're getting better odds than the market's closing line. Positive CLV indicates long-term profitable betting.
  </div>
  
  <!-- Enable Toggle -->
  <div class="form-group">
    <label class="form-group-checkbox">
      <input type="checkbox" id="clv-enabled" />
      <span style="font-weight: 600;">Enable CLV Tracking</span>
    </label>
    <p class="note">Uses FREE CSV data from football-data.co.uk (no API needed)</p>
  </div>
  
  <!-- Coverage Info -->
  <div style="background: #d4edda; padding: 15px; border-radius: 4px; border-left: 4px solid #28a745; margin-bottom: 20px;">
    <div style="font-weight: 600; margin-bottom: 10px; color: #155724;">Supported: 22 European Football Leagues</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
      <div>England: Premier League</div>
      <div>England: Championship</div>
      <div>Spain: La Liga</div>
      <div>Spain: Segunda Division</div>
      <div>Germany: Bundesliga</div>
      <div>Germany: Bundesliga 2</div>
      <div>Italy: Serie A</div>
      <div>Italy: Serie B</div>
      <div>France: Ligue 1</div>
      <div>France: Ligue 2</div>
      <div>Portugal: Primeira Liga</div>
      <div>Netherlands: Eredivisie</div>
      <div>Belgium: First Division</div>
      <div>Greece: Super League</div>
      <div>Turkey: Super Lig</div>
      <div>Scotland: 4 leagues</div>
      <div>England: League 1/2/National</div>
    </div>
  </div>
  
  <!-- Limitations -->
  <div class="warning-box">
    <strong>WARNING: Football Only</strong><br>
    CLV tracking is currently available for football bets only. Other sports will show "CLV not available".
  </div>
  
  <!-- Cache Management -->
  <div style="margin-top: 20px;">
    <h3 style="margin-top: 0; color: #333; font-size: 14px;">Cache Management</h3>
    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
      Downloaded CSV files are cached for 7 days. Clear cache if you need to force fresh data.
    </p>
    <button id="clear-csv-cache-btn" style="background: #ffc107; color: #000; border-color: #ffc107;">
      Clear CSV Cache
    </button>
    <span id="clear-csv-cache-status" style="margin-left: 10px; font-size: 12px;"></span>
  </div>
  
  <div class="button-row">
    <button class="btn-cancel js-close-window" type="button">Cancel</button>
    <button class="btn-save" id="save-clv-btn">Save Changes</button>
  </div>
</div>
```

**File:** `sb-logger-extension/settings.js`

**Add handlers:**

```javascript
// Load CLV settings
function loadClvSettings() {
  chrome.storage.local.get({ clvEnabled: false }, (result) => {
    document.getElementById('clv-enabled').checked = result.clvEnabled;
  });
}

// Save CLV settings
document.getElementById('save-clv-btn').addEventListener('click', () => {
  const enabled = document.getElementById('clv-enabled').checked;
  
  chrome.storage.local.set({ clvEnabled: enabled }, () => {
    console.log('[CLV Settings] Saved:', { enabled });
    alert('CLV settings saved!');
  });
});

// Clear CSV cache
document.getElementById('clear-csv-cache-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('clear-csv-cache-status');
  statusEl.textContent = 'Clearing...';
  
  // Call CSV service clear function
  if (typeof csvClvService !== 'undefined' && csvClvService.clearAllCSVCache) {
    await csvClvService.clearAllCSVCache();
    statusEl.textContent = '[OK] Cache cleared!';
    setTimeout(() => statusEl.textContent = '', 3000);
  } else {
    statusEl.textContent = '[ERROR] Service not loaded';
  }
});
```

---

### 5. Update Popup Badge Display

**File:** `sb-logger-extension/popup.js`

**Modify `renderClvBadge()` function** (around line 1215):

```javascript
function renderClvBadge(bet, betKey) {
  // Only show CLV for settled bets
  if (bet.status === 'pending') {
    return '';
  }
  
  // Check if CLV data exists
  if (bet.clv !== undefined && bet.clv !== null) {
    const clv = parseFloat(bet.clv);
    const clvColor = clv >= 0 ? '#28a745' : '#dc3545';
    const clvSign = clv >= 0 ? '+' : '';
    
    // Source indicator (safe text alternatives - no emoji for cross-browser compatibility)
    const sourceIcon = bet.clvSource === 'csv' ? '[CSV]' : 
                      bet.clvSource === 'manual' ? '[Manual]' : '[API]';
    
    return `
      <div style="padding: 4px 8px; background: ${clvColor}; color: #fff; border-radius: 3px; font-weight: 600; font-size: 11px; display: inline-block;">
        ${sourceIcon} CLV: ${clvSign}${clv.toFixed(2)}%
      </div>
    `;
  }
  
  // CLV not available
  if (bet.sport !== 'Football') {
    return `
      <div style="padding: 4px 8px; background: #6c757d; color: #fff; border-radius: 3px; font-size: 11px; display: inline-block;">
        CLV: N/A (football only)
      </div>
    `;
  }
  
  // CLV fetch failed (show retry count if >0)
  if (bet.clvRetryCount && bet.clvRetryCount > 0) {
    return `
      <div style="padding: 4px 8px; background: #ffc107; color: #000; border-radius: 3px; font-size: 11px; display: inline-block;">
        [!] CLV: Retry ${bet.clvRetryCount}/3
      </div>
    `;
  }
  
  // Pending CLV fetch
  return `
    <div style="padding: 4px 8px; background: #6c757d; color: #fff; border-radius: 3px; font-size: 11px; display: inline-block;">
      [...] CLV: Pending
    </div>
  `;
}

// Badge behavior summary:
// - Pending bets: No badge (CLV only for settled bets)
// - Settled with CLV: Green/red badge with % and source icon ([CSV], [Manual], [API])
// - Non-football: Gray "CLV: N/A (football only)"
// - Failed with retries: Yellow "[!] CLV: Retry X/3"
// - Pending fetch: Gray "[...] CLV: Pending"
// Note: Using text indicators instead of emoji for cross-browser/encoding compatibility
```

---

### 6. Update Manifest

**File:** `sb-logger-extension/manifest.json`

**Changes:**

1. Remove old CLV scripts from background
2. Add new CSV scripts

```json
{
  "manifest_version": 3,
  "name": "Surebet Helper - Save Bets",
  "version": "1.0.102.0",
  "description": "Track and analyze value bets from surebet.com. Save bets with one click, auto-fill stakes on exchanges, auto-check results, view P/L charts, track CLV (22 European football leagues), and export data.",
  
  "background": {
    "service_worker": "background.js"
  },
  
  "permissions": [
    "storage",
    "alarms",
    "downloads",
    "notifications",
    "tabs",
    "contextMenus",
    "scripting"
  ],
  
  "host_permissions": [
    "https://www.football-data.co.uk/*",
    "https://api.the-odds-api.com/*",
    "https://v3.football.api-sports.io/*",
    "*://*.surebet.com/*",
    "*://*.betfair.com/*",
    "*://*.smarkets.com/*",
    "*://*.matchbook.com/*",
    "*://*.betdaq.com/*"
  ]
}
```

**background.js must import the CSV modules using importScripts():**

```javascript
// At top of background.js (BEFORE any other code)
importScripts('footballDataLeagues.js');
importScripts('csvClvService.js');
importScripts('fuzzyMatcher.js');
// ... existing imports (apiService.js, etc.)

// ... rest of background.js code
```

**Notes:**
- ✅ Manifest V3: Uses `service_worker` (NOT module type - incompatible with importScripts)
- ✅ importScripts(): Standard MV3 pattern for service worker dependencies
- ✅ Permissions: Preserved existing `tabs`, `contextMenus`, `scripting` (needed by extension)
- ✅ Host permissions: **ADDITIVE** - added `football-data.co.uk` to existing domains
- ✅ Keep: API-Sports.io, The Odds API (still used for result checking)
- ✅ Keep: Exchange domains (Betfair, Smarkets, Matchbook, Betdaq) for auto-fill
- ❌ Remove: `clv_debug.js`, `prop_poller.js` from manifest (no longer used)
- ⚠️ Note: Remove `<all_urls>` if present in current manifest (replace with specific hosts above)
- Version bump: 1.0.101.1 → 1.0.102.0

---

## Testing Plan

### Phase 1: Unit Testing

**Test CSV Parsing:**
```javascript
// Download sample CSV
const csvText = await downloadCSV('E0', '2425');
const rows = parseFootballDataCSV(csvText);

console.assert(rows.length > 0, 'Should parse rows');
console.assert(rows[0].PSCH !== null, 'Should have closing odds');
console.assert(rows[0].DateISO, 'Should parse date');
```

**Test Season Detection:**
```javascript
console.assert(detectSeason('2024-07-15') === '2425', 'July 2024 = 2425');
console.assert(detectSeason('2024-09-15') === '2425', 'Sept 2024 = 2425');
console.assert(detectSeason('2025-03-20') === '2425', 'March 2025 = 2425');
console.assert(detectSeason('2025-06-10') === '2526', 'June 2025 = 2526');
console.assert(detectSeason('2025-08-10') === '2526', 'Aug 2025 = 2526');
```

**Test League Mapping:**
```javascript
console.assert(mapTournamentToLeague('Premier League') === 'E0');
console.assert(mapTournamentToLeague('La Liga') === 'SP1');
console.assert(mapTournamentToLeague('Unknown League') === null);
```

**Test CLV Calculation (use approximate equality for floats):**
```javascript
// Helper: assert approximate equality
function assertClose(actual, expected, tolerance = 0.01, msg) {
  const diff = Math.abs(actual - expected);
  console.assert(diff < tolerance, `${msg}: expected ${expected}, got ${actual} (diff: ${diff})`);
}

assertClose(calculateCLV(2.00, 1.80), 11.11, 0.01, 'Positive CLV');
assertClose(calculateCLV(1.95, 2.10), -7.14, 0.01, 'Negative CLV');
assertClose(calculateCLV(1.50, 1.50), 0.00, 0.01, 'No CLV (same odds)');
```

### Phase 2: Integration Testing

**Test with Real Bets:**
1. Create 10 test bets covering different leagues:
   - Premier League (E0)
   - Championship (E1)
   - La Liga (SP1)
   - Bundesliga (D1)
   - Serie A (I1)

2. Run CLV check:
```javascript
for (const bet of testBets) {
  const result = await fetchClvForBet(bet);
  console.log(`${bet.event}: ${result ? result.clv : 'FAILED'}`);
}
```

3. Verify:
   - ✅ League mapping works
   - ✅ CSV downloads successfully
   - ✅ Team name matching ≥70% confidence
   - ✅ CLV calculations accurate
   - ✅ Cache reduces redundant downloads

### Phase 3: User Acceptance Testing

**Test Scenarios:**
1. **New bet saved** → CLV fetched after settlement (2hr delay)
2. **Historical bets** → Bulk CLV check updates all bets
3. **Cache performance** → Second bet in same league uses cache (no download)
4. **Failed match** → Shows retry badge, attempts 3 times
5. **Non-football bet** → Shows "CLV: N/A (football only)"
6. **Settings toggle** → Disabling stops CLV checks

### Phase 4: Performance Testing

**Metrics:**
- CSV download time: <3 seconds per league
- Cache retrieval time: <100ms
- Match confidence: ≥85% for major leagues
- Storage usage: <2MB for 22 cached CSVs
- Memory footprint: <5MB additional

---

## Deployment Checklist

- [ ] Create `footballDataLeagues.js` with all 22 league mappings
- [ ] Create `csvClvService.js` with all functions
- [ ] Update `background.js` to replace API calls with CSV service
- [ ] Update `settings.html` with new CLV section
- [ ] Update `settings.js` with handlers
- [ ] Update `popup.js` badge rendering
- [ ] Update `manifest.json` version and scripts
- [ ] Remove old files: `clv_debug.js`, `prop_poller.js`
- [ ] Test with 10 sample bets across leagues
- [ ] Verify cache functionality (no duplicate downloads)
- [ ] Confirm historical season CSVs never expire (permanent cache)
- [ ] Confirm current season CSVs refresh every 7 days
- [ ] Update README with new CLV description
- [ ] Create GitHub release notes for v1.0.102.0

---

## Future Enhancements

### Short-term
- [ ] Add manual league selection dropdown if auto-detection fails
- [ ] Expand league mapping aliases based on real tournament names from user bets
- [ ] Show CSV cache status in settings (# of leagues cached, total size, expiry dates)
- [ ] Export CSV match diagnostics for debugging (team name matching scores)
- [ ] GitHub issue template for unmatched bets with match confidence scores

### Medium-term
- [ ] Support for cup competitions (FA Cup, Champions League) if CSV data added
- [ ] Historical CLV trends chart (track CLV improvement over time)
- [ ] Bookmaker vs Pinnacle closing line comparison
- [ ] Weekly CSV update notification

### Long-term
- [ ] Extend to other sports if CSV sources found
- [ ] Machine learning for team name matching improvement
- [ ] Collaborative database of unmatched team names
- [ ] Browser-independent implementation (Firefox, Safari)

---

## Support & Troubleshooting

### Common Issues

**Issue:** "League not supported"
- **Cause:** Tournament name not in mapping
- **Fix:** Add alias to `footballDataLeagues.js` or submit GitHub issue

**Issue:** "Match not found"
- **Cause:** Team name mismatch or event not in CSV
- **Fix:** Check fuzzy matching confidence, add team abbreviation

**Issue:** "CSV download failed"
- **Cause:** Network error or league/season doesn't exist yet
- **Fix:** Check internet connection, verify season is available on football-data.co.uk

**Issue:** "Closing odds missing" or "CLV: N/A"
- **Cause:** Market not supported (e.g., over/under, both teams to score, correct score, Asian handicap)
- **Fix:** Currently only supports 1X2 (Match Odds) markets (Home/Draw/Away). Other markets cannot be tracked with this CSV data source as Pinnacle closing odds are only available for 1X2. These bets will show "CLV: N/A (market not supported)" in the UI.

### Debug Logging

Enable verbose logging in console:
```javascript
// Add to csvClvService.js
const DEBUG = true;

if (DEBUG) {
  console.log('🔍 DEBUG:', ...);
}
```

### Contact

- GitHub Issues: https://github.com/tacticdemonic/surebet-helper-extension/issues
- Email: surebet-helper@tacticdemonic.github.io

---

**Last Updated:** December 10, 2025  
**Version:** 1.0.102.0  
**Author:** Surebet Helper Team
