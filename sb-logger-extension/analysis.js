// Analysis Page — Chart and Liquidity Analysis Dashboard
console.log('📊 Surebet Helper Analysis Script Loading...');

const api = typeof chrome !== 'undefined' ? chrome : browser;

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

let commissionRates = { ...DEFAULT_COMMISSION_RATES };

function loadCommissionRates(callback) {
  api.storage.local.get({ commission: DEFAULT_COMMISSION_RATES }, (res) => {
    commissionRates = { ...res.commission };
    console.log('💰 Commission rates loaded:', commissionRates);
    if (callback) callback();
  });
}

function getCommission(bookmaker) {
  if (!bookmaker) return 0;
  const bookie = bookmaker.toLowerCase();
  if (bookie.includes('betfair')) return commissionRates.betfair || 0;
  if (bookie.includes('betdaq')) return commissionRates.betdaq || 0;
  if (bookie.includes('matchbook')) return commissionRates.matchbook || 0;
  if (bookie.includes('smarkets')) return commissionRates.smarkets || 0;
  return 0;
}

function calculateExpectedValueAmount(bet) {
  if (!bet) return 0;

  const stake = parseFloat(bet.stake);
  const odds = parseFloat(bet.odds);
  const probability = parseFloat(bet.probability);
  const overvalue = parseFloat(bet.overvalue);
  const storedEV = parseFloat(bet.expectedValue);

  if (!isFinite(stake) || stake <= 0) {
    return 0;
  }

  if (isFinite(storedEV) && storedEV !== 0) {
    return storedEV;
  }

  const commission = getCommission(bet.bookmaker);
  const normalizeProbability = (value) => {
    if (!isFinite(value)) return null;
    return Math.min(Math.max(value / 100, 0), 1);
  };

  const winProbability = normalizeProbability(probability);

  const legacyEv = () => {
    if (!isFinite(overvalue)) return 0;
    const ev = (overvalue / 100) * stake;
    return bet.isLay ? -ev : ev;
  };

  if (!isFinite(odds) || odds <= 1 || winProbability === null) {
    return legacyEv();
  }

  if (bet.isLay) {
    const layOdds = parseFloat(bet.originalLayOdds) || odds;
    if (!isFinite(layOdds) || layOdds <= 1) {
      return legacyEv();
    }

    const liability = stake * (layOdds - 1);
    const grossWin = stake;
    const commissionAmount = commission > 0 ? (grossWin * commission / 100) : 0;
    const netWin = grossWin - commissionAmount;
    const selectionWins = winProbability;
    const selectionLoses = 1 - winProbability;

    return (selectionLoses * netWin) - (selectionWins * liability);
  }

  const grossProfit = stake * (odds - 1);
  const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
  const netProfit = grossProfit - commissionAmount;
  const loseProbability = 1 - winProbability;

  return (winProbability * netProfit) - (loseProbability * stake);
}

function getLimitTier(limit) {
  if (!isFinite(limit)) return null;
  if (limit < 50) return 'Low';
  if (limit < 100) return 'Medium';
  if (limit < 200) return 'High';
  return 'VeryHigh';
}

