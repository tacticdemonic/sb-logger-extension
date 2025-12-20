const axios = require('axios');

const API_KEY = process.env.THE_ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

if (!API_KEY) {
    console.error('Error: THE_ODDS_API_KEY environment variable is not set.');
    console.error('Please set it using: $env:THE_ODDS_API_KEY="YOUR_KEY"');
    // We don't exit here to allow importing this module without crashing, 
    // but methods will fail if key is missing.
}

const client = axios.create({
    baseURL: BASE_URL,
    params: {
        apiKey: API_KEY
    }
});

/**
 * Get active sports
 */
async function getSports() {
    try {
        const response = await client.get('/');
        return response.data;
    } catch (error) {
        console.error('Error fetching sports:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Get odds for a specific sport.
 * @param {string} sportKey - e.g., 'basketball_nba'
 * @param {string} regions - e.g., 'us', 'uk', 'eu'
 * @param {string} markets - e.g., 'h2h,spreads,totals,player_points'
 */
async function getOdds(sportKey, regions = 'us', markets = 'h2h,spreads,totals') {
    try {
        const response = await client.get(`/${sportKey}/odds`, {
            params: {
                regions,
                markets,
                oddsFormat: 'decimal'
            }
        });
        // Check headers for quota usage if needed: response.headers['x-requests-remaining']
        return response.data;
    } catch (error) {
        console.error('Error fetching odds:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Get odds for a specific event.
 * @param {string} sportKey 
 * @param {string} eventId 
 * @param {string} regions 
 * @param {string} markets 
 */
async function getEventOdds(sportKey, eventId, regions = 'us', markets = 'h2h') {
    try {
        const response = await client.get(`/${sportKey}/events/${eventId}/odds`, {
            params: {
                regions,
                markets,
                oddsFormat: 'decimal'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching event odds:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Example usage (uncomment to test)
// (async () => {
//     if (!API_KEY) return;
//     console.log('Fetching NBA odds...');
//     const odds = await getOdds('basketball_nba', 'us', 'h2h,player_points');
//     if (odds && odds.length > 0) {
//         console.log(`Found ${odds.length} games.`);
//         console.log('Sample game:', JSON.stringify(odds[0], null, 2));
//     } else {
//         console.log('No odds found.');
//     }
// })();

module.exports = {
    getSports,
    getOdds,
    getEventOdds
};
