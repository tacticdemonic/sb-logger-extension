// Background script handles export/download requests and automatic result checking
// Compatible with MV2 background pages used by Firefox signing

let ApiServiceClass = null;
let apiServiceReady = null;
let global_pendingBetCache = null; // In-memory broker cache for cross-origin bet transfer
const DISABLE_STORAGE_KEY = 'extensionDisabled';
const TOGGLE_MENU_ID = 'surebet-helper-toggle';
const IS_FIREFOX = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

const DEFAULT_STAKING_SETTINGS = {
  bankroll: 1000,
  baseBankroll: 1000,
  fraction: 0.25,
  adjustForPending: false,
  maxBetPercent: null,
  effectiveBankroll: null
};

const DEFAULT_COMMISSION_RATES = {
  betfair: 5.0,
  betdaq: 2.0,
  matchbook: 1.0,
  smarkets: 2.0
};

// Use chrome API when available (Firefox provides chrome shim), fallback to browser
const api = typeof chrome !== 'undefined' ? chrome : browser;

let recalculateDebounceTimer = null;

function recalculateEffectiveBankroll() {
  api.storage.local.get({ bets: [], stakingSettings: DEFAULT_STAKING_SETTINGS }, (res) => {
    const settings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
    if (!settings.adjustForPending) {
      return;
    }
    
    const bets = res.bets || [];
    const pendingBets = bets.filter(b => !b.status || b.status === 'pending');
    const totalPendingStakes = pendingBets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
    const effectiveBankroll = Math.max(0, (settings.bankroll || 0) - totalPendingStakes);
    
    const updatedSettings = {
      ...settings,
      effectiveBankroll: effectiveBankroll
    };
    
    api.storage.local.set({ stakingSettings: updatedSettings }, () => {
      console.log('[Surebet Helper Background] 📊 EffectiveBankroll recalculated:', {
        bankroll: settings.bankroll,
        pendingStakes: totalPendingStakes,
        effectiveBankroll: effectiveBankroll,
        pendingBets: pendingBets.length
      });
    });
  });
}

function debouncedRecalculateEffectiveBankroll() {
  if (recalculateDebounceTimer) {
    clearTimeout(recalculateDebounceTimer);
  }
  recalculateDebounceTimer = setTimeout(() => {
    recalculateEffectiveBankroll();
    recalculateDebounceTimer = null;
  }, 250);
}

function getStorageSizeKB() {
  return new Promise((resolve) => {
    try {
      api.storage.local.getBytesInUse(null, (bytes) => {
        const kb = Math.round(bytes / 1024);
        const warning = kb > 4096; // 4MB threshold
        resolve({ kb, bytes, warning });
      });
    } catch (err) {
      console.error('[Surebet Helper Background] Storage size check error:', err);
      resolve({ kb: 0, bytes: 0, warning: false });
    }
  });
}

function sanitizeBankroll(value, fallback = DEFAULT_STAKING_SETTINGS.bankroll) {
  const parsed = parseFloat(value);
  if (!isFinite(parsed)) {
    return fallback;
  }
  if (parsed <= 0) {
    return Math.max(0, fallback);
  }
  return Math.min(parsed, 1000000);
}

function mergeCommissionRates(rates = {}) {
  return {
    betfair: isFinite(parseFloat(rates.betfair)) ? parseFloat(rates.betfair) : DEFAULT_COMMISSION_RATES.betfair,
    betdaq: isFinite(parseFloat(rates.betdaq)) ? parseFloat(rates.betdaq) : DEFAULT_COMMISSION_RATES.betdaq,
    matchbook: isFinite(parseFloat(rates.matchbook)) ? parseFloat(rates.matchbook) : DEFAULT_COMMISSION_RATES.matchbook,
    smarkets: isFinite(parseFloat(rates.smarkets)) ? parseFloat(rates.smarkets) : DEFAULT_COMMISSION_RATES.smarkets
  };
}

function normalizeStatus(status) {
  if (!status) {
    return 'pending';
  }
  return String(status).trim().toLowerCase() || 'pending';
}

function getCommissionFromMap(bookmaker, rates = DEFAULT_COMMISSION_RATES) {
  if (!bookmaker) {
    return 0;
  }
  const name = bookmaker.toLowerCase();
  if (name.includes('betfair')) return rates.betfair || 0;
  if (name.includes('betdaq')) return rates.betdaq || 0;
  if (name.includes('matchbook')) return rates.matchbook || 0;
  if (name.includes('smarkets')) return rates.smarkets || 0;
  return 0;
}

function calculateActualProfit(bet, status, commissionRates = DEFAULT_COMMISSION_RATES) {
  const normalizedStatus = normalizeStatus(status);
  if (!bet || normalizedStatus === 'pending' || normalizedStatus === 'void') {
    return 0;
  }
  const stake = parseFloat(bet.stake);
  const odds = parseFloat(bet.odds);
  if (!isFinite(stake) || stake <= 0 || !isFinite(odds) || odds <= 1) {
    return 0;
  }
  const commission = getCommissionFromMap(bet.bookmaker, commissionRates);
  if (normalizedStatus === 'won') {
    if (bet.isLay) {
      const gross = stake;
      const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
      return gross - commissionAmount;
    }
    const grossProfit = (stake * odds) - stake;
    const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
    return grossProfit - commissionAmount;
  }
  if (normalizedStatus === 'lost') {
    if (bet.isLay) {
      const layOdds = isFinite(parseFloat(bet.originalLayOdds)) ? parseFloat(bet.originalLayOdds) : odds;
      return -(stake * (layOdds - 1));
    }
    return -stake;
  }
  return 0;
}

function recalculateBankrollFromStorage(callback) {
  chrome.storage.local.get({
    bets: [],
    stakingSettings: DEFAULT_STAKING_SETTINGS,
    commission: DEFAULT_COMMISSION_RATES
  }, (res) => {
    const commissionRates = mergeCommissionRates(res.commission);
    const bets = res.bets || [];
    const totalProfit = bets.reduce((sum, bet) => sum + calculateActualProfit(bet, bet.status, commissionRates), 0);
    const currentSettings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
    const baseBankroll = sanitizeBankroll(
      currentSettings.baseBankroll ?? currentSettings.bankroll ?? DEFAULT_STAKING_SETTINGS.baseBankroll,
      DEFAULT_STAKING_SETTINGS.baseBankroll
    );
    const updatedBankroll = sanitizeBankroll(baseBankroll + totalProfit, 0);
    const currentBankroll = sanitizeBankroll(currentSettings.bankroll ?? baseBankroll, 0);
    if (Math.abs(currentBankroll - updatedBankroll) < 0.01) {
      if (typeof callback === 'function') {
        callback(updatedBankroll);
      }
      return;
    }
    const nextSettings = { ...currentSettings, bankroll: updatedBankroll };
    chrome.storage.local.set({ stakingSettings: nextSettings }, () => {
      console.log('💰 Bankroll recalculated from settlements:', updatedBankroll.toFixed(2));
      if (typeof callback === 'function') {
        callback(updatedBankroll);
      }
    });
  });
}