function calculateLiquidityStats(bets) {
  console.log('📊 Calculating liquidity stats for', bets.length, 'bets');
  
  const settledBets = bets.filter(b => b.status && b.status !== 'pending');
  console.log('  Settled bets:', settledBets.length);
  
  const tiers = {
    'Low': { limit: [0, 50], bets: [], winCount: 0, totalPL: 0, totalStake: 0, totalOvervalue: 0 },
    'Medium': { limit: [50, 100], bets: [], winCount: 0, totalPL: 0, totalStake: 0, totalOvervalue: 0 },
    'High': { limit: [100, 200], bets: [], winCount: 0, totalPL: 0, totalStake: 0, totalOvervalue: 0 },
    'VeryHigh': { limit: [200, Infinity], bets: [], winCount: 0, totalPL: 0, totalStake: 0, totalOvervalue: 0 }
  };

  settledBets.forEach(bet => {
    const limit = parseFloat(bet.limit) || 0;
    const tier = getLimitTier(limit);
    
    if (tier && tiers[tier]) {
      tiers[tier].bets.push(bet);
      
      if (bet.status === 'won') {
        tiers[tier].winCount++;
      }
      
      let actualPL = 0;
      if (bet.status === 'won') {
        const commission = getCommission(bet.bookmaker);
        if (bet.isLay) {
          const gross = parseFloat(bet.stake) || 0;
          const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
          actualPL = gross - commissionAmount;
        } else {
          const grossProfit = (parseFloat(bet.stake) * parseFloat(bet.odds)) - parseFloat(bet.stake);
          const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
          actualPL = grossProfit - commissionAmount;
        }
      } else if (bet.status === 'lost') {
        if (bet.isLay) {
          actualPL = -(parseFloat(bet.stake) * (parseFloat(bet.odds) - 1));
        } else {
          actualPL = -parseFloat(bet.stake);
        }
      }
      
      tiers[tier].totalPL += actualPL;
      tiers[tier].totalStake += parseFloat(bet.stake) || 0;
      tiers[tier].totalOvervalue += parseFloat(bet.overvalue) || 0;
    }
  });

  const stats = {};
  Object.entries(tiers).forEach(([tierName, tierData]) => {
    const count = tierData.bets.length;
    const winRate = count > 0 ? (tierData.winCount / count * 100) : 0;
    const roi = tierData.totalStake > 0 ? (tierData.totalPL / tierData.totalStake * 100) : 0;
    const avgOvervalue = count > 0 ? tierData.totalOvervalue / count : 0;
    const significance = count >= 20 ? '✓' : count >= 10 ? '⚠️' : '❌';
    
    stats[tierName] = {
      count,
      winCount: tierData.winCount,
      winRate: winRate.toFixed(2),
      totalPL: tierData.totalPL.toFixed(2),
      avgPL: count > 0 ? (tierData.totalPL / count).toFixed(2) : '0.00',
      roi: roi.toFixed(2),
      avgOvervalue: avgOvervalue.toFixed(2),
      significance,
      significanceText: count >= 20 ? 'High' : count >= 10 ? 'Medium' : 'Low'
    };
  });

  console.log('  Tier stats:', stats);
  return stats;
}

function calculateBookmakerStats(bets) {
  console.log('📊 Calculating bookmaker stats');
  
  const settledBets = bets.filter(b => b.status && b.status !== 'pending');
  
  const bookmakersMap = {};
  
  settledBets.forEach(bet => {
    const bookie = bet.bookmaker || 'Unknown';
    if (!bookmakersMap[bookie]) {
      bookmakersMap[bookie] = {
        limits: [],
        winCount: 0,
        settledCount: 0,
        totalPL: 0,
        totalStake: 0
      };
    }
    
    const limit = parseFloat(bet.limit) || 0;
    if (limit > 0) {
      bookmakersMap[bookie].limits.push(limit);
    }
    
    if (bet.status === 'won') {
      bookmakersMap[bookie].winCount++;
    }
    bookmakersMap[bookie].settledCount++;
    
    let actualPL = 0;
    if (bet.status === 'won') {
      const commission = getCommission(bet.bookmaker);
      if (bet.isLay) {
        const gross = parseFloat(bet.stake) || 0;
        const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
        actualPL = gross - commissionAmount;
      } else {
        const grossProfit = (parseFloat(bet.stake) * parseFloat(bet.odds)) - parseFloat(bet.stake);
        const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
        actualPL = grossProfit - commissionAmount;
      }
    } else if (bet.status === 'lost') {
      if (bet.isLay) {
        actualPL = -(parseFloat(bet.stake) * (parseFloat(bet.odds) - 1));
      } else {
        actualPL = -parseFloat(bet.stake);
      }
    }
    
    bookmakersMap[bookie].totalPL += actualPL;
    bookmakersMap[bookie].totalStake += parseFloat(bet.stake) || 0;
  });

  const bookmakerStats = Object.entries(bookmakersMap).map(([name, data]) => {
    const avgLimit = data.limits.length > 0 
      ? (data.limits.reduce((a, b) => a + b, 0) / data.limits.length).toFixed(2)
      : '0.00';
    const winRate = data.settledCount > 0 
      ? (data.winCount / data.settledCount * 100).toFixed(2)
      : '0.00';
    const roi = data.totalStake > 0
      ? (data.totalPL / data.totalStake * 100).toFixed(2)
      : '0.00';
    
    return {
      name,
      avgLimit: parseFloat(avgLimit),
      winRate: parseFloat(winRate),
      roi: parseFloat(roi),
      totalBets: data.settledCount,
      totalPL: data.totalPL.toFixed(2),
      isHighPerformer: parseFloat(avgLimit) > 100 && parseFloat(winRate) > 50
    };
  }).sort((a, b) => b.roi - a.roi);

  console.log('  Bookmaker stats:', bookmakerStats);
  return bookmakerStats;
}

