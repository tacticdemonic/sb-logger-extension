// SB Logger - Content Script for surebet.com valuebets
(function () {
  if (window.__sbLoggerInjected) return;
  window.__sbLoggerInjected = true;

  // Only run on surebet.com valuebets page OR smarkets.com event pages
  console.log('SB Logger: Script loaded on:', location.hostname, location.pathname);
  
  const isSurebetValuebets = location.hostname.includes('surebet.com') && location.pathname.includes('valuebets');
  const isSmarketsEvent = location.hostname.includes('smarkets.com') && location.pathname.includes('/event/');
  
  if (!isSurebetValuebets && !isSmarketsEvent) {
    console.log('SB Logger: Not on supported page, exiting');
    return;
  }
  
  console.log('SB Logger: ✓ On supported page, continuing initialization');
  
  // Determine which site we're on
  const onSmarkets = location.hostname.includes('smarkets.com');

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
    
    // Initialize API retry tracking
    betData.apiRetryCount = 0;
    betData.lastApiCheck = null;

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

  function parseSmarketsPageData() {
    try {
      console.log('SB Logger: Parsing Smarkets page data');
      const data = {
        timestamp: new Date().toISOString(),
        url: location.href,
        bookmaker: 'Smarkets'
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

  function injectSaveButtonOnSmarkets() {
    // Skip if button already injected
    if (document.querySelector('.sb-logger-save-btn-smarkets')) {
      console.log('SB Logger: Save button already on Smarkets page');
      return;
    }

    console.log('SB Logger: Injecting save button on Smarkets page');

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
    saveBtn.textContent = '💾 Save Bet';
    saveBtn.title = 'Click to save the current bet to your log';

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

      const betData = parseSmarketsPageData();
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
      '[class*="bet-detail"]',
      '[class*="tooltip"]',
      '[class*="dropdown"]',
      '[class*="details"]'
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

  function init() {
    console.log('SB Logger: ===== INITIALIZING =====');
    console.log('SB Logger: URL:', location.href);
    injectStyles();
    
    // Show a temporary toast to confirm script is running
    setTimeout(() => {
      showToast('SB Logger Active!', true, 1500);
    }, 1000);
    
    // If on Smarkets, inject floating button
    if (onSmarkets) {
      console.log('SB Logger: On Smarkets, injecting floating save button');
      setTimeout(injectSaveButtonOnSmarkets, 1000);
      // Don't do the table row injection on Smarkets
      return;
    }
    
    // Initial injection with multiple retry attempts (for Surebet)
    setTimeout(injectSaveButtons, 500);
    
    // Try injecting preset buttons multiple times with increasing delays
    setTimeout(injectPresetButtons, 800);
    setTimeout(injectPresetButtons, 1500);
    setTimeout(injectPresetButtons, 3000);
    setTimeout(injectPresetButtons, 5000);
    
    // Also watch for clicks on filter buttons that might open the popup
    document.addEventListener('click', (e) => {
      console.log('SB Logger: Click detected on:', e.target.tagName, e.target.className, e.target);
      // If something was clicked that might open a filter popup, try injecting after a delay
      setTimeout(() => {
        console.log('SB Logger: Post-click injection attempt (200ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup(); // Also check for bet popups
      }, 200);
      setTimeout(() => {
        console.log('SB Logger: Post-click injection attempt (500ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 500);
      setTimeout(() => {
        console.log('SB Logger: Post-click injection attempt (1000ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 1000);
      setTimeout(() => {
        console.log('SB Logger: Post-click injection attempt (1500ms)');
        detectAndInjectIntoPopup();
      }, 1500);
    }, true);

    // Watch for new rows being added (auto-update feature)
    const observer = new MutationObserver((mutations) => {
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
      
      if (shouldInject) {
        setTimeout(injectSaveButtons, 100);
      }
      if (shouldInjectPresets) {
        setTimeout(injectPresetButtons, 300);
      }
      if (shouldCheckPopup) {
        setTimeout(detectAndInjectIntoPopup, 200);
      }
    });

    // Observe the main content area
    const mainContent = document.querySelector('main') || document.querySelector('.page-container') || document.body;
    observer.observe(mainContent, { childList: true, subtree: true });
    
    console.log('SB Logger: Initialization complete, observers active');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
