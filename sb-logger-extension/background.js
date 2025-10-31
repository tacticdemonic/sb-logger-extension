// Background script handles export/download requests and automatic result checking
// Manifest V3 service worker

import ApiService from './apiService.js';

// Set up alarm on extension load
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Extension installed/updated');
  // Set up alarm to check results every hour
  chrome.alarms.create('checkBetResults', { periodInMinutes: 60 });
  console.log('⏰ Alarm created: checkBetResults (every 60 minutes)');
});

// Handle alarm - automatically check results
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkBetResults') {
    autoCheckResults();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message?.action);
  
  if (!message || !message.action) {
    console.warn('⚠️ Invalid message received');
    return false;
  }
  
  if (message.action === 'export') {
    const { dataStr, filename, mime } = message;
    try {
      // Create blob URL and download it
      const blob = new Blob([dataStr], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename }, (downloadId) => {
        // Revoke after a few seconds
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
        sendResponse({ success: true, downloadId });
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
  
  return false;
});

async function handleCheckResults() {
  console.log('🔍 handleCheckResults called');
  try {
    console.log('✅ Creating ApiService instance...');
    const apiService = new ApiService();
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
      const bet = bets.find(b => (b.id || b.timestamp) === r.betId);
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
      const updatedBet = bets.find(b => results.some(r => (b.id || b.timestamp) === r.betId));
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
              updatedBet && (b.id || b.timestamp) === (updatedBet.id || updatedBet.timestamp)
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
    } else {
      console.log('ℹ️ No changes to save');
    }

    // Format results for display
    const formatted = results
      .filter(r => r.outcome !== null)
      .map(r => {
        const bet = pendingBets.find(b => (b.id || b.timestamp) === r.betId);
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