function calculateTemporalStats(bets) {
  console.log('📊 Calculating temporal stats');
  
  const settledBets = bets.filter(b => b.status && b.status !== 'pending' && b.eventTime && b.timestamp);
  
  const periods = {
    'More than 48h': { bets: [], winCount: 0, totalPL: 0, totalLimit: 0 },
    '24-48 hours': { bets: [], winCount: 0, totalPL: 0, totalLimit: 0 },
    '12-24 hours': { bets: [], winCount: 0, totalPL: 0, totalLimit: 0 },
    'Less than 12h': { bets: [], winCount: 0, totalPL: 0, totalLimit: 0 }
  };

  settledBets.forEach(bet => {
    const eventTime = new Date(bet.eventTime);
    const timestamp = new Date(bet.timestamp);
    const hoursToEvent = (eventTime - timestamp) / (1000 * 60 * 60);
    
    let period;
    if (hoursToEvent > 48) period = 'More than 48h';
    else if (hoursToEvent > 24) period = '24-48 hours';
    else if (hoursToEvent > 12) period = '12-24 hours';
    else period = 'Less than 12h';
    
    periods[period].bets.push(bet);
    
    if (bet.status === 'won') {
      periods[period].winCount++;
    }
    
    let actualPL = 0;
    if (bet.status === 'won') {
      const commission = getCommission(bet.bookmaker);
      if (bet.isLay) {
        const gross = parseFloat(bet.stake) || 0;
        const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
        actualPL = gross - commissionAmount;
      } else {
        const grossProfit = (parseFloat(bet.stake) * parseFloat(bet.odds)) - parseFloat(bet.stake);
        const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
        actualPL = grossProfit - commissionAmount;
      }
    } else if (bet.status === 'lost') {
      if (bet.isLay) {
        actualPL = -(parseFloat(bet.stake) * (parseFloat(bet.odds) - 1));
      } else {
        actualPL = -parseFloat(bet.stake);
      }
    }
    
    periods[period].totalPL += actualPL;
    periods[period].totalLimit += parseFloat(bet.limit) || 0;
  });

  const temporalStats = {};
  Object.entries(periods).forEach(([periodName, periodData]) => {
    const count = periodData.bets.length;
    const winRate = count > 0 ? (periodData.winCount / count * 100) : 0;
    const avgLimit = count > 0 ? (periodData.totalLimit / count).toFixed(2) : '0.00';
    
    temporalStats[periodName] = {
      count,
      winCount: periodData.winCount,
      winRate: winRate.toFixed(2),
      avgLimit: avgLimit,
      totalPL: periodData.totalPL.toFixed(2)
    };
  });

  console.log('  Temporal stats:', temporalStats);
  return temporalStats;
}

function calculateKellyStake(betData, stakingSettings = DEFAULT_STAKING_SETTINGS) {
  if (!betData) return 0;

  let odds = parseFloat(betData.odds);
  const probabilityPercent = parseFloat(betData.probability);

  if (!isFinite(odds) || odds <= 1 || !isFinite(probabilityPercent)) {
    return 0;
  }

  const p = probabilityPercent / 100;
  if (p <= 0 || p >= 1) return 0;

  const b = odds - 1;
  const q = 1 - p;
  if (b <= 0) return 0;

  let kellyPortion = ((b * p) - q) / b;
  if (!isFinite(kellyPortion)) return 0;

  kellyPortion = Math.max(0, kellyPortion);
  const userFraction = Math.max(0, Math.min(1, stakingSettings.fraction || DEFAULT_STAKING_SETTINGS.fraction));
  const bankroll = Math.max(0, stakingSettings.bankroll || DEFAULT_STAKING_SETTINGS.bankroll);

  let stake = bankroll * kellyPortion * userFraction;
  if (betData.limit && betData.limit > 0) {
    stake = Math.min(stake, betData.limit);
  }

  return Math.max(0, Math.round(stake * 100) / 100);
}

