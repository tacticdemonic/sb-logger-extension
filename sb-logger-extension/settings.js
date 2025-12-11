// Settings Page — Configuration Management
console.log('⚙️ Surebet Helper Settings Script Loading...');

const api = typeof chrome !== 'undefined' ? chrome : browser;

const DEFAULT_COMMISSION_RATES = {
  betfair: 5.0,
  betdaq: 2.0,
  matchbook: 1.0,
  smarkets: 2.0
};

const DEFAULT_ROUNDING_SETTINGS = {
  enabled: false,
  increment: null
};

const DEFAULT_AUTOFILL_SETTINGS = {
  enabled: false,
  bookmakers: {
    betfair: true,
    matchbook: true,
    smarkets: true,
    betdaq: true
  },
  timeout: 10000,
  requireConfirmation: false
};

const DEFAULT_ACTIONS_SETTINGS = {
  skipStakePrompt: false,
  skipDeleteConfirmation: false,
  skipOddsPrompt: false,
  skipMarketPrompt: false,
  dustbinActionAfterSave: 'none' // 'none' | 'hide-valuebet' | 'hide-event'
};

const DEFAULT_CLV_SETTINGS = {
  enabled: false,
  delayHours: 2,
  maxRetries: 3,
  batchCheckIntervalHours: 4
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('⚙️ Settings page loaded');

  // Get current section from hash or URL params
  const currentSection = window.location.hash.slice(1) || 'commission';
  console.log('⚙️ Current section:', currentSection);

  // Set up navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      window.location.hash = section;
      showSection(section);
    });
  });

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || 'commission';
    showSection(hash);
  });

  setupCloseButtons();

  // Load all settings
  loadAllSettings(() => {
    // Show initial section
    showSection(currentSection);

    // Set up event listeners for save buttons
    setupEventListeners();
  });

  function showSection(sectionName) {
    console.log('⚙️ showSection called with:', sectionName);
    
    document.querySelectorAll('.section-container').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeSection = document.getElementById(`${sectionName}-section`);
    console.log('⚙️ Found section element:', activeSection);
    if (activeSection) {
      activeSection.classList.add('active');
      console.log('⚙️ Activated section:', sectionName);
    } else {
      console.warn('⚠️ Section not found:', `${sectionName}-section`);
    }

    const activeBtn = document.querySelector(`.nav-btn[data-section="${sectionName}"]`);
    console.log('⚙️ Found button element:', activeBtn);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  function loadAllSettings(callback) {
    api.storage.local.get({
      commission: DEFAULT_COMMISSION_RATES,
      roundingSettings: DEFAULT_ROUNDING_SETTINGS,
      autoFillSettings: DEFAULT_AUTOFILL_SETTINGS,
      defaultActionsSettings: DEFAULT_ACTIONS_SETTINGS,
      clvSettings: DEFAULT_CLV_SETTINGS,
      apiKeys: {}
    }, (res) => {
      console.log('⚙️ Loaded settings from storage:', res);

      // Load commission rates
      document.getElementById('comm-betfair').value = res.commission?.betfair ?? DEFAULT_COMMISSION_RATES.betfair;
      document.getElementById('comm-betdaq').value = res.commission?.betdaq ?? DEFAULT_COMMISSION_RATES.betdaq;
      document.getElementById('comm-matchbook').value = res.commission?.matchbook ?? DEFAULT_COMMISSION_RATES.matchbook;
      document.getElementById('comm-smarkets').value = res.commission?.smarkets ?? DEFAULT_COMMISSION_RATES.smarkets;

      // Load rounding settings
      const roundingSettings = res.roundingSettings || DEFAULT_ROUNDING_SETTINGS;
      document.getElementById('rounding-enabled').checked = roundingSettings.enabled || false;
      document.getElementById('rounding-increment').value = roundingSettings.increment || '';

      // Load auto-fill settings
      const autoFillSettings = res.autoFillSettings || DEFAULT_AUTOFILL_SETTINGS;
      document.getElementById('autofill-enabled').checked = autoFillSettings.enabled || false;
      document.getElementById('autofill-betfair').checked = autoFillSettings.bookmakers?.betfair !== false;
      document.getElementById('autofill-betdaq').checked = autoFillSettings.bookmakers?.betdaq !== false;
      document.getElementById('autofill-smarkets').checked = autoFillSettings.bookmakers?.smarkets !== false;
      document.getElementById('autofill-matchbook').checked = autoFillSettings.bookmakers?.matchbook !== false;

      // Load default actions settings
      const defaultActionsSettings = res.defaultActionsSettings || DEFAULT_ACTIONS_SETTINGS;
      document.getElementById('default-actions-skip-stake').checked = defaultActionsSettings.skipStakePrompt || false;
      document.getElementById('default-actions-skip-delete').checked = defaultActionsSettings.skipDeleteConfirmation || false;
      document.getElementById('default-actions-skip-odds').checked = defaultActionsSettings.skipOddsPrompt || false;
      document.getElementById('default-actions-skip-market').checked = defaultActionsSettings.skipMarketPrompt || false;
      if (document.getElementById('default-actions-dustbin')) {
        document.getElementById('default-actions-dustbin').value = defaultActionsSettings.dustbinActionAfterSave || 'none';
      }

      // Load API keys (note: don't load the actual keys for security, just indicate if they exist)
      const apiKeys = res.apiKeys || {};
      if (apiKeys.apiFootballKey) {
        document.getElementById('api-football-key').value = '••••••••••••••••';
        document.getElementById('api-football-key').placeholder = 'API key already configured';
      }
      if (apiKeys.apiOddsKey) {
        document.getElementById('api-odds-key').value = '••••••••••••••••';
        document.getElementById('api-odds-key').placeholder = 'API key already configured';
      }

      // Load CLV settings (CSV-based, simplified)
      const clvSettings = res.clvSettings || DEFAULT_CLV_SETTINGS;
      const clvEnabled = document.getElementById('clv-enabled');
      
      if (clvEnabled) clvEnabled.checked = clvSettings.enabled || false;
      
      // Load Props Polling settings
      const propsSettings = res.propsPollingSettings || { enabled: false };
      const propsEnabled = document.getElementById('props-polling-enabled');
      
      if (propsEnabled) propsEnabled.checked = propsSettings.enabled || false;

      if (callback) callback();
    });
  }

  function setupCloseButtons() {
    document.querySelectorAll('.js-close-window').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        try {
          window.close();
        } catch (err) {
          console.warn('Unable to close settings window:', err);
        }
      });
    });
  }

  function setupEventListeners() {
    // Commission save
    document.getElementById('save-commission-btn').addEventListener('click', () => {
      const newRates = {
        betfair: parseFloat(document.getElementById('comm-betfair').value) || 0,
        betdaq: parseFloat(document.getElementById('comm-betdaq').value) || 0,
        matchbook: parseFloat(document.getElementById('comm-matchbook').value) || 0,
        smarkets: parseFloat(document.getElementById('comm-smarkets').value) || 0
      };
      console.log('💾 Saving commission rates:', newRates);
      api.storage.local.set({ commission: newRates }, () => {
        console.log('✅ Commission rates saved');
        alert('✅ Commission rates saved successfully!');
      });
    });

    // Rounding save
    document.getElementById('save-rounding-btn').addEventListener('click', () => {
      const enabled = document.getElementById('rounding-enabled').checked;
      const incrementStr = document.getElementById('rounding-increment').value;
      
      if (enabled) {
        const increment = parseFloat(incrementStr);
        if (!incrementStr || isNaN(increment)) {
          alert('❌ Please enter a valid rounding increment');
          return;
        }
        if (increment < 0.01 || increment > 100) {
          alert('❌ Rounding increment must be between 0.01 and 100');
          return;
        }
      }
      
      const newSettings = {
        enabled: enabled,
        increment: enabled && incrementStr ? parseFloat(incrementStr) : null
      };
      console.log('💾 Saving rounding settings:', newSettings);
      api.storage.local.set({ roundingSettings: newSettings }, () => {
        console.log('✅ Rounding settings saved');
        alert('✅ Rounding settings saved successfully!');
      });
    });

    // Auto-fill save
    document.getElementById('save-autofill-btn').addEventListener('click', () => {
      const enabled = document.getElementById('autofill-enabled').checked;
      const newSettings = {
        enabled: enabled,
        bookmakers: {
          betfair: document.getElementById('autofill-betfair').checked,
          betdaq: document.getElementById('autofill-betdaq').checked,
          smarkets: document.getElementById('autofill-smarkets').checked,
          matchbook: document.getElementById('autofill-matchbook').checked
        },
        timeout: 10000,
        requireConfirmation: false
      };
      console.log('💾 Saving auto-fill settings:', newSettings);
      api.storage.local.set({ autoFillSettings: newSettings }, () => {
        console.log('✅ Auto-fill settings saved');
        alert('✅ Auto-fill settings saved successfully!');
      });
    });

    // Default Actions save
    document.getElementById('save-defaults-btn').addEventListener('click', () => {
      const skipStakePrompt = document.getElementById('default-actions-skip-stake').checked;
      
      // Validate: if skipStakePrompt is enabled, Kelly staking must be enabled
      if (skipStakePrompt) {
        api.storage.local.get({ stakingSettings: {} }, (res) => {
          const stakingSettings = res.stakingSettings || {};
          if (!stakingSettings.bankroll || stakingSettings.bankroll <= 0) {
            alert('❌ Kelly Staking must be configured before enabling auto-save. Please set up Kelly Staking first.');
            document.getElementById('default-actions-skip-stake').checked = false;
            return;
          }
          
          saveDefaultActionsSettings();
        });
      } else {
        saveDefaultActionsSettings();
      }
      
      function saveDefaultActionsSettings() {
        const newSettings = {
          skipStakePrompt: document.getElementById('default-actions-skip-stake').checked,
          skipDeleteConfirmation: document.getElementById('default-actions-skip-delete').checked,
          skipOddsPrompt: document.getElementById('default-actions-skip-odds').checked,
          skipMarketPrompt: document.getElementById('default-actions-skip-market').checked,
          dustbinActionAfterSave: document.getElementById('default-actions-dustbin').value || 'none'
        };
        console.log('💾 Saving default actions settings:', newSettings);
        api.storage.local.set({ defaultActionsSettings: newSettings }, () => {
          console.log('✅ Default actions settings saved');
          alert('✅ Default actions settings saved successfully!');
        });
      }
    });

    // API test connection
    document.getElementById('test-api-btn').addEventListener('click', () => {
      const apiFootballKey = document.getElementById('api-football-key').value;
      const apiOddsKey = document.getElementById('api-odds-key').value;
      
      console.log('🔌 Test clicked - Football value:', JSON.stringify(apiFootballKey), 'Odds value:', JSON.stringify(apiOddsKey));
      
      if (!apiFootballKey && !apiOddsKey) {
        console.log('🔌 Both empty, showing alert');
        alert('⚠️ Please enter at least one API key');
        return;
      }

      document.getElementById('test-api-btn').disabled = true;
      document.getElementById('test-api-btn').textContent = '🔄 Testing...';

      // Load saved keys if fields show masked values
      api.storage.local.get({ apiKeys: {} }, (res) => {
        const savedKeys = res.apiKeys || {};
        
        // Use saved key if field is masked, otherwise use the entered value
        const footballToSend = apiFootballKey.startsWith('•') ? (savedKeys.apiFootballKey || '') : apiFootballKey;
        const oddsToSend = apiOddsKey.startsWith('•') ? (savedKeys.apiOddsKey || '') : apiOddsKey;
        
        console.log('🔌 Sending to background - Football:', footballToSend ? '(key present)' : '(empty)', 'Odds:', oddsToSend ? '(key present)' : '(empty)');

        // Send test message to background script
        api.runtime.sendMessage({
          action: 'testApiKeys',
          apiFootballKey: footballToSend,
          apiOddsKey: oddsToSend
        }, (response) => {
          document.getElementById('test-api-btn').disabled = false;
          document.getElementById('test-api-btn').textContent = '🔌 Test Connection';

          const resultDiv = document.getElementById('api-test-result');
          resultDiv.style.display = 'block';

          if (response.success) {
            resultDiv.style.background = '#d4edda';
            resultDiv.style.color = '#155724';
            resultDiv.style.borderLeft = '4px solid #28a745';
            resultDiv.innerHTML = '✅ <strong>Success!</strong> API connection(s) validated. You can now use the "Check Results" feature.';
          } else {
            resultDiv.style.background = '#f8d7da';
            resultDiv.style.color = '#721c24';
            resultDiv.style.borderLeft = '4px solid #dc3545';
            resultDiv.innerHTML = `❌ <strong>Connection Failed:</strong> ${response.error || 'Unknown error'}`;
          }

          setTimeout(() => {
            resultDiv.style.display = 'none';
          }, 5000);
        });
      });
    });

    // API save
    document.getElementById('save-api-btn').addEventListener('click', () => {
      const apiFootballKey = document.getElementById('api-football-key').value;
      const apiOddsKey = document.getElementById('api-odds-key').value;

      if (!apiFootballKey && !apiOddsKey) {
        alert('⚠️ Please enter at least one API key');
        return;
      }

      if (apiFootballKey.startsWith('•') && apiOddsKey.startsWith('•')) {
        alert('✅ API keys are already configured. No changes needed.');
        return;
      }

      const keysToSave = {};
      if (!apiFootballKey.startsWith('•') && apiFootballKey) {
        keysToSave.apiFootballKey = apiFootballKey;
      }
      if (!apiOddsKey.startsWith('•') && apiOddsKey) {
        keysToSave.apiOddsKey = apiOddsKey;
      }

      console.log('💾 Saving API keys');
      api.storage.local.get({ apiKeys: {} }, (res) => {
        const existingKeys = res.apiKeys || {};
        const updatedKeys = { ...existingKeys, ...keysToSave };
        api.storage.local.set({ apiKeys: updatedKeys }, () => {
          console.log('✅ API keys saved');
          alert('✅ API keys saved successfully! You can now use the "Check Results" feature.');
          // Reload to show masked keys
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        });
      });
    });

    // CLV Settings Save (CSV-based)
    const saveClvBtn = document.getElementById('save-clv-btn');
    if (saveClvBtn) {
      saveClvBtn.addEventListener('click', () => {
        const enabled = document.getElementById('clv-enabled').checked;
        
        const newSettings = {
          enabled: enabled,
          delayHours: 2,
          maxRetries: 3,
          batchCheckIntervalHours: 4
        };
        
        console.log('💾 Saving CLV settings:', newSettings);
        api.storage.local.set({ clvSettings: newSettings }, () => {
          console.log('✅ CLV settings saved');
          
          // Update CLV batch check schedule with new settings
          api.runtime.sendMessage({
            action: 'updateClvSchedule',
            intervalHours: newSettings.batchCheckIntervalHours
          });
          
          alert('✅ CLV tracking settings saved successfully!');
        });
      });
    }

    // Clear CSV Cache
    const clearCsvCacheBtn = document.getElementById('clear-csv-cache-btn');
    if (clearCsvCacheBtn) {
      clearCsvCacheBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('clear-csv-cache-status');
        statusEl.textContent = 'Clearing...';
        statusEl.style.color = '#007bff';
        
        // Clear all CSV caches from storage
        api.storage.local.get(null, (allData) => {
          const cacheKeys = Object.keys(allData).filter(key => key.startsWith('csv_cache_'));
          
          if (cacheKeys.length === 0) {
            statusEl.textContent = 'No caches to clear';
            statusEl.style.color = '#6c757d';
            setTimeout(() => statusEl.textContent = '', 3000);
            return;
          }
          
          api.storage.local.remove(cacheKeys, () => {
            console.log(`[CSV CLV] 💾 Cleared ${cacheKeys.length} CSV caches`);
            statusEl.textContent = `✅ Cleared ${cacheKeys.length} cache(s)`;
            statusEl.style.color = '#28a745';
            setTimeout(() => statusEl.textContent = '', 3000);
          });
        });
      });
    }
    
    // Force CLV Check
    const forceClvCheckBtn = document.getElementById('force-clv-check-btn');
    if (forceClvCheckBtn) {
      forceClvCheckBtn.addEventListener('click', async () => {
        forceClvCheckBtn.disabled = true;
        forceClvCheckBtn.textContent = '⏳ Checking...';
        
        const resultDiv = document.getElementById('force-clv-result');
        if (resultDiv) {
          resultDiv.style.display = 'inline';
          resultDiv.innerHTML = '<span style="color: #666;">🔄 Fetching CLV data...</span>';
        }
        
        try {
          console.log('📈 [Settings] Sending forceClvCheck message...');
          const response = await new Promise((resolve, reject) => {
            api.runtime.sendMessage({ action: 'forceClvCheck' }, (resp) => {
              if (api.runtime.lastError) {
                reject(new Error(api.runtime.lastError.message));
                return;
              }
              if (resp === undefined) {
                reject(new Error('No response from background script'));
                return;
              }
              resolve(resp);
            });
          });
          
          console.log('📈 [Settings] Force CLV check response:', response);
          
          if (response?.success) {
            const msg = response.updated > 0 
              ? `✅ Success! Checked ${response.checked} bet(s), updated ${response.updated} with CLV data.`
              : `ℹ️ Checked ${response.checked} bet(s), no new CLV data found.`;
            if (resultDiv) {
              resultDiv.innerHTML = `<span style="color: ${response.updated > 0 ? '#28a745' : '#666'};">${msg}</span>`;
            }
            alert(msg);
          } else {
            // Friendly message for unsupported leagues
            const errorMsg = response?.error === 'league_not_supported'
              ? `ℹ️ These bets are from leagues not covered by CSV data (e.g., cups, international competitions)`
              : `❌ CLV check failed: ${response?.error || 'Unknown error'}`;
            const color = response?.error === 'league_not_supported' ? '#666' : '#dc3545';
            if (resultDiv) {
              resultDiv.innerHTML = `<span style="color: ${color};">${errorMsg}</span>`;
            }
            alert(errorMsg);
          }
        } catch (err) {
          const errorMsg = `❌ Error: ${err.message}`;
          if (resultDiv) {
            resultDiv.innerHTML = `<span style="color: #dc3545;">${errorMsg}</span>`;
          }
          alert(errorMsg);
        }
        
        forceClvCheckBtn.disabled = false;
        forceClvCheckBtn.textContent = '⚡ Force Check Now';
      });
    }
    
    // Save Props Polling Settings
    const savePropsBtn = document.getElementById('save-props-btn');
    if (savePropsBtn) {
      savePropsBtn.addEventListener('click', () => {
        const enabled = document.getElementById('props-polling-enabled')?.checked || false;
        
        const newSettings = { enabled };
        
        console.log('💾 Saving props polling settings:', newSettings);
        api.storage.local.set({ propsPollingSettings: newSettings }, () => {
          console.log('✅ Props polling settings saved');
          alert('✅ Props polling settings saved successfully!');
          
          // Notify background to update polling schedule
          api.runtime.sendMessage({ 
            action: 'updatePropsPollingSchedule', 
            enabled: enabled 
          });
        });
      });
    }

    // Export config for CLV server
    const exportConfigBtn = document.getElementById('export-config-btn');
    if (exportConfigBtn) {
      exportConfigBtn.addEventListener('click', () => {
        api.storage.local.get({ apiKeys: {} }, (res) => {
          const apiKeys = res.apiKeys || {};
          
          if (!apiKeys.apiOddsKey) {
            alert('⚠️ The Odds API key is not configured. Please save your API key first.');
            return;
          }
          
          // Create config object
          const config = {
            THE_ODDS_API_KEY: apiKeys.apiOddsKey,
            exported_at: new Date().toISOString(),
            extension_version: api.runtime.getManifest().version
          };
          
          const dataStr = JSON.stringify(config, null, 2);
          const filename = 'config.json';
          
          // Export via chrome.downloads
          api.runtime.sendMessage({
            action: 'export',
            dataStr: dataStr,
            filename: filename,
            mime: 'application/json'
          }, (resp) => {
            if (resp && resp.success) {
              console.log('✅ Config exported successfully');
              
              // Show success message with instructions
              const sharedPath = navigator.platform.toLowerCase().includes('win') 
                ? '%LOCALAPPDATA%\\SurebetHelper\\config.json'
                : '~/.surebethelper/config.json';
              
              alert(
                `✅ Config file downloaded!\n\n` +
                `📁 Move the downloaded file to:\n${sharedPath}\n\n` +
                `🔄 Then restart the CLV server to use the new configuration.`
              );
            } else {
              console.error('❌ Config export failed:', resp?.error);
              alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
            }
          });
        });
      });
    }

    // Export pending bets (debug)
    const exportPendingBtn = document.getElementById('export-pending-btn');
    if (exportPendingBtn) {
      exportPendingBtn.addEventListener('click', () => {
        api.storage.local.get({ bets: [] }, (res) => {
          const allBets = res.bets || [];
          const pendingBets = allBets.filter(b => b.status === 'pending' || !b.status);
          
          if (pendingBets.length === 0) {
            alert('ℹ️ No pending bets to export.');
            return;
          }
          
          // Ensure all bets have debugLogs field (for backward compatibility)
          const betsWithLogs = pendingBets.map(bet => ({
            ...bet,
            debugLogs: bet.debugLogs || []
          }));
          
          const exportData = {
            exportDate: new Date().toISOString(),
            pendingBetCount: betsWithLogs.length,
            bets: betsWithLogs
          };
          
          const dataStr = JSON.stringify(exportData, null, 2);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `pending-bets-debug-${timestamp}.json`;
          
          api.runtime.sendMessage({
            action: 'export',
            dataStr: dataStr,
            filename: filename,
            mime: 'application/json'
          }, (resp) => {
            if (resp && resp.success) {
              console.log(`✅ Exported ${betsWithLogs.length} pending bet(s) with debug logs`);
              alert(`✅ Exported ${betsWithLogs.length} pending bet(s) to ${filename}`);
            } else {
              console.error('❌ Export failed:', resp?.error);
              alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
            }
          });
        });
      });
    }

    // Export ALL bets as JSON
    const exportJsonAllBtn = document.getElementById('export-json-all-btn');
    if (exportJsonAllBtn) {
      exportJsonAllBtn.addEventListener('click', () => {
        api.storage.local.get({ bets: [], stakingSettings: {} }, (res) => {
          const allBets = res.bets || [];
          const stakingSettings = res.stakingSettings || {};
          
          if (allBets.length === 0) {
            alert('ℹ️ No bets to export.');
            return;
          }
          
          // Ensure all bets have debugLogs field (for backward compatibility)
          const betsWithLogs = allBets.map(bet => ({
            ...bet,
            debugLogs: bet.debugLogs || []
          }));
          
          // Calculate analysis metrics
          const tierStats = calculateLiquidityTierStats(betsWithLogs);
          const bookmakerStats = calculateBookmakerStats(betsWithLogs);
          const temporalStats = calculateTemporalStats(betsWithLogs);
          const kellyStats = calculateKellyStats(betsWithLogs, stakingSettings);
          
          const exportData = {
            exportDate: new Date().toISOString(),
            bets: betsWithLogs,
            analysis: {
              liquidityTiers: tierStats,
              bookmakerProfiling: bookmakerStats,
              temporalAnalysis: temporalStats,
              kellyFillRatios: kellyStats
            }
          };
          
          const dataStr = JSON.stringify(exportData, null, 2);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `surebet-bets-${timestamp}.json`;
          
          api.runtime.sendMessage({
            action: 'export',
            dataStr: dataStr,
            filename: filename,
            mime: 'application/json'
          }, (resp) => {
            if (resp && resp.success) {
              console.log(`✅ Exported ${betsWithLogs.length} bet(s) with analysis`);
              alert(`✅ Exported ${betsWithLogs.length} bet(s) to ${filename}`);
            } else {
              console.error('❌ Export failed:', resp?.error);
              alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
            }
          });
        });
      });
    }

    // Export ALL bets as CSV
    const exportCsvAllBtn = document.getElementById('export-csv-all-btn');
    if (exportCsvAllBtn) {
      exportCsvAllBtn.addEventListener('click', () => {
        api.storage.local.get({ bets: [], commission: DEFAULT_COMMISSION_RATES, stakingSettings: {} }, (res) => {
          const allBets = res.bets || [];
          const commission = res.commission || DEFAULT_COMMISSION_RATES;
          const stakingSettings = res.stakingSettings || {};
          
          if (allBets.length === 0) {
            alert('ℹ️ No bets to export.');
            return;
          }
          
          // Build CSV header (27 columns matching popup.js)
          const rows = [];
          rows.push([
            'timestamp', 'bookmaker', 'sport', 'event', 'tournament', 'market', 'is_lay',
            'odds', 'probability', 'overvalue', 'stake', 'liability', 'commission_rate',
            'commission_amount', 'potential_return', 'profit', 'expected_value', 'status',
            'settled_at', 'actual_pl', 'note', 'url', 'limit', 'limit_tier',
            'recommended_kelly_stake', 'fill_ratio_percent', 'hours_to_event'
          ].join(','));
          
          for (const b of allBets) {
            const esc = (v) => `\"${('' + (v ?? '')).replace(/\"/g, '\"\"')}\"`;
            const commRate = getCommissionRate(b.bookmaker, commission);
            
            // Calculate profit and liability with commission
            let profit = '';
            let potential = '';
            let commissionAmount = '';
            let liability = '';
            
            if (b.stake && b.odds) {
              if (b.isLay) {
                const layOdds = b.originalLayOdds || b.odds;
                liability = (parseFloat(b.stake) * (parseFloat(layOdds) - 1)).toFixed(2);
                const grossProfit = parseFloat(b.stake);
                const commAmt = commRate > 0 ? (grossProfit * commRate / 100) : 0;
                const netProfit = grossProfit - commAmt;
                profit = netProfit.toFixed(2);
                potential = netProfit.toFixed(2);
                commissionAmount = commAmt.toFixed(2);
              } else {
                const grossProfit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
                const commAmt = commRate > 0 ? (grossProfit * commRate / 100) : 0;
                const netProfit = grossProfit - commAmt;
                profit = netProfit.toFixed(2);
                potential = (parseFloat(b.stake) + netProfit).toFixed(2);
                commissionAmount = commAmt.toFixed(2);
                liability = '0';
              }
            }
            
            // Calculate expected value
            let expectedValue = '';
            if (b.overvalue && b.stake) {
              const ev = (parseFloat(b.overvalue) / 100) * parseFloat(b.stake);
              expectedValue = ev.toFixed(2);
            }
            
            // Calculate actual P/L
            let actualPL = '';
            if (b.stake && b.odds) {
              if (b.status === 'won') {
                actualPL = profit;
              } else if (b.status === 'lost') {
                actualPL = b.isLay ? '-' + liability : '-' + b.stake;
              } else if (b.status === 'void') {
                actualPL = '0';
              }
            }
            
            // Calculate liquidity metrics
            const limitVal = parseFloat(b.limit) || '';
            const limitTier = limitVal ? getLimitTier(limitVal) : '';
            const recommendedKelly = calculateKellyStake(b, stakingSettings, commRate);
            
            let fillRatio = '';
            if (recommendedKelly > 0) {
              fillRatio = ((parseFloat(b.stake) / recommendedKelly) * 100).toFixed(2);
            }
            
            let hoursToEvent = '';
            if (b.eventTime && b.timestamp) {
              const eventTime = new Date(b.eventTime);
              const timestamp = new Date(b.timestamp);
              hoursToEvent = ((eventTime - timestamp) / (1000 * 60 * 60)).toFixed(2);
            }
            
            rows.push([
              esc(b.timestamp),
              esc(b.bookmaker),
              esc(b.sport),
              esc(b.event),
              esc(b.tournament),
              esc(b.market),
              esc(b.isLay ? 'YES' : 'NO'),
              esc(b.odds),
              esc(b.probability),
              esc(b.overvalue),
              esc(b.stake),
              esc(liability),
              esc(commRate),
              esc(commissionAmount),
              esc(potential),
              esc(profit),
              esc(expectedValue),
              esc(b.status || 'pending'),
              esc(b.settledAt || ''),
              esc(actualPL),
              esc(b.note),
              esc(b.url),
              esc(limitVal),
              esc(limitTier),
              esc(recommendedKelly ? recommendedKelly.toFixed(2) : ''),
              esc(fillRatio),
              esc(hoursToEvent)
            ].join(','));
          }
          
          const dataStr = rows.join('\r\n');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `surebet-bets-${timestamp}.csv`;
          
          api.runtime.sendMessage({
            action: 'export',
            dataStr: dataStr,
            filename: filename,
            mime: 'text/csv'
          }, (resp) => {
            if (resp && resp.success) {
              console.log(`✅ Exported ${allBets.length} bet(s) as CSV`);
              alert(`✅ Exported ${allBets.length} bet(s) to ${filename}`);
            } else {
              console.error('❌ Export failed:', resp?.error);
              alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
            }
          });
        });
      });
    }

    // Clear all bets
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (!confirm('⚠️ This will permanently delete ALL saved bets. This cannot be undone. Are you sure?')) {
          return;
        }
        if (!confirm('🚨 Final confirmation: Delete all bets permanently?')) {
          return;
        }

        clearAllBtn.disabled = true;
        clearAllBtn.textContent = '🔄 Deleting...';

        api.runtime.sendMessage({ action: 'clearBets' }, (resp) => {
          clearAllBtn.disabled = false;
          clearAllBtn.textContent = '🗑️ Delete All Bets';

          if (resp && resp.success) {
            console.log('✅ All bets cleared');
            alert('✅ All bets have been permanently deleted.');
            // Trigger bankroll recalculation
            try {
              api.runtime.sendMessage({ action: 'recalculateBankroll' });
            } catch (err) {
              console.warn('⚠️ Unable to trigger bankroll recalc:', err?.message || err);
            }
          } else {
            alert('❌ Failed to clear bets: ' + (resp?.error || 'Unknown error'));
          }
        });
      });
    }

    // Force Player Props Poll button
    const forcePropsPollBtn = document.getElementById('props-force-poll-btn');
    if (forcePropsPollBtn) {
      forcePropsPollBtn.addEventListener('click', async () => {
        forcePropsPollBtn.disabled = true;
        forcePropsPollBtn.textContent = '⏳ Polling...';
        
        const resultDiv = document.getElementById('props-force-poll-result');
        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<span style="color: #666;">🔄 Fetching current odds for player props...</span>';
        }
        
        try {
          console.log('🎯 [PROPS UI] Sending forcePropsPoll message...');
          const response = await new Promise((resolve, reject) => {
            api.runtime.sendMessage({ action: 'forcePropsPoll' }, (resp) => {
              console.log('🎯 [PROPS UI] Raw response:', resp);
              
              // Check for runtime errors
              if (api.runtime.lastError) {
                console.error('🎯 [PROPS UI] Runtime error:', api.runtime.lastError);
                reject(new Error(api.runtime.lastError.message));
                return;
              }
              
              if (resp === undefined) {
                console.error('🎯 [PROPS UI] Response is undefined - background script may not be responding');
                reject(new Error('No response from background script'));
                return;
              }
              
              resolve(resp);
            });
          });
          
          console.log('🎯 [PROPS UI] Processed response:', response);
          
          if (response?.success) {
            const msg = response.updated > 0 
              ? `✅ Success! Updated ${response.updated} of ${response.total} pending player prop bet(s).`
              : `ℹ️ ${response.message || 'No pending player prop bets to poll.'}`;
            if (resultDiv) {
              resultDiv.innerHTML = `<span style="color: ${response.updated > 0 ? '#28a745' : '#666'};">${msg}</span>`;
            }
            alert(msg);
            
            // Refresh API usage stats
            updatePropsApiUsage();
          } else {
            const errorMsg = `❌ Props poll failed: ${response?.error || 'Unknown error'}`;
            if (resultDiv) {
              resultDiv.innerHTML = `<span style="color: #dc3545;">${errorMsg}</span>`;
            }
            alert(errorMsg);
          }
        } catch (err) {
          const errorMsg = `❌ Error: ${err.message}`;
          if (resultDiv) {
            resultDiv.innerHTML = `<span style="color: #dc3545;">${errorMsg}</span>`;
          }
          alert(errorMsg);
        }
        
        forcePropsPollBtn.disabled = false;
        forcePropsPollBtn.textContent = '⚡ Force Poll Now';
      });
    }
    
    // Helper function to update props API usage display
    async function updatePropsApiUsage() {
      const usageDiv = document.getElementById('props-api-usage');
      if (!usageDiv) return;
      
      try {
        const data = await new Promise((resolve) => {
          api.storage.local.get({ propApiUsage: {} }, resolve);
        });
        
        const usage = data.propApiUsage;
        if (usage && usage.monthlyUsed !== undefined) {
          usageDiv.textContent = `Monthly: ${usage.monthlyUsed} / 500 | Daily: ${usage.dailyUsed || 0} / 16 | Manual: ${usage.manualUsed || 0} / 50`;
        }
      } catch (err) {
        console.error('Failed to update props API usage:', err);
      }
    }
    
    // Initial load of props API usage
    updatePropsApiUsage();
    
    // Clear CLV cache (CSV-based)
    const clearClvCacheBtn = document.getElementById('clv-clear-cache-btn');
    if (clearClvCacheBtn) {
      clearClvCacheBtn.addEventListener('click', async () => {
        if (!confirm('Clear all cached CSV CLV data? This will remove all downloaded CSVs (current season entries will be redownloaded on demand).')) {
          return;
        }
        clearClvCacheBtn.disabled = true;
        clearClvCacheBtn.textContent = '🔄 Clearing...';

        // Clear all CSV caches from storage
        api.storage.local.get(null, (allData) => {
          const cacheKeys = Object.keys(allData).filter(key => key.startsWith('csv_cache_'));
          if (cacheKeys.length === 0) {
            alert('ℹ️ No CSV caches to clear.');
            clearClvCacheBtn.disabled = false;
            clearClvCacheBtn.textContent = '🗑️ Clear Cache';
            return;
          }
          api.storage.local.remove(cacheKeys, () => {
            alert(`✅ Cleared ${cacheKeys.length} CSV cache(s).`);
            refreshClvCacheStats();
            clearClvCacheBtn.disabled = false;
            clearClvCacheBtn.textContent = '🗑️ Clear Cache';
          });
        });
      });
    }
    
    // Refresh CLV cache stats
    const refreshClvStatsBtn = document.getElementById('clv-refresh-stats-btn');
    if (refreshClvStatsBtn) {
      refreshClvStatsBtn.addEventListener('click', refreshClvCacheStats);
    }
    
    // Check updates button is deprecated - OddsHarvester removed
    const checkUpdatesBtn = document.getElementById('clv-check-updates-btn');
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', () => {
        alert('OddsHarvester has been removed. CSV-based CLV does not support a local harvester update.');
      });
    }
    
    // Open setup guide
    const openGuideBtn = document.getElementById('clv-open-setup-guide-btn');
    if (openGuideBtn) {
      openGuideBtn.addEventListener('click', () => {
        api.tabs.create({ url: 'https://github.com/tacticdemonic/surebet-helper-extension/blob/main/sb-logger-extension/CLV_SETUP_GUIDE.md' });
      });
    }
    
    // Download installer script link (deprecated)
    const downloadInstallerLink = document.getElementById('clv-download-installer');
    if (downloadInstallerLink) {
      // Hide link since OddsHarvester has been removed
      downloadInstallerLink.style.display = 'none';
    }
  }
  
  // ========== CLV HELPER FUNCTIONS ==========
  
  function updateClvConnectionStatus(connected, data = null) {
    const indicator = document.getElementById('clv-status-indicator');
    const instructions = document.getElementById('clv-setup-instructions');
    const versionEl = document.getElementById('clv-harvester-version');
    
    if (indicator) {
      if (connected) {
        indicator.innerHTML = '✅ Connected';
        indicator.style.color = '#28a745';
      } else {
        indicator.innerHTML = '❌ Offline';
        indicator.style.color = '#dc3545';
      }
    }
    
    if (instructions) {
      instructions.style.display = connected ? 'none' : 'block';
    }
    
    if (versionEl && data?.version) {
      versionEl.textContent = data.version || 'Unknown';
    }
  }
  
  async function checkClvConnection() {
    // CSV-based CLV does not require a local server. Set status based on whether CSV CLV is enabled.
    const clvEnabled = document.getElementById('clv-enabled')?.checked || false;
    const versionData = clvEnabled ? { version: 'CSV-based' } : null;
    updateClvConnectionStatus(!!clvEnabled, versionData);
    // Refresh cache-based stats
    refreshClvCacheStats();
  }
  
  async function refreshClvCacheStats() {
    const dbSizeEl = document.getElementById('clv-db-size');
    const cacheStatsEl = document.getElementById('clv-cache-stats');
    try {
      api.storage.local.get(null, (allData) => {
        const cacheKeys = Object.keys(allData).filter(k => k.startsWith('csv_cache_'));
        const cachedLeagues = cacheKeys.length;
        let cachedOdds = 0;
        let approxBytes = 0;
        for (const k of cacheKeys) {
          try {
            const val = allData[k];
            if (val && val.rows && Array.isArray(val.rows)) {
              cachedOdds += val.rows.length;
              // rough size estimate - stringified length
              approxBytes += JSON.stringify(val).length;
            }
          } catch (e) {
            // ignore errors
          }
        }

        if (dbSizeEl) {
          if (approxBytes >= 1024 * 1024) {
            dbSizeEl.textContent = `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`;
          } else {
            dbSizeEl.textContent = `${Math.round(approxBytes / 1024)} KB`;
          }
        }
        if (cacheStatsEl) {
          cacheStatsEl.innerHTML = `Leagues cached: ${cachedLeagues || 0}<br>Odds cached: ${cachedOdds || 0}`;
        }
      });
    } catch (err) {
      if (dbSizeEl) dbSizeEl.textContent = '--';
      if (cacheStatsEl) cacheStatsEl.innerHTML = 'Leagues cached: --<br>Odds cached: --';
    }
  }
  
  // Auto-check CLV connection when section is shown
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.section === 'clv') {
        checkClvConnection();
      }
    });
  });
  
  // Check CLV connection on initial load if CLV section is active
  if (window.location.hash === '#clv') {
    setTimeout(checkClvConnection, 500);
  }

  // Kelly Staking Settings
  const kellySection = document.getElementById('kelly-section');
  const kellySummary = document.getElementById('kelly-summary');
  
  function loadKellySettings() {
    api.storage.local.get({ stakingSettings: {
      bankroll: 1000,
      baseBankroll: 1000,
      fraction: 0.25,
      useCommission: true,
      adjustForPending: false,
      maxBetPercent: null,
      effectiveBankroll: null
    }}, (res) => {
      const settings = res.stakingSettings || {};
      const bankroll = settings.bankroll || 1000;
      const baseBankroll = settings.baseBankroll || bankroll;
      const fraction = (settings.fraction || 0.25) * 100;
      const useCommission = settings.useCommission !== false;
      const adjustForPending = settings.adjustForPending || false;
      const maxBetPercent = settings.maxBetPercent || '';
      
      document.getElementById('kelly-bankroll').value = baseBankroll;
      document.getElementById('kelly-fraction').value = fraction;
      document.getElementById('kelly-use-commission').checked = useCommission;
      document.getElementById('kelly-adjust-pending').checked = adjustForPending;
      document.getElementById('kelly-max-bet-percent').value = maxBetPercent ? (maxBetPercent * 100).toFixed(0) : '';
      
      updateKellySummary(bankroll, baseBankroll, fraction, useCommission, adjustForPending, settings.effectiveBankroll);
    });
  }
  
  function updateKellySummary(bankroll, baseBankroll, fractionPercent, useCommission, adjustForPending, effectiveBankroll) {
    const profitLoss = bankroll - baseBankroll;
    const plClass = profitLoss >= 0 ? 'green' : 'red';
    const plSign = profitLoss >= 0 ? '+' : '';
    
    let summaryHTML = `
      <strong>Current Bankroll:</strong> £${bankroll.toFixed(2)}<br>
      <strong>Starting Bankroll:</strong> £${baseBankroll.toFixed(2)}<br>
      <strong>P/L:</strong> <span style="color: ${plClass}">${plSign}£${profitLoss.toFixed(2)}</span><br>
      <strong>Kelly Fraction:</strong> ${fractionPercent}%<br>
      <strong>Commission Adjustment:</strong> ${useCommission ? '✓ Enabled' : '✗ Disabled'}<br>
      <strong>Pending Bet Adjustment:</strong> ${adjustForPending ? '✅ Enabled' : '❌ Disabled'}
    `;
    
    if (adjustForPending && effectiveBankroll != null) {
      const pendingStakes = bankroll - effectiveBankroll;
      summaryHTML += `<br><strong>Effective Bankroll:</strong> £${effectiveBankroll.toFixed(2)} (£${pendingStakes.toFixed(2)} pending, £${effectiveBankroll.toFixed(2)} available)`;
      
      if (effectiveBankroll <= 0) {
        summaryHTML += '<br><span style="color: red;">⚠️ WARNING: Pending bets exceed bankroll. New stakes disabled.</span>';
      }
    }
    
    kellySummary.innerHTML = summaryHTML;
  }
  
  if (kellySection) {
    loadKellySettings();
    
    const saveKellyBtn = document.getElementById('save-kelly-btn');
    if (saveKellyBtn) {
      saveKellyBtn.addEventListener('click', () => {
        const bankroll = parseFloat(document.getElementById('kelly-bankroll').value) || 1000;
        const fractionPercent = parseFloat(document.getElementById('kelly-fraction').value) || 25;
        const fraction = fractionPercent / 100;
        const useCommission = document.getElementById('kelly-use-commission').checked;
        const adjustForPending = document.getElementById('kelly-adjust-pending').checked;
        const maxBetPercentInput = parseFloat(document.getElementById('kelly-max-bet-percent').value);
        const maxBetPercent = !isNaN(maxBetPercentInput) ? maxBetPercentInput / 100 : null;
        
        // Validate max bet percent
        if (maxBetPercent !== null) {
          if (maxBetPercent > 0.50) {
            alert('⚠️ Warning: Max bet cap >50% not recommended by experts. This defeats the purpose of Kelly staking.\n\nConsider 10% for conservative betting or 20% for moderate risk.');
          } else if (maxBetPercent > 0.25) {
            alert('⚠️ Warning: Max bet cap >25% may increase variance. RebelBetting recommends ≤10% for safety.');
          }
        }
        
        api.storage.local.get({ stakingSettings: {} }, (res) => {
          const currentBankroll = res.stakingSettings?.bankroll || bankroll;
          
          const newSettings = {
            bankroll: currentBankroll,
            baseBankroll: bankroll,
            fraction: fraction,
            useCommission: useCommission,
            adjustForPending: adjustForPending,
            maxBetPercent: maxBetPercent,
            effectiveBankroll: res.stakingSettings?.effectiveBankroll || null
          };
          
          api.storage.local.set({ stakingSettings: newSettings }, () => {
            alert('✅ Kelly staking settings saved!');
            // Trigger effective bankroll recalculation
            if (adjustForPending) {
              // Send message to background script to recalculate
              api.runtime.sendMessage({ action: 'recalculateEffectiveBankroll' }, () => {
                loadKellySettings();
              });
            } else {
              loadKellySettings();
            }
          });
        });
      });
    }
    
    const resetKellyBtn = document.getElementById('reset-kelly-btn');
    if (resetKellyBtn) {
      resetKellyBtn.addEventListener('click', () => {
        if (confirm('Reset Kelly settings to defaults?')) {
          const defaults = {
            bankroll: 1000,
            baseBankroll: 1000,
            fraction: 0.25,
            useCommission: true,
            adjustForPending: false,
            maxBetPercent: null,
            effectiveBankroll: null
          };
          api.storage.local.set({ stakingSettings: defaults }, () => {
            alert('✅ Kelly settings reset to defaults');
            loadKellySettings();
          });
        }
      });
    }
  }

  // API Link buttons
  const apiFootballLink = document.getElementById('api-football-link');
  if (apiFootballLink) {
    apiFootballLink.addEventListener('click', () => {
      api.tabs.create({ url: 'https://www.api-football.com/' });
    });
  }

  const oddsApiLink = document.getElementById('odds-api-link');
  if (oddsApiLink) {
    oddsApiLink.addEventListener('click', () => {
      api.tabs.create({ url: 'https://the-odds-api.com/' });
    });
  }

  // ========== API DIAGNOSTICS SECTION ==========
  
  // Load and display rate limits
  async function loadRateLimits() {
    return new Promise((resolve) => {
      api.storage.local.get({ apiRateLimits: {} }, (res) => {
        const limits = res.apiRateLimits || {};
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.slice(0, 7);
        
        // Sports with their endpoints
        const sports = {
          football: { emoji: '⚽', limit: 100 },
          basketball: { emoji: '🏀', limit: 100 },
          hockey: { emoji: '🏒', limit: 100 },
          baseball: { emoji: '⚾', limit: 100 },
          nfl: { emoji: '🏈', limit: 100 },
          rugby: { emoji: '🏉', limit: 100 },
          volleyball: { emoji: '🏐', limit: 100 },
          handball: { emoji: '🤾', limit: 100 },
          afl: { emoji: '🏈', limit: 100 }
        };
        
        const stats = {};
        const warnings = [];
        
        // Process each sport
        for (const [sport, config] of Object.entries(sports)) {
          const data = limits[sport] || { count: 0, resetDate: today };
          const isToday = data.resetDate === today;
          const used = isToday ? data.count : 0;
          const remaining = config.limit - used;
          
          stats[sport] = {
            emoji: config.emoji,
            used,
            limit: config.limit,
            remaining,
            nearLimit: used >= config.limit * 0.9
          };
          
          if (stats[sport].nearLimit && used > 0) {
            warnings.push(`${config.emoji} ${sport}: ${used}/${config.limit}`);
          }
        }
        
        // Add Odds API (monthly)
        const oddsData = limits.oddsApi || { count: 0, resetMonth: thisMonth };
        const isThisMonth = oddsData.resetMonth === thisMonth;
        const oddsUsed = isThisMonth ? oddsData.count : 0;
        stats.oddsApi = {
          emoji: '🌐',
          used: oddsUsed,
          limit: 500,
          remaining: 500 - oddsUsed,
          nearLimit: oddsUsed >= 450,
          isMonthly: true
        };
        
        if (stats.oddsApi.nearLimit && oddsUsed > 0) {
          warnings.push(`🌐 Odds API: ${oddsUsed}/500 (monthly)`);
        }
        
        resolve({ stats, warnings });
      });
    });
  }
  
  function renderRateLimits() {
    loadRateLimits().then(({ stats, warnings }) => {
      const grid = document.getElementById('rate-limits-grid');
      const warningDiv = document.getElementById('rate-limit-warning');
      const warningText = document.getElementById('rate-limit-warning-text');
      
      if (!grid) return;
      
      // Render warning if any
      if (warnings.length > 0) {
        warningDiv.style.display = 'block';
        warningText.textContent = `Approaching limits: ${warnings.join(', ')}`;
      } else {
        warningDiv.style.display = 'none';
      }
      
      // Render stats grid
      let html = '';
      for (const [sport, data] of Object.entries(stats)) {
        const percentage = Math.round((data.used / data.limit) * 100);
        const barColor = data.nearLimit ? '#dc3545' : (data.used > 0 ? '#ffc107' : '#28a745');
        const periodLabel = data.isMonthly ? '/mo' : '/day';
        const displayName = sport === 'oddsApi' ? 'Odds API' : sport.charAt(0).toUpperCase() + sport.slice(1);
        
        html += `
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid ${data.nearLimit ? '#dc3545' : '#dee2e6'};">
            <div style="font-size: 16px; margin-bottom: 4px;">${data.emoji}</div>
            <div style="font-size: 11px; font-weight: 600; color: #333;">${displayName}</div>
            <div style="font-size: 10px; color: #666; margin-bottom: 4px;">${data.used}/${data.limit}${periodLabel}</div>
            <div style="height: 4px; background: #e9ecef; border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${percentage}%; background: ${barColor};"></div>
            </div>
          </div>
        `;
      }
      
      grid.innerHTML = html;
    });
  }
  
  // Load diagnostic log
  async function loadDiagnosticLog(typeFilter = null) {
    return new Promise((resolve) => {
      api.storage.local.get({ apiDiagnosticLog: [] }, (res) => {
        let log = res.apiDiagnosticLog || [];
        
        // Filter by type if specified
        if (typeFilter) {
          log = log.filter(e => e.type === typeFilter);
        }
        
        // Return most recent entries (reversed for newest first)
        resolve(log.slice(-100).reverse());
      });
    });
  }
  
  function renderDiagnosticLog(entries) {
    const container = document.getElementById('diagnostics-log');
    if (!container) return;
    
    if (!entries || entries.length === 0) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">No diagnostic entries found.</div>';
      return;
    }
    
    // Store entries for detail view
    window._diagnosticEntries = entries;
    
    let html = '';
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const time = new Date(entry.timestamp).toLocaleString();
      let bgColor = '#fff';
      let icon = '📝';
      let borderColor = '#28a745';
      
      switch (entry.type) {
        case 'api_response':
          icon = '📡';
          bgColor = '#e7f3ff';
          borderColor = '#007bff';
          break;
        case 'match_success':
          icon = '✅';
          bgColor = '#d4edda';
          borderColor = '#28a745';
          break;
        case 'match_failure':
          icon = '❌';
          bgColor = '#f8d7da';
          borderColor = '#dc3545';
          break;
        case 'api_error':
          icon = '⚠️';
          bgColor = '#fff3cd';
          borderColor = '#ffc107';
          break;
        case 'unsupported_sport':
          icon = '🚫';
          bgColor = '#f8d7da';
          borderColor = '#dc3545';
          break;
        case 'result_determined':
          icon = '🎯';
          bgColor = '#d4edda';
          borderColor = '#28a745';
          break;
      }
      
      let details = '';
      let extraInfo = '';
      
      if (entry.type === 'api_response') {
        details = `${entry.sport} - ${entry.date} - ${entry.fixtureCount} fixtures`;
        if (entry.sampleFixtures && entry.sampleFixtures.length > 0) {
          details += `<br><span style="color: #666; font-size: 10px;">Sample: ${entry.sampleFixtures.map(f => f.teams?.home + ' vs ' + f.teams?.away).join(', ')}</span>`;
        }
      } else if (entry.type === 'match_success') {
        details = `${entry.betEvent || 'Unknown'} → ${entry.matchedFixture}`;
        extraInfo = `Match type: ${entry.matchType || 'unknown'}`;
      } else if (entry.type === 'match_failure') {
        details = `<strong>${entry.bet?.event || 'Unknown'}</strong>`;
        extraInfo = `Reason: ${entry.reason}`;
        
        // Show searched teams
        if (entry.searchedTeams) {
          details += `<br><span style="color: #666; font-size: 10px;">Searched: "${entry.searchedTeams.team1?.normalized || entry.searchedTeams.team1}" vs "${entry.searchedTeams.team2?.normalized || entry.searchedTeams.team2}"</span>`;
        }
        
        // Show top candidates with similarity scores
        if (entry.topCandidates && entry.topCandidates.length > 0) {
          details += `<br><span style="color: #666; font-size: 10px;"><strong>Top candidates:</strong></span>`;
          entry.topCandidates.slice(0, 3).forEach((c, idx) => {
            const scoreColor = parseFloat(c.score) > 0.5 ? '#856404' : '#6c757d';
            details += `<br><span style="color: ${scoreColor}; font-size: 10px; margin-left: 10px;">${idx + 1}. ${c.fixture} (${(parseFloat(c.score) * 100).toFixed(0)}%)</span>`;
            if (c.sim1Home && c.sim2Away) {
              details += `<span style="color: #888; font-size: 9px;"> [h1:${(parseFloat(c.sim1Home)*100).toFixed(0)}% a2:${(parseFloat(c.sim2Away)*100).toFixed(0)}%]</span>`;
            }
          });
        }
        
        if (entry.totalFixturesSearched) {
          extraInfo += ` | Searched ${entry.totalFixturesSearched} fixtures | Threshold: ${entry.matchThreshold || 0.65}`;
        }
      } else if (entry.type === 'api_error') {
        details = `${entry.sport} - ${entry.error}`;
      } else if (entry.type === 'unsupported_sport') {
        details = `${entry.sport} - ${entry.bet?.event || 'Unknown'}`;
      } else if (entry.type === 'result_determined') {
        details = `${entry.bet?.event || 'Unknown'} → <strong>${entry.outcome?.toUpperCase()}</strong> (${entry.score})`;
      } else {
        details = JSON.stringify(entry).substring(0, 100);
      }
      
      html += `
        <div class="diagnostic-entry" data-index="${i}" style="background: ${bgColor}; padding: 8px; margin-bottom: 6px; border-radius: 3px; border-left: 3px solid ${borderColor}; cursor: pointer;" onclick="showDiagnosticDetail(${i})">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 600;">${icon} ${entry.type}</span>
            <span style="color: #888; font-size: 10px;">${time}</span>
          </div>
          <div style="font-size: 11px;">${details}</div>
          ${extraInfo ? `<div style="font-size: 10px; color: #666; margin-top: 4px;">${extraInfo}</div>` : ''}
          <div style="font-size: 9px; color: #007bff; margin-top: 4px;">Click to view full details →</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
  
  // Show diagnostic detail modal
  window.showDiagnosticDetail = function(index) {
    const entries = window._diagnosticEntries;
    if (!entries || !entries[index]) return;
    
    const entry = entries[index];
    const modal = document.getElementById('diagnostic-detail-modal');
    const content = document.getElementById('diagnostic-detail-content');
    
    if (modal && content) {
      content.textContent = JSON.stringify(entry, null, 2);
      modal.style.display = 'block';
    }
  };
  
  // Close detail modal
  const closeDetailModal = document.getElementById('close-detail-modal');
  if (closeDetailModal) {
    closeDetailModal.addEventListener('click', () => {
      document.getElementById('diagnostic-detail-modal').style.display = 'none';
    });
  }
  
  // Close modal on background click
  const detailModal = document.getElementById('diagnostic-detail-modal');
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        detailModal.style.display = 'none';
      }
    });
  }
  
  // Set up diagnostics event listeners
  const loadDiagnosticsBtn = document.getElementById('load-diagnostics-btn');
  if (loadDiagnosticsBtn) {
    loadDiagnosticsBtn.addEventListener('click', () => {
      const filter = document.getElementById('diagnostic-filter')?.value || null;
      loadDiagnosticLog(filter).then(entries => {
        renderDiagnosticLog(entries);
      });
    });
  }
  
  const exportDiagnosticsBtn = document.getElementById('export-diagnostics-btn');
  if (exportDiagnosticsBtn) {
    exportDiagnosticsBtn.addEventListener('click', () => {
      api.storage.local.get({ apiDiagnosticLog: [], apiRateLimits: {} }, (res) => {
        const exportData = {
          exportDate: new Date().toISOString(),
          diagnosticLog: res.apiDiagnosticLog || [],
          rateLimits: res.apiRateLimits || {}
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
      });
    });
  }
  
  const clearDiagnosticsBtn = document.getElementById('clear-diagnostics-btn');
  if (clearDiagnosticsBtn) {
    clearDiagnosticsBtn.addEventListener('click', () => {
      if (!confirm('Clear all diagnostic log entries?')) return;
      
      api.storage.local.set({ apiDiagnosticLog: [] }, () => {
        console.log('✅ Diagnostic log cleared');
        document.getElementById('diagnostics-log').innerHTML = '<div style="color: #666; padding: 10px;">Log cleared.</div>';
      });
    });
  }
  
  const refreshRateLimitsBtn = document.getElementById('refresh-rate-limits-btn');
  if (refreshRateLimitsBtn) {
    refreshRateLimitsBtn.addEventListener('click', () => {
      renderRateLimits();
    });
  }
  
  // ========== VERBOSE MODE TOGGLE ==========
  const verboseToggle = document.getElementById('verbose-diagnostics-toggle');
  if (verboseToggle) {
    // Load current setting
    api.storage.local.get({ verboseDiagnosticMode: false }, (res) => {
      verboseToggle.checked = res.verboseDiagnosticMode || false;
    });
    
    // Save on change
    verboseToggle.addEventListener('change', () => {
      const enabled = verboseToggle.checked;
      api.storage.local.set({ verboseDiagnosticMode: enabled }, () => {
        console.log('🔬 Verbose diagnostic mode:', enabled ? 'ENABLED' : 'DISABLED');
        // Also notify background script to update the in-memory flag
        api.runtime.sendMessage({ action: 'setVerboseDiagnosticMode', enabled }, (response) => {
          if (response?.success) {
            console.log('✅ Background updated verbose mode');
          }
        });
      });
    });
  }
  
  // ========== TEST MATCH TOOL ==========
  const testMatchBtn = document.getElementById('test-match-btn');
  const testEventDate = document.getElementById('test-event-date');
  
  // Set default date to today
  if (testEventDate) {
    testEventDate.value = new Date().toISOString().split('T')[0];
  }
  
  if (testMatchBtn) {
    testMatchBtn.addEventListener('click', async () => {
      const eventName = document.getElementById('test-event-name').value.trim();
      const sport = document.getElementById('test-event-sport').value;
      const date = document.getElementById('test-event-date').value;
      const resultDiv = document.getElementById('test-match-result');
      
      if (!eventName) {
        alert('Please enter an event name to test');
        return;
      }
      
      if (!date) {
        alert('Please select a date');
        return;
      }
      
      testMatchBtn.disabled = true;
      testMatchBtn.textContent = '🔄 Testing...';
      resultDiv.style.display = 'block';
      resultDiv.style.background = '#e7f3ff';
      resultDiv.innerHTML = '<div style="color: #666;">Fetching fixtures and testing match...</div>';
      
      try {
        // Send test request to background script
        api.runtime.sendMessage({
          action: 'testMatchEvent',
          eventName,
          sport,
          date
        }, (response) => {
          testMatchBtn.disabled = false;
          testMatchBtn.textContent = '🔍 Test Match';
          
          if (response?.error) {
            resultDiv.style.background = '#f8d7da';
            resultDiv.innerHTML = `<strong>❌ Error:</strong> ${response.error}`;
            return;
          }
          
          if (response?.matchFound) {
            resultDiv.style.background = '#d4edda';
            resultDiv.innerHTML = `
              <strong>✅ Match Found!</strong><br>
              <strong>Matched:</strong> ${response.matchedFixture}<br>
              <strong>Match Type:</strong> ${response.matchType}<br>
              <strong>Similarity:</strong> ${response.similarity || 'N/A'}<br>
              <strong>Status:</strong> ${response.status || 'Unknown'}<br>
              ${response.score ? `<strong>Score:</strong> ${response.score}` : ''}
            `;
          } else {
            resultDiv.style.background = '#fff3cd';
            let html = `
              <strong>⚠️ No Match Found</strong><br>
              <strong>Searched for:</strong> "${response.searchedTeams?.team1}" vs "${response.searchedTeams?.team2}"<br>
              <strong>Fixtures searched:</strong> ${response.fixturesCount || 0}<br>
              <br><strong>Top Candidates:</strong>
            `;
            
            if (response.topCandidates && response.topCandidates.length > 0) {
              html += '<div style="margin-top: 8px; max-height: 150px; overflow-y: auto;">';
              response.topCandidates.forEach((c, i) => {
                const scoreColor = parseFloat(c.score) > 0.5 ? '#856404' : '#6c757d';
                html += `<div style="margin: 4px 0; padding: 4px; background: rgba(255,255,255,0.5); border-radius: 2px;">
                  <span style="color: ${scoreColor}; font-weight: 600;">${i + 1}. ${c.fixture}</span>
                  <span style="color: #666;"> (${(parseFloat(c.score) * 100).toFixed(0)}%)</span>
                  ${c.sim1Home ? `<br><span style="font-size: 10px; color: #888;">Similarity: home1=${(parseFloat(c.sim1Home)*100).toFixed(0)}%, away2=${(parseFloat(c.sim2Away)*100).toFixed(0)}%</span>` : ''}
                </div>`;
              });
              html += '</div>';
            } else {
              html += '<br><em>No candidates found. Check if the date is correct and API has data for this sport.</em>';
            }
            
            resultDiv.innerHTML = html;
          }
        });
      } catch (err) {
        testMatchBtn.disabled = false;
        testMatchBtn.textContent = '🔍 Test Match';
        resultDiv.style.background = '#f8d7da';
        resultDiv.innerHTML = `<strong>❌ Error:</strong> ${err.message}`;
      }
    });
  }
  
  // ========== RETRY PENDING BETS ==========
  const retryPendingBtn = document.getElementById('retry-pending-btn');
  const retryPendingStatus = document.getElementById('retry-pending-status');
  
  if (retryPendingBtn) {
    retryPendingBtn.addEventListener('click', () => {
      retryPendingBtn.disabled = true;
      retryPendingBtn.textContent = '🔄 Checking...';
      if (retryPendingStatus) retryPendingStatus.textContent = 'Triggering result check...';
      
      api.runtime.sendMessage({ action: 'checkResults', force: true }, (response) => {
        retryPendingBtn.disabled = false;
        retryPendingBtn.textContent = '🔄 Retry All Pending Bets';
        
        if (response?.success) {
          if (retryPendingStatus) {
            retryPendingStatus.innerHTML = `<span style="color: #28a745;">✅ Check complete! ${response.checked || 0} bet(s) processed, ${response.settled || 0} settled.</span>`;
          }
          // Reload diagnostics to show new entries
          setTimeout(() => {
            loadDiagnosticLog().then(entries => renderDiagnosticLog(entries));
          }, 1000);
        } else {
          if (retryPendingStatus) {
            retryPendingStatus.innerHTML = `<span style="color: #dc3545;">❌ ${response?.error || 'Check failed'}</span>`;
          }
        }
      });
    });
  }
  
  // Auto-load rate limits when diagnostics section is shown
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.section === 'diagnostics') {
        renderRateLimits();
      }
    });
  });
  
  // Load rate limits on initial load if diagnostics section is active
  if (window.location.hash === '#diagnostics') {
    renderRateLimits();
  }
  
  // ========== HELPER FUNCTIONS FOR EXPORT ==========
  
  function getCommissionRate(bookmaker, commissionSettings) {
    const normalized = bookmaker?.toLowerCase() || '';
    if (normalized.includes('betfair')) return commissionSettings.betfair || 5.0;
    if (normalized.includes('betdaq')) return commissionSettings.betdaq || 2.0;
    if (normalized.includes('matchbook')) return commissionSettings.matchbook || 1.0;
    if (normalized.includes('smarkets')) return commissionSettings.smarkets || 2.0;
    return 0;
  }
  
  function getLimitTier(limit) {
    if (limit >= 1000) return 'High (£1000+)';
    if (limit >= 500) return 'Medium (£500-£999)';
    if (limit >= 100) return 'Low (£100-£499)';
    return 'Very Low (<£100)';
  }
  
  function calculateKellyStake(bet, stakingSettings, commRate) {
    if (!stakingSettings.bankroll || !bet.odds || !bet.probability) return 0;
    
    const bankroll = stakingSettings.effectiveBankroll || stakingSettings.bankroll || 1000;
    const fraction = stakingSettings.fraction || 0.25;
    const useCommission = stakingSettings.useCommission !== false;
    
    let odds = parseFloat(bet.odds);
    if (useCommission && commRate > 0 && !bet.isLay) {
      odds = 1 + ((odds - 1) * (1 - commRate / 100));
    }
    
    const prob = parseFloat(bet.probability) / 100;
    const q = 1 - prob;
    const b = odds - 1;
    
    const kelly = (b * prob - q) / b;
    if (kelly <= 0) return 0;
    
    let stake = bankroll * kelly * fraction;
    
    if (stakingSettings.maxBetPercent) {
      const maxStake = bankroll * stakingSettings.maxBetPercent;
      stake = Math.min(stake, maxStake);
    }
    
    return stake;
  }
  
  function calculateLiquidityTierStats(bets) {
    const tiers = { high: 0, medium: 0, low: 0, veryLow: 0, unknown: 0 };
    bets.forEach(b => {
      const limit = parseFloat(b.limit);
      if (!limit) {
        tiers.unknown++;
      } else if (limit >= 1000) {
        tiers.high++;
      } else if (limit >= 500) {
        tiers.medium++;
      } else if (limit >= 100) {
        tiers.low++;
      } else {
        tiers.veryLow++;
      }
    });
    return tiers;
  }
  
  function calculateBookmakerStats(bets) {
    const stats = {};
    bets.forEach(b => {
      if (!b.bookmaker) return;
      if (!stats[b.bookmaker]) {
        stats[b.bookmaker] = { count: 0, totalStake: 0, avgLimit: 0 };
      }
      stats[b.bookmaker].count++;
      stats[b.bookmaker].totalStake += parseFloat(b.stake) || 0;
      if (b.limit) {
        stats[b.bookmaker].avgLimit = (stats[b.bookmaker].avgLimit * (stats[b.bookmaker].count - 1) + parseFloat(b.limit)) / stats[b.bookmaker].count;
      }
    });
    return stats;
  }
  
  function calculateTemporalStats(bets) {
    const hourlyDistribution = Array(24).fill(0);
    bets.forEach(b => {
      if (b.timestamp) {
        const hour = new Date(b.timestamp).getHours();
        hourlyDistribution[hour]++;
      }
    });
    return { hourlyDistribution };
  }
  
  function calculateKellyStats(bets, stakingSettings) {
    let totalBets = 0;
    let settledBets = 0;
    let exceedingKelly = 0;
    let totalFillRatio = 0;
    
    bets.forEach(b => {
      if (!b.stake || !stakingSettings.bankroll) return;
      totalBets++;
      
      const recommendedKelly = calculateKellyStake(b, stakingSettings, 0);
      if (recommendedKelly > 0) {
        const fillRatio = parseFloat(b.stake) / recommendedKelly;
        totalFillRatio += fillRatio;
        if (fillRatio > 1) exceedingKelly++;
      }
      
      if (b.status && b.status !== 'pending') settledBets++;
    });
    
    return {
      totalBets,
      settledBets,
      exceedingKelly,
      exceedingKellyPercent: totalBets > 0 ? (exceedingKelly / totalBets * 100).toFixed(2) : 0,
      avgFillRatio: totalBets > 0 ? (totalFillRatio / totalBets).toFixed(2) : 0
    };
  }

  // Market Filter Settings
  const DEFAULT_UI_PREFERENCES = {
    marketFilterEnabled: false,
    marketFilterMode: 'hide',
    activePresets: []
  };

  function loadMarketFilterSettings() {
    api.storage.local.get({ 
      uiPreferences: DEFAULT_UI_PREFERENCES,
      bets: []
    }, (res) => {
      const prefs = res.uiPreferences || DEFAULT_UI_PREFERENCES;
      const bets = res.bets || [];
      
      // Set checkbox
      const enabledCheckbox = document.getElementById('market-filter-enabled');
      if (enabledCheckbox) {
        enabledCheckbox.checked = prefs.marketFilterEnabled || false;
      }
      
      // Set radio buttons
      const hideRadio = document.getElementById('filter-mode-hide');
      const highlightRadio = document.getElementById('filter-mode-highlight');
      if (hideRadio && highlightRadio) {
        if (prefs.marketFilterMode === 'highlight') {
          highlightRadio.checked = true;
        } else {
          hideRadio.checked = true;
        }
      }
      
      // Calculate and display ROI for each preset
      const presetIds = ['cards', 'asian_handicap', 'dnb', 'goals_only', 'corners_only'];
      presetIds.forEach(presetId => {
        const roiData = calculateMarketROI(bets, presetId);
        const roiWarning = getROIWarningText(roiData);
        
        // Update the ROI text in the preset box
        const roiSpan = document.getElementById(`roi-${presetId}`);
        if (roiSpan) {
          roiSpan.textContent = roiWarning.text;
          roiSpan.style.color = roiWarning.color;
        }
      });
      
      // Set active preset boxes
      const activePresets = prefs.activePresets || [];
      document.querySelectorAll('.preset-box').forEach(box => {
        const presetId = box.dataset.preset;
        if (activePresets.includes(presetId)) {
          box.classList.add('active');
        } else {
          box.classList.remove('active');
        }
      });
      
      console.log('🎯 Market filter settings loaded:', prefs);
    });
  }

  function saveMarketFilterSettings() {
    const enabledCheckbox = document.getElementById('market-filter-enabled');
    const hideRadio = document.getElementById('filter-mode-hide');
    const highlightRadio = document.getElementById('filter-mode-highlight');
    
    const activePresets = [];
    document.querySelectorAll('.preset-box.active').forEach(box => {
      activePresets.push(box.dataset.preset);
    });
    
    // Read existing uiPreferences to preserve other settings
    api.storage.local.get({ uiPreferences: {} }, (res) => {
      const updatedPreferences = {
        ...res.uiPreferences,
        marketFilterEnabled: enabledCheckbox ? enabledCheckbox.checked : false,
        marketFilterMode: highlightRadio && highlightRadio.checked ? 'highlight' : 'hide',
        activePresets: activePresets
      };
      
      api.storage.local.set({ uiPreferences: updatedPreferences }, () => {
      console.log('💾 Market filter settings saved:', updatedPreferences);
      // Show success message
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;top:20px;right:20px;background:#28a745;color:#fff;padding:15px 20px;border-radius:4px;z-index:9999;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
      msg.textContent = '✓ Market filter settings saved!';
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 2000);
      });
    });
  }

  // Market filter preset definitions (duplicated from popup.js)
  const MARKET_FILTER_PRESETS = {
    cards: {
      name: '🚫 Cards/Bookings',
      keywords: ['card', 'booking', 'yellow', 'red'],
      type: 'block'
    },
    asian_handicap: {
      name: '🚫 Asian Handicaps',
      keywords: ['asian handicap', 'ah'],
      type: 'block'
    },
    dnb: {
      name: '🚫 Draw No Bet',
      keywords: ['draw no bet', 'dnb'],
      type: 'block'
    },
    shots: {
      name: '🚫 Shots',
      keywords: ['shot', 'shots on target', 'sot'],
      type: 'block'
    },
    player_props: {
      name: '🚫 Player Props',
      keywords: ['anytime goalscorer', 'first goalscorer', 'last goalscorer', 'to score', 'player to', 'assist'],
      type: 'block'
    },
    correct_score: {
      name: '🚫 Correct Score',
      keywords: ['correct score', 'exact score'],
      type: 'block'
    },
    goals_only: {
      name: '✅ Goals Only',
      keywords: ['goal', 'btts', 'over', 'under', 'total'],
      type: 'whitelist'
    },
    corners_only: {
      name: '✅ Corners Only',
      keywords: ['corner'],
      type: 'whitelist'
    }
  };

  // Get commission for bookmaker (duplicated from popup.js)
  function getCommission(bookmaker) {
    if (!bookmaker) return 0;
    const bookie = bookmaker.toLowerCase();
    const commissionRates = {
      betfair: 5.0,
      betdaq: 2.0,
      matchbook: 1.0,
      smarkets: 2.0
    };
    if (bookie.includes('betfair')) return commissionRates.betfair || 0;
    if (bookie.includes('betdaq')) return commissionRates.betdaq || 0;
    if (bookie.includes('matchbook')) return commissionRates.matchbook || 0;
    if (bookie.includes('smarkets')) return commissionRates.smarkets || 0;
    return 0;
  }

  // Calculate actual ROI for each market preset from bet history
  function calculateMarketROI(bets, presetId) {
    const preset = MARKET_FILTER_PRESETS[presetId];
    if (!preset) return null;
    
    // Build pattern parts - handle abbreviations like "AH" that may be followed by digits
    const patternParts = preset.keywords.map(keyword => {
      // If keyword is short (2-3 chars, likely abbreviation), use lookahead instead of word boundary at end
      // This allows matching "AH1", "AH2", "DNB1" etc.
      if (keyword.length <= 3 && /^[a-z]+$/i.test(keyword)) {
        return `\\b${keyword}(?=\\d|\\(|\\s|$|-)`;
      }
      // For multi-word or longer keywords, use word boundaries
      return `\\b${keyword}\\b`;
    });
    
    const pattern = new RegExp(`(${patternParts.join('|')})`, 'i');
    
    const matchingBets = bets.filter(b => {
      if (!b.market) return false;
      if (!b.status || b.status === 'pending') return false;
      
      const marketLower = b.market.toLowerCase();
      return pattern.test(marketLower);
    });
    
    if (matchingBets.length === 0) {
      return { roi: null, totalStaked: 0, profit: 0, betCount: 0 };
    }
    
    let totalStaked = 0;
    let totalProfit = 0;
    
    matchingBets.forEach(b => {
      const stake = parseFloat(b.stake) || 0;
      totalStaked += stake;
      
      if (b.actualPL !== undefined && b.actualPL !== null) {
        totalProfit += b.actualPL;
      } else {
        const odds = parseFloat(b.odds) || 0;
        const commission = getCommission(b.bookmaker);
        
        if (b.status === 'won') {
          if (b.isLay) {
            const gross = stake;
            const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
            totalProfit += (gross - commissionAmount);
          } else {
            const grossProfit = (stake * odds) - stake;
            const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
            totalProfit += (grossProfit - commissionAmount);
          }
        } else if (b.status === 'lost') {
          if (b.isLay) {
            const layOdds = parseFloat(b.originalLayOdds) || odds;
            totalProfit -= (stake * (layOdds - 1));
          } else {
            totalProfit -= stake;
          }
        }
      }
    });
    
    const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100) : 0;
    
    return {
      roi: roi,
      totalStaked: totalStaked,
      profit: totalProfit,
      betCount: matchingBets.length
    };
  }

  // Generate ROI warning text with color coding and low-data warning
  function getROIWarningText(roiData) {
    if (!roiData || roiData.roi === null || roiData.betCount === 0) {
      return { 
        text: 'No settled bets yet - filter still available', 
        color: '#6c757d',
        isLowData: true
      };
    }
    
    const betCount = roiData.betCount;
    const roi = roiData.roi;
    const roiStr = roi >= 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`;
    const isLowData = betCount < 10;
    
    let text, color;
    
    if (isLowData) {
      text = `ROI: ${roiStr} (${betCount} bets) ⚠️ Low data - use cautiously`;
      color = '#ff9800';
    } else if (roi >= 10) {
      text = `ROI: ${roiStr} (${betCount} bets) ✓ Recommended`;
      color = '#28a745';
    } else if (roi >= 0) {
      text = `ROI: ${roiStr} (${betCount} bets)`;
      color = '#28a745';
    } else if (roi >= -10) {
      text = `ROI: ${roiStr} (${betCount} bets) ⚠️ Slightly negative`;
      color = '#ffc107';
    } else if (roi >= -30) {
      text = `ROI: ${roiStr} (${betCount} bets) ⚠️ High risk`;
      color = '#ff9800';
    } else {
      text = `ROI: ${roiStr} (${betCount} bets) ⚠️ Very high risk`;
      color = '#dc3545';
    }
    
    return { text, color, isLowData };
  }

  // Setup market filter event listeners
  const marketFilterEnabled = document.getElementById('market-filter-enabled');
  if (marketFilterEnabled) {
    marketFilterEnabled.addEventListener('change', saveMarketFilterSettings);
  }

  const filterModeRadios = document.querySelectorAll('input[name="filter-mode"]');
  filterModeRadios.forEach(radio => {
    radio.addEventListener('change', saveMarketFilterSettings);
  });

  // Preset box click handlers
  document.querySelectorAll('.preset-box').forEach(box => {
    box.addEventListener('click', () => {
      box.classList.toggle('active');
      saveMarketFilterSettings();
    });
  });

  // Load market filter settings when marketfilters section is shown
  const originalShowSection = showSection;
  showSection = function(sectionName) {
    originalShowSection(sectionName);
    if (sectionName === 'marketfilters') {
      loadMarketFilterSettings();
    }
  };
});
