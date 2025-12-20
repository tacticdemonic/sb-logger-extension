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

function calculateBetPL(bet) {
  if (!bet) return 0;

  // Use imported actualPL if available (from exchange CSVs)
  if (bet.actualPL !== undefined && bet.actualPL !== null) {
    const parsed = parseFloat(bet.actualPL);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // Fallback to calculation
  if (bet.status === 'won') {
    const commission = getCommission(bet.bookmaker);
    if (bet.isLay) {
      const layOdds = parseFloat(bet.originalLayOdds) || parseFloat(bet.odds);
      if (!Number.isFinite(layOdds) || layOdds <= 1) return 0;
      const gross = parseFloat(bet.stake) || 0;
      const commissionAmount = commission > 0 ? (gross * commission / 100) : 0;
      return gross - commissionAmount;
    } else {
      const grossProfit = (parseFloat(bet.stake) * parseFloat(bet.odds)) - parseFloat(bet.stake);
      const commissionAmount = commission > 0 ? (grossProfit * commission / 100) : 0;
      return grossProfit - commissionAmount;
    }
  } else if (bet.status === 'lost') {
    if (bet.isLay) {
      const layOdds = parseFloat(bet.originalLayOdds) || parseFloat(bet.odds);
      if (!Number.isFinite(layOdds) || layOdds <= 1) return 0;
      return -(parseFloat(bet.stake) * (layOdds - 1));
    } else {
      return -parseFloat(bet.stake);
    }
  } else if (bet.status === 'void') {
    return 0;
  }

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
      if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
        actualPL = calculateBetPL(bet);
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
    if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
      actualPL = calculateBetPL(bet);
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
    if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
      actualPL = calculateBetPL(bet);
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

  // Use effective bankroll if pending adjustment is enabled
  const activeBankroll = (stakingSettings.adjustForPending && stakingSettings.effectiveBankroll != null)
    ? stakingSettings.effectiveBankroll
    : bankroll;

  let stake = activeBankroll * kellyPortion * userFraction;

  // Apply max bet cap after Kelly calculation (before liquidity limit)
  if (stakingSettings.maxBetPercent && stakingSettings.maxBetPercent > 0) {
    stake = Math.min(stake, bankroll * stakingSettings.maxBetPercent);
  }

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

// ========== CLV ANALYSIS FUNCTIONS ==========

function calculateClvStats(bets) {
  console.log('📊 Calculating CLV stats');

  // Get settled bets with CLV data
  const betsWithClv = bets.filter(b =>
    ['won', 'lost'].includes(b.status) &&
    b.clv !== undefined &&
    b.clv !== null
  );

  // Count bets pending CLV
  const pendingClv = bets.filter(b =>
    ['won', 'lost'].includes(b.status) &&
    (b.clv === undefined || b.clv === null)
  ).length;

  if (betsWithClv.length === 0) {
    return {
      totalWithClv: 0,
      pendingClv,
      avgClv: 0,
      positiveClvPercent: 0,
      correlation: null,
      histogram: [],
      byBookmaker: [],
      scatterData: []
    };
  }

  // Calculate average CLV
  const totalClv = betsWithClv.reduce((sum, b) => sum + parseFloat(b.clv), 0);
  const avgClv = totalClv / betsWithClv.length;

  // Calculate positive CLV percentage
  const positiveClvCount = betsWithClv.filter(b => parseFloat(b.clv) >= 0).length;
  const positiveClvPercent = (positiveClvCount / betsWithClv.length) * 100;

  // Build histogram buckets
  const histogramBuckets = {
    '<-5%': 0,
    '-5 to -2%': 0,
    '-2 to 0%': 0,
    '0 to 2%': 0,
    '2 to 5%': 0,
    '>5%': 0
  };

  betsWithClv.forEach(b => {
    const clv = parseFloat(b.clv);
    if (clv < -5) histogramBuckets['<-5%']++;
    else if (clv < -2) histogramBuckets['-5 to -2%']++;
    else if (clv < 0) histogramBuckets['-2 to 0%']++;
    else if (clv < 2) histogramBuckets['0 to 2%']++;
    else if (clv < 5) histogramBuckets['2 to 5%']++;
    else histogramBuckets['>5%']++;
  });

  // Build scatter data (CLV vs actual outcome)
  const scatterData = betsWithClv.map(b => {
    const clv = parseFloat(b.clv);
    const stake = parseFloat(b.stake) || 0;
    const odds = parseFloat(b.odds) || 0;
    const commission = getCommission(b.bookmaker);

    let actualPL = 0;
    if (b.status === 'won' || b.status === 'lost' || b.status === 'void') {
      actualPL = calculateBetPL(b);
    }

    const roi = stake > 0 ? (actualPL / stake) * 100 : 0;

    return {
      x: clv,
      y: roi,
      event: b.event,
      status: b.status,
      bookmaker: b.bookmaker
    };
  });

  // Calculate correlation between CLV and ROI
  let correlation = null;
  if (scatterData.length >= 5) {
    const xVals = scatterData.map(d => d.x);
    const yVals = scatterData.map(d => d.y);

    const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
    const meanY = yVals.reduce((a, b) => a + b, 0) / yVals.length;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < xVals.length; i++) {
      const dx = xVals[i] - meanX;
      const dy = yVals[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    if (denom > 0) {
      correlation = numerator / denom;
    }
  }

  // CLV by bookmaker
  const bookmakerClv = {};
  betsWithClv.forEach(b => {
    const bookie = b.bookmaker || 'Unknown';
    if (!bookmakerClv[bookie]) {
      bookmakerClv[bookie] = { total: 0, count: 0, positive: 0 };
    }
    bookmakerClv[bookie].total += parseFloat(b.clv);
    bookmakerClv[bookie].count++;
    if (parseFloat(b.clv) >= 0) bookmakerClv[bookie].positive++;
  });

  const byBookmaker = Object.entries(bookmakerClv).map(([name, data]) => ({
    name,
    avgClv: (data.total / data.count).toFixed(2),
    positivePercent: ((data.positive / data.count) * 100).toFixed(1),
    count: data.count
  })).sort((a, b) => parseFloat(b.avgClv) - parseFloat(a.avgClv));

  return {
    totalWithClv: betsWithClv.length,
    pendingClv,
    avgClv: avgClv.toFixed(2),
    positiveClvPercent: positiveClvPercent.toFixed(1),
    correlation: correlation !== null ? correlation.toFixed(3) : null,
    histogram: histogramBuckets,
    byBookmaker,
    scatterData
  };
}

function renderClvHistogramChart(histogram) {
  const canvas = document.getElementById('clvHistogramChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const labels = Object.keys(histogram);
  const values = Object.values(histogram);

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = { top: 40, right: 30, bottom: 50, left: 50 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;
  const barWidth = chartWidth / labels.length * 0.7;
  const gap = chartWidth / labels.length * 0.3;
  const maxValue = Math.max(...values, 1);

  // Draw bars
  labels.forEach((label, i) => {
    const value = values[i];
    const barHeight = (value / maxValue) * chartHeight;
    const x = padding.left + i * (barWidth + gap) + gap / 2;
    const y = canvas.height - padding.bottom - barHeight;

    // Color based on positive/negative CLV
    const isPositive = label.includes('>') || (label.includes('0 to') && !label.includes('-'));
    ctx.fillStyle = isPositive ? '#28a745' : '#dc3545';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw value on top
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), x + barWidth / 2, y - 5);

    // Draw label
    ctx.fillText(label, x + barWidth / 2, canvas.height - padding.bottom + 20);
  });

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, canvas.height - padding.bottom);
  ctx.strokeStyle = '#ccc';
  ctx.stroke();

  // Title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CLV Distribution (# of bets)', canvas.width / 2, 20);
}

function renderClvScatterChart(scatterData) {
  const canvas = document.getElementById('clvScatterChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (scatterData.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No CLV data available yet', canvas.width / 2, canvas.height / 2);
    return;
  }

  const padding = { top: 40, right: 30, bottom: 50, left: 60 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;

  // Calculate ranges with minimum fallback to prevent division by zero
  const xVals = scatterData.map(d => d.x);
  const yVals = scatterData.map(d => d.y);
  const xMin = Math.min(...xVals, -10);
  const xMax = Math.max(...xVals, 10);
  const yMin = Math.min(...yVals, -100);
  const yMax = Math.max(...yVals, 100);
  // Ensure minimum range to avoid NaN from division by zero when all points share same value
  const xRange = Math.max(xMax - xMin, 1);
  const yRange = Math.max(yMax - yMin, 1);

  // Draw axes
  const zeroX = padding.left + ((0 - xMin) / xRange) * chartWidth;
  const zeroY = padding.top + ((yMax - 0) / yRange) * chartHeight;

  // Y-axis (CLV = 0)
  ctx.beginPath();
  ctx.moveTo(zeroX, padding.top);
  ctx.lineTo(zeroX, canvas.height - padding.bottom);
  ctx.strokeStyle = '#ccc';
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // X-axis (ROI = 0)
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(canvas.width - padding.right, zeroY);
  ctx.stroke();

  // Draw points
  scatterData.forEach(d => {
    const x = padding.left + ((d.x - xMin) / xRange) * chartWidth;
    const y = padding.top + ((yMax - d.y) / yRange) * chartHeight;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = d.status === 'won' ? '#28a745' : '#dc3545';
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CLV (%)', canvas.width / 2, canvas.height - 10);

  ctx.save();
  ctx.translate(15, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('ROI (%)', 0, 0);
  ctx.restore();

  // Title
  ctx.font = 'bold 14px Arial';
  ctx.fillText('CLV vs Actual ROI', canvas.width / 2, 20);

  // Legend
  ctx.font = '11px Arial';
  ctx.fillStyle = '#28a745';
  ctx.fillText('● Won', canvas.width - 80, 20);
  ctx.fillStyle = '#dc3545';
  ctx.fillText('● Lost', canvas.width - 40, 20);
}

function renderClvAnalysis(clvStats) {
  // Update summary stats
  document.getElementById('clv-total-stat').textContent = clvStats.totalWithClv;

  const avgClvEl = document.getElementById('clv-avg-stat');
  const avgClv = parseFloat(clvStats.avgClv);
  avgClvEl.textContent = (avgClv >= 0 ? '+' : '') + clvStats.avgClv + '%';
  if (avgClvEl.parentElement) {
    avgClvEl.parentElement.style.borderLeftColor = avgClv >= 0 ? '#28a745' : '#dc3545';
  }

  document.getElementById('clv-positive-stat').textContent = clvStats.positiveClvPercent + '%';

  const correlationEl = document.getElementById('clv-correlation-stat');
  if (clvStats.correlation !== null) {
    const corr = parseFloat(clvStats.correlation);
    correlationEl.textContent = clvStats.correlation;
    if (correlationEl.parentElement) {
      correlationEl.parentElement.style.borderLeftColor = corr > 0.3 ? '#28a745' : corr < -0.3 ? '#dc3545' : '#ffc107';
    }
  } else {
    correlationEl.textContent = 'N/A (need 5+ bets)';
  }

  // Render histogram
  renderClvHistogramChart(clvStats.histogram);

  // Render scatter chart
  renderClvScatterChart(clvStats.scatterData);

  // Render bookmaker table
  const bookmakerHtml = clvStats.byBookmaker.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Bookmaker</th>
          <th style="text-align:center">Bets with CLV</th>
          <th style="text-align:center">Avg CLV</th>
          <th style="text-align:center">Positive CLV %</th>
        </tr>
      </thead>
      <tbody>
        ${clvStats.byBookmaker.map(b => {
    const avgClv = parseFloat(b.avgClv);
    const clvColor = avgClv >= 0 ? '#28a745' : '#dc3545';
    return `
            <tr>
              <td style="font-weight:600">${b.name}</td>
              <td style="text-align:center">${b.count}</td>
              <td style="text-align:center;color:${clvColor};font-weight:600">${avgClv >= 0 ? '+' : ''}${b.avgClv}%</td>
              <td style="text-align:center">${b.positivePercent}%</td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  ` : '<p class="note">No CLV data by bookmaker available yet.</p>';

  document.getElementById('clv-bookmaker-content').innerHTML = bookmakerHtml;

  // Show/hide pending warning
  const pendingWarning = document.getElementById('clv-pending-warning');
  const pendingCount = document.getElementById('clv-pending-count');
  if (pendingWarning && pendingCount) {
    if (clvStats.pendingClv > 0) {
      pendingCount.textContent = clvStats.pendingClv;
      pendingWarning.style.display = 'block';
    } else {
      pendingWarning.style.display = 'none';
    }
  }
}

function calculateSummaryStats(bets) {
  console.log('📊 Calculating summary stats');

  const settledBets = bets.filter(b => b.status && b.status !== 'pending');

  // Build cumulative P/L array
  const sortedBets = bets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let cumulativePL = 0;
  const cumulativePLArray = [];
  let totalWins = 0;
  let totalLosses = 0;

  sortedBets.forEach(b => {
    if (b.status === 'won' || b.status === 'lost' || b.status === 'void') {
      const pl = calculateBetPL(b);
      cumulativePL += pl;

      if (b.status === 'won') totalWins += 1;
      else if (b.status === 'lost') totalLosses += 1;
    }
    cumulativePLArray.push(cumulativePL);
  });

  // Calculate yield/ROI
  const totalTurnover = settledBets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
  const yield_ = totalTurnover > 0 ? (cumulativePL / totalTurnover * 100) : 0;

  // Calculate profit factor
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? totalWins : 0);

  // Calculate average stake
  const avgStake = settledBets.length > 0 ? totalTurnover / settledBets.length : 0;

  // Calculate drawdowns
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let peak = 0;

  for (let i = 0; i < cumulativePLArray.length; i++) {
    if (cumulativePLArray[i] > peak) {
      peak = cumulativePLArray[i];
    }
    const dd = peak - cumulativePLArray[i];
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  if (cumulativePLArray.length > 0) {
    currentDrawdown = peak - cumulativePLArray[cumulativePLArray.length - 1];
  }

  // Calculate longest win/loss streaks
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  sortedBets.forEach(b => {
    if (b.status === 'won') {
      currentWinStreak++;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
      currentLossStreak = 0;
    } else if (b.status === 'lost') {
      currentLossStreak++;
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak;
      }
      currentWinStreak = 0;
    }
  });

  const stats = {
    totalCount: bets.length,
    yield: yield_.toFixed(2),
    profitFactor: profitFactor.toFixed(2),
    totalTurnover: totalTurnover.toFixed(2),
    netProfit: cumulativePL.toFixed(2),
    avgStake: avgStake.toFixed(2),
    maxDrawdown: maxDrawdown.toFixed(2),
    currentDrawdown: currentDrawdown.toFixed(2),
    longestWinStreak,
    longestLossStreak,
    settledCount: settledBets.length,
    winCount: totalWins,
    lossCount: totalLosses
  };

  console.log('  Summary stats:', stats);
  return stats;
}

function calculateOddsBandStats(bets) {
  console.log('📊 Calculating odds band stats');

  const settledBets = bets.filter(b => b.status && b.status !== 'pending');

  const bands = {
    '1.00-1.50': { min: 1.00, max: 1.50, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '1.51-2.00': { min: 1.51, max: 2.00, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '2.01-3.00': { min: 2.01, max: 3.00, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '3.01-5.00': { min: 3.01, max: 5.00, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '5.01+': { min: 5.01, max: Infinity, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 }
  };

  settledBets.forEach(bet => {
    const odds = parseFloat(bet.odds) || 0;
    let bandKey = null;

    for (const [key, band] of Object.entries(bands)) {
      if (odds >= band.min && odds <= band.max) {
        bandKey = key;
        break;
      }
    }

    if (bandKey && bands[bandKey]) {
      bands[bandKey].bets.push(bet);
      bands[bandKey].totalProbability += parseFloat(bet.probability) || 0;

      if (bet.status === 'won') {
        bands[bandKey].winCount++;
      }

      let actualPL = 0;
      if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
        actualPL = calculateBetPL(bet);
      }

      bands[bandKey].totalPL += actualPL;
    }
  });

  const stats = {};
  Object.entries(bands).forEach(([bandName, bandData]) => {
    const count = bandData.bets.length;
    const actualWinRate = count > 0 ? (bandData.winCount / count * 100) : 0;
    const expectedWinRate = count > 0 ? (bandData.totalProbability / count) : 0;
    const deviation = actualWinRate - expectedWinRate;
    const totalStake = bandData.bets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
    const roi = totalStake > 0 ? (bandData.totalPL / totalStake * 100) : 0;
    const isSignificant = count >= 20;

    stats[bandName] = {
      count,
      winCount: bandData.winCount,
      actualWinRate: actualWinRate.toFixed(2),
      expectedWinRate: expectedWinRate.toFixed(2),
      deviation: deviation.toFixed(2),
      deviationDirection: deviation >= 0 ? 'positive' : 'negative',
      roi: roi.toFixed(2),
      totalPL: bandData.totalPL.toFixed(2),
      isSignificant,
      significance: isSignificant ? 'High' : count >= 10 ? 'Medium' : 'Low'
    };
  });

  console.log('  Odds band stats:', stats);
  return stats;
}

function calculateOvervalueStats(bets) {
  console.log('📊 Calculating overvalue stats');

  const settledBets = bets.filter(b => b.status && b.status !== 'pending');

  const ranges = {
    '0-1%': { min: 0, max: 1, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '1-2%': { min: 1, max: 2, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '2-3%': { min: 2, max: 3, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '3-5%': { min: 3, max: 5, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 },
    '5%+': { min: 5, max: Infinity, bets: [], winCount: 0, totalPL: 0, totalProbability: 0 }
  };

  settledBets.forEach(bet => {
    const overvalue = parseFloat(bet.overvalue) || 0;
    let rangeKey = null;

    for (const [key, range] of Object.entries(ranges)) {
      if (overvalue >= range.min && overvalue < range.max) {
        rangeKey = key;
        break;
      }
      if (key === '5%+' && overvalue >= range.min) {
        rangeKey = key;
        break;
      }
    }

    if (rangeKey && ranges[rangeKey]) {
      ranges[rangeKey].bets.push(bet);
      ranges[rangeKey].totalProbability += parseFloat(bet.probability) || 0;

      if (bet.status === 'won') {
        ranges[rangeKey].winCount++;
      }

      let actualPL = 0;
      if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
        actualPL = calculateBetPL(bet);
      }

      ranges[rangeKey].totalPL += actualPL;
    }
  });

  const stats = {};
  Object.entries(ranges).forEach(([rangeName, rangeData]) => {
    const count = rangeData.bets.length;
    const actualWinRate = count > 0 ? (rangeData.winCount / count * 100) : 0;
    const expectedWinRate = count > 0 ? (rangeData.totalProbability / count) : 0;
    const deviation = actualWinRate - expectedWinRate;
    const totalStake = rangeData.bets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
    const roi = totalStake > 0 ? (rangeData.totalPL / totalStake * 100) : 0;
    const isSignificant = count >= 20;

    stats[rangeName] = {
      count,
      winCount: rangeData.winCount,
      actualWinRate: actualWinRate.toFixed(2),
      expectedWinRate: expectedWinRate.toFixed(2),
      deviation: deviation.toFixed(2),
      deviationDirection: deviation >= 0 ? 'positive' : 'negative',
      roi: roi.toFixed(2),
      totalPL: rangeData.totalPL.toFixed(2),
      isSignificant,
      significance: isSignificant ? 'High' : count >= 10 ? 'Medium' : 'Low'
    };
  });

  console.log('  Overvalue stats:', stats);
  return stats;
}

function calculateSportStats(bets) {
  console.log('📊 Calculating sport stats');

  const settledBets = bets.filter(b => b.status && b.status !== 'pending');

  const sportsMap = {};

  settledBets.forEach(bet => {
    const sport = bet.sport || 'Other';
    if (!sportsMap[sport]) {
      sportsMap[sport] = {
        bets: [],
        winCount: 0,
        totalPL: 0,
        totalProbability: 0,
        totalOdds: 0,
        totalOvervalue: 0
      };
    }

    sportsMap[sport].bets.push(bet);
    sportsMap[sport].totalProbability += parseFloat(bet.probability) || 0;
    sportsMap[sport].totalOdds += parseFloat(bet.odds) || 0;
    sportsMap[sport].totalOvervalue += parseFloat(bet.overvalue) || 0;

    if (bet.status === 'won') {
      sportsMap[sport].winCount++;
    }

    let actualPL = 0;
    if (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') {
      actualPL = calculateBetPL(bet);
    }

    sportsMap[sport].totalPL += actualPL;
  });

  const sportStats = Object.entries(sportsMap).map(([name, data]) => {
    const count = data.bets.length;
    const actualWinRate = count > 0 ? (data.winCount / count * 100) : 0;
    const expectedWinRate = count > 0 ? (data.totalProbability / count) : 0;
    const deviation = actualWinRate - expectedWinRate;
    const totalStake = data.bets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
    const roi = totalStake > 0 ? (data.totalPL / totalStake * 100) : 0;
    const avgOdds = count > 0 ? (data.totalOdds / count).toFixed(2) : '0.00';
    const avgOvervalue = count > 0 ? (data.totalOvervalue / count).toFixed(2) : '0.00';
    const isSignificant = count >= 20;

    return {
      name,
      count,
      winCount: data.winCount,
      actualWinRate: actualWinRate.toFixed(2),
      expectedWinRate: expectedWinRate.toFixed(2),
      deviation: deviation.toFixed(2),
      deviationDirection: deviation >= 0 ? 'positive' : 'negative',
      roi: roi.toFixed(2),
      totalPL: data.totalPL.toFixed(2),
      avgOdds: parseFloat(avgOdds),
      avgOvervalue: parseFloat(avgOvervalue),
      isSignificant,
      significance: isSignificant ? 'High' : count >= 10 ? 'Medium' : 'Low'
    };
  }).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));

  console.log('  Sport stats:', sportStats);
  return sportStats;
}

// Bar chart rendering function
function renderBarChart(canvasId, labels, values, colors, showLowSignificance = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const barHeight = 30;
  const topPadding = 30;
  const bottomPadding = 40;
  const leftPadding = 150;
  const rightPadding = 20;

  const chartHeight = Math.max(labels.length * barHeight + topPadding + bottomPadding, canvas.height);
  canvas.height = chartHeight;

  const chartWidth = canvas.width - leftPadding - rightPadding;

  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, -100);
  const range = Math.max(maxValue - minValue, 1);

  // Draw background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw labels
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  labels.forEach((label, idx) => {
    const y = topPadding + (idx + 0.5) * barHeight;
    const opacity = showLowSignificance && !showLowSignificance[idx] ? 0.5 : 1.0;
    ctx.globalAlpha = opacity;
    ctx.fillText(label, leftPadding - 10, y + 4);
    ctx.globalAlpha = 1.0;
  });

  // Draw bars
  values.forEach((value, idx) => {
    const y = topPadding + idx * barHeight;
    const normalizedValue = (value - minValue) / range;
    const barWidth = normalizedValue * chartWidth;
    const barY = y + 5;
    const opacity = showLowSignificance && !showLowSignificance[idx] ? 0.5 : 1.0;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = colors[idx] || '#007bff';
    ctx.fillRect(leftPadding, barY, barWidth, barHeight - 10);

    // Draw value text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(value.toFixed(2) + '%', leftPadding + barWidth + 5, barY + 18);
    ctx.globalAlpha = 1.0;
  });

  // Draw axes
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPadding, topPadding);
  ctx.lineTo(leftPadding, topPadding + labels.length * barHeight);
  ctx.lineTo(canvas.width - rightPadding, topPadding + labels.length * barHeight);
  ctx.stroke();
}

// Histogram rendering function
function renderHistogram(canvasId, labels, counts, significance) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const barWidth = 80;
  const topPadding = 40;
  const bottomPadding = 60;
  const leftPadding = 60;
  const rightPadding = 20;

  const chartHeight = canvas.height;
  const chartWidth = canvas.width - leftPadding - rightPadding;

  const maxCount = Math.max(...counts, 1);

  // Draw background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = topPadding + (chartHeight - topPadding - bottomPadding) / 5 * i;
    ctx.beginPath();
    ctx.moveTo(leftPadding, y);
    ctx.lineTo(canvas.width - rightPadding, y);
    ctx.stroke();
  }

  // Draw bars
  labels.forEach((label, idx) => {
    const normalizedCount = (counts[idx] / maxCount) * (chartHeight - topPadding - bottomPadding);
    const x = leftPadding + idx * (barWidth + 15);
    const y = chartHeight - bottomPadding - normalizedCount;
    const opacity = !significance[idx] ? 0.5 : 1.0;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = significance[idx] ? '#007bff' : '#b3d9ff';
    ctx.fillRect(x, y, barWidth, normalizedCount);
    ctx.globalAlpha = 1.0;

    // Draw count text on bar
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(counts[idx], x + barWidth / 2, y + normalizedCount - 10);

    // Draw label
    ctx.fillStyle = '#555';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barWidth / 2, chartHeight - bottomPadding + 15);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  // Draw axes
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPadding, topPadding);
  ctx.lineTo(leftPadding, chartHeight - bottomPadding);
  ctx.lineTo(canvas.width - rightPadding, chartHeight - bottomPadding);
  ctx.stroke();

  // Draw axis labels
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Overvalue Range', canvas.width / 2, canvas.height - 10);

  ctx.save();
  ctx.translate(15, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Number of Bets', 0, 0);
  ctx.restore();
}

// Performance analysis rendering function
function renderPerformanceAnalysis(oddsBandStats, overvalueStats, sportStats) {
  console.log('📊 Rendering performance analysis');

  // Render odds band chart
  const oddsBandLabels = Object.keys(oddsBandStats);
  const oddsBandROI = Object.values(oddsBandStats).map(s => parseFloat(s.roi));
  const oddsBandColors = oddsBandROI.map(roi => roi >= 0 ? '#28a745' : '#dc3545');
  const oddsBandSignificance = Object.values(oddsBandStats).map(s => s.isSignificant);

  renderBarChart('oddsBandChart', oddsBandLabels, oddsBandROI, oddsBandColors, oddsBandSignificance);

  // Render odds band table
  const oddsBandHtml = `
    <table>
      <thead>
        <tr>
          <th>Odds Band</th>
          <th style="text-align:center">Bets (n)</th>
          <th style="text-align:center">Actual Win %</th>
          <th style="text-align:center">Expected Win %</th>
          <th style="text-align:center">Deviation</th>
          <th style="text-align:center">ROI %</th>
          <th style="text-align:center">Total P/L</th>
          <th style="text-align:center">Significance</th>
        </tr>
      </thead>
      <tbody>
        ${oddsBandLabels.map(band => {
    const stats = oddsBandStats[band];
    const className = !stats.isSignificant ? 'low-significance' : '';
    const roiColor = parseFloat(stats.roi) >= 0 ? '#28a745' : '#dc3545';
    const plColor = parseFloat(stats.totalPL) >= 0 ? '#28a745' : '#dc3545';
    const devColor = stats.deviationDirection === 'positive' ? '#28a745' : '#dc3545';
    return `
            <tr class="${className}">
              <td style="font-weight:600">${band}</td>
              <td style="text-align:center">${stats.count}</td>
              <td style="text-align:center">${stats.actualWinRate}%</td>
              <td style="text-align:center">${stats.expectedWinRate}%</td>
              <td style="text-align:center;color:${devColor};font-weight:600">${stats.deviation > 0 ? '+' : ''}${stats.deviation}%</td>
              <td style="text-align:center;color:${roiColor};font-weight:600">${stats.roi}%</td>
              <td style="text-align:center;color:${plColor};font-weight:600">£${stats.totalPL}</td>
              <td style="text-align:center">${stats.significance}</td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('oddsBand-content').innerHTML = oddsBandHtml;

  // Render overvalue histogram
  const overvalueLabels = Object.keys(overvalueStats);
  const overvalueCounts = Object.values(overvalueStats).map(s => s.count);
  const overvalueSignificance = Object.values(overvalueStats).map(s => s.isSignificant);

  renderHistogram('overvalueChart', overvalueLabels, overvalueCounts, overvalueSignificance);

  // Render overvalue table
  const overvalueHtml = `
    <table>
      <thead>
        <tr>
          <th>Overvalue Range</th>
          <th style="text-align:center">Bets (n)</th>
          <th style="text-align:center">Actual Win %</th>
          <th style="text-align:center">Expected Win %</th>
          <th style="text-align:center">Deviation</th>
          <th style="text-align:center">ROI %</th>
          <th style="text-align:center">Total P/L</th>
          <th style="text-align:center">Significance</th>
        </tr>
      </thead>
      <tbody>
        ${overvalueLabels.map(range => {
    const stats = overvalueStats[range];
    const className = !stats.isSignificant ? 'low-significance' : '';
    const roiColor = parseFloat(stats.roi) >= 0 ? '#28a745' : '#dc3545';
    const plColor = parseFloat(stats.totalPL) >= 0 ? '#28a745' : '#dc3545';
    const devColor = stats.deviationDirection === 'positive' ? '#28a745' : '#dc3545';
    return `
            <tr class="${className}">
              <td style="font-weight:600">${range}</td>
              <td style="text-align:center">${stats.count}</td>
              <td style="text-align:center">${stats.actualWinRate}%</td>
              <td style="text-align:center">${stats.expectedWinRate}%</td>
              <td style="text-align:center;color:${devColor};font-weight:600">${stats.deviation > 0 ? '+' : ''}${stats.deviation}%</td>
              <td style="text-align:center;color:${roiColor};font-weight:600">${stats.roi}%</td>
              <td style="text-align:center;color:${plColor};font-weight:600">£${stats.totalPL}</td>
              <td style="text-align:center">${stats.significance}</td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('overvalue-content').innerHTML = overvalueHtml;

  // Render sport chart
  const sportLabels = sportStats.map(s => s.name);
  const sportROI = sportStats.map(s => parseFloat(s.roi));
  const sportColors = sportROI.map(roi => roi >= 0 ? '#28a745' : '#dc3545');
  const sportSignificance = sportStats.map(s => s.isSignificant);

  renderBarChart('sportChart', sportLabels, sportROI, sportColors, sportSignificance);

  // Render sport table
  const sportHtml = `
    <table>
      <thead>
        <tr>
          <th>Sport</th>
          <th style="text-align:center">Bets (n)</th>
          <th style="text-align:center">Win Rate %</th>
          <th style="text-align:center">Expected %</th>
          <th style="text-align:center">Deviation</th>
          <th style="text-align:center">ROI %</th>
          <th style="text-align:center">Avg Odds</th>
          <th style="text-align:center">Avg Overvalue %</th>
          <th style="text-align:center">Total P/L</th>
          <th style="text-align:center">Significance</th>
        </tr>
      </thead>
      <tbody>
        ${sportStats.map(sport => {
    const className = !sport.isSignificant ? 'low-significance' : '';
    const roiColor = parseFloat(sport.roi) >= 0 ? '#28a745' : '#dc3545';
    const plColor = parseFloat(sport.totalPL) >= 0 ? '#28a745' : '#dc3545';
    const devColor = sport.deviationDirection === 'positive' ? '#28a745' : '#dc3545';
    return `
            <tr class="${className}">
              <td style="font-weight:600">${sport.name}</td>
              <td style="text-align:center">${sport.count}</td>
              <td style="text-align:center">${sport.actualWinRate}%</td>
              <td style="text-align:center">${sport.expectedWinRate}%</td>
              <td style="text-align:center;color:${devColor};font-weight:600">${sport.deviation > 0 ? '+' : ''}${sport.deviation}%</td>
              <td style="text-align:center;color:${roiColor};font-weight:600">${sport.roi}%</td>
              <td style="text-align:center">${sport.avgOdds.toFixed(2)}</td>
              <td style="text-align:center">${sport.avgOvervalue.toFixed(2)}%</td>
              <td style="text-align:center;color:${plColor};font-weight:600">£${sport.totalPL}</td>
              <td style="text-align:center">${sport.significance}</td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('sport-content').innerHTML = sportHtml;
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

    if (b.status === 'won' || b.status === 'lost' || b.status === 'void') {
      cumulativePL += calculateBetPL(b);
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
    // Calculate all stats first
    const summaryStats = calculateSummaryStats(bets);
    const oddsBandStats = calculateOddsBandStats(bets);
    const overvalueStats = calculateOvervalueStats(bets);
    const sportStats = calculateSportStats(bets);

    // Render summary stats section
    document.getElementById('total-bets-stat').textContent = summaryStats.totalCount;
    document.getElementById('settled-bets-stat').textContent = summaryStats.settledCount;

    document.getElementById('yield-stat').textContent = summaryStats.yield + '%';
    const yieldValue = parseFloat(summaryStats.yield);
    if (document.getElementById('yield-stat').parentElement) {
      document.getElementById('yield-stat').parentElement.style.color = yieldValue >= 0 ? '#28a745' : '#dc3545';
    }

    document.getElementById('profit-factor-stat').textContent = summaryStats.profitFactor;
    const pfValue = parseFloat(summaryStats.profitFactor);
    if (document.getElementById('profit-factor-stat').parentElement) {
      document.getElementById('profit-factor-stat').parentElement.style.color = pfValue > 1 ? '#28a745' : '#dc3545';
    }

    document.getElementById('turnover-stat').textContent = '£' + summaryStats.totalTurnover;
    document.getElementById('net-profit-stat').textContent = '£' + summaryStats.netProfit;
    const npValue = parseFloat(summaryStats.netProfit);
    if (document.getElementById('net-profit-stat').parentElement) {
      document.getElementById('net-profit-stat').parentElement.style.color = npValue >= 0 ? '#28a745' : '#dc3545';
    }

    document.getElementById('avg-stake-stat').textContent = '£' + summaryStats.avgStake;
    document.getElementById('max-drawdown-stat').textContent = '£' + summaryStats.maxDrawdown;
    document.getElementById('current-drawdown-stat').textContent = '£' + summaryStats.currentDrawdown;
    document.getElementById('win-streak-stat').textContent = summaryStats.longestWinStreak;
    document.getElementById('loss-streak-stat').textContent = summaryStats.longestLossStreak;

    // Render chart
    showChart(bets);

    // Render performance analysis
    renderPerformanceAnalysis(oddsBandStats, overvalueStats, sportStats);

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

    // Render CLV analysis
    const clvStats = calculateClvStats(bets);
    renderClvAnalysis(clvStats);
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

      const summaryStats = calculateSummaryStats(bets);
      const tierStats = calculateLiquidityStats(bets);
      const bookmakerStats = calculateBookmakerStats(bets);
      const temporalStats = calculateTemporalStats(bets);
      const kellyStats = calculateKellyFillRatios(bets, stakingSettings);
      const oddsBandStats = calculateOddsBandStats(bets);
      const overvalueStats = calculateOvervalueStats(bets);
      const sportStats = calculateSportStats(bets);

      const exportData = {
        exportDate: new Date().toISOString(),
        bets: bets,
        analysis: {
          summaryStats: summaryStats,
          performanceAnalysis: {
            oddsBands: oddsBandStats,
            overvalueDistribution: overvalueStats,
            sportBreakdown: sportStats
          },
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

        // Calculate actual P/L using the helper (uses imported actualPL if available)
        let actualPL = '';
        if (b.status === 'won' || b.status === 'lost' || b.status === 'void') {
          actualPL = calculateBetPL(b).toFixed(2);
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