function calculateKellyFillRatios(bets, stakingSettings = DEFAULT_STAKING_SETTINGS) {
  console.log('📊 Calculating Kelly fill ratios');

  const kellyMetrics = bets.map(bet => {
    const recommendedKelly = calculateKellyStake(bet, stakingSettings);
    const actualStake = parseFloat(bet.stake) || 0;
    const limit = parseFloat(bet.limit) || 0;
    
    let fillRatio = 0;
    let exceededKelly = false;
    
    if (recommendedKelly > 0) {
      fillRatio = (actualStake / recommendedKelly) * 100;
      exceededKelly = actualStake > limit && limit > 0;
    }

    return {
      uid: bet.uid,
      recommendedKelly: recommendedKelly.toFixed(2),
      actualStake: actualStake.toFixed(2),
      limit: limit.toFixed(2),
      fillRatio: fillRatio.toFixed(2),
      exceededKelly,
      hasWarning: fillRatio < 100 || exceededKelly
    };
  });

  const settledWithKelly = kellyMetrics.filter(m => m.recommendedKelly > 0 && bets.find(b => b.uid === m.uid && b.status && b.status !== 'pending'));
  const exceedingKelly = kellyMetrics.filter(m => m.exceededKelly).length;
  const fillRatioAvg = kellyMetrics.length > 0 
    ? (kellyMetrics.reduce((sum, m) => sum + parseFloat(m.fillRatio), 0) / kellyMetrics.length).toFixed(2)
    : '0.00';

  const summary = {
    totalBets: bets.length,
    settledBets: settledWithKelly.length,
    exceedingKelly,
    exceedingKellyPercent: bets.length > 0 ? ((exceedingKelly / bets.length) * 100).toFixed(2) : '0.00',
    avgFillRatio: fillRatioAvg,
    perBetMetrics: kellyMetrics
  };

  console.log('  Kelly fill summary:', summary);
  return summary;
}