function loadApiService() {
  if (apiServiceReady) {
    return apiServiceReady;
  }
  apiServiceReady = (async () => {
    try {
      if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
        console.log('📦 Loading ApiService via importScripts');
        self.importScripts('apiService.js');
        ApiServiceClass = self.ApiService;
      } else {
        console.log('📦 Loading ApiService via dynamic import');
        const moduleUrl = api?.runtime?.getURL ? api.runtime.getURL('apiService.js') : 'apiService.js';
        const module = await import(moduleUrl);
        ApiServiceClass = module?.ApiService || module?.default || self?.ApiService || null;
      }
      if (!ApiServiceClass) {
        throw new Error('ApiService class not found');
      }
      console.log('✅ ApiService loaded successfully');
    } catch (error) {
      ApiServiceClass = null;
      console.error('❌ Failed to load ApiService:', error);
      throw error;
    }
  })();
  return apiServiceReady;
}

async function getApiServiceInstance() {
  if (!ApiServiceClass) {
    await loadApiService();
  }
  if (!ApiServiceClass) {
    throw new Error('ApiService unavailable');
  }
  
  // Load API keys and settings from storage
  const storageData = await new Promise((resolve) => {
    chrome.storage.local.get({ apiKeys: {}, verboseDiagnosticMode: false }, resolve);
  });
  
  const apiKeys = storageData.apiKeys || {};
  const apiFootballKey = apiKeys.apiFootballKey || '';
  const apiOddsKey = apiKeys.apiOddsKey || '';
  
  console.log('🔑 Loaded API keys from storage - Football:', !!apiFootballKey, 'Odds:', !!apiOddsKey);
  
  // Set verbose diagnostic mode if function is available
  if (typeof setVerboseDiagnosticMode === 'function') {
    setVerboseDiagnosticMode(storageData.verboseDiagnosticMode || false);
  }
  
  return new ApiServiceClass(apiFootballKey, apiOddsKey);
}

