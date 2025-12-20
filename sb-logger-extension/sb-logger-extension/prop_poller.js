// Player Props Line Movement Tracker
// Polls The Odds API 3x daily to track line movement for player props
// Uses free tier: 500 requests/month (~16/day budget)

// Browser API compatibility - use propApi to avoid conflicts with background.js
const propApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : {});

const PROP_POLLER_CONFIG = {
  // Polling schedule (local timezone): 8am, 2pm, 8pm
  scheduleHours: [8, 14, 20],
  
  // Rate limiting
  monthlyBudget: 500,
  dailyBudget: 16,
  reserveForManual: 50, // Reserve 50 calls for manual force-checks
  
  // Badge display threshold
  movementThreshold: 5.0, // Only show badges when movement >= 5%
  
  // Priority queue settings
  maxPropsPerPoll: 5, // Limit to 5 props per poll session
  
  // Sport priority (higher number = higher priority during season)
  sportPriority: {
    'americanfootball_nfl': 10,      // NFL (Sep-Feb)
    'basketball_nba': 9,              // NBA (Oct-Jun)
    'baseball_mlb': 8,                // MLB (Apr-Oct)
    'icehockey_nhl': 7,               // NHL (Oct-Jun)
    'basketball_ncaab': 6,            // NCAAB (Nov-Apr)
    'americanfootball_ncaaf': 5       // NCAAF (Aug-Jan)
  }
};

// The Odds API player prop markets mapping
const PROP_MARKETS = {
  'basketball_nba': ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  'americanfootball_nfl': ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions'],
  'baseball_mlb': ['pitcher_strikeouts', 'batter_home_runs', 'batter_hits', 'batter_rbis'],
  'icehockey_nhl': ['player_points', 'player_shots_on_goal', 'player_blocked_shots'],
  'basketball_ncaab': ['player_points', 'player_rebounds', 'player_assists'],
  'americanfootball_ncaaf': ['player_pass_tds', 'player_pass_yds', 'player_rush_yds']
};

/**
 * Get user's local timezone
 */
function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    console.warn('âš ï¸ Could not determine timezone, defaulting to UTC');
    return 'UTC';
  }
}

/**
 * Calculate next poll time based on local schedule
 */
function getNextPollTime() {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Find next schedule hour
  const nextHour = PROP_POLLER_CONFIG.scheduleHours.find(h => h > currentHour) 
                   || PROP_POLLER_CONFIG.scheduleHours[0];
  
  const nextPoll = new Date();
  nextPoll.setHours(nextHour, 0, 0, 0);
  
  // If next hour is earlier than current (wrapped to next day)
  if (nextHour <= currentHour) {
    nextPoll.setDate(nextPoll.getDate() + 1);
  }
  
  return nextPoll;
}

/**
 * Initialize polling alarms
 */
