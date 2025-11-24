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
    smarkets: true
  },
  timeout: 10000,
  requireConfirmation: false
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
      document.getElementById('autofill-smarkets').checked = autoFillSettings.bookmakers?.smarkets !== false;
      document.getElementById('autofill-matchbook').checked = autoFillSettings.bookmakers?.matchbook !== false;

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
      useCommission: true
    }}, (res) => {
      const settings = res.stakingSettings || {};
      const bankroll = settings.bankroll || 1000;
      const baseBankroll = settings.baseBankroll || bankroll;
      const fraction = (settings.fraction || 0.25) * 100;
      const useCommission = settings.useCommission !== false;
      
      document.getElementById('kelly-bankroll').value = baseBankroll;
      document.getElementById('kelly-fraction').value = fraction;
      document.getElementById('kelly-use-commission').checked = useCommission;
      
      updateKellySummary(bankroll, baseBankroll, fraction, useCommission);
    });
  }
  
  function updateKellySummary(bankroll, baseBankroll, fractionPercent, useCommission) {
    const profitLoss = bankroll - baseBankroll;
    const plClass = profitLoss >= 0 ? 'green' : 'red';
    const plSign = profitLoss >= 0 ? '+' : '';
    
    kellySummary.innerHTML = `
      <strong>Current Bankroll:</strong> £${bankroll.toFixed(2)}<br>
      <strong>Starting Bankroll:</strong> £${baseBankroll.toFixed(2)}<br>
      <strong>P/L:</strong> <span style="color: ${plClass}">${plSign}£${profitLoss.toFixed(2)}</span><br>
      <strong>Kelly Fraction:</strong> ${fractionPercent}%<br>
      <strong>Commission Adjustment:</strong> ${useCommission ? '✓ Enabled' : '✗ Disabled'}
    `;
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
        
        api.storage.local.get({ stakingSettings: {} }, (res) => {
          const currentBankroll = res.stakingSettings?.bankroll || bankroll;
          
          const newSettings = {
            bankroll: currentBankroll,
            baseBankroll: bankroll,
            fraction: fraction,
            useCommission: useCommission
          };
          
          api.storage.local.set({ stakingSettings: newSettings }, () => {
            alert('✅ Kelly staking settings saved!');
            loadKellySettings();
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
            useCommission: true
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
});