function generateBetUid() {
  if (self.crypto && typeof self.crypto.randomUUID === 'function') {
    return self.crypto.randomUUID();
  }
  return `surebet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getBetKey(bet) {
  if (!bet) return '';
  if (bet.uid) return String(bet.uid);
  const idPart = bet.id !== undefined && bet.id !== null ? String(bet.id) : '';
  const tsPart = bet.timestamp ? String(bet.timestamp) : '';
  if (idPart && tsPart) return `${idPart}::${tsPart}`;
  return idPart || tsPart || '';
}

function ensureBetIdentity(bet) {
  let changed = false;
  if (bet && !bet.timestamp) {
    bet.timestamp = new Date().toISOString();
    changed = true;
  }
  if (bet && !bet.uid) {
    bet.uid = generateBetUid();
    changed = true;
  }
  return changed;
}

function getDisabledState(callback) {
  api.storage.local.get({ [DISABLE_STORAGE_KEY]: false }, (result) => {
    callback(Boolean(result[DISABLE_STORAGE_KEY]));
  });
}

function updateActionVisuals(disabled) {
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: disabled ? 'OFF' : '' });
    if (disabled && chrome.action.setBadgeBackgroundColor) {
      chrome.action.setBadgeBackgroundColor({ color: '#d9534f' });
    }
  }

  if (chrome.action && chrome.action.setTitle) {
    chrome.action.setTitle({ title: disabled ? 'Surebet Helper (Disabled)' : 'Surebet Helper' });
  }
}

function createToggleContextMenu(disabled) {
  const title = disabled ? 'Enable Surebet Helper' : 'Disable Surebet Helper';
  // Firefox (Manifest V3) uses 'action', Chrome uses 'action' too
  // 'browser_action' is not valid for Manifest V3
  const contexts = ['action'];

  const createMenu = () => {
    chrome.contextMenus.create({ id: TOGGLE_MENU_ID, title, contexts }, () => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ Failed to create Surebet Helper context menu:', chrome.runtime.lastError.message);
      }
    });
  };

  chrome.contextMenus.remove(TOGGLE_MENU_ID, () => {
    if (chrome.runtime.lastError) {
      // Ignore missing menu errors
    }
    createMenu();
  });
}

function syncToggleUiState() {
  getDisabledState((disabled) => {
    updateActionVisuals(disabled);
    if (chrome.contextMenus && chrome.contextMenus.create) {
      createToggleContextMenu(disabled);
    }
  });
}

function notifyTabsOfToggle(disabled) {
  if (!chrome.tabs || !chrome.tabs.query) {
    return;
  }

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (typeof tab.id === 'undefined') {
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        action: 'extension-disabled-changed',
        disabled
      }, () => {
        // Ignore errors for tabs without the content script
        if (chrome.runtime.lastError) {
          return;
        }
      });
    });
  });
}

function setDisabledState(disabled) {
  chrome.storage.local.set({ [DISABLE_STORAGE_KEY]: disabled });
}

if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(changes, DISABLE_STORAGE_KEY)) {
      return;
    }
    const disabled = Boolean(changes[DISABLE_STORAGE_KEY].newValue);
    updateActionVisuals(disabled);
    if (chrome.contextMenus && chrome.contextMenus.create) {
      createToggleContextMenu(disabled);
    }
    notifyTabsOfToggle(disabled);
  });
}

// Migrate overvalue format from ratio to percentage
function migrateOvervalueFormat() {
  chrome.storage.local.get(['bets', 'overvalueMigrationDone'], (result) => {
    if (result.overvalueMigrationDone) {
      console.log('✓ Overvalue migration already completed');
      return;
    }
    
    const bets = result.bets || [];
    let migratedCount = 0;
    
    const migratedBets = bets.map(bet => {
      // Check if overvalue is in ratio format (< 2, meaning 0-100% edge)
      if (bet.overvalue && bet.overvalue < 2) {
        const newOvervalue = parseFloat(((bet.overvalue - 1) * 100).toFixed(2));
        console.log(`🔄 Migrated overvalue from ${bet.overvalue} to ${newOvervalue}% for bet: ${bet.event}`);
        migratedCount++;
        return { ...bet, overvalue: newOvervalue };
      }
      return bet;
    });
    
    if (migratedCount > 0) {
      chrome.storage.local.set({ bets: migratedBets, overvalueMigrationDone: true }, () => {
        console.log(`✅ Overvalue migration complete: ${migratedCount} bets converted`);
      });
    } else {
      chrome.storage.local.set({ overvalueMigrationDone: true });
      console.log('ℹ️ No bets needed overvalue migration');
    }
  });
}

// Set up alarm on extension load
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Extension installed/updated');
  migrateOvervalueFormat();
  chrome.storage.local.get(DISABLE_STORAGE_KEY, (result) => {
    if (typeof result[DISABLE_STORAGE_KEY] === 'undefined') {
      chrome.storage.local.set({ [DISABLE_STORAGE_KEY]: false }, syncToggleUiState);
    } else {
      syncToggleUiState();
    }
  });
  // Set up alarm to check results every hour
  chrome.alarms.create('checkBetResults', { periodInMinutes: 60 });
  console.log('⏰ Alarm created: checkBetResults (every 60 minutes)');
  
  // Set up CLV batch check alarm (default: every 4 hours)
  chrome.storage.local.get({ clvSettings: { batchCheckIntervalHours: 4 } }, (res) => {
    const intervalHours = res.clvSettings?.batchCheckIntervalHours || 4;
    chrome.alarms.create('clvBatchCheck', { periodInMinutes: intervalHours * 60 });
    console.log(`⏰ CLV alarm created: clvBatchCheck (every ${intervalHours} hours)`);
  });
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    syncToggleUiState();
  });
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === TOGGLE_MENU_ID) {
      getDisabledState((disabled) => {
        setDisabledState(!disabled);
      });
    }
  });
}

// Ensure UI state is in sync when background loads
syncToggleUiState();

// Handle alarm - automatically check results
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkBetResults') {
    autoCheckResults();
  }
  
  if (alarm.name === 'clvBatchCheck') {
    autoFetchClv();
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message?.action);
  
  if (!message || !message.action) {
    console.warn('⚠️ Invalid message received');
    return false;
  }
  
  if (message.action === 'export') {
    const { dataStr, filename, mime } = message;
    try {
      console.log('⬇️ Export action received, downloading:', filename);
      // Create blob URL and download it
      const blob = new Blob([dataStr], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      api.downloads.download({ url, filename }, (downloadId) => {
        console.log('✅ Download started with ID:', downloadId);
        // Revoke after a few seconds
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
        if (api.runtime.lastError) {
          console.error('Download error:', api.runtime.lastError);
          sendResponse({ success: false, error: api.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
      // Indicate we'll call sendResponse asynchronously
      return true;
    } catch (err) {
      console.error('Export error', err);
      sendResponse({ success: false, error: err && err.message });
      return true;
    }
  }

  if (message.action === 'testApiKeys') {
    console.log('🔌 testApiKeys action received');
    
    (async () => {
      try {
        const apiFootballKey = message.apiFootballKey || '';
        const apiOddsKey = message.apiOddsKey || '';
        
        // Check if at least one valid key is provided (non-empty string)
        if (!apiFootballKey.trim() && !apiOddsKey.trim()) {
          sendResponse({ success: false, error: 'No API keys provided' });
          return;
        }

        // Load ApiService (ensure it's loaded for future use)
        await loadApiService();
        
        let footballOk = !apiFootballKey.trim(); // If empty, skip (consider OK)
        let oddsOk = !apiOddsKey.trim(); // If empty, skip (consider OK)
        let error = null;

        // Test Football API if key provided
        if (apiFootballKey.trim()) {
          try {
            console.log('🔌 Testing Football API...');
            // Use /status endpoint which returns subscription details or errors
            const response = await fetch('https://v3.football.api-sports.io/status', {
              headers: {
                'x-rapidapi-key': apiFootballKey.trim(),
                'x-rapidapi-host': 'v3.football.api-sports.io'
              }
            });
            
            console.log('🔌 Football API HTTP status:', response.status);
            const data = await response.json();
            console.log('🔌 Football API response:', JSON.stringify(data));
            
            // Check HTTP status first
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${data.message || 'Request failed'}`);
            }
            
            // Check for errors object - API-Football returns { errors: { token: "Error..." } }
            // The errors object can be empty {} for valid keys or contain error messages for invalid
            if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
              const errorKeys = Object.keys(data.errors);
              if (errorKeys.length > 0) {
                const firstKey = errorKeys[0];
                throw new Error(data.errors[firstKey] || 'Invalid API key');
              }
            }
            
            if (data.message) {
                throw new Error(data.message);
            }
            
            // Validate that we got a proper response with account info
            // API-Football /status returns { response: { account: {...} } } for valid keys
            // For invalid keys, response is an empty array []
            if (!data.response || Array.isArray(data.response) || !data.response.account) {
                throw new Error('Invalid API key: no account information returned');
            }

            footballOk = true;
            console.log('✅ Football API test passed - Account:', data.response.account?.email || 'unknown');
          } catch (err) {
            console.warn('⚠️ Football API test failed:', err.message);
            error = 'Football API: ' + err.message;
            footballOk = false;
          }
        }

        // Test Odds API if key provided
        if (apiOddsKey.trim()) {
          try {
            console.log('🔌 Testing Odds API...');
            const response = await fetch(
              `https://api.the-odds-api.com/v4/sports?apiKey=${apiOddsKey.trim()}`,
              {
                headers: { 'Accept': 'application/json' }
              }
            );
            
            console.log('🔌 Odds API HTTP status:', response.status);
            const data = await response.json();
            console.log('🔌 Odds API response type:', typeof data, 'isArray:', Array.isArray(data));
            
            // Explicitly check HTTP status (Odds API returns 401 for invalid keys)
            if (!response.ok) {
                 const msg = data.message || data.error || `HTTP ${response.status}`;
                 throw new Error(msg);
            }
            
            if (data.message || data.error) {
              throw new Error(data.message || data.error);
            }
            
            if (!Array.isArray(data)) {
              throw new Error('Invalid response format');
            }
            
            oddsOk = true;
            console.log('✅ Odds API test passed, found', data.length, 'sports');
          } catch (err) {
            console.warn('⚠️ Odds API test failed:', err.message);
            error = error ? error + '; ' : '';
            error += 'Odds API: ' + err.message;
            oddsOk = false;
          }
        }

        if (!footballOk || !oddsOk) {
          sendResponse({ 
            success: false, 
            error: error || 'One or more API keys are invalid'
          });
        } else {
          sendResponse({ 
            success: true, 
            message: 'API keys validated successfully'
          });
        }
      } catch (err) {
        console.error('❌ API test error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    
    return true;
  }
  
  if (message.action === 'clearBets') {
    chrome.storage.local.set({ bets: [] }, () => {
      recalculateBankrollFromStorage(() => sendResponse({ success: true }));
    });
    return true;
  }

  if (message.action === 'recalculateBankroll') {
    recalculateBankrollFromStorage(() => {
      sendResponse({ success: true });
    });
    return true;
  } 
  
  if (message.action === 'checkResults') {
    // Check for bet results using API service
    console.log('🔍 checkResults action received in background');
    
    // Use async IIFE to handle promise
    (async () => {
      try {
        const results = await handleCheckResults();
        console.log('✅ handleCheckResults completed:', results);
        sendResponse(results);
      } catch (error) {
        console.error('❌ handleCheckResults error:', error);
        sendResponse({ error: error.message || 'Unknown error occurred' });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  // Broker: Save pending bet (cross-origin safe via background context)
  if (message.action === 'savePendingBet') {
    const { betData } = message;
    if (!betData || !betData.id) {
      console.warn('Surebet Helper: ⚠ savePendingBet received invalid data');
      sendResponse({ success: false, error: 'Invalid bet data' });
      return true;
    }
    
    console.log(`Surebet Helper: 📬 Broker saving pendingBet (ID: ${betData.id})`);
    
    // Store in memory for immediate cross-origin retrieval
    global_pendingBetCache = betData;
    
    // Also persist to chrome.storage.local as backup for crash recovery
    chrome.storage.local.set({ pendingBet: betData }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Surebet Helper: ⚠ Failed to persist pendingBet to storage:', chrome.runtime.lastError);
      } else {
        console.log('Surebet Helper: ✓ Persisted pendingBet to chrome.storage.local');
      }
      sendResponse({ success: true });
    });
    
    return true; // Keep channel open for async response
  }

  // Broker: Consume pending bet (retrieve and clear)
  if (message.action === 'consumePendingBet') {
    (async () => {
      console.log('Surebet Helper: ?Y"? Broker consuming pendingBet');

      let betData = global_pendingBetCache || null;

      // Clear memory cache
      global_pendingBetCache = null;

      // If nothing in memory, try storage before clearing
      if (!betData) {
        try {
          const storageResult = await new Promise((resolve) => {
            chrome.storage.local.get(['pendingBet'], resolve);
          });
          if (storageResult && storageResult.pendingBet && storageResult.pendingBet.id) {
            betData = storageResult.pendingBet;
            console.log(`Surebet Helper: ?o" Retrieved pendingBet from storage (ID: ${betData.id})`);
          }
        } catch (err) {
          console.warn('Surebet Helper: ?s? Failed to read pendingBet from storage:', err && err.message);
        }
      }

      // Clear from storage only if something was found
      if (betData) {
        chrome.storage.local.remove('pendingBet', () => {
          if (chrome.runtime.lastError) {
            console.warn('Surebet Helper: ?s? Failed to clear pendingBet from storage:', chrome.runtime.lastError);
          } else {
            console.log('Surebet Helper: ?o" Cleared pendingBet from chrome.storage.local');
          }
        });
      }

      if (betData) {
        console.log(`Surebet Helper: ?o" Broker returned pendingBet (ID: ${betData.id})`);
      } else {
        console.log('Surebet Helper: ?s? Broker found no pendingBet');
      }

      sendResponse({ success: true, betData });
    })();
    return true;
  }

  // Broker: Mark bet as placed (feedback from auto-fill success)
  if (message.action === 'betPlaced') {
    const { betId, uid, odds, stake, exchange, timestamp } = message;
    console.log(`Surebet Helper: 📝 betPlaced confirmation received (ID: ${betId || uid})`);
    
    (async () => {
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['bets'], resolve);
        });
        
        const bets = result.bets || [];
        // Find bet by uid (preferred) or id
        const betIndex = bets.findIndex(b => 
          (uid && b.uid === uid) || (betId && (b.id === betId || b.uid === betId))
        );
        
        if (betIndex >= 0) {
          // Add placement confirmation fields (keep status as 'pending' for settlement tracking)
          bets[betIndex].placedAt = timestamp || new Date().toISOString();
          bets[betIndex].placedOdds = odds || bets[betIndex].odds;
          bets[betIndex].placedStake = stake || bets[betIndex].stake;
          bets[betIndex].placedExchange = exchange || bets[betIndex].bookmaker;
          bets[betIndex].autoFillSuccess = true;
          
          await new Promise((resolve) => {
            chrome.storage.local.set({ bets }, resolve);
          });
          
          console.log(`Surebet Helper: ✓ Bet ${betId || uid} marked as placed at ${bets[betIndex].placedAt}`);
          sendResponse({ success: true, betIndex, placedAt: bets[betIndex].placedAt });
        } else {
          console.warn(`Surebet Helper: ⚠ betPlaced - Bet not found (ID: ${betId || uid})`);
          sendResponse({ success: false, error: 'Bet not found' });
        }
      } catch (err) {
        console.error('Surebet Helper: ❌ betPlaced error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    
    return true;
  }
  
  if (message.action === 'checkStorageSize') {
    (async () => {
      const sizeInfo = await getStorageSizeKB();
      sendResponse({ success: true, ...sizeInfo });
    })();
    return true;
  }
  
  // ========== DIAGNOSTIC TOOLS ==========
  
  // Set verbose diagnostic mode
  if (message.action === 'setVerboseDiagnosticMode') {
    const enabled = message.enabled || false;
    console.log('🔬 setVerboseDiagnosticMode:', enabled);
    
    // Update the in-memory flag in apiService (if loaded)
    if (typeof setVerboseDiagnosticMode === 'function') {
      setVerboseDiagnosticMode(enabled);
    }
    
    // Also persist to storage for reload
    chrome.storage.local.set({ verboseDiagnosticMode: enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Test match event against API fixtures
  if (message.action === 'testMatchEvent') {
    console.log('🧪 testMatchEvent action received');
    
    (async () => {
      try {
        const { eventName, sport, date } = message;
        
        if (!eventName || !sport || !date) {
          sendResponse({ error: 'Missing required parameters (eventName, sport, date)' });
          return;
        }
        
        // Load ApiService
        const apiService = await getApiServiceInstance();
        const config = apiService.isConfigured();
        
        if (!config.football && !config.other) {
          sendResponse({ error: 'No API keys configured. Please set up API keys first.' });
          return;
        }
        
        // Fetch fixtures for the sport and date
        const eventDate = new Date(date);
        console.log(`🧪 Testing match: "${eventName}" (${sport}) on ${date}`);
        
        let fixtures = [];
        try {
          fixtures = await apiService.fetchSportFixtures(sport, eventDate);
        } catch (err) {
          sendResponse({ error: `Failed to fetch fixtures: ${err.message}` });
          return;
        }
        
        console.log(`🧪 Fetched ${fixtures.length} fixtures for ${sport} on ${date}`);
        
        if (fixtures.length === 0) {
          sendResponse({ 
            matchFound: false, 
            error: 'No fixtures found for this sport and date',
            fixturesCount: 0
          });
          return;
        }
        
        // Parse team names from event
        const betEvent = eventName.toLowerCase().trim();
        const betTeams = betEvent.split(/\s+(?:vs\.?|v\.?|versus|at|@)\s+/i);
        
        if (betTeams.length !== 2) {
          sendResponse({ 
            matchFound: false, 
            error: 'Could not parse team names. Use format "Team A vs Team B"',
            parseResult: betTeams
          });
          return;
        }
        
        const [team1Raw, team2Raw] = betTeams.map(t => t.trim());
        const team1 = apiService.normalizeTeamName(team1Raw);
        const team2 = apiService.normalizeTeamName(team2Raw);
        
        console.log(`🧪 Searching for: "${team1}" vs "${team2}"`);
        
        // Find matches and calculate similarities
        const candidates = [];
        
        for (const fixture of fixtures) {
          const teams = apiService.extractTeamNames(fixture, sport);
          if (!teams.home || !teams.away) continue;
          
          const homeTeam = apiService.normalizeTeamName(teams.home);
          const awayTeam = apiService.normalizeTeamName(teams.away);
          
          const sim1Home = apiService.stringSimilarity(team1, homeTeam);
          const sim2Away = apiService.stringSimilarity(team2, awayTeam);
          const sim1Away = apiService.stringSimilarity(team1, awayTeam);
          const sim2Home = apiService.stringSimilarity(team2, homeTeam);
          const score = Math.max(sim1Home + sim2Away, sim1Away + sim2Home) / 2;
          
          // Check for exact match
          const exactMatch = (homeTeam.includes(team1) && awayTeam.includes(team2)) ||
                            (homeTeam.includes(team2) && awayTeam.includes(team1));
          
          candidates.push({
            home: teams.home,
            away: teams.away,
            homeNormalized: homeTeam,
            awayNormalized: awayTeam,
            score: score.toFixed(3),
            sim1Home: sim1Home.toFixed(3),
            sim2Away: sim2Away.toFixed(3),
            sim1Away: sim1Away.toFixed(3),
            sim2Home: sim2Home.toFixed(3),
            exactMatch,
            status: apiService.extractGameStatus(fixture, sport),
            fixture
          });
        }
        
        // Sort by score
        candidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
        
        // Check if we have a match (exact or fuzzy > 0.65)
        const bestMatch = candidates[0];
        const threshold = sport === 'football' ? 0.7 : 0.65;
        
        if (bestMatch && (bestMatch.exactMatch || parseFloat(bestMatch.score) >= threshold)) {
          const scores = apiService.extractScores(bestMatch.fixture, sport);
          sendResponse({
            matchFound: true,
            matchedFixture: `${bestMatch.home} vs ${bestMatch.away}`,
            matchType: bestMatch.exactMatch ? 'exact' : 'fuzzy',
            similarity: `${(parseFloat(bestMatch.score) * 100).toFixed(0)}%`,
            status: bestMatch.status,
            score: scores ? `${scores.home} - ${scores.away}` : null,
            searchedTeams: { team1, team2 },
            fixturesCount: fixtures.length
          });
        } else {
          // No match found - return candidates for debugging
          sendResponse({
            matchFound: false,
            searchedTeams: { team1, team2 },
            fixturesCount: fixtures.length,
            threshold,
            topCandidates: candidates.slice(0, 10).map(c => ({
              fixture: `${c.home} vs ${c.away}`,
              score: c.score,
              sim1Home: c.sim1Home,
              sim2Away: c.sim2Away,
              sim1Away: c.sim1Away,
              sim2Home: c.sim2Home,
              status: c.status
            }))
          });
        }
        
      } catch (err) {
        console.error('🧪 testMatchEvent error:', err);
        sendResponse({ error: err.message || 'Unknown error during test' });
      }
    })();
    
    return true;
  }
  
  // ========== CLV TRACKING ==========
  
  // Update CLV batch check schedule
  if (message.action === 'updateClvSchedule') {
    const intervalHours = parseInt(message.intervalHours) || 4;
    console.log('📈 Updating CLV schedule, interval:', intervalHours, 'hours');
    
    // Clear existing alarm and create new one
    chrome.alarms.clear('clvBatchCheck', () => {
      chrome.alarms.create('clvBatchCheck', { periodInMinutes: intervalHours * 60 });
      console.log(`⏰ CLV alarm updated: every ${intervalHours} hours`);
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Force immediate CLV check for all eligible bets (ignores delay)
  if (message.action === 'forceClvCheck') {
    console.log('📈 Force CLV check triggered');
    
    (async () => {
      try {
        const clvSettings = await getClvSettings();
        
        if (!clvSettings.enabled) {
          sendResponse({ success: false, error: 'CLV tracking is disabled', checked: 0 });
          return;
        }
        
        // Check API availability with timeout
        try {
          const healthController = new AbortController();
          const healthTimeout = setTimeout(() => healthController.abort(), 5000);
          const healthResponse = await fetch(`${clvSettings.apiUrl}/health`, { signal: healthController.signal });
          clearTimeout(healthTimeout);
          if (!healthResponse.ok) {
            sendResponse({ success: false, error: 'CLV API not responding', checked: 0 });
            return;
          }
        } catch (err) {
          sendResponse({ success: false, error: 'CLV API not reachable: ' + (err.name === 'AbortError' ? 'timeout' : err.message), checked: 0 });
          return;
        }
        
        // Get ALL settled bets without CLV (ignore delay and retry count for force)
        const storage = await new Promise((resolve) => {
          chrome.storage.local.get({ bets: [] }, resolve);
        });
        
        const eligibleBets = storage.bets.filter(bet => {
          if (!['won', 'lost'].includes(bet.status)) return false;
          if (bet.clv !== undefined && bet.clv !== null) return false;
          return true;
        });
        
        if (eligibleBets.length === 0) {
          sendResponse({ success: true, message: 'No bets need CLV data', checked: 0, updated: 0 });
          return;
        }
        
        console.log(`📈 Force checking ${eligibleBets.length} bet(s)`);
        
        // Fetch CLV
        const result = await fetchClvFromApi(eligibleBets, clvSettings);
        
        if (result.success && result.results && result.results.length > 0) {
          // Update bets
          const bets = storage.bets.map(bet => {
            const betId = getBetKey(bet) || bet.id;
            const clvResult = result.results.find(r => r.betId === betId);
            
            if (clvResult) {
              return {
                ...bet,
                closingOdds: clvResult.closingOdds,
                clv: clvResult.clv,
                clvSource: clvResult.source,
                clvFetchedAt: new Date().toISOString()
              };
            }
            
            // Increment retry count for failed fetches
            if (eligibleBets.some(eb => (getBetKey(eb) || eb.id) === betId)) {
              return {
                ...bet,
                clvRetryCount: (bet.clvRetryCount || 0) + 1,
                clvLastRetry: new Date().toISOString()
              };
            }
            
            return bet;
          });
          
          await new Promise((resolve) => {
            chrome.storage.local.set({ bets }, resolve);
          });
          
          sendResponse({ 
            success: true, 
            checked: eligibleBets.length, 
            updated: result.results.length,
            failed: result.failed || 0
          });
        } else {
          // Increment retry for all failed
          const bets = storage.bets.map(bet => {
            const betId = getBetKey(bet) || bet.id;
            if (eligibleBets.some(eb => (getBetKey(eb) || eb.id) === betId)) {
              return {
                ...bet,
                clvRetryCount: (bet.clvRetryCount || 0) + 1,
                clvLastRetry: new Date().toISOString()
              };
            }
            return bet;
          });
          
          await new Promise((resolve) => {
            chrome.storage.local.set({ bets }, resolve);
          });
          
          sendResponse({ 
            success: false, 
            error: result.error || 'API returned no results',
            checked: eligibleBets.length, 
            updated: 0 
          });
        }
      } catch (err) {
        console.error('📈 Force CLV check error:', err);
        sendResponse({ success: false, error: err.message, checked: 0 });
      }
    })();
    return true;
  }
  
  // Trigger manual CLV fetch for a specific bet
  if (message.action === 'fetchClvForBet') {
    console.log('📈 fetchClvForBet action received');
    
    (async () => {
      try {
        const { betId } = message;
        const clvSettings = await getClvSettings();
        
        if (!clvSettings.enabled) {
          sendResponse({ success: false, error: 'CLV tracking is disabled' });
          return;
        }
        
        // Get the bet
        const storage = await new Promise((resolve) => {
          chrome.storage.local.get({ bets: [] }, resolve);
        });
        
        const bet = storage.bets.find(b => getBetKey(b) === betId || b.id === betId);
        if (!bet) {
          sendResponse({ success: false, error: 'Bet not found' });
          return;
        }
        
        // Fetch CLV from API
        const result = await fetchClvFromApi([bet], clvSettings);
        
        if (result.success && result.results && result.results.length > 0) {
          const clvResult = result.results[0];
          
          // Update the bet with CLV data
          const bets = storage.bets.map(b => {
            if (getBetKey(b) === betId || b.id === betId) {
              return {
                ...b,
                closingOdds: clvResult.closingOdds,
                clv: clvResult.clv,
                clvSource: clvResult.source,
                clvFetchedAt: new Date().toISOString()
              };
            }
            return b;
          });
          
          await new Promise((resolve) => {
            chrome.storage.local.set({ bets }, resolve);
          });
          
          sendResponse({ success: true, clv: clvResult.clv, closingOdds: clvResult.closingOdds });
        } else {
          sendResponse({ success: false, error: result.error || 'Failed to fetch CLV' });
        }
      } catch (err) {
        console.error('📈 fetchClvForBet error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    
    return true;
  }
  
  // Save manual CLV entry
  if (message.action === 'saveManualClv') {
    console.log('📈 saveManualClv action received');
    
    (async () => {
      try {
        const { betId, closingOdds } = message;
        
        if (!betId || !closingOdds) {
          sendResponse({ success: false, error: 'Missing betId or closingOdds' });
          return;
        }
        
        const storage = await new Promise((resolve) => {
          chrome.storage.local.get({ bets: [] }, resolve);
        });
        
        let betUpdated = false;
        const bets = storage.bets.map(b => {
          if (getBetKey(b) === betId || b.id === betId) {
            const odds = parseFloat(b.odds) || 0;
            const closing = parseFloat(closingOdds) || 0;
            const clv = closing > 0 ? ((odds / closing) - 1) * 100 : 0;
            
            betUpdated = true;
            return {
              ...b,
              closingOdds: closing,
              clv: clv,
              clvSource: 'manual',
              clvFetchedAt: new Date().toISOString()
            };
          }
          return b;
        });
        
        if (!betUpdated) {
          sendResponse({ success: false, error: 'Bet not found' });
          return;
        }
        
        await new Promise((resolve) => {
          chrome.storage.local.set({ bets }, resolve);
        });
        
        const updatedBet = bets.find(b => getBetKey(b) === betId || b.id === betId);
        sendResponse({ 
          success: true, 
          clv: updatedBet.clv, 
          closingOdds: updatedBet.closingOdds 
        });
      } catch (err) {
        console.error('📈 saveManualClv error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    
    return true;
  }
  
  return false;
});

async function handleCheckResults() {
  console.log('🔍 handleCheckResults called (batched multi-sport)');
  try {
    console.log('✅ Ensuring ApiService instance is ready...');
    const apiService = await getApiServiceInstance();
    const config = apiService.isConfigured();
    console.log('🔧 API Config:', config);
    
    if (!config.football && !config.other) {
      console.warn('⚠️ No API keys configured');
      return {
        error: 'No API keys configured. Click "⚙️ API Setup" for instructions.'
      };
    }

    // Get all pending bets (using Promise wrapper for callback-based API)
    const storage = await new Promise((resolve) => {
      chrome.storage.local.get({ bets: [] }, resolve);
    });
    const allBets = storage.bets || [];
    console.log('📊 Total bets in storage:', allBets.length);

    let identityChanged = false;
    allBets.forEach((bet) => {
      if (ensureBetIdentity(bet)) {
        identityChanged = true;
      }
    });

    if (identityChanged) {
      console.log('🆔 Added missing identifiers to stored bets, saving...');
      await new Promise((resolve) => chrome.storage.local.set({ bets: allBets }, resolve));
    }
    
    const pendingBets = allBets.filter(b => !b.status || b.status === 'pending');
    console.log('📊 Pending bets:', pendingBets.length);

    if (pendingBets.length === 0) {
      return { results: [], message: 'No pending bets to check.' };
    }

    // Filter bets that are ready for lookup (respects retry count and delays)
    // Also exclude bets marked as unsupported sport
    const readyBets = pendingBets.filter(b => {
      // Skip if marked as unsupported sport
      if (b.unsupportedSport) {
        console.log(`⏭️ Skipping ${b.event} - unsupported sport`);
        return false;
      }
      
      const retryCount = b.apiRetryCount || 0;
      console.log(`📋 Checking ${b.event}: retryCount=${retryCount}, ready=${apiService.isReadyForLookup(b)}`);
      return retryCount < 5 && apiService.isReadyForLookup(b);
    });

    if (readyBets.length === 0) {
      console.log('⏰ No bets ready for lookup yet');
      return { results: [], message: 'No bets ready for lookup yet. Check back later.' };
    }

    console.log(`Checking ${readyBets.length} bets for results (batched)...`);

    // Use batched processing for optimized API calls
    const results = await apiService.checkBetsForResultsBatched(readyBets);

    // Update retry counts and statuses
    // Re-fetch bets from storage to avoid race conditions with manual updates
    const freshStorage = await new Promise((resolve) => {
      chrome.storage.local.get({ bets: [], commission: DEFAULT_COMMISSION_RATES }, resolve);
    });
    const bets = freshStorage.bets || [];
    const commissionRates = freshStorage.commission || DEFAULT_COMMISSION_RATES;
    
    let updated = false;
    let unsupportedCount = 0;
    let rateLimitedCount = 0;
    
    results.forEach(r => {
      const bet = bets.find(b => getBetKey(b) === r.betId);
      // Make commission rates available in this scope
      const res = { commission: commissionRates };
      if (bet) {
        // Skip if bet is no longer pending (manually marked as won/lost/void)
        if (bet.status && bet.status !== 'pending') {
          console.log(`⏭️ Skipping ${bet.event} - already marked as ${bet.status}`);
          return;
        }
        
        // Handle unsupported sports - mark to exclude from future auto-checks
        if (r.unsupportedSport) {
          bet.unsupportedSport = true;
          bet.apiRetryCount = 999; // Exclude from future auto-checks
          bet.unsupportedMessage = r.message;
          unsupportedCount++;
          updated = true;
          console.log(`⚠️ Marked ${bet.event} as unsupported sport`);
          return;
        }
        
        // Handle rate limited - don't increment retry
        if (r.rateLimited) {
          rateLimitedCount++;
          console.log(`⏳ Rate limited for ${bet.event} - will retry when limit resets`);
          return;
        }
        
        if (r.incrementRetry) {
          const oldCount = bet.apiRetryCount || 0;
          bet.apiRetryCount = oldCount + 1;
          bet.lastApiCheck = new Date().toISOString();
          console.log(`🔄 Incremented retry count for ${bet.event}: ${oldCount} → ${bet.apiRetryCount}/5`);
          updated = true;
        }
        // If result found, update bet status
        if (r.outcome !== null && (!bet.status || bet.status === 'pending')) {
          bet.status = r.outcome;
          bet.settledAt = new Date().toISOString();
          // Calculate actual P/L with commission (different for back vs lay)
          const stake = parseFloat(bet.stake) || 0;
          const odds = parseFloat(bet.odds) || 0;
          const commissionRates = res.commission || DEFAULT_COMMISSION_RATES;
          const commission = getCommissionFromMap(bet.bookmaker, commissionRates);
          
          if (r.outcome === 'won') {
            if (bet.isLay) {
              const gross = stake;
              const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
              bet.actualPL = gross - commissionAmount;
            } else {
              const grossProfit = (stake * odds) - stake;
              const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
              bet.actualPL = grossProfit - commissionAmount;
            }
          } else if (r.outcome === 'lost') {
            if (bet.isLay) {
              const layOdds = parseFloat(bet.originalLayOdds) || odds;
              bet.actualPL = -(stake * (layOdds - 1));
            } else {
              bet.actualPL = -stake;
            }
          } else if (r.outcome === 'void') {
            bet.actualPL = 0;
          }
          console.log(`✅ Auto-settled ${bet.event} as ${r.outcome} (actualPL: ${bet.actualPL?.toFixed(2) || 0})`);
          updated = true;
        }
      }
    });

    // Save updated bets only if changes were made (using Promise wrapper for callback-based API)
    if (updated) {
      console.log('💾 Saving updated bets to storage...');
      // Log the bet being saved for debugging
      const updatedBet = bets.find(b => results.some(r => getBetKey(b) === r.betId));
      if (updatedBet) {
        console.log('📝 Sample updated bet:', {
          event: updatedBet.event,
          status: updatedBet.status,
          apiRetryCount: updatedBet.apiRetryCount,
          lastApiCheck: updatedBet.lastApiCheck,
          unsupportedSport: updatedBet.unsupportedSport
        });
      }
      await new Promise((resolve) => {
        chrome.storage.local.set({ bets }, () => {
          console.log('✅ Bets saved successfully');
          // Verify the save by reading it back
          chrome.storage.local.get({ bets: [] }, (verifyRes) => {
            const verifiedBet = (verifyRes.bets || []).find(b => 
              updatedBet && getBetKey(b) === getBetKey(updatedBet)
            );
            if (verifiedBet) {
              console.log('🔍 Verified saved bet:', {
                event: verifiedBet.event,
                status: verifiedBet.status,
                apiRetryCount: verifiedBet.apiRetryCount,
                lastApiCheck: verifiedBet.lastApiCheck
              });
            }
            resolve();
          });
        });
      });
      await new Promise((resolve) => {
        recalculateBankrollFromStorage(() => resolve());
      });
    } else {
      console.log('ℹ️ No changes to save');
    }

    // Format results for display
    const formatted = results
      .filter(r => r.outcome !== null)
      .map(r => {
        const bet = pendingBets.find(b => getBetKey(b) === r.betId);
        return {
          betId: r.betId,
          event: bet ? bet.event : 'Unknown',
          outcome: r.outcome,
          confidence: r.confidence
        };
      });

    return { 
      success: true,
      results: formatted,
      checked: readyBets.length,
      settled: formatted.length,
      found: formatted.length,
      unsupported: unsupportedCount,
      rateLimited: rateLimitedCount
    };
  } catch (error) {
    console.error('Check results error:', error);
    return { success: false, error: error.message };
  }
}

async function autoCheckResults() {
  console.log('Auto-checking bet results...');
  
  try {
    const result = await handleCheckResults();
    
    if (result.results && result.results.length > 0) {
      // Show notification for found results
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon96.png',
        title: 'Surebet Helper - Results Found',
        message: `Found ${result.results.length} result(s). Open extension to review.`,
        priority: 2
      });
    }
  } catch (error) {
    console.error('Auto-check error:', error);
  }
}

// ========== CLV TRACKING FUNCTIONS ==========

const DEFAULT_CLV_SETTINGS = {
  enabled: false,
  apiUrl: 'http://localhost:8765',
  delayHours: 2,
  fallbackStrategy: 'pinnacle',
  maxRetries: 3,
  maxConcurrency: 3,
  batchCheckIntervalHours: 4
};

async function getClvSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ clvSettings: DEFAULT_CLV_SETTINGS }, (res) => {
      resolve({ ...DEFAULT_CLV_SETTINGS, ...res.clvSettings });
    });
  });
}

async function fetchClvFromApi(bets, clvSettings) {
  const apiUrl = clvSettings.apiUrl || 'http://localhost:8765';
  const timeoutMs = 30000; // 30 second timeout for CLV API calls
  
  try {
    // Prepare bet requests for the API
    const betRequests = bets.map(bet => {
      const sport = bet.sport?.toLowerCase();
      // Warn about unknown sports instead of silently defaulting
      if (!sport || !['football', 'basketball', 'tennis', 'hockey', 'american football', 'baseball', 'volleyball'].includes(sport)) {
        console.warn(`📈 CLV: Unknown/missing sport "${bet.sport}" for bet ${getBetKey(bet) || bet.id}, using 'football' fallback`);
      }
      return {
        bet_id: getBetKey(bet) || bet.id,
        event: bet.event,
        sport: sport || 'football',
        tournament: bet.tournament || '',
        bookmaker: bet.bookmaker,
        market: bet.market || 'Match Odds',
        selection: extractSelection(bet),
        opening_odds: parseFloat(bet.odds) || 0,
        event_date: extractEventDate(bet),
        home_team: extractHomeTeam(bet),
        away_team: extractAwayTeam(bet)
      };
    });
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Send batch request to API with timeout
    const response = await fetch(`${apiUrl}/api/batch-closing-odds`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bets: betRequests,
        fallback_strategy: clvSettings.fallbackStrategy || 'pinnacle',
        max_concurrency: clvSettings.maxConcurrency || 3
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('📈 CLV API error:', response.status, errorText);
      return { success: false, error: `API returned ${response.status}` };
    }
    
    const data = await response.json();
    
    // Process results and calculate CLV
    const results = [];
    for (const result of data.results || []) {
      if (result.success && result.closing_odds) {
        const bet = bets.find(b => (getBetKey(b) || b.id) === result.bet_id);
        if (bet) {
          const openingOdds = parseFloat(bet.odds) || 0;
          const closingOdds = parseFloat(result.closing_odds) || 0;
          const clv = closingOdds > 0 ? ((openingOdds / closingOdds) - 1) * 100 : 0;
          
          results.push({
            betId: result.bet_id,
            closingOdds: closingOdds,
            clv: clv,
            source: result.source || 'api',
            bookmakerMatched: result.bookmaker_matched || false
          });
        }
      }
    }
    
    return { 
      success: true, 
      results,
      jobId: data.job_id,
      processed: data.processed || 0,
      failed: data.failed || 0
    };
  } catch (err) {
    // Handle abort (timeout) specifically
    if (err.name === 'AbortError') {
      console.error('📈 CLV API request timed out after 30s');
      return { success: false, error: 'Request timed out - API may be overloaded or unresponsive' };
    }
    console.error('📈 CLV API fetch error:', err);
    return { success: false, error: err.message };
  }
}

function extractSelection(bet) {
  // Try to extract selection from market field
  if (bet.market) {
    const parts = bet.market.split(' - ');
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
  }
  
  // Try to extract from event (home/away/draw)
  if (bet.event) {
    const teams = bet.event.split(/\s+(?:vs\.?|v\.?|-)\s+/i);
    if (teams.length >= 2) {
      // Check if it's a home/away selection
      if (bet.market?.toLowerCase().includes('home')) {
        return teams[0].trim();
      }
      if (bet.market?.toLowerCase().includes('away')) {
        return teams[teams.length - 1].trim();
      }
    }
  }
  
  return bet.market || 'Unknown';
}

function extractEventDate(bet) {
  // Try eventTime first
  if (bet.eventTime) {
    try {
      return new Date(bet.eventTime).toISOString().split('T')[0];
    } catch (e) {}
  }
  
  // Fall back to timestamp
  if (bet.timestamp) {
    try {
      return new Date(bet.timestamp).toISOString().split('T')[0];
    } catch (e) {}
  }
  
  return new Date().toISOString().split('T')[0];
}

function extractHomeTeam(bet) {
  if (!bet.event) return '';
  const teams = bet.event.split(/\s+(?:vs\.?|v\.?|-)\s+/i);
  return teams.length >= 2 ? teams[0].trim() : '';
}

function extractAwayTeam(bet) {
  if (!bet.event) return '';
  const teams = bet.event.split(/\s+(?:vs\.?|v\.?|-)\s+/i);
  return teams.length >= 2 ? teams[teams.length - 1].trim() : '';
}

async function autoFetchClv() {
  console.log('📈 Auto-fetching CLV for settled bets...');
  
  try {
    const clvSettings = await getClvSettings();
    
    if (!clvSettings.enabled) {
      console.log('📈 CLV tracking is disabled, skipping');
      return;
    }
    
    // Check if API is available with 5s timeout
    try {
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 5000);
      const healthResponse = await fetch(`${clvSettings.apiUrl}/health`, {
        signal: healthController.signal
      });
      clearTimeout(healthTimeout);
      if (!healthResponse.ok) {
        console.warn('📈 CLV API not available, skipping');
        return;
      }
    } catch (err) {
      console.warn('📈 CLV API not reachable:', err.name === 'AbortError' ? 'health check timed out' : err.message);
      return;
    }
    
    // Get settled bets without CLV
    const storage = await new Promise((resolve) => {
      chrome.storage.local.get({ bets: [] }, resolve);
    });
    
    const now = new Date();
    const delayMs = (clvSettings.delayHours || 2) * 60 * 60 * 1000;
    
    // Find bets that:
    // 1. Are settled (won/lost)
    // 2. Don't have CLV yet
    // 3. Settled at least delayHours ago
    // 4. Haven't exceeded max retries
    const eligibleBets = storage.bets.filter(bet => {
      if (!['won', 'lost'].includes(bet.status)) return false;
      if (bet.clv !== undefined && bet.clv !== null) return false;
      
      // Check retry count
      const retryCount = bet.clvRetryCount || 0;
      if (retryCount >= clvSettings.maxRetries) return false;
      
      // Check if enough time has passed since settlement
      // For legacy/imported bets without settledAt, use bet timestamp as fallback
      // If neither exists, skip this bet to avoid hitting API before closing lines available
      const settlementTimestamp = bet.settledAt || bet.timestamp;
      if (settlementTimestamp) {
        const settledTime = new Date(settlementTimestamp).getTime();
        if (now.getTime() - settledTime < delayMs) return false;
      } else {
        // No timestamp available - skip to be safe (user can use Force Check)
        console.warn(`📈 Skipping bet without timestamp: ${getBetKey(bet) || bet.id}`);
        return false;
      }
      
      return true;
    });
    
    if (eligibleBets.length === 0) {
      console.log('📈 No eligible bets for CLV fetch');
      return;
    }
    
    console.log(`📈 Found ${eligibleBets.length} bet(s) eligible for CLV fetch`);
    
    // Fetch CLV for eligible bets
    const result = await fetchClvFromApi(eligibleBets, clvSettings);
    
    if (result.success && result.results && result.results.length > 0) {
      // Update bets with CLV data
      const bets = storage.bets.map(bet => {
        const betId = getBetKey(bet) || bet.id;
        const clvResult = result.results.find(r => r.betId === betId);
        
        if (clvResult) {
          return {
            ...bet,
            closingOdds: clvResult.closingOdds,
            clv: clvResult.clv,
            clvSource: clvResult.source,
            clvFetchedAt: new Date().toISOString()
          };
        }
        
        // Increment retry count for failed fetches
        if (eligibleBets.some(eb => (getBetKey(eb) || eb.id) === betId)) {
          return {
            ...bet,
            clvRetryCount: (bet.clvRetryCount || 0) + 1,
            clvLastRetry: new Date().toISOString()
          };
        }
        
        return bet;
      });
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ bets }, resolve);
      });
      
      console.log(`📈 CLV updated for ${result.results.length} bet(s)`);
      
      // Show notification if CLV was found
      if (result.results.length > 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon96.png',
          title: 'Surebet Helper - CLV Updated',
          message: `CLV calculated for ${result.results.length} bet(s).`,
          priority: 1
        });
      }
    } else {
      console.log('📈 No CLV results obtained:', result.error);
      
      // Increment retry count for all eligible bets
      const bets = storage.bets.map(bet => {
        const betId = getBetKey(bet) || bet.id;
        if (eligibleBets.some(eb => (getBetKey(eb) || eb.id) === betId)) {
          return {
            ...bet,
            clvRetryCount: (bet.clvRetryCount || 0) + 1,
            clvLastRetry: new Date().toISOString()
          };
        }
        return bet;
      });
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ bets }, resolve);
      });
    }
  } catch (error) {
    console.error('📈 Auto-fetch CLV error:', error);
  }
}

// Message handler for extension requests
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recalculateEffectiveBankroll') {
    recalculateEffectiveBankroll();
    sendResponse({ success: true });
  }
  return true;
});