async function initializePropPolling() {
  // Safety check - ensure API is available
  if (!propApi || !propApi.storage || !propApi.alarms) {
    console.warn('⚠️ Browser API not available yet, skipping prop polling initialization');
    return;
  }
  
  console.log('🎯 Initializing player props polling system');
  
  try {
    // Get settings
    const settings = await propApi.storage.local.get({
      propsPollingSettings: { enabled: false },
      apiKeys: {}
    });
    
    if (!settings.propsPollingSettings?.enabled) {
      console.log('⏸️ Player props polling disabled in settings');
      return;
    }
    
    if (!settings.apiKeys.apiOddsKey) {
      console.warn('âš ï¸ The Odds API key not configured');
      return;
    }
    
    // Clear existing alarms
    propApi.alarms.clear('prop-polling-8am');
    propApi.alarms.clear('prop-polling-2pm');
    propApi.alarms.clear('prop-polling-8pm');
    
    // Schedule 3 daily alarms
    const schedules = [
      { name: 'prop-polling-8am', hour: 8 },
      { name: 'prop-polling-2pm', hour: 14 },
      { name: 'prop-polling-8pm', hour: 20 }
    ];
    
    for (const schedule of schedules) {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(schedule.hour, 0, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const delayInMinutes = (scheduledTime - now) / (1000 * 60);
      
      propApi.alarms.create(schedule.name, {
        when: scheduledTime.getTime(),
        periodInMinutes: 24 * 60 // Repeat daily
      });
      
      console.log(`â° Scheduled ${schedule.name} in ${Math.floor(delayInMinutes)} minutes`);
    }
    
    console.log('âœ… Prop polling initialized. Next poll:', getNextPollTime().toLocaleString());
  } catch (error) {
    console.error('âŒ Error initializing prop polling:', error);
    return;
  }
}

/**
 * Get current API usage stats
 */
async function getApiUsageStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const stats = await propApi.storage.local.get({
    propApiUsage: {
      monthlyUsed: 0,
      dailyUsed: 0,
      lastResetMonth: monthStart.toISOString(),
      lastResetDay: dayStart.toISOString(),
      manualUsed: 0
    }
  });
  
  let usage = stats.propApiUsage;
  
  // Reset counters if new month
  if (new Date(usage.lastResetMonth) < monthStart) {
    usage.monthlyUsed = 0;
    usage.manualUsed = 0;
    usage.lastResetMonth = monthStart.toISOString();
  }
  
  // Reset daily counter if new day
  if (new Date(usage.lastResetDay) < dayStart) {
    usage.dailyUsed = 0;
    usage.lastResetDay = dayStart.toISOString();
  }
  
  return usage;
}

/**
 * Update API usage stats
 */
async function incrementApiUsage(isManual = false) {
  const usage = await getApiUsageStats();
  
  usage.monthlyUsed++;
  usage.dailyUsed++;
  if (isManual) {
    usage.manualUsed++;
  }
  
  await propApi.storage.local.set({ propApiUsage: usage });
  
  console.log(`ðŸ“Š API Usage - Month: ${usage.monthlyUsed}/${PROP_POLLER_CONFIG.monthlyBudget}, Day: ${usage.dailyUsed}/${PROP_POLLER_CONFIG.dailyBudget}, Manual: ${usage.manualUsed}/${PROP_POLLER_CONFIG.reserveForManual}`);
  
  return usage;
}

/**
 * Check if we have API quota available
 */
async function hasApiQuota(isManual = false) {
  const usage = await getApiUsageStats();
  
  // Monthly limit
  if (usage.monthlyUsed >= PROP_POLLER_CONFIG.monthlyBudget) {
    console.warn('âŒ Monthly API quota exhausted');
    return false;
  }
  
  // Daily limit for automatic polls
  if (!isManual && usage.dailyUsed >= PROP_POLLER_CONFIG.dailyBudget) {
    console.warn('âŒ Daily API quota exhausted');
    return false;
  }
  
  // Manual reserve check
  if (isManual) {
    const remainingMonthly = PROP_POLLER_CONFIG.monthlyBudget - usage.monthlyUsed;
    const automaticBudget = PROP_POLLER_CONFIG.monthlyBudget - PROP_POLLER_CONFIG.reserveForManual;
    
    if (usage.monthlyUsed >= automaticBudget && usage.manualUsed >= PROP_POLLER_CONFIG.reserveForManual) {
      console.warn('âŒ Manual reserve quota exhausted');
      return false;
    }
  }
  
  return true;
}

/**
 * Get pending player prop bets (status = "pending", market contains prop keywords)
 */
async function getPendingPlayerPropBets() {
  const data = await propApi.storage.local.get({ bets: [] });
  const bets = data.bets || [];
  
  // Filter for pending bets with player prop indicators
  const propKeywords = ['points', 'rebounds', 'assists', 'threes', 'pass', 'rush', 'reception', 
                        'strikeout', 'hits', 'home run', 'rbi', 'shots', 'blocked'];
  
  const propBets = bets.filter(bet => {
    if (bet.status !== 'pending') return false;
    
    const eventLower = (bet.event || '').toLowerCase();
    const marketLower = (bet.market || '').toLowerCase();
    const noteLower = (bet.note || '').toLowerCase();
    
    return propKeywords.some(keyword => 
      eventLower.includes(keyword) || 
      marketLower.includes(keyword) || 
      noteLower.includes(keyword)
    );
  });
  
  console.log(`ðŸŽ¯ Found ${propBets.length} pending player prop bets`);
  return propBets;
}