// Chart rendering function
function showChart(bets) {
  const canvas = document.getElementById('plChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const sortedBets = bets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let cumulativePL = 0;
  let cumulativeEV = 0;
  const dataPoints = [];

  sortedBets.forEach((b, idx) => {
    const ev = calculateExpectedValueAmount(b);
    cumulativeEV += ev;

    if (b.status === 'won' && b.stake && b.odds) {
      const commission = getCommission(b.bookmaker);
      const grossProfit = (parseFloat(b.stake) * parseFloat(b.odds)) - parseFloat(b.stake);
      const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
      const netProfit = grossProfit - commissionAmount;
      cumulativePL += netProfit;
    } else if (b.status === 'lost' && b.stake) {
      cumulativePL -= parseFloat(b.stake);
    }

    dataPoints.push({
      index: idx + 1,
      pl: cumulativePL,
      ev: cumulativeEV,
      settled: b.status && b.status !== 'pending'
    });
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 50;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const allValues = [...dataPoints.map(d => d.pl), ...dataPoints.map(d => d.ev)];
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  const valueRange = maxValue - minValue || 1;

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

  // Draw labels
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Number of Bets', canvas.width / 2, canvas.height - 10);

  ctx.save();
  ctx.translate(12, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Profit / Loss', 0, 0);
  ctx.restore();

  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#555';
  const yLabels = 5;
  for (let i = 0; i <= yLabels; i++) {
    const value = displayMin + (displayRange / yLabels) * i;
    const y = canvas.height - paddingBottom - (i / yLabels) * chartHeight;
    ctx.fillText(value.toFixed(1), paddingLeft - 8, y + 4);
  }

  ctx.textAlign = 'center';
  const xLabelInterval = Math.max(1, Math.floor(dataPoints.length / 10));
  for (let i = 0; i < dataPoints.length; i += xLabelInterval) {
    const x = getX(i);
    ctx.fillText((i + 1).toString(), x, canvas.height - paddingBottom + 20);
  }
  if (dataPoints.length > 0) {
    const lastX = getX(dataPoints.length - 1);
    ctx.fillText(dataPoints.length.toString(), lastX, canvas.height - paddingBottom + 20);
  }

  // Draw legend
  const legendX = paddingLeft + 10;
  const legendY = paddingTop + 10;
  const settledCount = dataPoints.filter(d => d.settled).length;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(legendX - 5, legendY - 5, 180, 78);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 5, legendY - 5, 180, 78);

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

  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = '#007bff';
  ctx.fillText(`${cumulativeEV >= 0 ? '+' : ''}${cumulativeEV.toFixed(2)}`, legendX + 35, legendY + 26);

  ctx.strokeStyle = cumulativePL >= 0 ? '#28a745' : '#dc3545';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY + 42);
  ctx.lineTo(legendX + 30, legendY + 42);
  ctx.stroke();
  ctx.font = '11px Arial';
  ctx.fillStyle = '#333';
  ctx.fillText('Actual P/L', legendX + 35, legendY + 46);

  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = cumulativePL >= 0 ? '#28a745' : '#dc3545';
  ctx.fillText(`${cumulativePL >= 0 ? '+' : ''}${cumulativePL.toFixed(2)} (${settledCount} settled)`, legendX + 35, legendY + 60);
}

// Page initialization and navigation
document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 Analysis page loaded');

  // Get current hash or default to chart
  const currentHash = window.location.hash.slice(1) || 'chart';
  console.log('📊 Current view:', currentHash);

  // Set up navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      window.location.hash = view;
      showView(view);
    });
  });

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || 'chart';
    showView(hash);
  });

  // Load data and show initial view
  loadCommissionRates(() => {
    api.storage.local.get({ bets: [], stakingSettings: DEFAULT_STAKING_SETTINGS }, (res) => {
      const bets = res.bets || [];
      const stakingSettings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;

      if (bets.length === 0) {
        document.querySelector('.container').innerHTML = '<div style="padding: 40px; text-align: center; color: #666;"><p style="font-size: 18px;">No bets saved yet.</p><p>Visit <strong>surebet.com/valuebets</strong> and click "💾 Save" on any bet row to get started.</p></div>';
        return;
      }

      // Render all analysis data
      renderAllAnalysis(bets, stakingSettings);

      // Show initial view
      showView(currentHash);
    });
  });

  function renderAllAnalysis(bets, stakingSettings) {
    // Render chart
    showChart(bets);

    // Render liquidity tiers
    const tierStats = calculateLiquidityStats(bets);
    const tierHtml = `
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th style="text-align:center">Limit Range</th>
            <th style="text-align:center">Bets (n)</th>
            <th style="text-align:center">Win Rate</th>
            <th style="text-align:center">ROI %</th>
            <th style="text-align:center">Total P/L</th>
            <th style="text-align:center">Avg P/L</th>
            <th style="text-align:center">Significance</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(tierStats).map(([tier, stats]) => {
            const ranges = { 'Low': '<£50', 'Medium': '£50-100', 'High': '£100-200', 'VeryHigh': '>£200' };
            const roiColor = parseFloat(stats.roi) >= 0 ? '#28a745' : '#dc3545';
            const plColor = parseFloat(stats.totalPL) >= 0 ? '#28a745' : '#dc3545';
            return `
              <tr style="${stats.count < 10 ? 'background:#fff3cd' : ''}">
                <td style="font-weight:600">${tier}</td>
                <td style="text-align:center">${ranges[tier]}</td>
                <td style="text-align:center">${stats.count}</td>
                <td style="text-align:center">${stats.winCount}/${stats.count} (${stats.winRate}%)</td>
                <td style="text-align:center;color:${roiColor};font-weight:600">${stats.roi}%</td>
                <td style="text-align:center;color:${plColor};font-weight:600">£${stats.totalPL}</td>
                <td style="text-align:center">£${stats.avgPL}</td>
                <td style="text-align:center">${stats.significance} ${stats.significanceText}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p class="note">✓ High significance: n≥20 | ⚠️ Medium: 10≤n<20 | ❌ Low: n<10</p>
    `;
    document.getElementById('liquidity-content').innerHTML = tierHtml;

    // Render bookmakers
    const bookmakerStats = calculateBookmakerStats(bets);
    const bookmakerHtml = `
      <table>
        <thead>
          <tr>
            <th>Bookmaker</th>
            <th style="text-align:center">Avg Limit</th>
            <th style="text-align:center">Total Bets</th>
            <th style="text-align:center">Win Rate %</th>
            <th style="text-align:center">ROI %</th>
            <th style="text-align:center">Total P/L</th>
          </tr>
        </thead>
        <tbody>
          ${bookmakerStats.map(bookie => {
            const winRateColor = parseFloat(bookie.winRate) > 50 ? '#28a745' : parseFloat(bookie.winRate) > 40 ? '#ffc107' : '#dc3545';
            const roiColor = parseFloat(bookie.roi) >= 0 ? '#28a745' : '#dc3545';
            const plColor = parseFloat(bookie.totalPL) >= 0 ? '#28a745' : '#dc3545';
            const bgColor = bookie.isHighPerformer ? '#e8f5e9' : '';
            return `
              <tr style="background:${bgColor}">
                <td style="font-weight:600">${bookie.name}${bookie.isHighPerformer ? ' ⭐' : ''}</td>
                <td style="text-align:center">£${bookie.avgLimit.toFixed(2)}</td>
                <td style="text-align:center">${bookie.totalBets}</td>
                <td style="text-align:center;color:${winRateColor};font-weight:600">${bookie.winRate.toFixed(2)}%</td>
                <td style="text-align:center;color:${roiColor};font-weight:600">${bookie.roi.toFixed(2)}%</td>
                <td style="text-align:center;color:${plColor};font-weight:600">£${parseFloat(bookie.totalPL).toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p class="note">⭐ High Performer: Avg limit >£100 AND win rate >50%</p>
    `;
    document.getElementById('bookmakers-content').innerHTML = bookmakerHtml;

    // Render temporal
    const temporalStats = calculateTemporalStats(bets);
    const temporalHtml = `
      <table>
        <thead>
          <tr>
            <th>Time Period</th>
            <th style="text-align:center">Bets (n)</th>
            <th style="text-align:center">Win Rate</th>
            <th style="text-align:center">Avg Limit</th>
            <th style="text-align:center">Total P/L</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(temporalStats).map(([period, stats]) => {
            const plColor = parseFloat(stats.totalPL) >= 0 ? '#28a745' : '#dc3545';
            const winRate = parseFloat(stats.winRate);
            const winRateColor = winRate > 50 ? '#28a745' : winRate > 40 ? '#ffc107' : '#dc3545';
            return `
              <tr>
                <td style="font-weight:600">${period}</td>
                <td style="text-align:center">${stats.count}</td>
                <td style="text-align:center;color:${winRateColor};font-weight:600">${stats.winCount}/${stats.count} (${stats.winRate}%)</td>
                <td style="text-align:center">£${stats.avgLimit}</td>
                <td style="text-align:center;color:${plColor};font-weight:600">£${stats.totalPL}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('temporal-content').innerHTML = temporalHtml;

    // Render kelly
    const kellyStats = calculateKellyFillRatios(bets, stakingSettings);
    const kellyHtml = `
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Bets</div>
          <div class="stat-value">${kellyStats.totalBets}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Settled Bets</div>
          <div class="stat-value positive">${kellyStats.settledBets}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg Fill Ratio</div>
          <div class="stat-value">${kellyStats.avgFillRatio}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Exceeding Limit</div>
          <div class="stat-value negative">${kellyStats.exceedingKelly} (${kellyStats.exceedingKellyPercent}%)</div>
        </div>
      </div>
      <p class="note"><strong>Fill Ratio:</strong> (Actual Stake ÷ Recommended Kelly Stake) × 100%<br><strong>Recommended:</strong> 80-100% for balanced bet sizing<br><strong>Exceeding Limit:</strong> Bets where actual stake exceeds market liquidity (rare but important to track)</p>
    `;
    document.getElementById('kelly-content').innerHTML = kellyHtml;
  }

  function showView(viewName) {
    document.querySelectorAll('.view-container').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeView = document.getElementById(`${viewName}-view`);
    if (activeView) {
      activeView.classList.add('active');
    }

    const activeBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  // Export buttons
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    api.storage.local.get({ bets: [], stakingSettings: DEFAULT_STAKING_SETTINGS }, (res) => {
      const bets = res.bets || [];
      const stakingSettings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
      
      updateCache(bets, stakingSettings);
      
      const tierStats = calculateLiquidityStats(bets);
      const bookmakerStats = calculateBookmakerStats(bets);
      const temporalStats = calculateTemporalStats(bets);
      const kellyStats = calculateKellyFillRatios(bets, stakingSettings);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        bets: bets,
        analysis: {
          liquidityTiers: tierStats,
          bookmakerProfiling: bookmakerStats,
          temporalAnalysis: temporalStats,
          kellyFillRatios: {
            totalBets: kellyStats.totalBets,
            settledBets: kellyStats.settledBets,
            exceedingKelly: kellyStats.exceedingKelly,
            exceedingKellyPercent: kellyStats.exceedingKellyPercent,
            avgFillRatio: kellyStats.avgFillRatio
          }
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const filename = `surebet-analysis-${(new Date()).toISOString().replace(/[:.]/g, '-')}.json`;
      console.log('📤 Exporting JSON with analysis...');
      api.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'application/json' }, (resp) => {
        if (resp && resp.success) {
          alert('✅ Analysis exported as JSON successfully!');
        } else {
          alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
        }
      });
    });
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    api.storage.local.get({ bets: [], stakingSettings: DEFAULT_STAKING_SETTINGS }, (res) => {
      const data = res.bets || [];
      const stakingSettings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
      
      if (data.length === 0) {
        alert('No bets to export.');
        return;
      }
      
      // Build CSV header with new columns
      const rows = [];
      rows.push(['timestamp', 'bookmaker', 'sport', 'event', 'tournament', 'market', 'is_lay', 'odds', 'probability', 'overvalue', 'stake', 'liability', 'commission_rate', 'commission_amount', 'potential_return', 'profit', 'expected_value', 'status', 'settled_at', 'actual_pl', 'note', 'url', 'limit', 'limit_tier', 'recommended_kelly_stake', 'fill_ratio_percent', 'hours_to_event'].join(','));
      
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
        let expectedValueAmount = calculateExpectedValueAmount(b);
        if (expectedValueAmount || expectedValueAmount === 0) {
          expectedValue = expectedValueAmount.toFixed(2);
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

        // Calculate new liquidity metrics
        const limitVal = parseFloat(b.limit) || '';
        const limitTier = limitVal ? getLimitTier(limitVal) : '';
        const recommendedKelly = calculateKellyStake(b, stakingSettings).toFixed(2);
        
        let fillRatio = '';
        if (recommendedKelly > 0) {
          fillRatio = ((parseFloat(b.stake) / parseFloat(recommendedKelly)) * 100).toFixed(2);
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
          esc(commission),
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
          esc(recommendedKelly),
          esc(fillRatio),
          esc(hoursToEvent)
        ].join(','));
      }
      const dataStr = rows.join('\r\n');
      const filename = `surebet-analysis-${(new Date()).toISOString().replace(/[:.]/g, '-')}.csv`;
      console.log('📤 Exporting CSV with analysis...');
      api.runtime.sendMessage({ action: 'export', dataStr, filename, mime: 'text/csv' }, (resp) => {
        if (resp && resp.success) {
          alert('✅ CSV exported successfully!');
        } else {
          alert('❌ Export failed: ' + (resp?.error || 'Unknown error'));
        }
      });
    });
  });
});

// Helper function - update cache (minimal version for analysis page)
function updateCache(bets, stakingSettings) {
  // This is a placeholder - the cache updating logic would go here if needed
}
