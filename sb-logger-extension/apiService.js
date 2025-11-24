// API service for fetching sports results
// Uses API-Football for football/soccer and The Odds API for other sports

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
    console.log('🔍 Matching event:', bet.event);
    const betEvent = bet.event.toLowerCase().trim();
    // Split on 'vs', 'v', 'at', or 'versus' with surrounding spaces
    const betTeams = betEvent.split(/\s+(?:vs\.?|v\.?|versus|at)\s+/i);
    
    if (betTeams.length !== 2) {
      console.warn('⚠️ Could not parse team names from:', bet.event);
      return null;
    }

    const [team1Raw, team2Raw] = betTeams.map(t => t.trim());
    const team1 = this.normalizeTeamName(team1Raw);
    const team2 = this.normalizeTeamName(team2Raw);
    console.log('🔍 Looking for:', team1, 'vs', team2);

    for (const fixture of fixtures) {
      const homeTeam = this.normalizeTeamName(fixture.teams.home.name);
      const awayTeam = this.normalizeTeamName(fixture.teams.away.name);

      // Try exact match first
      if (homeTeam.includes(team1) && awayTeam.includes(team2)) {
        console.log('✅ Exact match found:', fixture.teams.home.name, 'vs', fixture.teams.away.name);
        return fixture;
      }

      // Try fuzzy match (contains)
      const similarity1 = this.stringSimilarity(team1, homeTeam);
      const similarity2 = this.stringSimilarity(team2, awayTeam);

      if (similarity1 > 0.7 && similarity2 > 0.7) {
        console.log('✅ Fuzzy match found:', fixture.teams.home.name, 'vs', fixture.teams.away.name, `(${(similarity1*100).toFixed(0)}%, ${(similarity2*100).toFixed(0)}%)`);
        return fixture;
      }
    }

    console.warn('❌ No match found for:', bet.event);
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

  // Process a batch of bets and check for results
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
  self.ApiService = ApiService;
  console.log('✅ ApiService class loaded and available');
}

// Provide CommonJS fallback for tests or tooling if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiService, API_CONFIG };
}