/**
 * Prioritize bets by sport and timestamp
 */
function prioritizeBets(bets) {
  return bets.sort((a, b) => {
    // Get sport from bet (need to map to The Odds API sport keys)
    const sportA = mapBetSportToOddsApiSport(a.sport);
    const sportB = mapBetSportToOddsApiSport(b.sport);
    
    const priorityA = PROP_POLLER_CONFIG.sportPriority[sportA] || 0;
    const priorityB = PROP_POLLER_CONFIG.sportPriority[sportB] || 0;
    
    // Higher priority first
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    
    // Then by timestamp (older first)
    return a.timestamp - b.timestamp;
  });
}

/**
 * Map bet sport to The Odds API sport key
 */
function mapBetSportToOddsApiSport(sport) {
  const sportLower = (sport || '').toLowerCase();
  
  if (sportLower.includes('nfl') || sportLower.includes('american football')) {
    return 'americanfootball_nfl';
  }
  if (sportLower.includes('nba')) {
    return 'basketball_nba';
  }
  if (sportLower.includes('mlb') || sportLower.includes('baseball')) {
    return 'baseball_mlb';
  }
  if (sportLower.includes('nhl') || sportLower.includes('hockey')) {
    return 'icehockey_nhl';
  }
  if (sportLower.includes('ncaab') || sportLower.includes('college basketball')) {
    return 'basketball_ncaab';
  }
  if (sportLower.includes('ncaaf') || sportLower.includes('college football')) {
    return 'americanfootball_ncaaf';
  }
  
  return 'basketball_nba'; // Default fallback
}

/**
 * Fetch current odds from The Odds API
 */
async function fetchCurrentOdds(apiKey, sport, markets) {
  const baseUrl = 'https://api.the-odds-api.com/v4';
  const url = `${baseUrl}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${markets.join(',')}&oddsFormat=decimal`;
  
  console.log(`ðŸŒ Fetching odds for ${sport}:`, markets);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`âœ… Received ${data.length} events from API`);
    
    return data;
  } catch (error) {
    console.error('âŒ Error fetching odds:', error);
    throw error;
  }
}

/**
 * Calculate line movement percentage
 */
function calculateLineMovement(openingOdds, currentOdds) {
  if (!openingOdds || !currentOdds) return null;
  
  const movement = ((currentOdds - openingOdds) / openingOdds) * 100;
  return parseFloat(movement.toFixed(2));
}

/**
 * Update bet with current odds and line movement
 */
async function updateBetLineMovement(betId, currentOdds) {
  const data = await propApi.storage.local.get({ bets: [] });
  const bets = data.bets || [];
  
  const betIndex = bets.findIndex(b => b.id === betId);
  if (betIndex === -1) {
    console.warn(`âš ï¸ Bet ${betId} not found`);
    return;
  }
  
  const bet = bets[betIndex];
  
  // Set opening odds if not already set
  if (!bet.openingOdds) {
    bet.openingOdds = bet.odds;
  }
  
  // Update current odds
  bet.currentOdds = currentOdds;
  bet.lastPolled = new Date().toISOString();
  
  // Calculate line movement
  bet.lineMovement = calculateLineMovement(bet.openingOdds, currentOdds);
  
  bets[betIndex] = bet;
  await propApi.storage.local.set({ bets });
  
  console.log(`ðŸ“ˆ Updated bet ${betId}: ${bet.openingOdds} â†’ ${currentOdds} (${bet.lineMovement > 0 ? '+' : ''}${bet.lineMovement}%)`);
  
  return bet;
}

