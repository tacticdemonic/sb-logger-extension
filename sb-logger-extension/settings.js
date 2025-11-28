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
    document.querySelectorAll('.section-container').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeSection = document.getElementById(`${sectionName}-section`);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    const activeBtn = document.querySelector(`.nav-btn[data-section="${sectionName}"]`);
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
    
    let html = '';
    for (const entry of entries) {
      const time = new Date(entry.timestamp).toLocaleString();
      let bgColor = '#fff';
      let icon = '📝';
      
      switch (entry.type) {
        case 'api_response':
          icon = '📡';
          bgColor = '#e7f3ff';
          break;
        case 'match_success':
          icon = '✅';
          bgColor = '#d4edda';
          break;
        case 'match_failure':
          icon = '❌';
          bgColor = '#f8d7da';
          break;
        case 'api_error':
          icon = '⚠️';
          bgColor = '#fff3cd';
          break;
        case 'unsupported_sport':
          icon = '🚫';
          bgColor = '#f8d7da';
          break;
        case 'result_determined':
          icon = '🎯';
          bgColor = '#d4edda';
          break;
      }
      
      let details = '';
      if (entry.type === 'api_response') {
        details = `${entry.sport} - ${entry.date} - ${entry.fixtureCount} fixtures`;
        if (entry.sampleFixtures && entry.sampleFixtures.length > 0) {
          details += `<br><span style="color: #666; font-size: 10px;">Sample: ${entry.sampleFixtures.map(f => f.teams?.home + ' vs ' + f.teams?.away).join(', ')}</span>`;
        }
      } else if (entry.type === 'match_success') {
        details = `${entry.betEvent || 'Unknown'} → ${entry.matchedFixture}`;
      } else if (entry.type === 'match_failure') {
        details = `${entry.bet?.event || 'Unknown'} - ${entry.reason}`;
        if (entry.topCandidates && entry.topCandidates.length > 0) {
          details += `<br><span style="color: #666; font-size: 10px;">Candidates: ${entry.topCandidates.map(c => c.fixture + ' (' + c.score + ')').slice(0, 3).join(', ')}</span>`;
        }
      } else if (entry.type === 'api_error') {
        details = `${entry.sport} - ${entry.error}`;
      } else if (entry.type === 'unsupported_sport') {
        details = `${entry.sport} - ${entry.bet?.event || 'Unknown'}`;
      } else if (entry.type === 'result_determined') {
        details = `${entry.bet?.event || 'Unknown'} → ${entry.outcome} (${entry.score})`;
      } else {
        details = JSON.stringify(entry).substring(0, 100);
      }
      
      html += `
        <div style="background: ${bgColor}; padding: 8px; margin-bottom: 6px; border-radius: 3px; border-left: 3px solid ${entry.type === 'match_failure' || entry.type === 'api_error' ? '#dc3545' : '#28a745'};">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 600;">${icon} ${entry.type}</span>
            <span style="color: #888; font-size: 10px;">${time}</span>
          </div>
          <div style="font-size: 11px;">${details}</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
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
});
