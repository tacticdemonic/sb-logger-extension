// Background script handles export/download requests and automatic result checking
// Compatible with MV2 background pages used by Firefox signing

let ApiServiceClass = null;
let apiServiceReady = null;
let global_pendingBetCache = null; // In-memory broker cache for cross-origin bet transfer
const DISABLE_STORAGE_KEY = 'extensionDisabled';
const TOGGLE_MENU_ID = 'sb-logger-toggle';
const IS_FIREFOX = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

const DEFAULT_STAKING_SETTINGS = {
  bankroll: 1000,
  baseBankroll: 1000,
  fraction: 0.25
};

const DEFAULT_COMMISSION_RATES = {
  betfair: 5.0,
  betdaq: 2.0,
  matchbook: 1.0,
  smarkets: 2.0
};

// Use chrome API when available (Firefox provides chrome shim), fallback to browser
const api = typeof chrome !== 'undefined' ? chrome : browser;

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
  return new ApiServiceClass();
}

function generateBetUid() {
  if (self.crypto && typeof self.crypto.randomUUID === 'function') {
    return self.crypto.randomUUID();
  }
  return `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    chrome.action.setTitle({ title: disabled ? 'SB Logger (Disabled)' : 'SB Logger' });
  }
}

function createToggleContextMenu(disabled) {
  const title = disabled ? 'Enable SB Logger' : 'Disable SB Logger';
  // Firefox (Manifest V3) uses 'action', Chrome uses 'action' too
  // 'browser_action' is not valid for Manifest V3
  const contexts = ['action'];

  const createMenu = () => {
    chrome.contextMenus.create({ id: TOGGLE_MENU_ID, title, contexts }, () => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ Failed to create SB Logger context menu:', chrome.runtime.lastError.message);
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

// Set up alarm on extension load
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Extension installed/updated');
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
      console.warn('SB Logger: ⚠ savePendingBet received invalid data');
      sendResponse({ success: false, error: 'Invalid bet data' });
      return true;
    }
    
    console.log(`SB Logger: 📬 Broker saving pendingBet (ID: ${betData.id})`);
    
    // Store in memory for immediate cross-origin retrieval
    global_pendingBetCache = betData;
    
    // Also persist to chrome.storage.local as backup for crash recovery
    chrome.storage.local.set({ pendingBet: betData }, () => {
      if (chrome.runtime.lastError) {
        console.warn('SB Logger: ⚠ Failed to persist pendingBet to storage:', chrome.runtime.lastError);
      } else {
        console.log('SB Logger: ✓ Persisted pendingBet to chrome.storage.local');
      }
      sendResponse({ success: true });
    });
    
    return true; // Keep channel open for async response
  }

  // Broker: Consume pending bet (retrieve and clear)
  if (message.action === 'consumePendingBet') {
    (async () => {
      console.log('SB Logger: ?Y"? Broker consuming pendingBet');

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
            console.log(`SB Logger: ?o" Retrieved pendingBet from storage (ID: ${betData.id})`);
          }
        } catch (err) {
          console.warn('SB Logger: ?s? Failed to read pendingBet from storage:', err && err.message);
        }
      }

      // Clear from storage only if something was found
      if (betData) {
        chrome.storage.local.remove('pendingBet', () => {
          if (chrome.runtime.lastError) {
            console.warn('SB Logger: ?s? Failed to clear pendingBet from storage:', chrome.runtime.lastError);
          } else {
            console.log('SB Logger: ?o" Cleared pendingBet from chrome.storage.local');
          }
        });
      }

      if (betData) {
        console.log(`SB Logger: ?o" Broker returned pendingBet (ID: ${betData.id})`);
      } else {
        console.log('SB Logger: ?s? Broker found no pendingBet');
      }

      sendResponse({ success: true, betData });
    })();
    return true;
  }
  
  return false;
});

async function handleCheckResults() {
  console.log('🔍 handleCheckResults called');
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
    const readyBets = pendingBets.filter(b => {
      const retryCount = b.apiRetryCount || 0;
      console.log(`📋 Checking ${b.event}: retryCount=${retryCount}, ready=${apiService.isReadyForLookup(b)}`);
      return retryCount < 5 && apiService.isReadyForLookup(b);
    });

    if (readyBets.length === 0) {
      console.log('⏰ No bets ready for lookup yet');
      return { results: [], message: 'No bets ready for lookup yet. Check back later.' };
    }

    console.log(`Checking ${readyBets.length} bets for results...`);

    // Check results
    const results = await apiService.checkBetsForResults(readyBets);

    // Update retry counts and statuses
    // Re-fetch bets from storage to avoid race conditions with manual updates
    const freshStorage = await new Promise((resolve) => {
      chrome.storage.local.get({ bets: [] }, resolve);
    });
    const bets = freshStorage.bets || [];
    
    let updated = false;
    results.forEach(r => {
      const bet = bets.find(b => getBetKey(b) === r.betId);
      if (bet) {
        // Skip if bet is no longer pending (manually marked as won/lost/void)
        if (bet.status && bet.status !== 'pending') {
          console.log(`⏭️ Skipping ${bet.event} - already marked as ${bet.status}`);
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
          // Calculate actual P/L
          const stake = parseFloat(bet.stake) || 0;
          const odds = parseFloat(bet.odds) || 0;
          if (r.outcome === 'won') {
            bet.actualPL = stake * (odds - 1);
          } else if (r.outcome === 'lost') {
            bet.actualPL = -stake;
          } else if (r.outcome === 'void') {
            bet.actualPL = 0;
          }
          console.log(`✅ Auto-settled ${bet.event} as ${r.outcome}`);
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
          lastApiCheck: updatedBet.lastApiCheck
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
      results: formatted,
      checked: readyBets.length,
      found: formatted.length
    };
  } catch (error) {
    console.error('Check results error:', error);
    return { error: error.message };
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
        title: 'SB Logger - Results Found',
        message: `Found ${result.results.length} result(s). Open extension to review.`,
        priority: 2
      });
    }
  } catch (error) {
    console.error('Auto-check error:', error);
  }
}