/**
 * Main polling function
 */
async function pollPlayerProps(isManual = false) {
  console.log(`ðŸŽ¯ Starting player props poll (${isManual ? 'MANUAL' : 'AUTOMATIC'})`);
  
  // Check quota
  if (!await hasApiQuota(isManual)) {
    return { success: false, error: 'API quota exhausted' };
  }
  
  // Get API key
  const settings = await propApi.storage.local.get({ apiKeys: {} });
  const apiKey = settings.apiKeys.apiOddsKey;
  
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  // Get pending prop bets
  const pendingBets = await getPendingPlayerPropBets();
  
  if (pendingBets.length === 0) {
    console.log('â„¹ï¸ No pending player prop bets to poll');
    return { success: true, updated: 0, message: 'No pending prop bets' };
  }
  
  // Prioritize and limit
  const prioritized = prioritizeBets(pendingBets);
  const toProcess = prioritized.slice(0, PROP_POLLER_CONFIG.maxPropsPerPoll);
  
  console.log(`ðŸ“‹ Processing ${toProcess.length} of ${pendingBets.length} pending bets`);
  
  let updatedCount = 0;
  const errors = [];
  
  // Group bets by sport
  const betsBySport = {};
  for (const bet of toProcess) {
    const sport = mapBetSportToOddsApiSport(bet.sport);
    if (!betsBySport[sport]) {
      betsBySport[sport] = [];
    }
    betsBySport[sport].push(bet);
  }
  
  // Fetch odds for each sport
  for (const [sport, sportBets] of Object.entries(betsBySport)) {
    try {
      const markets = PROP_MARKETS[sport] || ['player_points'];
      const oddsData = await fetchCurrentOdds(apiKey, sport, markets);
      await incrementApiUsage(isManual);
      
      // Match bets to odds data using event name and market matching
      for (const bet of sportBets) {
        let matchedOdds = null;
        
        // Try to find matching event and market in API response
        if (oddsData && Array.isArray(oddsData)) {
          for (const event of oddsData) {
            // Fuzzy match event name (normalize and compare)
            const eventName = (event.home_team + ' vs ' + event.away_team).toLowerCase();
            const betEvent = (bet.event || '').toLowerCase();
            
            if (eventName.includes(betEvent) || betEvent.includes(eventName)) {
              // Found matching event, now find matching market
              const bookmakers = event.bookmakers || [];
              for (const bookmaker of bookmakers) {
                const markets = bookmaker.markets || [];
                for (const market of markets) {
                  // Try to match market description to bet market
                  const marketKey = (market.key || '').toLowerCase();
                  const betMarket = (bet.market || '').toLowerCase();
                  
                  if (marketKey.includes(betMarket) || betMarket.includes(marketKey)) {
                    // Found matching market, get current odds
                    const outcomes = market.outcomes || [];
                    if (outcomes.length > 0) {
                      // Use first available odds (in production, would match outcome name)
                      matchedOdds = outcomes[0].price;
                      break;
                    }
                  }
                }
                if (matchedOdds) break;
              }
              if (matchedOdds) break;
            }
          }
        }
        
        // Update with matched odds or skip if no match found
        if (matchedOdds) {
          await updateBetLineMovement(bet.id, matchedOdds);
          updatedCount++;
        } else {
          console.warn(`⚠️ No matching odds found for bet ${bet.id} (${bet.event})`);
        }
      }
      
    } catch (error) {
      console.error(`âŒ Error polling ${sport}:`, error);
      errors.push({ sport, error: error.message });
    }
  }
  
  console.log(`âœ… Poll complete. Updated ${updatedCount} bets`);
  
  return {
    success: true,
    updated: updatedCount,
    total: pendingBets.length,
    errors
  };
}

/**
 * Force manual poll (triggered from UI)
 */
async function forceManualPoll() {
  return await pollPlayerProps(true);
}

// Export functions for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializePropPolling,
    pollPlayerProps,
    forceManualPoll,
    getApiUsageStats
  };
}

