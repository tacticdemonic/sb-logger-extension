// SB Logger - Content Script for surebet.com valuebets
(function () {
  if (window.__sbLoggerInjected) return;
  window.__sbLoggerInjected = true;

  // Only run on surebet.com valuebets page
  if (!location.hostname.includes('surebet.com') || !location.pathname.includes('valuebets')) {
    return;
  }

  const CSS = `
    .sb-logger-save-btn {
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      margin-left: 4px;
      transition: background 0.2s;
    }
    .sb-logger-save-btn:hover {
      background: #218838;
    }
    .sb-logger-save-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }
    .sb-logger-toast {
      position: fixed;
      right: 16px;
      top: 80px;
      z-index: 9999;
      background: #28a745;
      color: #fff;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    }
    .sb-logger-toast.error {
      background: #dc3545;
    }
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function showToast(text, success = true, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'sb-logger-toast' + (success ? '' : ' error');
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 450);
    }, duration);
  }

  function parseRowData(row) {
    try {
      // Get data from row attributes
      const data = {
        id: row.dataset.id,
        odds: parseFloat(row.dataset.value) || 0,
        probability: parseFloat(row.dataset.probability) || 0,
        overvalue: parseFloat(row.dataset.overvalue) || 0,
        timestamp: new Date().toISOString(),
        url: location.href
      };

      // Extract bookmaker
      const bookmakerCell = row.querySelector('.booker a');
      if (bookmakerCell) {
        data.bookmaker = bookmakerCell.textContent.trim();
      }

      // Extract sport
      const sportSpan = row.querySelector('.booker .minor');
      if (sportSpan) {
        data.sport = sportSpan.textContent.trim();
      }

      // Extract event name
      const eventCell = row.querySelector('.event a');
      if (eventCell) {
        data.event = eventCell.textContent.trim();
      }

      // Extract tournament
      const tournamentSpan = row.querySelector('.event .minor');
      if (tournamentSpan) {
        data.tournament = tournamentSpan.textContent.trim();
      }

      // Extract market from the coefficient cell (includes "- lay" suffix if applicable)
      const coeffCell = row.querySelector('.coeff abbr');
      if (coeffCell) {
        // Get the full text content which includes any "- lay" suffix
        data.market = coeffCell.textContent.trim();
      } else {
        // Fallback: try JSON data in dropdown menu
        const dropdown = row.querySelector('[data-comb-json]');
        if (dropdown) {
          try {
            const json = JSON.parse(dropdown.dataset.combJson);
            if (json.prongs && json.prongs[0]) {
              const prong = JSON.parse(json.prongs[0]);
              if (prong.tr_terse) {
                // Remove HTML tags from market description
                data.market = prong.tr_terse.replace(/<[^>]*>/g, '');
              } else if (prong.tr_expanded) {
                data.market = prong.tr_expanded;
              }
            }
          } catch (e) {
            console.warn('Failed to parse JSON data:', e);
          }
        }
      }

      // Extract time
      const timeCell = row.querySelector('.time abbr');
      if (timeCell && timeCell.dataset.utc) {
        const utcMs = parseInt(timeCell.dataset.utc);
        data.eventTime = new Date(utcMs).toISOString();
      }

      return data;
    } catch (err) {
      console.error('SB Logger: Error parsing row data', err);
      return null;
    }
  }

  async function saveBet(betData) {
    // Ask for stake amount
    const stakeStr = prompt('Enter your stake amount:', '');
    if (stakeStr === null) return false; // User cancelled

    const stake = parseFloat(stakeStr.replace(/[^\d.]/g, ''));
    if (isNaN(stake) || stake <= 0) {
      alert('Invalid stake amount');
      return false;
    }

    betData.stake = stake;

    // Optional note
    const note = prompt('Optional note:', '') || '';
    betData.note = note;
    
    // Initialize status as pending
    betData.status = 'pending';

    // Save to storage
    return new Promise((resolve) => {
      chrome.storage.local.get({ bets: [] }, (res) => {
        const bets = res.bets || [];
        bets.push(betData);
        chrome.storage.local.set({ bets }, () => {
          resolve(true);
        });
      });
    });
  }

  function injectSaveButtons() {
    // Find all valuebet rows
    const rows = document.querySelectorAll('tbody.valuebet_record');
    
    rows.forEach(row => {
      // Skip if button already injected
      if (row.querySelector('.sb-logger-save-btn')) return;

      // Find the first cell with buttons
      const firstCell = row.querySelector('td .d-flex');
      if (!firstCell) return;

      // Create save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'sb-logger-save-btn';
      saveBtn.textContent = '💾 Save';
      saveBtn.title = 'Save this bet to your log';

      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        saveBtn.disabled = true;
        saveBtn.textContent = '...';

        const betData = parseRowData(row);
        if (!betData) {
          showToast('Failed to extract bet data', false);
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save';
          return;
        }

        const saved = await saveBet(betData);
        if (saved) {
          showToast('✓ Bet saved successfully!');
          saveBtn.textContent = '✓';
          setTimeout(() => {
            saveBtn.textContent = '💾 Save';
            saveBtn.disabled = false;
          }, 2000);
        } else {
          saveBtn.textContent = '💾 Save';
          saveBtn.disabled = false;
        }
      });

      // Insert button into the cell
      firstCell.appendChild(saveBtn);
    });
  }

  function init() {
    injectStyles();
    
    // Initial injection
    setTimeout(injectSaveButtons, 500);

    // Watch for new rows being added (auto-update feature)
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && 
              (node.classList?.contains('valuebet_record') || 
               node.querySelector?.('.valuebet_record'))) {
            shouldInject = true;
          }
        });
      });
      if (shouldInject) {
        setTimeout(injectSaveButtons, 100);
      }
    });

    // Observe the main content area
    const mainContent = document.querySelector('main') || document.querySelector('.page-container') || document.body;
    observer.observe(mainContent, { childList: true, subtree: true });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
