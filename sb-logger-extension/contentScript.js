// SB Logger - Content Script for surebet.com valuebets
(function () {
  if (window.__sbLoggerInjected) return;
  window.__sbLoggerInjected = true;

  const DISABLE_STORAGE_KEY = 'extensionDisabled';
  let isInitialized = false;
  let isDisabled = false;
  let mutationObserver = null;
  const clickHandlers = {
    surebetLink: null,
    global: null
  };

  function generateBetUid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // Run on surebet.com valuebets page OR any bookmaker site (not Surebet)
  console.log('SB Logger: Script loaded on:', location.hostname, location.pathname);
  
  const isSurebetValuebets = location.hostname.includes('surebet.com') && location.pathname.includes('valuebets');
  const isBookmakerSite = !location.hostname.includes('surebet.com');
  
  if (!isSurebetValuebets && !isBookmakerSite) {
    console.log('SB Logger: Not on supported page, exiting');
    return;
  }
  
  console.log('SB Logger: ✓ On supported page, continuing initialization');
  
  // Determine which site we're on
  const onBookmakerSite = isBookmakerSite;

  // Bookmaker preset configurations
  // Note: To select only the main version without country codes, just use "Betfair"
  // To select a specific country version, use "Betfair (AU)", "Betfair (BR)", etc.
  const BOOKMAKER_PRESETS = {
    normal: [
      '10Bet', '888sport', 'Bet365', 'Betfair', 'Betway', 
      'Bwin', 'Ladbrokes', 'Paddy Power', 
      'Unibet', 'BetVictor', 'Betfred'
    ],
    exchanges: [
      'Betfair', 'Betdaq', 'Smarkets', 'Matchbook'
    ]
  };

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
    .sb-logger-preset-container {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .sb-logger-preset-btn {
      background: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: 500;
      transition: all 0.2s;
      flex: 1;
    }
    .sb-logger-preset-btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .sb-logger-preset-btn.exchanges {
      background: #6f42c1;
    }
    .sb-logger-preset-btn.exchanges:hover {
      background: #5a32a3;
    }
    .sb-logger-high-stake {
      background-color: rgba(255, 215, 0, 0.15) !important;
      border-left: 4px solid #FFD700 !important;
    }
    .sb-logger-high-stake:hover {
      background-color: rgba(255, 215, 0, 0.25) !important;
    }
    .sb-logger-hide-lay-btn {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: #6f42c1;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.2s;
    }
    .sb-logger-hide-lay-btn:hover {
      background: #5a32a3;
      transform: scale(1.05);
    }
    .sb-logger-hide-lay-btn.active {
      background: #dc3545;
    }
    .sb-logger-hide-lay-btn.active:hover {
      background: #c82333;
    }
    .sb-logger-hidden-row {
      display: none !important;
    }
  `;

  function injectStyles() {
    if (document.getElementById('sb-logger-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'sb-logger-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function showToast(text, success = true, duration = 2500) {
    if (isDisabled) {
      return;
    }
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
    console.log('SB Logger: saveBet called with data:', betData);
    console.log('SB Logger: Odds check - value:', betData.odds, 'type:', typeof betData.odds, 'check result:', (!betData.odds || betData.odds === 0));
    
    // If odds not found, prompt for it
    if (!betData.odds || betData.odds === 0) {
      console.log('SB Logger: Odds missing, prompting user');
      const oddsStr = prompt('Enter the odds (decimal format, e.g., 2.5):', '');
      if (oddsStr === null) return false; // User cancelled
      
      const odds = parseFloat(oddsStr.replace(/[^\d.]/g, ''));
      if (isNaN(odds) || odds <= 1) {
        alert('Invalid odds');
        return false;
      }
      betData.odds = odds;
    } else {
      console.log('SB Logger: Odds already present:', betData.odds);
    }

    // If market not found, prompt for it
    if (!betData.market) {
      const market = prompt('Enter the market/selection (e.g., "Player 1 to win", "Over 2.5 goals"):', '');
      if (market === null) return false; // User cancelled
      if (market.trim()) {
        betData.market = market.trim();
      }
    }

    // Ask for stake amount
    const stakeStr = prompt('Enter your stake amount:', '');
    if (stakeStr === null) return false; // User cancelled

    const stake = parseFloat(stakeStr.replace(/[^\d.]/g, ''));
    if (isNaN(stake) || stake <= 0) {
      alert('Invalid stake amount');
      return false;
    }
    betData.stake = stake;

    // Use overvalue as EV
    if (betData.odds && betData.probability) {
      const impliedProb = (1 / betData.odds) * 100;
      if (!betData.overvalue) {
        betData.overvalue = betData.probability - impliedProb;
      }
      // EV is the overvalue percentage
      betData.expectedValue = betData.overvalue;
    }

    // Optional note
    const note = prompt('Optional note:', betData.note || '') || '';
    if (note) {
      betData.note = note;
    }

    if (!betData.timestamp) {
      betData.timestamp = new Date().toISOString();
    }

    if (!betData.uid) {
      betData.uid = generateBetUid();
    }
    
    // Initialize status as pending
    betData.status = 'pending';
    
    // Initialize API retry tracking
    betData.apiRetryCount = 0;
    betData.lastApiCheck = null;

    console.log('SB Logger: Final bet data to save:', betData);

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

  function applyBookmakerPreset(presetName) {
    console.log('SB Logger: Applying preset:', presetName);
    if (isDisabled) {
      return;
    }
    const bookmakers = BOOKMAKER_PRESETS[presetName];
    if (!bookmakers) {
      showToast('Unknown preset: ' + presetName, false);
      return;
    }

    // Find all bookmaker checkboxes - look in the visible popup first
    let checkboxes = [];
    
    // Strategy 1: Find checkboxes in the visible popup
    const popup = document.querySelector('.popup:not(.hidden)') || 
                  document.querySelector('[role="dialog"]') ||
                  document.querySelector('.modal:not(.hidden)');
    
    if (popup) {
      checkboxes = Array.from(popup.querySelectorAll('input[type="checkbox"]'));
      console.log('SB Logger: Found', checkboxes.length, 'checkboxes in popup');
    }
    
    // Strategy 2: Fall back to looking anywhere for visible checkboxes
    if (checkboxes.length === 0) {
      checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => {
        const style = window.getComputedStyle(cb);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      console.log('SB Logger: Found', checkboxes.length, 'visible checkboxes on page');
    }

    if (checkboxes.length === 0) {
      showToast('Could not find bookmaker checkboxes', false);
      return;
    }

    let checkedCount = 0;
    let uncheckedCount = 0;

    // Uncheck all first
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));
        uncheckedCount++;
      }
    });

    // Check only the ones in our preset
    checkboxes.forEach(checkbox => {
      // Find the label text for this checkbox
      const label = checkbox.closest('label') || 
                   checkbox.parentElement?.querySelector('label') ||
                   checkbox.nextElementSibling;
      
      const labelText = label ? label.textContent.trim() : '';
      
      // Check if this bookmaker is in our preset
      const shouldCheck = bookmakers.some(bookie => {
        const bookieLower = bookie.toLowerCase();
        const labelLower = labelText.toLowerCase();
        
        // Remove percentage and whitespace for comparison
        const labelClean = labelLower.replace(/\s*\d+%\s*$/, '').trim();
        
        // EXACT MATCH ONLY:
        // "Betfair" should match "Betfair 5%" but NOT "Betfair SB 5%" or "Betfair (AU) 5%"
        
        // If the bookie name has country code, do exact match
        if (bookieLower.includes('(')) {
          return labelClean === bookieLower;
        }
        
        // For plain names without country codes:
        // Must be exact match or followed by percentage/space+percentage only
        // Extract bookmaker name from label (everything before percentage or country code)
        const labelBookmaker = labelClean
          .replace(/\s*\([A-Z]{2,3}\).*$/, '')  // Remove country codes
          .trim();
        
        // Must match exactly, no extra letters
        if (labelBookmaker === bookieLower) {
          // Exclude if there's a country code or additional text after bookmaker name
          if (/\([A-Z]{2,3}\)/i.test(labelText)) {
            return false;  // Has country code like "(AU)"
          }
          // Check if there are extra letters/words after the bookmaker name (like "SB", "MBR")
          const afterBookmaker = labelClean.substring(bookieLower.length).trim();
          if (afterBookmaker && /^[a-z]/i.test(afterBookmaker)) {
            // There's text after bookmaker name that's not just a percentage
            return false;
          }
          return true;
        }
        
        return false;
      });

      if (shouldCheck && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));
        checkedCount++;
      }
    });

    const presetLabel = presetName === 'normal' ? 'Normal List' : 'Exchanges Only';
    showToast(`✓ Applied ${presetLabel} preset: ${checkedCount} bookmakers selected`);
  }

  function injectPresetButtons() {
    console.log('SB Logger: === Attempting to inject preset buttons ===');
    if (isDisabled) {
      return;
    }
    
    // Skip if already injected anywhere on the page
    if (document.querySelector('.sb-logger-preset-container')) {
      console.log('SB Logger: Preset buttons already injected, skipping');
      return;
    }
    
    // Debug: Log all visible checkboxes
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => {
      const style = window.getComputedStyle(cb);
      const parent = cb.closest('div');
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      return style.display !== 'none' && style.visibility !== 'hidden' &&
             (!parentStyle || (parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden'));
    });
    console.log('SB Logger: Total checkboxes:', allCheckboxes.length, 'Visible:', visibleCheckboxes.length);
    
    // Log some visible checkbox labels for debugging
    if (visibleCheckboxes.length > 0) {
      const labels = visibleCheckboxes.slice(0, 5).map(cb => {
        const label = cb.closest('label') || cb.nextElementSibling || cb.parentElement;
        return label ? label.textContent.trim().substring(0, 30) : 'no label';
      });
      console.log('SB Logger: Sample checkbox labels:', labels);
    }

    // Try multiple strategies to find the bookmaker filter popup/modal
    let container = null;
    
    // Strategy 1: Look for modal/popup/dropdown containers first
    const modalSelectors = [
      '.modal:not(.hidden)',
      '.popup:not(.hidden)', 
      '.dropdown-menu:not(.hidden)',
      '[role="dialog"]',
      '[class*="Modal"]',
      '[class*="Popup"]',
      '[class*="Dropdown"]',
      '.filter-popup',
      '.booker-filter-popup'
    ];
    
    for (const selector of modalSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.querySelector('input[type="checkbox"]')) {
        // Make sure it's visible
        const style = window.getComputedStyle(elem);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          container = elem;
          console.log('SB Logger: Found modal/popup filter container with selector:', selector);
          break;
        }
      }
    }
    
    // Strategy 2: Look for visible containers with bookmaker checkboxes
    if (!container) {
      const allDivs = Array.from(document.querySelectorAll('div'));
      container = allDivs.find(div => {
        const style = window.getComputedStyle(div);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        
        const checkboxes = div.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length >= 5) { // At least 5 checkboxes
          const text = div.textContent.toLowerCase();
          // Check if it contains bookmaker names
          return text.includes('betfair') || text.includes('bet365') || 
                 text.includes('ladbrokes') || text.includes('betway');
        }
        return false;
      });
      
      if (container) {
        console.log('SB Logger: Found visible container with bookmaker checkboxes');
      }
    }
    
    // Strategy 3: Find the container with the most visible checkboxes
    if (!container) {
      const visibleCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const style = window.getComputedStyle(cb);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      
      if (visibleCheckboxes.length > 0) {
        console.log('SB Logger: Found', visibleCheckboxes.length, 'visible checkboxes');
        
        // Find the common parent that contains the most checkboxes
        const parents = visibleCheckboxes.map(cb => {
          // Go up to find a meaningful container (not just a label)
          let parent = cb.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!parent || parent === document.body) break;
            const checkCount = parent.querySelectorAll('input[type="checkbox"]').length;
            if (checkCount >= 5) {
              return { parent, count: checkCount };
            }
            parent = parent.parentElement;
          }
          return null;
        }).filter(Boolean);
        
        if (parents.length > 0) {
          // Sort by checkbox count and take the one with the most
          parents.sort((a, b) => b.count - a.count);
          container = parents[0].parent;
          console.log('SB Logger: Found container with', parents[0].count, 'checkboxes');
        }
      }
    }
    
    if (!container) {
      console.log('SB Logger: ❌ Could not find bookmaker filter container');
      console.log('SB Logger: Available visible checkboxes:', 
        Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter(cb => window.getComputedStyle(cb).display !== 'none').length);
      
      // Debug: List all divs with multiple checkboxes
      const divsWithCheckboxes = Array.from(document.querySelectorAll('div'))
        .map(div => ({ div, count: div.querySelectorAll('input[type="checkbox"]').length }))
        .filter(item => item.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      console.log('SB Logger: Top 5 divs with checkboxes:', divsWithCheckboxes.map(i => ({
        count: i.count,
        classes: i.div.className,
        visible: window.getComputedStyle(i.div).display !== 'none'
      })));
      return;
    }

    console.log('SB Logger: ✓ Found container, injecting preset buttons');
    console.log('SB Logger: Container classes:', container.className);
    console.log('SB Logger: Container checkboxes:', container.querySelectorAll('input[type="checkbox"]').length);

    // Create preset button container
    const presetContainer = document.createElement('div');
    presetContainer.className = 'sb-logger-preset-container';

    // Create "Normal List" button
    const normalBtn = document.createElement('button');
    normalBtn.className = 'sb-logger-preset-btn normal';
    normalBtn.textContent = '⭐ My Normal List';
    normalBtn.title = 'Apply your standard bookmaker selection';
    normalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBookmakerPreset('normal');
    });

    // Create "Exchanges" button
    const exchangesBtn = document.createElement('button');
    exchangesBtn.className = 'sb-logger-preset-btn exchanges';
    exchangesBtn.textContent = '🔄 Exchanges Only';
    exchangesBtn.title = 'Show only betting exchanges';
    exchangesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBookmakerPreset('exchanges');
    });

    presetContainer.appendChild(normalBtn);
    presetContainer.appendChild(exchangesBtn);

    // Insert at the top of the filter container (before the first child)
    if (container.firstChild) {
      container.insertBefore(presetContainer, container.firstChild);
    } else {
      container.appendChild(presetContainer);
    }
    console.log('SB Logger: Preset buttons injected successfully at the top!');
  }

  function toggleLayBets() {
    if (isDisabled) {
      return;
    }
    const mainTable = document.querySelector('table');
    if (!mainTable) return;
    
    const rows = mainTable.querySelectorAll('tbody.valuebet_record');
    const hideLayBtn = document.querySelector('.sb-logger-hide-lay-btn');
    const isHiding = hideLayBtn && hideLayBtn.classList.contains('active');
    
    let hiddenCount = 0;
    rows.forEach(row => {
      // Check if this is a lay bet by looking at the market text
      const coeffCell = row.querySelector('.coeff abbr');
      let isLayBet = false;
      
      if (coeffCell) {
        const marketText = coeffCell.textContent.toLowerCase();
        isLayBet = marketText.includes('- lay') || marketText.endsWith('lay');
      }
      
      // Also check the link data
      if (!isLayBet) {
        const link = row.querySelector('a[href*="/nav/valuebet/prong/"]');
        if (link && link.href) {
          const linkData = parseSurebetLinkData(link.href);
          if (linkData && linkData.isLay) {
            isLayBet = true;
          }
        }
      }
      
      if (isLayBet) {
        if (isHiding) {
          row.classList.add('sb-logger-hidden-row');
          hiddenCount++;
        } else {
          row.classList.remove('sb-logger-hidden-row');
        }
      }
    });
    
    if (hideLayBtn) {
      if (isHiding) {
        hideLayBtn.textContent = `👁️ Show Lay Bets (${hiddenCount} hidden)`;
      } else {
        hideLayBtn.textContent = '🚫 Hide Lay Bets';
      }
    }
  }

  function injectHideLayButton() {
    if (isDisabled) {
      return;
    }
    // Skip if button already exists
    if (document.querySelector('.sb-logger-hide-lay-btn')) {
      return;
    }
    
    const btn = document.createElement('button');
    btn.className = 'sb-logger-hide-lay-btn';
    btn.textContent = '🚫 Hide Lay Bets';
    btn.title = 'Toggle visibility of lay bets';
    
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      toggleLayBets();
    });
    
    document.body.appendChild(btn);
    console.log('SB Logger: Hide Lay Bets button injected');
  }

  function injectSaveButtons() {
    if (isDisabled) {
      return;
    }
    // Find the main valuebets table only
    const mainTable = document.querySelector('table');
    if (!mainTable) {
      console.log('SB Logger: Main table not found');
      return;
    }
    
    // Find all valuebet rows in the main table only
    const rows = mainTable.querySelectorAll('tbody.valuebet_record');
    console.log('SB Logger: Found', rows.length, 'valuebet rows in main table');
    
    let hasHighStake = false;
    
    rows.forEach(row => {
      // Skip if button already injected
      if (row.querySelector('.sb-logger-save-btn')) return;

      // Try to find a link to the valuebet details
      const link = row.querySelector('a[href*="/nav/valuebet/prong/"]');
      let linkUrl = link ? link.href : null;

      // Parse stake limit from the link data
      if (link && link.href) {
        try {
          console.log('SB Logger: Parsing link for stake limit:', link.href.substring(0, 100));
          const linkData = parseSurebetLinkData(link.href);
          console.log('SB Logger: Parsed link data:', linkData ? `id: ${linkData.id}, limit: ${linkData.limit}` : 'null');
          
          if (linkData && typeof linkData.limit !== 'undefined') {
            const stakeLimit = linkData.limit;
            console.log('SB Logger: Found stake limit from link:', stakeLimit);
            
            // Highlight rows with stake >= £100
            if (stakeLimit >= 100) {
              row.classList.add('sb-logger-high-stake');
              hasHighStake = true;
              console.log('SB Logger: ✓ Highlighted row with stake limit:', stakeLimit);
            }
          } else {
            console.log('SB Logger: No limit found in link data');
          }
        } catch (e) {
          console.log('SB Logger: Error parsing stake limit:', e.message);
        }
      } else {
        console.log('SB Logger: No link found in row');
      }

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

        let betData = null;
        
        // Parse from link only
        if (linkUrl) {
          console.log('SB Logger: Parsing from link:', linkUrl);
          betData = parseSurebetLinkData(linkUrl);
        }
        
        if (!betData) {
          showToast('Failed to extract bet data from link', false);
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
    
    // Play notification sound if any high stake bets were found
    if (hasHighStake) {
      playNotificationSound();
    }
  }

  function playNotificationSound() {
    try {
      // Create audio context and play a notification beep
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set frequency (800 Hz for a pleasant notification tone)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      // Set volume (0.3 = 30% volume)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      // Play the sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      console.log('SB Logger: ♪ Notification sound played for high stake bet(s)');
    } catch (e) {
      console.log('SB Logger: Could not play notification sound:', e.message);
    }
  }

  function parseSurebetLinkData(url) {
    try {
      console.log('SB Logger: Parsing Surebet link data from URL');
      
      // Extract the JSON data from the URL parameter
      const urlObj = new URL(url);
      const jsonBody = urlObj.searchParams.get('json_body[prongs][]');
      
      if (!jsonBody) {
        console.log('SB Logger: No JSON data found in URL');
        return null;
      }
      
      // Decode and parse the JSON
      const jsonData = JSON.parse(decodeURIComponent(jsonBody));
      console.log('SB Logger: Parsed JSON from link:', jsonData);
      console.log('SB Logger: Raw odds value:', jsonData.value, 'Type:', typeof jsonData.value);
      console.log('SB Logger: Is lay bet?', jsonData.type?.back === false);
      console.log('SB Logger: Probability:', jsonData.probability);
      console.log('SB Logger: Overvalue:', jsonData.overvalue);
      
      const parsedOdds = parseFloat(jsonData.value);
      console.log('SB Logger: Parsed odds:', parsedOdds, 'isNaN:', isNaN(parsedOdds), 'Final:', parsedOdds || 0);
      
      const isLayBet = jsonData.type?.back === false || false;
      
      const data = {
        timestamp: new Date().toISOString(),
        url: url,
        id: jsonData.id,
        odds: parsedOdds || 0,
        originalLayOdds: isLayBet && jsonData.original_value ? parseFloat(jsonData.original_value) : null,
        probability: parseFloat((jsonData.probability * 100).toFixed(2)) || 0,
        overvalue: parseFloat(jsonData.overvalue.toFixed(2)) || 0,
        bookmaker: jsonData.bk || '',
        sport: jsonData.sport_id === 22 ? 'Tennis' : (jsonData.sport_id === 15 ? 'Football' : 'Other'),
        tournament: jsonData.tournament || '',
        teams: jsonData.teams || [],
        event: jsonData.teams ? jsonData.teams.join(' vs ') : '',
        market: jsonData.tr_expanded || jsonData.tr_terse || '',
        eventTime: jsonData.time || null,
        commission: parseFloat(jsonData.commission) || 0,
        bk_probability: parseFloat(jsonData.bk_probability) || 0,
        bk_margin: parseFloat(jsonData.bk_margin) || 0,
        limit: parseFloat(jsonData.limit) || 0,
        currency: jsonData.currency || 'GBP',
        isLay: isLayBet
      };
      
      // Clean up market text (remove HTML tags)
      if (data.market) {
        data.market = data.market.replace(/<[^>]*>/g, '');
      }
      
      // Check market text for lay bet indicators (various formats)
      if (data.market) {
        const marketLower = data.market.toLowerCase();
        if (marketLower.includes('- lay') || 
            marketLower.includes('lay odds') || 
            marketLower.includes('- lay odds') ||
            marketLower.endsWith('lay')) {
          data.isLay = true;
        }
      }
      
      console.log('SB Logger: Extracted data from link:', data);
      console.log('SB Logger: Final odds value:', data.odds, 'Type:', typeof data.odds);
      return data;
    } catch (err) {
      console.error('SB Logger: Error parsing Surebet link data', err);
      return null;
    }
  }

  function parseSmarketsPageData() {
    try {
      console.log('SB Logger: Parsing bookmaker page data');
      
      // Try to detect bookmaker from hostname
      const hostname = location.hostname.toLowerCase();
      let bookmaker = 'Unknown';
      if (hostname.includes('smarkets')) bookmaker = 'Smarkets';
      else if (hostname.includes('betfair')) bookmaker = 'Betfair';
      else if (hostname.includes('betdaq')) bookmaker = 'Betdaq';
      else if (hostname.includes('matchbook')) bookmaker = 'Matchbook';
      else if (hostname.includes('bet365')) bookmaker = 'Bet365';
      else if (hostname.includes('betway')) bookmaker = 'Betway';
      else if (hostname.includes('paddypower')) bookmaker = 'Paddy Power';
      else if (hostname.includes('ladbrokes')) bookmaker = 'Ladbrokes';
      else bookmaker = hostname.split('.')[0];
      
      const data = {
        timestamp: new Date().toISOString(),
        url: location.href,
        bookmaker: bookmaker
      };

      // Extract event name from page title or h1
      const titleElement = document.querySelector('h1, title');
      if (titleElement) {
        const titleText = titleElement.textContent.trim();
        // Format: "Whitney Osuigwe vs Priska Madelyn Nugroho | Tennis odds | Smarkets..."
        const eventMatch = titleText.match(/^([^|]+)/);
        if (eventMatch) {
          data.event = eventMatch[1].trim();
        }
      }

      // Extract sport from URL or page
      const urlMatch = location.pathname.match(/\/sport\/([^\/]+)/);
      if (urlMatch) {
        data.sport = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Extract tournament from URL
      const tournamentMatch = location.pathname.match(/\/sport\/[^\/]+\/([^\/]+)/);
      if (tournamentMatch) {
        data.tournament = tournamentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Extract event time from URL
      const timeMatch = location.pathname.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})-(\d{2})\//);
      if (timeMatch) {
        data.eventTime = `${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]}T${timeMatch[4]}:${timeMatch[5]}:00Z`;
      }

      // Try to find odds buttons on the page (look for back/lay odds)
      // Smarkets typically shows odds in buttons or clickable elements
      const oddsButtons = document.querySelectorAll('[class*="odd"], [class*="price"], button[class*="back"], button[class*="lay"]');
      console.log('SB Logger: Found', oddsButtons.length, 'potential odds elements');
      
      // Log some samples for debugging
      if (oddsButtons.length > 0) {
        const samples = Array.from(oddsButtons).slice(0, 5).map(btn => ({
          text: btn.textContent.trim(),
          classes: btn.className,
          dataAttrs: Object.keys(btn.dataset)
        }));
        console.log('SB Logger: Sample odds elements:', samples);
      }

      // Add a note that user should manually select market and odds
      data.note = 'Manual odds entry - please specify market and odds';

      console.log('SB Logger: Parsed Smarkets data:', data);
      return data;
    } catch (err) {
      console.error('SB Logger: Error parsing Smarkets data', err);
      return null;
    }
  }

  function parseBetPopupData(popup) {
    try {
      console.log('SB Logger: Parsing bet popup data');
      const data = {
        timestamp: new Date().toISOString(),
        url: location.href
      };

      // Extract event name from popup (usually in header)
      const eventHeader = popup.querySelector('h2, h3, .event-title, [class*="event"], [class*="match"]');
      if (eventHeader) {
        data.event = eventHeader.textContent.trim();
      }

      // Extract odds from popup
      const oddsElement = popup.querySelector('[class*="odd"], [class*="coef"], .value, [data-value]');
      if (oddsElement) {
        const oddsText = oddsElement.textContent || oddsElement.dataset.value || '';
        data.odds = parseFloat(oddsText.replace(/[^\d.]/g, ''));
      }

      // Extract bookmaker
      const bookmakerElement = popup.querySelector('[class*="bookmaker"], [class*="booker"], .bookie');
      if (bookmakerElement) {
        data.bookmaker = bookmakerElement.textContent.trim();
      }

      // Extract market/bet type
      const marketElement = popup.querySelector('[class*="market"], [class*="bet-type"], .selection');
      if (marketElement) {
        data.market = marketElement.textContent.trim();
      }

      // Extract sport if available
      const sportElement = popup.querySelector('[class*="sport"]');
      if (sportElement) {
        data.sport = sportElement.textContent.trim();
      }

      // Try to get additional info from the popup text
      const allText = popup.textContent;
      
      // Look for percentage/probability patterns
      const probabilityMatch = allText.match(/(\d+\.?\d*)%/);
      if (probabilityMatch) {
        data.probability = parseFloat(probabilityMatch[1]);
      }

      // Look for overvalue patterns
      const overvalueMatch = allText.match(/overvalue[:\s]+(\d+\.?\d*)%/i) || 
                            allText.match(/edge[:\s]+(\d+\.?\d*)%/i);
      if (overvalueMatch) {
        data.overvalue = parseFloat(overvalueMatch[1]);
      }

      console.log('SB Logger: Parsed popup data:', data);
      return data;
    } catch (err) {
      console.error('SB Logger: Error parsing popup data', err);
      return null;
    }
  }

  async function getSurebetDataFromReferrer() {
    return new Promise((resolve) => {
      // Check chrome.storage.local for data saved on click
      chrome.storage.local.get(['pendingBet'], (result) => {
        if (result.pendingBet) {
          console.log('SB Logger: Found stored bet data from Surebet click:', result.pendingBet);
          // Clear it after retrieving
          chrome.storage.local.remove('pendingBet');
          resolve(result.pendingBet);
        } else {
          console.log('SB Logger: No stored bet data found in storage');
          console.log('SB Logger: document.referrer =', document.referrer);
          console.log('SB Logger: window.location.href =', window.location.href);
          
          // Try to get data from document.referrer if it's a Surebet link
          if (document.referrer && document.referrer.includes('/nav/valuebet/prong/')) {
            console.log('SB Logger: Found Surebet referrer, parsing:', document.referrer);
            const data = parseSurebetLinkData(document.referrer);
            if (data) {
              console.log('SB Logger: Extracted data from referrer:', data);
              resolve(data);
              return;
            }
          } else if (document.referrer) {
            console.log('SB Logger: Referrer exists but not a Surebet valuebet link');
          } else {
            console.log('SB Logger: No referrer found');
          }
          
          // Try to check if we're in an iframe and parent has Surebet URL
          try {
            if (window !== window.top && window.top.location.href.includes('/nav/valuebet/prong/')) {
              console.log('SB Logger: In iframe with Surebet parent, parsing:', window.top.location.href);
              const data = parseSurebetLinkData(window.top.location.href);
              if (data) {
                console.log('SB Logger: Extracted data from parent frame:', data);
                resolve(data);
                return;
              }
            }
          } catch (e) {
            // Cross-origin access blocked, ignore
            console.log('SB Logger: Cannot access parent frame (cross-origin)');
          }
          
          resolve(null);
        }
      });
    });
  }

  async function injectSaveButtonOnSmarkets() {
    if (isDisabled) {
      return;
    }
    // Skip if button already injected
    if (document.querySelector('.sb-logger-save-btn-smarkets')) {
      console.log('SB Logger: Save button already on Smarkets page');
      return;
    }

    console.log('SB Logger: Injecting save button on Smarkets page');

    // Try to get data from Surebet click
    const surebetData = await getSurebetDataFromReferrer();

    // Create a floating save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'sb-logger-save-btn-smarkets';
    saveBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 16px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;
    saveBtn.textContent = surebetData ? '💾 Save Bet (From Surebet)' : '💾 Save Bet';
    saveBtn.title = surebetData ? 'Save the bet you clicked from Surebet' : 'Click to save the current bet to your log';

    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#218838';
      saveBtn.style.transform = 'scale(1.05)';
    });

    saveBtn.addEventListener('mouseleave', () => {
      if (!saveBtn.disabled) {
        saveBtn.style.background = '#28a745';
        saveBtn.style.transform = 'scale(1)';
      }
    });

    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      saveBtn.disabled = true;
      saveBtn.style.background = '#6c757d';
      saveBtn.textContent = 'Saving...';

      let betData = surebetData || parseSmarketsPageData();
      
      if (!betData) {
        showToast('Failed to extract bet data from page', false);
        saveBtn.disabled = false;
        saveBtn.style.background = '#28a745';
        saveBtn.textContent = '💾 Save Bet';
        return;
      }

      const saved = await saveBet(betData);
      if (saved) {
        showToast('✓ Bet saved successfully!');
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save Bet';
          saveBtn.style.background = '#28a745';
          saveBtn.disabled = false;
        }, 2000);
      } else {
        saveBtn.textContent = '💾 Save Bet';
        saveBtn.style.background = '#28a745';
        saveBtn.disabled = false;
      }
    });

    document.body.appendChild(saveBtn);
    console.log('SB Logger: Floating save button added to Smarkets page');
  }

  function injectSaveButtonInPopup(popup) {
    if (isDisabled) {
      return;
    }
    // Skip if button already injected
    if (popup.querySelector('.sb-logger-save-btn-popup')) {
      console.log('SB Logger: Save button already in popup');
      return;
    }

    console.log('SB Logger: Injecting save button into bet popup');

    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'sb-logger-save-btn sb-logger-save-btn-popup';
    saveBtn.style.cssText = `
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      margin: 10px 0;
      display: block;
      width: 100%;
      font-weight: bold;
      transition: background 0.2s;
    `;
    saveBtn.textContent = '💾 Save This Bet';
    saveBtn.title = 'Save this bet to your log';

    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#218838';
    });

    saveBtn.addEventListener('mouseleave', () => {
      if (!saveBtn.disabled) {
        saveBtn.style.background = '#28a745';
      }
    });

    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      saveBtn.disabled = true;
      saveBtn.style.background = '#6c757d';
      saveBtn.textContent = 'Saving...';

      const betData = parseBetPopupData(popup);
      if (!betData) {
        showToast('Failed to extract bet data from popup', false);
        saveBtn.disabled = false;
        saveBtn.style.background = '#28a745';
        saveBtn.textContent = '💾 Save This Bet';
        return;
      }

      const saved = await saveBet(betData);
      if (saved) {
        showToast('✓ Bet saved successfully!');
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save This Bet';
          saveBtn.disabled = false;
        }, 2000);
      } else {
        saveBtn.textContent = '💾 Save This Bet';
        saveBtn.style.background = '#28a745';
        saveBtn.disabled = false;
      }
    });

    // Find the best place to insert the button
    // Try to find a button container or footer area
    let insertTarget = popup.querySelector('[class*="footer"], [class*="actions"], [class*="buttons"], .modal-footer');
    
    if (insertTarget) {
      // Insert at the beginning of the container
      insertTarget.insertBefore(saveBtn, insertTarget.firstChild);
    } else {
      // Try to find the main content area
      insertTarget = popup.querySelector('[class*="content"], [class*="body"], .modal-body');
      if (insertTarget) {
        // Append to the end
        insertTarget.appendChild(saveBtn);
      } else {
        // Last resort: just append to the popup itself
        popup.appendChild(saveBtn);
      }
    }

    console.log('SB Logger: Save button injected into popup successfully');
  }

  function detectAndInjectIntoPopup() {
    if (isDisabled) {
      return;
    }
    // Only run on Smarkets or other bookmaker sites, NOT on Surebet
    if (location.hostname.includes('surebet.com')) {
      console.log('SB Logger: On Surebet page, skipping popup detection');
      return;
    }
    
    console.log('SB Logger: === Detecting bet popup ===');
    
    // Look for various types of popup/modal containers that might contain bet details
    const popupSelectors = [
      '.popup:not(.hidden)',
      '.modal:not(.hidden)',
      '[role="dialog"]',
      '[class*="Modal"]:not([style*="display: none"])',
      '[class*="Popup"]:not([style*="display: none"])',
      '[class*="overlay"]:not([style*="display: none"])',
      '.bet-details',
      '[class*="bet-detail"]'
    ];

    // Also try to find any absolutely positioned elements that might be popups
    const allDivs = document.querySelectorAll('div');
    const candidates = [];
    
    for (const selector of popupSelectors) {
      const popups = document.querySelectorAll(selector);
      console.log(`SB Logger: Found ${popups.length} elements matching "${selector}"`);
      
      popups.forEach(popup => {
        const style = window.getComputedStyle(popup);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        
        if (isVisible) {
          const text = popup.textContent.toLowerCase();
          console.log(`SB Logger: Checking visible popup:`, {
            selector,
            classes: popup.className,
            hasOdd: text.includes('odd'),
            hasBet: text.includes('bet'),
            hasMatch: text.includes('match'),
            hasEvent: text.includes('event'),
            textSample: text.substring(0, 100)
          });
          
          // Check if it contains bet-related content (odds, events, etc.)
          if (text.includes('odd') || text.includes('bet') || text.includes('match') || 
              text.includes('event') || text.includes('coef') || text.includes('value') ||
              popup.querySelector('[class*="odd"], [class*="coef"], [data-value]')) {
            console.log('SB Logger: ✓ Found bet popup with selector:', selector);
            candidates.push(popup);
          }
        }
      });
    }
    
    // Also check for any fixed/absolute positioned divs that appeared recently and are visible
    allDivs.forEach(div => {
      const style = window.getComputedStyle(div);
      if ((style.position === 'fixed' || style.position === 'absolute') &&
          style.display !== 'none' && 
          style.visibility !== 'hidden' &&
          parseInt(style.zIndex) > 100) {
        const text = div.textContent.toLowerCase();
        if ((text.includes('odd') || text.includes('coef') || text.includes('value')) && 
            text.length > 20 && text.length < 5000) {
          console.log('SB Logger: Found positioned div that might be popup:', {
            position: style.position,
            zIndex: style.zIndex,
            classes: div.className
          });
          if (!candidates.includes(div)) {
            candidates.push(div);
          }
        }
      }
    });
    
    console.log(`SB Logger: Total popup candidates found: ${candidates.length}`);
    
    // Inject into all candidates
    candidates.forEach(popup => {
      injectSaveButtonInPopup(popup);
    });
  }

  function cleanupExtension() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (clickHandlers.surebetLink) {
      document.removeEventListener('click', clickHandlers.surebetLink, true);
      clickHandlers.surebetLink = null;
    }

    if (clickHandlers.global) {
      document.removeEventListener('click', clickHandlers.global, true);
      clickHandlers.global = null;
    }

    document.querySelectorAll('.sb-logger-save-btn, .sb-logger-save-btn-smarkets, .sb-logger-preset-container, .sb-logger-hide-lay-btn, .sb-logger-toast').forEach((node) => {
      node.remove();
    });

    document.querySelectorAll('.sb-logger-high-stake').forEach((row) => {
      row.classList.remove('sb-logger-high-stake');
    });

    document.querySelectorAll('.sb-logger-hidden-row').forEach((row) => {
      row.classList.remove('sb-logger-hidden-row');
    });

    const styleEl = document.getElementById('sb-logger-style');
    if (styleEl) {
      styleEl.remove();
    }

    isInitialized = false;
  }

  function init() {
    if (isDisabled) {
      console.log('SB Logger: Disabled, initialization skipped');
      return;
    }
    if (isInitialized) {
      return;
    }
    isInitialized = true;
    console.log('SB Logger: ===== INITIALIZING =====');
    console.log('SB Logger: URL:', location.href);
    injectStyles();
    
    // Show a temporary toast to confirm script is running
    setTimeout(() => {
      showToast('SB Logger Active!', true, 1500);
    }, 1000);
    
    // If on any bookmaker site, inject floating button
    if (onBookmakerSite) {
      console.log('SB Logger: On bookmaker site, injecting floating save button');
      setTimeout(injectSaveButtonOnSmarkets, 1000);
      // Don't do the table row injection on bookmaker sites
      return;
    }
    
    // Inject hide lay bets button on Surebet page
    setTimeout(injectHideLayButton, 500);
    
    // On Surebet: intercept clicks on valuebet links to store data
    clickHandlers.surebetLink = (e) => {
      if (isDisabled) {
        return;
      }
      const link = e.target.closest('a[href*="/nav/valuebet/prong/"]');
      if (link && link.href) {
        console.log('SB Logger: Surebet link clicked, storing data for later');
        const betData = parseSurebetLinkData(link.href);
        if (betData) {
          chrome.storage.local.set({ pendingBet: betData }, () => {
            console.log('SB Logger: Bet data stored for bookmaker page:', betData);
          });
        }
      }
    };
    document.addEventListener('click', clickHandlers.surebetLink, true);
    
    // Initial injection with multiple retry attempts (for Surebet)
    setTimeout(injectSaveButtons, 500);
    
    // Try injecting preset buttons multiple times with increasing delays
    setTimeout(injectPresetButtons, 800);
    setTimeout(injectPresetButtons, 1500);
    setTimeout(injectPresetButtons, 3000);
    setTimeout(injectPresetButtons, 5000);
    
    // Also watch for clicks on filter buttons that might open the popup
    clickHandlers.global = (e) => {
      if (isDisabled) {
        return;
      }
      console.log('SB Logger: Click detected on:', e.target.tagName, e.target.className, e.target);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('SB Logger: Post-click injection attempt (200ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 200);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('SB Logger: Post-click injection attempt (500ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 500);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('SB Logger: Post-click injection attempt (1000ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 1000);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('SB Logger: Post-click injection attempt (1500ms)');
        detectAndInjectIntoPopup();
      }, 1500);
    };
    document.addEventListener('click', clickHandlers.global, true);

    // Watch for new rows being added (auto-update feature)
    mutationObserver = new MutationObserver((mutations) => {
      if (isDisabled) {
        return;
      }
      let shouldInject = false;
      let shouldInjectPresets = false;
      let shouldCheckPopup = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.classList?.contains('valuebet_record') || 
                node.querySelector?.('.valuebet_record')) {
              shouldInject = true;
            }
            // Check if filter UI was added
            if (node.querySelector?.('input[type="checkbox"]') ||
                node.classList?.contains('filter') ||
                node.classList?.contains('filters')) {
              shouldInjectPresets = true;
            }
            // Check if a popup/modal was added
            if (node.classList?.contains('popup') || 
                node.classList?.contains('modal') ||
                node.getAttribute?.('role') === 'dialog' ||
                node.className?.includes?.('Modal') ||
                node.className?.includes?.('Popup') ||
                node.className?.includes?.('overlay')) {
              shouldCheckPopup = true;
            }
          }
        });
      });
      
      if (shouldInject && !isDisabled) {
        setTimeout(injectSaveButtons, 100);
        // Reapply hide lay filter if active
        setTimeout(() => {
          if (isDisabled) return;
          const hideLayBtn = document.querySelector('.sb-logger-hide-lay-btn');
          if (hideLayBtn && hideLayBtn.classList.contains('active')) {
            toggleLayBets();
          }
        }, 150);
      }
      if (shouldInjectPresets && !isDisabled) {
        setTimeout(injectPresetButtons, 300);
      }
      if (shouldCheckPopup && !isDisabled) {
        setTimeout(detectAndInjectIntoPopup, 200);
      }
    });

    // Observe the main content area
    const mainContent = document.querySelector('main') || document.querySelector('.page-container') || document.body;
    mutationObserver.observe(mainContent, { childList: true, subtree: true });
    
    console.log('SB Logger: Initialization complete, observers active');
  }

  function scheduleInit() {
    if (isDisabled) {
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }

  function updateDisabledState(disabled) {
    const wasDisabled = isDisabled;
    isDisabled = disabled;

    if (disabled) {
      if (!wasDisabled) {
        console.log('SB Logger: Disabled via action menu');
      }
      cleanupExtension();
      return;
    }

    if (wasDisabled) {
      console.log('SB Logger: Re-enabled via action menu');
    }
    scheduleInit();
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'extension-disabled-changed') {
        updateDisabledState(Boolean(message.disabled));
      }
    });
  }

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ [DISABLE_STORAGE_KEY]: false }, (result) => {
      const disabled = Boolean(result[DISABLE_STORAGE_KEY]);
      if (disabled) {
        updateDisabledState(true);
      } else {
        scheduleInit();
      }
    });
  } else {
    scheduleInit();
  }
})();
