// Popup UI — lists bets and triggers export/clear actions.
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('bets');
  const btnJson = document.getElementById('export-json');
  const btnCsv = document.getElementById('export-csv');
  const btnClear = document.getElementById('clear-all');
  const btnChart = document.getElementById('view-chart');
  const btnCloseChart = document.getElementById('close-chart');
  const chartModal = document.getElementById('chart-modal');

  function render(bets, sortBy = 'saved-desc') {
    if (!bets || bets.length === 0) {
      container.innerHTML = '<div class="small">No bets saved yet. Visit surebet.com/valuebets and click "💾 Save" on any bet row.</div>';
      return;
    }
    
    // Sort bets
    let sortedBets = bets.slice();
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
      const ts = new Date(b.timestamp).toLocaleString();
      const potential = b.stake && b.odds ? (b.stake * b.odds).toFixed(2) : '-';
      const profit = b.stake && b.odds ? ((b.stake * b.odds) - b.stake).toFixed(2) : '-';
      
      // Calculate expected value (EV) based on probability and odds
      let expectedValue = 0;
      if (b.stake && b.odds && b.probability) {
        const winProb = parseFloat(b.probability) / 100;
        const winAmount = parseFloat(b.stake) * parseFloat(b.odds);
        const loseProb = 1 - winProb;
        const loseAmount = parseFloat(b.stake);
        expectedValue = (winProb * winAmount) - (loseProb * loseAmount);
      }
      
      // Add to total EV for all bets
      totalEV += expectedValue;
      
      // Calculate actual profit/loss based on status
      let actualPL = 0;
      if (b.stake && b.odds) {
        if (b.status === 'won') {
          actualPL = parseFloat(profit);
        } else if (b.status === 'lost') {
          actualPL = -parseFloat(b.stake);
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
      let plDisplay = profit;
      
      if (b.status === 'won') {
        statusBadge = '✓ WON';
        statusColor = '#28a745';
        plDisplay = `+${profit}`;
      } else if (b.status === 'lost') {
        statusBadge = '✗ LOST';
        statusColor = '#dc3545';
        plDisplay = `-${b.stake || 0}`;
      } else if (b.status === 'void') {
        statusBadge = '○ VOID';
        statusColor = '#6c757d';
        plDisplay = '0.00';
      } else {
        statusBadge = '⋯ PENDING';
        statusColor = '#ffc107';
      }
      
      const betId = b.id || b.timestamp;
      
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
      
      return `<tr data-bet-id="${betId}" style="${eventPassed && b.status === 'pending' ? 'background:#fff3cd' : ''}">
        <td style="width:110px">
          <div class="small">${ts}</div>
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
            <span class="badge" style="background:#007bff;color:#fff;font-size:10px;padding:2px 6px;margin-right:4px">Odds: ${b.odds}</span>
            <span class="badge" style="background:#6c757d;color:#fff;font-size:10px;padding:2px 6px;margin-right:4px">Prob: ${b.probability}%</span>
            <span class="badge" style="background:#ffc107;color:#000;font-size:10px;padding:2px 6px">Value: +${b.overvalue}%</span>
          </div>
          <div style="margin-top:4px;font-size:12px">
            <strong>Stake:</strong> ${b.stake || '-'} | 
            <strong>Potential:</strong> ${potential} | 
            <strong>P/L:</strong> <span style="color:${b.status === 'won' ? '#28a745' : b.status === 'lost' ? '#dc3545' : '#666'}">${plDisplay}</span> | 
            <strong>EV:</strong> <span style="color:#007bff">${expectedValue > 0 ? '+' : ''}${expectedValue.toFixed(2)}</span>
          </div>
          ${b.note ? `<div class="note" style="margin-top:4px"><em>${escapeHtml(b.note)}</em></div>` : ''}
          ${b.status !== 'won' && b.status !== 'lost' && b.status !== 'void' ? `
          <div style="margin-top:6px;display:flex;gap:4px">
            <button class="status-btn" data-bet-id="${betId}" data-status="won" style="font-size:10px;padding:3px 8px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer">✓ Won</button>
            <button class="status-btn" data-bet-id="${betId}" data-status="lost" style="font-size:10px;padding:3px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer">✗ Lost</button>
            <button class="status-btn" data-bet-id="${betId}" data-status="void" style="font-size:10px;padding:3px 8px;background:#6c757d;color:#fff;border:none;border-radius:3px;cursor:pointer">○ Void</button>
          </div>` : ''}
        </td>
      </tr>`;
    }).join('');
    
    const roi = totalStaked > 0 ? ((runningProfit / totalStaked) * 100).toFixed(2) : '0.00';
    const roiColor = runningProfit >= 0 ? '#28a745' : '#dc3545';
    const evDiff = runningProfit - expectedProfitSettled;
    const evDiffColor = evDiff >= 0 ? '#28a745' : '#dc3545';
    const totalEvColor = totalEV >= 0 ? '#007bff' : '#dc3545';
    
    const summary = `
      <div style="background:#f8f9fa;padding:8px;margin-bottom:8px;border-radius:4px;font-size:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div>
            <strong>Total Staked:</strong> ${totalStaked.toFixed(2)} | 
            <strong>Settled:</strong> ${settledBets}/${bets.length} | 
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
    
    // Add event listeners for status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const betId = btn.dataset.betId;
        const status = btn.dataset.status;
        updateBetStatus(betId, status);
      });
    });
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updateBetStatus(betId, status) {
    chrome.storage.local.get({ bets: [] }, (res) => {
      const bets = res.bets || [];
      const bet = bets.find(b => (b.id || b.timestamp) === betId);
      if (bet) {
        bet.status = status;
        bet.settledAt = new Date().toISOString();
        chrome.storage.local.set({ bets }, () => {
          loadAndRender();
        });
      }
    });
  }
  
  function loadAndRender() {
    const sortBy = document.getElementById('sort-select')?.value || 'saved-desc';
    chrome.storage.local.get({ bets: [] }, (res) => {
      render(res.bets || [], sortBy);
    });
  }
  
  // Sort select handler
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', loadAndRender);
  }

  btnJson.addEventListener('click', async () => {
    chrome.storage.local.get({ bets: [] }, (res) => {
      const data = res.bets || [];
      const dataStr = JSON.stringify(data, null, 2);
      const filename = `sb-bets-${(new Date()).toISOString().replace(/[:.]/g, '-')}.json`;
      chrome.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'application/json' }, (resp) => {
        // Optional feedback
      });
    });
  });

  btnCsv.addEventListener('click', async () => {
    chrome.storage.local.get({ bets: [] }, (res) => {
      const data = res.bets || [];
      if (data.length === 0) {
        alert('No bets to export.');
        return;
      }
      // Build CSV header
      const rows = [];
      rows.push(['timestamp', 'bookmaker', 'sport', 'event', 'tournament', 'market', 'odds', 'probability', 'overvalue', 'stake', 'potential_return', 'profit', 'expected_value', 'status', 'settled_at', 'actual_pl', 'note', 'url'].join(','));
      for (const b of data) {
        const esc = (v) => `\"${('' + (v ?? '')).replace(/\"/g, '\"\"')}\"`;
        const potential = b.stake && b.odds ? (b.stake * b.odds).toFixed(2) : '';
        const profit = b.stake && b.odds ? ((b.stake * b.odds) - b.stake).toFixed(2) : '';
        
        // Calculate expected value
        let expectedValue = '';
        if (b.stake && b.odds && b.probability) {
          const winProb = parseFloat(b.probability) / 100;
          const winAmount = parseFloat(b.stake) * parseFloat(b.odds);
          const loseProb = 1 - winProb;
          const loseAmount = parseFloat(b.stake);
          expectedValue = ((winProb * winAmount) - (loseProb * loseAmount)).toFixed(2);
        }
        
        // Calculate actual P/L
        let actualPL = '';
        if (b.stake && b.odds) {
          if (b.status === 'won') {
            actualPL = profit;
          } else if (b.status === 'lost') {
            actualPL = '-' + b.stake;
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
          esc(b.odds),
          esc(b.probability),
          esc(b.overvalue),
          esc(b.stake),
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
      chrome.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'text/csv' }, (resp) => {});
    });
  });

  btnClear.addEventListener('click', () => {
    if (!confirm('Clear all saved bets? This cannot be undone.')) return;
    chrome.runtime.sendMessage({ action: 'clearBets' }, (resp) => {
      if (resp && resp.success) loadAndRender();
      else alert('Clear failed.');
    });
  });

  if (btnChart) {
    btnChart.addEventListener('click', () => {
      chrome.storage.local.get({ bets: [] }, (res) => {
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
      // Calculate EV
      let ev = 0;
      if (b.stake && b.odds && b.probability) {
        const winProb = parseFloat(b.probability) / 100;
        const winAmount = parseFloat(b.stake) * parseFloat(b.odds);
        const loseProb = 1 - winProb;
        const loseAmount = parseFloat(b.stake);
        ev = (winProb * winAmount) - (loseProb * loseAmount);
      }
      cumulativeEV += ev;
      
      // Calculate actual P/L for settled bets
      if (b.status === 'won' && b.stake && b.odds) {
        const profit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
        cumulativePL += profit;
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

  loadAndRender();
});
