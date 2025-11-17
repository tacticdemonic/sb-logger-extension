// Popup UI — lists bets and triggers export/clear actions.
console.log('🚀 SB Logger Popup Script Loading...');

// Use chrome API when available (includes Firefox shim), fallback to browser
const api = typeof chrome !== 'undefined' ? chrome : browser;

function generateBetUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded - Initializing popup...');
  const container = document.getElementById('bets');
  const btnJson = document.getElementById('export-json');
  const btnCsv = document.getElementById('export-csv');
  const btnClear = document.getElementById('clear-all');
  const btnChart = document.getElementById('view-chart');
  const btnCloseChart = document.getElementById('close-chart');
  const chartModal = document.getElementById('chart-modal');
  const btnCheckResults = document.getElementById('check-results');
  const btnApiSetup = document.getElementById('api-setup');
  const btnImportCsv = document.getElementById('import-csv');
  const btnCommissionSettings = document.getElementById('commission-settings');
  const commissionPanel = document.getElementById('commission-panel');
  const btnSaveCommission = document.getElementById('save-commission');
  const btnCancelCommission = document.getElementById('cancel-commission');

  // Default commission rates
  const defaultCommission = {
    betfair: 5.0,
    betdaq: 2.0,
    matchbook: 1.0,
    smarkets: 2.0
  };

  // Load commission settings
  let commissionRates = { ...defaultCommission };
  
  // Function to load commission rates from storage
  function loadCommissionRates(callback) {
    api.storage.local.get({ commission: defaultCommission }, (res) => {
      commissionRates = { ...res.commission };
      console.log('💰 Commission rates loaded:', commissionRates);
      if (callback) callback();
    });
  }

  // Helper function to get commission rate for a bookmaker
  function getCommission(bookmaker) {
    if (!bookmaker) return 0;
    const bookie = bookmaker.toLowerCase();
    if (bookie.includes('betfair')) return commissionRates.betfair || 0;
    if (bookie.includes('betdaq')) return commissionRates.betdaq || 0;
    if (bookie.includes('matchbook')) return commissionRates.matchbook || 0;
    if (bookie.includes('smarkets')) return commissionRates.smarkets || 0;
    return 0;
  }

  // Commission settings button
  if (btnCommissionSettings) {
    btnCommissionSettings.addEventListener('click', () => {
      const isVisible = commissionPanel.style.display !== 'none';
      if (isVisible) {
        commissionPanel.style.display = 'none';
      } else {
        // Load current values from storage to ensure they're fresh
        loadCommissionRates(() => {
          document.getElementById('comm-betfair').value = commissionRates.betfair || defaultCommission.betfair;
          document.getElementById('comm-betdaq').value = commissionRates.betdaq || defaultCommission.betdaq;
          document.getElementById('comm-matchbook').value = commissionRates.matchbook || defaultCommission.matchbook;
          document.getElementById('comm-smarkets').value = commissionRates.smarkets || defaultCommission.smarkets;
          commissionPanel.style.display = 'block';
        });
      }
    });
  }

  // Save commission settings
  if (btnSaveCommission) {
    btnSaveCommission.addEventListener('click', () => {
      const newRates = {
        betfair: parseFloat(document.getElementById('comm-betfair').value) || 0,
        betdaq: parseFloat(document.getElementById('comm-betdaq').value) || 0,
        matchbook: parseFloat(document.getElementById('comm-matchbook').value) || 0,
        smarkets: parseFloat(document.getElementById('comm-smarkets').value) || 0
      };
      console.log('💾 Saving commission rates:', newRates);
      api.storage.local.set({ commission: newRates }, () => {
        console.log('✅ Commission rates saved successfully');
        // Reload commission rates from storage and then refresh the display
        loadCommissionRates(() => {
          commissionPanel.style.display = 'none';
          loadAndRender(); // Refresh display with new commission rates
        });
      });
    });
  }

  // Cancel commission settings
  if (btnCancelCommission) {
    btnCancelCommission.addEventListener('click', () => {
      commissionPanel.style.display = 'none';
    });
  }

  // Set up event delegation for status buttons once
  console.log('=== SB Logger Popup: Setting up event delegation ===');
  console.log('Container element:', container);
  
  if (!container) {
    console.error('ERROR: Container element not found!');
  } else {
    container.addEventListener('click', (e) => {
      console.log('🖱️ Container clicked:', e.target.tagName, e.target.className);
      if (e.target.classList.contains('status-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const betId = e.target.dataset.betId;
        const status = e.target.dataset.status;
        console.log('✅ Status button clicked via delegation:', { betId, status });
        updateBetStatus(betId, status);
      } else if (e.target.classList.contains('delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const betId = e.target.dataset.betId;
        console.log('🗑️ Delete button clicked via delegation:', { betId });
        deleteBet(betId);
      } else {
        console.log('⚠️ Clicked element is not a status-btn or delete-btn');
      }
    }, true);
    console.log('✓ Event listener attached to container');
  }

  function render(bets, sortBy = 'saved-desc', hideLayBets = false) {
    console.log('🎨 Rendering', bets.length, 'bets, sortBy:', sortBy, 'hideLayBets:', hideLayBets);
    
    if (!bets || bets.length === 0) {
      container.innerHTML = '<div class="small">No bets saved yet. Visit surebet.com/valuebets and click "💾 Save" on any bet row.</div>';
      return;
    }
    
    // Log status breakdown
    const statusCounts = bets.reduce((acc, b) => {
      const status = b.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 Status breakdown:', statusCounts);
    
    // Filter out lay bets if hideLayBets is true
    let filteredBets = bets;
    if (hideLayBets) {
      filteredBets = bets.filter(b => !b.isLay);
      if (filteredBets.length === 0) {
        container.innerHTML = '<div class="small">No bets to display (all bets are lay bets). Uncheck "Hide Lay Bets" to see them.</div>';
        return;
      }
    }
    
    // Sort bets
    let sortedBets = filteredBets.slice();
    switch(sortBy) {
      case 'saved-desc':
        sortedBets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case 'saved-asc':
        sortedBets.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        break;
      case 'event-asc':
        sortedBets.sort((a, b) => {
          if (!a.eventTime) return 1;
          if (!b.eventTime) return -1;
          return new Date(a.eventTime) - new Date(b.eventTime);
        });
        break;
      case 'event-desc':
        sortedBets.sort((a, b) => {
          if (!a.eventTime) return 1;
          if (!b.eventTime) return -1;
          return new Date(b.eventTime) - new Date(a.eventTime);
        });
        break;
      case 'status':
        sortedBets.sort((a, b) => {
          const statusOrder = { 'pending': 0, 'won': 1, 'lost': 2, 'void': 3 };
          const aStatus = a.status || 'pending';
          const bStatus = b.status || 'pending';
          if (statusOrder[aStatus] !== statusOrder[bStatus]) {
            return statusOrder[aStatus] - statusOrder[bStatus];
          }
          // Secondary sort by event time for pending bets
          if (aStatus === 'pending' && a.eventTime && b.eventTime) {
            return new Date(a.eventTime) - new Date(b.eventTime);
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        break;
    }
    
    // Calculate running totals
    let runningProfit = 0;
    let totalStaked = 0;
    let settledBets = 0;
    let expectedProfitSettled = 0; // EV for settled bets only
    let totalEV = 0; // EV for all bets (pending + settled)
    
    const rows = sortedBets.map((b, idx) => {
      const betKey = getBetKey(b);
      const ts = new Date(b.timestamp).toLocaleString();
      const commission = getCommission(b.bookmaker);
      
      // Normalize status by trimming whitespace
      if (b.status && typeof b.status === 'string') {
        b.status = b.status.trim().toLowerCase();
      }
      
      // Calculate profit with commission (different for back vs lay)
      let profit = 0;
      let potential = 0;
      let liability = 0;
      
      if (b.stake && b.odds) {
        if (b.isLay) {
          // LAY BET: You're acting as the bookmaker
          // Use original lay odds if available, otherwise use stored odds
          const layOdds = b.originalLayOdds || b.odds;
          liability = parseFloat(b.stake) * (parseFloat(layOdds) - 1);
          profit = parseFloat(b.stake); // Profit if selection loses
          const commissionAmount = commission > 0 ? (profit * commission / 100) : 0;
          profit = profit - commissionAmount; // Net profit after commission
          potential = profit; // Your potential win is the profit
        } else {
          // BACK BET: Traditional bet
          const grossProfit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
          const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
          profit = grossProfit - commissionAmount;
          potential = parseFloat(b.stake) + profit;
        }
      }
      const profitDisplay = b.stake && b.odds ? profit.toFixed(2) : '-';
      const potentialDisplay = b.stake && b.odds ? potential.toFixed(2) : '-';
      
      // Calculate expected value (EV) from overvalue
      let expectedValue = 0;
      if (b.overvalue) {
        // EV is the overvalue percentage
        expectedValue = parseFloat(b.overvalue);
      }
      
      // Add to total EV for all bets
      totalEV += expectedValue;
      
      // Calculate actual profit/loss based on status, including commission
      let actualPL = 0;
      if (b.stake && b.odds) {
        if (b.status === 'won') {
          actualPL = profit;
        } else if (b.status === 'lost') {
          if (b.isLay) {
            // For lay bets, if you lose, you pay the liability
            actualPL = -(parseFloat(b.stake) * (parseFloat(b.odds) - 1));
          } else {
            // For back bets, if you lose, you lose the stake
            actualPL = -parseFloat(b.stake);
          }
        }
        // void bets don't affect P/L
      }
      
      if (b.status && b.status !== 'pending') {
        runningProfit += actualPL;
        settledBets++;
        expectedProfitSettled += expectedValue;
      }
      if (b.stake) {
        totalStaked += parseFloat(b.stake);
      }
      
      // Status badge
      let statusBadge = '';
      let statusColor = '#6c757d';
      let plDisplay = profitDisplay;
      
      // Debug logging for the Galatasaray bet
      if (b.event && b.event.includes('Galatasaray')) {
        console.log('🔍 Rendering Galatasaray bet:', {
          id: b.id,
          timestamp: b.timestamp,
          betKey,
          event: b.event,
          status: b.status,
          statusType: typeof b.status,
          statusLength: b.status?.length,
          statusTrimmed: b.status?.trim(),
          isWon: b.status === 'won',
          isLost: b.status === 'lost',
          isVoid: b.status === 'void',
          isPending: !b.status || b.status === 'pending',
          stake: b.stake,
          market: b.market
        });
      }
      
      if (b.status === 'won') {
        statusBadge = '✓ WON';
        statusColor = '#28a745';
        plDisplay = `+${profitDisplay}`;
      } else if (b.status === 'lost') {
        statusBadge = '✗ LOST';
        statusColor = '#dc3545';
        if (b.isLay) {
          // Show liability for lay bets
          plDisplay = `-${liability.toFixed(2)}`;
        } else {
          plDisplay = `-${b.stake || 0}`;
        }
      } else if (b.status === 'void') {
        statusBadge = '○ VOID';
        statusColor = '#6c757d';
        plDisplay = '0.00';
      } else {
        statusBadge = '⋯ PENDING';
        statusColor = '#ffc107';
      }
      
      
      // Format event time and check if it's passed
      let eventTimeDisplay = '';
      let eventPassed = false;
      if (b.eventTime) {
        const eventDate = new Date(b.eventTime);
        const now = new Date();
        eventPassed = eventDate < now;
        const eventTimeStr = eventDate.toLocaleString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit'
        });
        const passedStyle = eventPassed && b.status === 'pending' ? 'color:#dc3545;font-weight:600' : 'color:#666';
        eventTimeDisplay = `<div class="small" style="${passedStyle};margin-top:2px">🕒 ${eventTimeStr}${eventPassed && b.status === 'pending' ? ' ⚠️' : ''}</div>`;
      }
      
      return `<tr data-bet-id="${betKey}" style="${eventPassed && b.status === 'pending' ? 'background:#fff3cd' : ''}">
        <td style="width:110px">
          <div class="small">${ts}</div>
          ${b.event && b.event.includes('Galatasaray') ? `<div class="small" style="color:#dc3545;font-weight:600">ID: ${betKey}</div>` : ''}
          <div style="font-weight:600;color:#28a745">${b.bookmaker || 'Unknown'}</div>
          <div class="small">${b.sport || ''}</div>
          ${eventTimeDisplay}
          <div style="margin-top:6px">
            <span class="badge" style="background:${statusColor};color:#fff;font-size:10px;padding:3px 6px;font-weight:600">${statusBadge}</span>
          </div>
        </td>
        <td>
          <div style="font-weight:600">${escapeHtml(b.event || 'Unknown Event')}</div>
          <div class="small">${escapeHtml(b.tournament || '')}</div>
          <div class="note">${escapeHtml(b.market || '')}</div>
          <div style="margin-top:4px">
            ${b.isLay ? '<span class="badge" style="background:#6f42c1;color:#fff;font-size:10px;padding:2px 6px;margin-right:4px;font-weight:700">LAY</span>' : ''}
            <span class="badge" style="background:#007bff;color:#fff;font-size:10px;padding:2px 6px;margin-right:4px">Odds: ${b.odds}</span>
            <span class="badge" style="background:#6c757d;color:#fff;font-size:10px;padding:2px 6px;margin-right:4px">Prob: ${b.probability}%</span>
            <span class="badge" style="background:#ffc107;color:#000;font-size:10px;padding:2px 6px">Value: +${b.overvalue}%</span>
          </div>
          <div style="margin-top:4px;font-size:12px">
            <strong>Stake:</strong> ${b.stake || '-'}${b.isLay ? ` | <strong>Liability:</strong> <span style="color:#dc3545">${liability.toFixed(2)}</span>` : ''} | 
            <strong>Potential:</strong> ${potentialDisplay} | 
            <strong>P/L:</strong> <span style="color:${b.status === 'won' ? '#28a745' : b.status === 'lost' ? '#dc3545' : '#666'}">${plDisplay}</span> | 
            <strong>EV:</strong> <span style="color:${expectedValue >= 0 ? '#007bff' : '#dc3545'};font-weight:${expectedValue >= 0 ? '600' : '400'}" title="Expected Value (Overvalue)">${expectedValue > 0 ? '+' : ''}${expectedValue.toFixed(2)}%</span>
          </div>
          ${b.note ? `<div class="note" style="margin-top:4px"><em>${escapeHtml(b.note)}</em></div>` : ''}
          <div style="margin-top:6px;display:flex;gap:4px">
            ${(!b.status || b.status === 'pending') ? `
            <button class="status-btn" data-bet-id="${betKey}" data-status="won" style="font-size:10px;padding:3px 8px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">✓ Won</button>
            <button class="status-btn" data-bet-id="${betKey}" data-status="lost" style="font-size:10px;padding:3px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">✗ Lost</button>
            <button class="status-btn" data-bet-id="${betKey}" data-status="void" style="font-size:10px;padding:3px 8px;background:#6c757d;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">○ Void</button>
            ` : ''}
            <button class="delete-btn" data-bet-id="${betKey}" style="font-size:10px;padding:3px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;font-weight:600;margin-left:auto" title="Delete this bet">🗑️ Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    
    const roi = totalStaked > 0 ? ((runningProfit / totalStaked) * 100).toFixed(2) : '0.00';
    const roiColor = runningProfit >= 0 ? '#28a745' : '#dc3545';
    const evDiff = runningProfit - expectedProfitSettled;
    const evDiffColor = evDiff >= 0 ? '#28a745' : '#dc3545';
    const totalEvColor = totalEV >= 0 ? '#007bff' : '#dc3545';
    
    const hiddenCount = bets.length - filteredBets.length;
    const summary = `
      <div style="background:#f8f9fa;padding:8px;margin-bottom:8px;border-radius:4px;font-size:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div>
            <strong>Total Staked:</strong> ${totalStaked.toFixed(2)} | 
            <strong>Settled:</strong> ${settledBets}/${filteredBets.length}${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''} | 
            <strong>Total EV:</strong> <span style="color:${totalEvColor};font-weight:600">${totalEV >= 0 ? '+' : ''}${totalEV.toFixed(2)}</span>
          </div>
          <div style="font-size:14px;font-weight:700;color:${roiColor}">
            <span style="color:#666">P/L:</span> ${runningProfit >= 0 ? '+' : ''}${runningProfit.toFixed(2)} <span style="font-size:11px">(${roi >= 0 ? '+' : ''}${roi}%)</span>
          </div>
        </div>
        ${settledBets > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #dee2e6;font-size:11px">
          <div style="color:#666">
            <strong>Expected (Settled):</strong> <span style="color:#007bff">${expectedProfitSettled >= 0 ? '+' : ''}${expectedProfitSettled.toFixed(2)}</span>
          </div>
          <div style="color:#666">
            <strong>vs Expected:</strong> <span style="color:${evDiffColor};font-weight:600">${evDiff >= 0 ? '+' : ''}${evDiff.toFixed(2)}</span>
          </div>
        </div>` : ''}
      </div>
    `;
    
    container.innerHTML = summary + `<table><thead><tr><th style="width:120px">When / Bookie</th><th>Bet Details</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updateBetStatus(betId, status) {
    console.log('updateBetStatus called with:', { betId, status });
    api.storage.local.get({ bets: [] }, (res) => {
      const bets = res.bets || [];
      console.log('Total bets in storage:', bets.length);
      // Convert betId to string for comparison since data attributes are always strings
      const betKey = String(betId);
      const bet = bets.find(b => getBetKey(b) === betKey);
      console.log('Searching for bet with ID:', betKey);
      console.log('Found bet:', bet);
      if (bet) {
        const oldStatus = bet.status;
        // Ensure status is trimmed and lowercase
        bet.status = status.trim().toLowerCase();
        bet.settledAt = new Date().toISOString();
        console.log('Updating bet status to:', bet.status, '(was:', oldStatus, ')');
        api.storage.local.set({ bets }, () => {
          console.log('✅ Bet status updated successfully in storage');
          // Verify the update
          api.storage.local.get({ bets: [] }, (verifyRes) => {
            const verifiedBet = (verifyRes.bets || []).find(b => {
              return getBetKey(b) === betKey;
            });
            console.log('🔍 Verified bet after save:', {
              id: verifiedBet?.id,
              event: verifiedBet?.event,
              status: verifiedBet?.status,
              settledAt: verifiedBet?.settledAt,
              betKey: verifiedBet ? getBetKey(verifiedBet) : undefined
            });
            console.log('🔄 Reloading UI...');
            loadAndRender();
          });
        });
      } else {
        console.error('Bet not found with id:', betKey);
        console.error('Available bet IDs:', bets.map(b => getBetKey(b)));
      }
    });
  }

  function deleteBet(betId) {
    console.log('deleteBet called with:', { betId });
    if (!confirm('Are you sure you want to delete this bet? This cannot be undone.')) {
      return;
    }
    api.storage.local.get({ bets: [] }, (res) => {
      const bets = res.bets || [];
      console.log('Total bets in storage before delete:', bets.length);
      // Convert betId to string for comparison since data attributes are always strings
      const betKey = String(betId);
      const betIndex = bets.findIndex(b => getBetKey(b) === betKey);
      console.log('Searching for bet with ID:', betKey);
      console.log('Found bet at index:', betIndex);
      if (betIndex !== -1) {
        const deletedBet = bets[betIndex];
        console.log('Deleting bet:', deletedBet);
        bets.splice(betIndex, 1);
        api.storage.local.set({ bets }, () => {
          console.log('Bet deleted successfully, reloading...');
          console.log('Total bets after delete:', bets.length);
          loadAndRender();
        });
      } else {
        console.error('Bet not found with id:', betKey);
        console.error('Available bet IDs:', bets.map(b => getBetKey(b)));
        alert('Error: Bet not found');
      }
    });
  }
  
  function loadAndRender() {
    const sortBy = document.getElementById('sort-select')?.value || 'saved-desc';
    const hideLayBets = document.getElementById('hide-lay-bets')?.checked || false;
    api.storage.local.get({ bets: [] }, (res) => {
      let bets = res.bets || [];
      
      // Clean up any bets with whitespace in status (migration)
      let needsCleanup = false;
      bets = bets.map(b => {
        if (ensureBetIdentity(b)) {
          needsCleanup = true;
        }
        if (b.status && typeof b.status === 'string') {
          const cleaned = b.status.trim().toLowerCase();
          if (cleaned !== b.status) {
            console.log('🧹 Cleaning status for', b.event, ':', `"${b.status}"`, '→', `"${cleaned}"`);
            b.status = cleaned;
            needsCleanup = true;
          }
        }
        return b;
      });
      
      // Save cleaned bets if needed
      if (needsCleanup) {
        console.log('💾 Saving cleaned bets to storage...');
        api.storage.local.set({ bets }, () => {
          render(bets, sortBy, hideLayBets);
        });
      } else {
        render(bets, sortBy, hideLayBets);
      }
    });
  }
  
  // Sort select handler
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', loadAndRender);
  }

  // Hide lay bets checkbox handler
  const hideLayBetsCheckbox = document.getElementById('hide-lay-bets');
  if (hideLayBetsCheckbox) {
    hideLayBetsCheckbox.addEventListener('change', loadAndRender);
  }

  btnJson.addEventListener('click', async () => {
    api.storage.local.get({ bets: [] }, (res) => {
      const data = res.bets || [];
      const dataStr = JSON.stringify(data, null, 2);
      const filename = `sb-bets-${(new Date()).toISOString().replace(/[:.]/g, '-')}.json`;
      console.log('📤 Sending export message for JSON...');
      api.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'application/json' }, (resp) => {
        console.log('📥 Export response:', resp);
        if (api.runtime.lastError) {
          console.error('Export error:', api.runtime.lastError);
          alert('Export failed: ' + api.runtime.lastError.message);
        } else if (resp && resp.success) {
          console.log('✅ Export successful');
          alert('JSON exported successfully!');
        } else if (resp && resp.error) {
          alert('Export failed: ' + resp.error);
        }
      });
    });
  });

  btnCsv.addEventListener('click', async () => {
    api.storage.local.get({ bets: [] }, (res) => {
      const data = res.bets || [];
      if (data.length === 0) {
        alert('No bets to export.');
        return;
      }
      // Build CSV header
      const rows = [];
      rows.push(['timestamp', 'bookmaker', 'sport', 'event', 'tournament', 'market', 'is_lay', 'odds', 'probability', 'overvalue', 'stake', 'liability', 'commission_rate', 'commission_amount', 'potential_return', 'profit', 'expected_value', 'status', 'settled_at', 'actual_pl', 'note', 'url'].join(','));
      for (const b of data) {
        const esc = (v) => `\"${('' + (v ?? '')).replace(/\"/g, '\"\"')}\"`;
        const commission = getCommission(b.bookmaker);
        
        // Calculate profit and liability with commission (different for back vs lay)
        let profit = '';
        let potential = '';
        let commissionAmount = '';
        let liability = '';
        
        if (b.stake && b.odds) {
          if (b.isLay) {
            // LAY BET: Use original lay odds
            const layOdds = b.originalLayOdds || b.odds;
            liability = (parseFloat(b.stake) * (parseFloat(layOdds) - 1)).toFixed(2);
            const grossProfit = parseFloat(b.stake);
            const commAmt = commission > 0 ? (grossProfit * commission / 100) : 0;
            const netProfit = grossProfit - commAmt;
            profit = netProfit.toFixed(2);
            potential = netProfit.toFixed(2);
            commissionAmount = commAmt.toFixed(2);
          } else {
            // BACK BET
            const grossProfit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
            const commAmt = commission > 0 ? (grossProfit * commission / 100) : 0;
            const netProfit = grossProfit - commAmt;
            profit = netProfit.toFixed(2);
            potential = (parseFloat(b.stake) + netProfit).toFixed(2);
            commissionAmount = commAmt.toFixed(2);
            liability = '0';
          }
        }
        
        // Calculate expected value from overvalue
        let expectedValue = '';
        if (b.overvalue) {
          // EV is the overvalue percentage
          expectedValue = parseFloat(b.overvalue).toFixed(2);
        }
        
        // Calculate actual P/L with commission (different for back vs lay)
        let actualPL = '';
        if (b.stake && b.odds) {
          if (b.status === 'won') {
            actualPL = profit;
          } else if (b.status === 'lost') {
            if (b.isLay) {
              // For lay bets, if you lose, you pay the liability
              actualPL = '-' + liability;
            } else {
              actualPL = '-' + b.stake;
            }
          } else if (b.status === 'void') {
            actualPL = '0';
          }
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
          esc(commission),
          esc(commissionAmount),
          esc(potential),
          esc(profit),
          esc(expectedValue),
          esc(b.status || 'pending'),
          esc(b.settledAt || ''),
          esc(actualPL),
          esc(b.note),
          esc(b.url)
        ].join(','));
      }
      const dataStr = rows.join('\r\n');
      const filename = `sb-bets-${(new Date()).toISOString().replace(/[:.]/g, '-')}.csv`;
      console.log('📤 Sending export message for CSV...');
      api.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'text/csv' }, (resp) => {
        console.log('📥 Export response:', resp);
        if (api.runtime.lastError) {
          console.error('Export error:', api.runtime.lastError);
          alert('Export failed: ' + api.runtime.lastError.message);
        } else if (resp && resp.success) {
          console.log('✅ Export successful');
          alert('CSV exported successfully!');
        } else if (resp && resp.error) {
          alert('Export failed: ' + resp.error);
        }
      });
    });
  });

  btnClear.addEventListener('click', () => {
    if (!confirm('Clear all saved bets? This cannot be undone.')) return;
    api.runtime.sendMessage({ action: 'clearBets' }, (resp) => {
      if (resp && resp.success) loadAndRender();
      else alert('Clear failed.');
    });
  });

  if (btnChart) {
    btnChart.addEventListener('click', () => {
      api.storage.local.get({ bets: [] }, (res) => {
        const bets = res.bets || [];
        if (bets.length === 0) {
          alert('No bets to chart. Save some bets first!');
          return;
        }
        showChart(bets);
      });
    });
  }

  if (btnCloseChart) {
    btnCloseChart.addEventListener('click', () => {
      chartModal.classList.remove('active');
    });
  }

  if (chartModal) {
    chartModal.addEventListener('click', (e) => {
      if (e.target.id === 'chart-modal') {
        chartModal.classList.remove('active');
      }
    });
  }

  if (btnCheckResults) {
    btnCheckResults.addEventListener('click', () => {
      btnCheckResults.disabled = true;
      btnCheckResults.textContent = '🔄 Checking...';
      
      console.log('🔍 Check Results button clicked');
      console.log('📤 Sending message to background script...');
      
      api.runtime.sendMessage({ action: 'checkResults' }, (response) => {
        console.log('📬 Message callback triggered');
        
        // Check for runtime errors
        if (api.runtime.lastError) {
          console.error('❌ Runtime error:', api.runtime.lastError);
          btnCheckResults.disabled = false;
          btnCheckResults.textContent = '🔍 Check Results';
          alert('Communication error: ' + api.runtime.lastError.message);
          return;
        }
        btnCheckResults.disabled = false;
        btnCheckResults.textContent = '🔍 Check Results';
        
        console.log('📥 Response received:', response);
        
        if (!response) {
          console.error('❌ No response received from background script');
          alert('No response from result checker. Check the console (F12) for errors.');
          return;
        }
        
        if (response.error) {
          console.error('❌ Error response:', response.error);
          alert('Error checking results: ' + response.error);
        } else if (response.message) {
          console.log('ℹ️ Info message:', response.message);
          alert(response.message);
        } else if (response.results !== undefined) {
          const found = response.found || 0;
          const checked = response.checked || 0;
          
          console.log(`✅ Results: ${found} found from ${checked} checked`);
          
          if (found > 0) {
            alert(`Found ${found} result(s) from ${checked} bet(s) checked!\n\nRefreshing bet list...`);
            loadAndRender();
          } else {
            alert(`Checked ${checked} bet(s), but no results found yet.\n\nBets will be rechecked automatically or you can try again later.`);
          }
        } else {
          console.error('❌ Unexpected response structure:', JSON.stringify(response));
          alert('Unexpected response from result checker.\n\nResponse: ' + JSON.stringify(response));
        }
      });
    });
  }

  if (btnApiSetup) {
    btnApiSetup.addEventListener('click', () => {
      const message = `API Setup Instructions:
      
1. Get free API keys:
   • API-Football: https://www.api-football.com/ (100 req/day)
   • The Odds API: https://the-odds-api.com/ (500 req/month)

2. Open the extension folder:
   sb-logger-extension/apiService.js

3. Replace the placeholder API keys at the top of the file

4. Reload the extension in Firefox (about:debugging)

5. Click "🔍 Check Results" to test

See API_SETUP.md in the extension folder for detailed instructions.`;
      
      alert(message);
    });
  }

  // Import CSV functionality - open dedicated import page
  if (btnImportCsv) {
    btnImportCsv.addEventListener('click', () => {
      console.log('� Opening import page...');
      api.tabs.create({ url: api.runtime.getURL('import.html') });
    });
  }

  function parseBetfairCSV(csvText) {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }
    
    // Parse header to find column indices
    const header = lines[0].split(',').map(h => h.trim());
    const marketIdx = header.findIndex(h => h.toLowerCase().includes('market'));
    const startTimeIdx = header.findIndex(h => h.toLowerCase().includes('start'));
    const settledDateIdx = header.findIndex(h => h.toLowerCase().includes('settled'));
    const plIdx = header.findIndex(h => h.toLowerCase().includes('profit') || h.toLowerCase().includes('loss') || h.toLowerCase().includes('p/l'));
    
    console.log('CSV Header:', header);
    console.log('Column indices:', { marketIdx, startTimeIdx, settledDateIdx, plIdx });
    
    if (marketIdx === -1 || plIdx === -1) {
      throw new Error('CSV must have "Market" and "Profit/Loss" columns');
    }
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim());
      
      if (cols.length < header.length) continue;
      
      const market = cols[marketIdx];
      const pl = parseFloat(cols[plIdx].replace(/[£€$,]/g, ''));
      
      if (!market || isNaN(pl)) continue;
      
      // Parse market string: "Sport / Event : Market"
      // Example: "Basketball / Helsinki Seagulls v KTP Basket : Handicap"
      const colonIdx = market.indexOf(':');
      let sport = '';
      let event = '';
      let marketName = market;
      
      if (colonIdx !== -1) {
        const beforeColon = market.substring(0, colonIdx).trim();
        marketName = market.substring(colonIdx + 1).trim();
        
        // Extract sport and event from "Sport / Event" format
        const slashIdx = beforeColon.indexOf('/');
        if (slashIdx !== -1) {
          sport = beforeColon.substring(0, slashIdx).trim();
          event = beforeColon.substring(slashIdx + 1).trim();
        } else {
          event = beforeColon;
        }
      }
      
      const entry = {
        sport: sport,
        market: marketName,
        event: event,
        pl: pl,
        startTime: startTimeIdx !== -1 ? cols[startTimeIdx] : null,
        settledDate: settledDateIdx !== -1 ? cols[settledDateIdx] : null,
        rawMarket: market
      };
      
      console.log('Parsed CSV entry:', entry);
      results.push(entry);
    }
    
    console.log(`Parsed ${results.length} total entries from CSV`);
    return results;
  }

  function matchBetWithPL(bet, plData, allPendingBets = []) {
    // Must be Betfair bet
    if (!bet.bookmaker || !bet.bookmaker.toLowerCase().includes('betfair')) {
      console.log(`Skipping non-Betfair bet: ${bet.bookmaker}`);
      return null;
    }
    
    // Skip already settled bets
    if (bet.status && bet.status !== 'pending') {
      console.log(`Skipping already settled bet: ${bet.event} (${bet.status})`);
      return null;
    }
    
    console.log(`\nTrying to match bet:`);
    console.log(`  Event: "${bet.event}"`);
    console.log(`  Market: "${bet.market}"`);
    console.log(`  Sport: "${bet.sport}"`);
    
    // Normalize strings for comparison
    const normalizeName = (str) => {
      if (!str) return '';
      return str.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const betEvent = normalizeName(bet.event);
    const betSport = normalizeName(bet.sport);
    
    // Count how many pending bets exist for this same event
    const betsOnSameEvent = allPendingBets.filter(b => {
      const bEvent = normalizeName(b.event);
      return bEvent === betEvent || betEvent.includes(bEvent) || bEvent.includes(betEvent);
    }).length;
    
    console.log(`  Found ${betsOnSameEvent} pending bet(s) on this event`);
    
    // Try to match by market and event
    for (const pl of plData) {
      const betMarket = normalizeName(bet.market);
      const plMarket = normalizeName(pl.market);
      const plEvent = normalizeName(pl.event);
      const plSport = normalizeName(pl.sport);
      
      console.log(`  Comparing with CSV entry:`);
      console.log(`    Event: "${pl.event}" (normalized: "${plEvent}")`);
      console.log(`    Market: "${pl.market}" (normalized: "${plMarket}")`);
      console.log(`    Sport: "${pl.sport}" (normalized: "${plSport}")`);
      
      // Check if sports match (if both available)
      let sportMatch = true;
      if (betSport && plSport) {
        sportMatch = betSport === plSport || betSport.includes(plSport) || plSport.includes(betSport);
        console.log(`    Sport match: ${sportMatch}`);
      }
      
      // Check if events match
      const eventMatch = betEvent && plEvent &&
        (betEvent.includes(plEvent) || plEvent.includes(betEvent) ||
         levenshteinDistance(betEvent, plEvent) < Math.min(betEvent.length, plEvent.length) * 0.3);
      console.log(`    Event match: ${eventMatch}`);
      
      // Check if markets match (contains or partial match)
      const marketMatch = betMarket && plMarket && 
        (betMarket.includes(plMarket) || plMarket.includes(betMarket) || 
         levenshteinDistance(betMarket, plMarket) < Math.min(betMarket.length, plMarket.length) * 0.3);
      console.log(`    Market match: ${marketMatch}`);
      
      // Match if sport and event match (and optionally market)
      // This allows matching even if markets are different names for same bet
      if (sportMatch && eventMatch && marketMatch) {
        console.log(`  ✓ EXACT MATCH FOUND (sport + event + market)!`);
        return pl;
      }
      
      // Relaxed match: if sport and event match but markets are similar enough
      if (sportMatch && eventMatch && betMarket && plMarket) {
        const marketSimilarity = 1 - (levenshteinDistance(betMarket, plMarket) / Math.max(betMarket.length, plMarket.length));
        console.log(`    Market similarity: ${(marketSimilarity * 100).toFixed(1)}%`);
        if (marketSimilarity > 0.4) {
          console.log(`  ✓ FUZZY MATCH FOUND (sport + event + similar market)!`);
          return pl;
        }
      }
    }
    
    console.log(`  ✗ No match found`);
    return null;
  }

  // Simple Levenshtein distance for fuzzy matching
  function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];
    
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[len1][len2];
  }

  function importMultipleBetfairPL(files) {
    console.log(`=== IMPORTING ${files.length} BETFAIR P/L CSV FILES ===`);
    
    let allPlData = [];
    let filesProcessed = 0;
    let errors = [];
    
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          console.log(`\n--- Processing file ${index + 1}/${files.length}: ${file.name} ---`);
          const csvText = event.target.result;
          const plData = parseBetfairCSV(csvText);
          console.log(`✓ Parsed ${plData.length} entries from ${file.name}`);
          allPlData = allPlData.concat(plData);
        } catch (error) {
          console.error(`✗ Error reading ${file.name}:`, error);
          errors.push(`${file.name}: ${error.message}`);
        }
        
        filesProcessed++;
        
        // When all files are processed, match and update bets
        if (filesProcessed === files.length) {
          if (errors.length > 0) {
            alert(`Warning: ${errors.length} file(s) had errors:\n\n${errors.join('\n')}\n\nProcessing remaining files...`);
          }
          
          if (allPlData.length === 0) {
            alert('No valid data found in any CSV files.');
            return;
          }
          
          console.log(`\n=== COMBINED: ${allPlData.length} TOTAL ENTRIES FROM ${files.length} FILES ===`);
          processImportedData(allPlData, files.length);
        }
      };
      reader.onerror = () => {
        errors.push(`${file.name}: Failed to read file`);
        filesProcessed++;
        
        if (filesProcessed === files.length) {
          if (errors.length === files.length) {
            alert('Error: Could not read any of the selected files.');
          } else {
            processImportedData(allPlData, files.length);
          }
        }
      };
      reader.readAsText(file);
    });
  }

  function importBetfairPL(csvText, fileName = 'CSV') {
    console.log(`=== IMPORTING BETFAIR P/L: ${fileName} ===`);
    
    try {
      const plData = parseBetfairCSV(csvText);
      console.log('Parsed', plData.length, 'P/L entries from CSV');
      
      if (plData.length === 0) {
        alert('No valid data found in CSV file.');
        return;
      }
      
      processImportedData(plData, 1);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV: ' + error.message);
    }
  }

  function processImportedData(plData, fileCount) {
    // Show what was parsed
    console.log('\n=== CSV ENTRIES ===');
    plData.forEach((entry, idx) => {
      console.log(`${idx + 1}. ${entry.sport} | ${entry.event} | ${entry.market} | P/L: ${entry.pl}`);
    });
    
    // Load all bets from storage
    api.storage.local.get({ bets: [] }, (res) => {
      const bets = res.bets || [];
      console.log(`\n=== CHECKING ${bets.length} BETS ===`);
      
      const pendingBetfairBets = bets.filter(b => 
        b.bookmaker && b.bookmaker.toLowerCase().includes('betfair') && 
        (!b.status || b.status === 'pending')
      );
      
      console.log(`Found ${pendingBetfairBets.length} pending Betfair bets:`);
      pendingBetfairBets.forEach((bet, idx) => {
        console.log(`${idx + 1}. ${bet.sport} | ${bet.event} | ${bet.market}`);
      });
      
      let matchedCount = 0;
      let updatedBets = 0;
      const matchDetails = [];
      
      // Try to match each bet with P/L data
      bets.forEach(bet => {
        const matchedPL = matchBetWithPL(bet, plData, pendingBetfairBets);
        if (matchedPL) {
          matchedCount++;
          
          // Determine status based on P/L
          let newStatus;
          if (matchedPL.pl > 0) {
            newStatus = 'won';
          } else if (matchedPL.pl < 0) {
            newStatus = 'lost';
          } else {
            newStatus = 'void';
          }
          
          // Only update if status changed
          if (!bet.status || bet.status === 'pending') {
            bet.status = newStatus;
            bet.settledAt = new Date().toISOString();
            bet.importedPL = matchedPL.pl;
            updatedBets++;
            const detail = `${bet.event} - ${bet.market} -> ${newStatus} (P/L: ${matchedPL.pl})`;
            console.log(`✓ Matched bet: ${detail}`);
            matchDetails.push(detail);
          }
        }
      });
      
      console.log(`\n=== RESULTS ===`);
      console.log(`CSV entries: ${plData.length}`);
      console.log(`Pending Betfair bets: ${pendingBetfairBets.length}`);
      console.log(`Matched: ${matchedCount}`);
      console.log(`Updated: ${updatedBets}`);
      
      // Save updated bets
      if (updatedBets > 0) {
        api.storage.local.set({ bets }, () => {
          const fileText = fileCount > 1 ? `${fileCount} CSV files` : 'CSV';
          const details = matchDetails.length > 0 && matchDetails.length <= 10 ? '\n\nMatched bets:\n' + matchDetails.join('\n') : '';
          alert(`Successfully imported Betfair P/L from ${fileText}!\n\nCSV entries: ${plData.length}\nPending Betfair bets checked: ${pendingBetfairBets.length}\nMatched: ${matchedCount}\nUpdated: ${updatedBets}${details}\n\nCheck console (F12) for detailed logs.`);
          loadAndRender();
        });
      } else {
        const fileText = fileCount > 1 ? `${fileCount} CSV files` : 'CSV';
        let message = `Import complete from ${fileText}.\n\nCSV entries: ${plData.length}\nPending Betfair bets: ${pendingBetfairBets.length}\nMatched: ${matchedCount}\nUpdated: 0`;
        
        if (matchedCount > 0) {
          message += '\n\nAll matched bets were already settled.';
        } else if (pendingBetfairBets.length === 0) {
          message += '\n\nNo pending Betfair bets found in your log.';
        } else {
          message += '\n\nNo matches found. The events/markets in your CSV don\'t match your logged bets.';
        }
        
        message += '\n\nCheck the browser console (F12) for detailed matching logs.';
        alert(message);
      }
    });
  }

  function showChart(bets) {
    const canvas = document.getElementById('plChart');
    const ctx = canvas.getContext('2d');
    
    // Sort bets by timestamp
    const sortedBets = bets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Calculate cumulative data
    let cumulativePL = 0;
    let cumulativeEV = 0;
    const dataPoints = [];
    
    sortedBets.forEach((b, idx) => {
      // Calculate EV from overvalue
      let ev = 0;
      if (b.stake && b.overvalue) {
        // EV is simply the overvalue percentage applied to the stake
        ev = (parseFloat(b.overvalue) / 100) * parseFloat(b.stake);
      }
      cumulativeEV += ev;
      
      // Calculate actual P/L for settled bets with commission
      if (b.status === 'won' && b.stake && b.odds) {
        const commission = getCommission(b.bookmaker);
        const grossProfit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
        const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
        const netProfit = grossProfit - commissionAmount;
        cumulativePL += netProfit;
      } else if (b.status === 'lost' && b.stake) {
        cumulativePL -= parseFloat(b.stake);
      }
      // void bets don't change P/L
      
      dataPoints.push({
        index: idx + 1,
        pl: cumulativePL,
        ev: cumulativeEV,
        settled: b.status && b.status !== 'pending'
      });
    });
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Setup dimensions with more padding for labels
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 40;
    const paddingBottom = 50;
    const chartWidth = canvas.width - paddingLeft - paddingRight;
    const chartHeight = canvas.height - paddingTop - paddingBottom;
    
    // Find min/max values
    const allValues = [...dataPoints.map(d => d.pl), ...dataPoints.map(d => d.ev)];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const valueRange = maxValue - minValue || 1;
    
    // Add 10% padding to the value range for better visualization
    const valuePadding = valueRange * 0.1;
    const displayMax = maxValue + valuePadding;
    const displayMin = minValue - valuePadding;
    const displayRange = displayMax - displayMin;
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
    ctx.stroke();
    
    // Draw zero line
    const zeroY = canvas.height - paddingBottom - ((0 - displayMin) / displayRange * chartHeight);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY);
    ctx.lineTo(canvas.width - paddingRight, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw horizontal grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = paddingTop + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(canvas.width - paddingRight, y);
      ctx.stroke();
    }
    
    // Helper function to convert data to canvas coordinates
    function getX(index) {
      return paddingLeft + (index / dataPoints.length) * chartWidth;
    }
    
    function getY(value) {
      return canvas.height - paddingBottom - ((value - displayMin) / displayRange * chartHeight);
    }
    
    // Draw EV line (blue)
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((point, idx) => {
      const x = getX(idx);
      const y = getY(point.ev);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw P/L line (green/red)
    ctx.strokeStyle = cumulativePL >= 0 ? '#28a745' : '#dc3545';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let hasSettled = false;
    dataPoints.forEach((point, idx) => {
      if (point.settled) {
        const x = getX(idx);
        const y = getY(point.pl);
        if (!hasSettled) {
          ctx.moveTo(x, y);
          hasSettled = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
    
    // Draw X-axis label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Number of Bets', canvas.width / 2, canvas.height - 10);
    
    // Draw Y-axis label
    ctx.save();
    ctx.translate(12, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Profit / Loss', 0, 0);
    ctx.restore();
    
    // Draw Y-axis value labels
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#555';
    const yLabels = 5;
    for (let i = 0; i <= yLabels; i++) {
      const value = displayMin + (displayRange / yLabels) * i;
      const y = canvas.height - paddingBottom - (i / yLabels) * chartHeight;
      ctx.fillText(value.toFixed(1), paddingLeft - 8, y + 4);
    }
    
    // Draw X-axis value labels (show every nth bet)
    ctx.textAlign = 'center';
    const xLabelInterval = Math.max(1, Math.floor(dataPoints.length / 10));
    for (let i = 0; i < dataPoints.length; i += xLabelInterval) {
      const x = getX(i);
      ctx.fillText((i + 1).toString(), x, canvas.height - paddingBottom + 20);
    }
    // Always show the last bet number
    if (dataPoints.length > 0) {
      const lastX = getX(dataPoints.length - 1);
      ctx.fillText(dataPoints.length.toString(), lastX, canvas.height - paddingBottom + 20);
    }
    
    // Draw legend in top-left corner
    const legendX = paddingLeft + 10;
    const legendY = paddingTop + 10;
    const settledCount = dataPoints.filter(d => d.settled).length;
    
    // Legend background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(legendX - 5, legendY - 5, 180, 78);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 5, legendY - 5, 180, 78);
    
    // Expected EV line
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 8);
    ctx.lineTo(legendX + 30, legendY + 8);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.font = '11px Arial';
    ctx.fillText('Expected EV', legendX + 35, legendY + 12);
    
    // EV value
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#007bff';
    ctx.fillText(`${cumulativeEV >= 0 ? '+' : ''}${cumulativeEV.toFixed(2)}`, legendX + 35, legendY + 26);
    
    // Actual P/L line
    ctx.strokeStyle = cumulativePL >= 0 ? '#28a745' : '#dc3545';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 42);
    ctx.lineTo(legendX + 30, legendY + 42);
    ctx.stroke();
    ctx.font = '11px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('Actual P/L', legendX + 35, legendY + 46);
    
    // P/L value
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = cumulativePL >= 0 ? '#28a745' : '#dc3545';
    ctx.fillText(`${cumulativePL >= 0 ? '+' : ''}${cumulativePL.toFixed(2)} (${settledCount} settled)`, legendX + 35, legendY + 60);
    
    // Show modal
    document.getElementById('chart-modal').classList.add('active');
  }

  // Load commission rates first, then render
  loadCommissionRates(() => {
    loadAndRender();
  });
});
