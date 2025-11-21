// Import page script - handles CSV file import from dedicated page
console.log('📥 Import page loaded v2.1 - Enhanced matching with player name stripping');

const fileInput = document.getElementById('csv-file-input');
const selectedFilesDiv = document.getElementById('selected-files');
const fileList = document.getElementById('file-list');
const importBtn = document.getElementById('import-btn');
const cancelBtn = document.getElementById('cancel-btn');
const resultsDiv = document.getElementById('results');

let selectedFiles = [];

// Listen for file selection
fileInput.addEventListener('change', (e) => {
  selectedFiles = Array.from(e.target.files);
  console.log(`📁 Files selected: ${selectedFiles.length}`);
  
  if (selectedFiles.length > 0) {
    // Show selected files
    fileList.innerHTML = '';
    selectedFiles.forEach(file => {
      const li = document.createElement('li');
      li.textContent = file.name;
      fileList.appendChild(li);
    });
    selectedFilesDiv.style.display = 'block';
  } else {
    selectedFilesDiv.style.display = 'none';
  }
});

// Cancel selection
cancelBtn.addEventListener('click', () => {
  fileInput.value = '';
  selectedFiles = [];
  selectedFilesDiv.style.display = 'none';
});

// Import files
importBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;
  
  console.log('🔄 Starting import process...');
  importBtn.disabled = true;
  importBtn.textContent = 'Importing...';
  
  try {
    if (selectedFiles.length === 1) {
      await importSingleFile(selectedFiles[0]);
    } else {
      await importMultipleFiles(selectedFiles);
    }
  } catch (error) {
    console.error('❌ Import error:', error);
    showResults('error', `Error: ${error.message}`);
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import Now';
  }
});

async function importSingleFile(file) {
  console.log(`📂 Processing file: ${file.name}`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvText = event.target.result;
        console.log(`✅ File loaded, length: ${csvText.length}`);
        
        const plData = parseCSV(csvText, file.name);
        console.log(`📊 Parsed ${plData.length} settled bets from CSV`);
        
        await processImportedData(plData, file.name);
        resolve();
      } catch (error) {
        console.error('❌ Error processing file:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

async function importMultipleFiles(files) {
  console.log(`📂 Processing ${files.length} files...`);
  
  const allPlData = [];
  
  for (const file of files) {
    try {
      console.log(`📄 Reading ${file.name}...`);
      const csvText = await readFileAsText(file);
      const plData = parseCSV(csvText, file.name);
      allPlData.push(...plData);
      console.log(`✅ ${file.name}: ${plData.length} settled bets`);
    } catch (error) {
      console.error(`❌ Error reading ${file.name}:`, error);
      throw error;
    }
  }
  
  console.log(`📊 Total rows from all files: ${allPlData.length}`);
  await processImportedData(allPlData, `${files.length} files`);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSV(csvText, filename) {
  // Detect CSV format by examining the header
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }
  
  const firstLine = lines[0].toLowerCase();
  
  // Detect Smarkets format
  if (firstLine.includes('smarkets account overview')) {
    console.log('📋 Detected Smarkets CSV format');
    return parseSmarketsCSV(lines);
  }
  
  // Detect Betfair Exchange format
  if (firstLine.includes('event-id') || firstLine.includes('market-id')) {
    console.log('📋 Detected Betfair Exchange CSV format');
    return parseBetfairExchangeCSV(lines);
  }
  
  // Detect old Betfair P&L format (Sport / Event : Market)
  if (firstLine.includes('market') && firstLine.includes('profit')) {
    console.log('📋 Detected Betfair P&L CSV format');
    return parseBetfairPLCSV(lines);
  }
  
  // Default to old format
  console.log('⚠️ Unknown CSV format, trying Betfair P&L parser');
  return parseBetfairPLCSV(lines);
}

function parseBetfairPLCSV(lines) {
  // Parse header
  const header = lines[0].split(',').map(h => h.trim());
  const marketIdx = header.findIndex(h => h.toLowerCase().includes('market'));
  const plIdx = header.findIndex(h => h.toLowerCase().includes('profit') || h.toLowerCase().includes('loss') || h.toLowerCase().includes('p/l'));
  
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
    
    if (!market || isNaN(pl) || pl === 0) continue;
    
    // Parse market: "Sport / Event : Market"
    const colonIdx = market.indexOf(':');
    if (colonIdx === -1) continue;
    
    const beforeColon = market.substring(0, colonIdx).trim();
    const marketName = market.substring(colonIdx + 1).trim();
    
    const slashIdx = beforeColon.indexOf('/');
    if (slashIdx === -1) continue;
    
    const sport = beforeColon.substring(0, slashIdx).trim();
    const event = beforeColon.substring(slashIdx + 1).trim();
    
    results.push({
      sport,
      event,
      market: marketName,
      profitLoss: pl
    });
  }
  
  return results;
}

function parseBetfairExchangeCSV(lines) {
  const header = lines[0].split(',');
  const eventNameIdx = header.findIndex(h => h.includes('event-name'));
  const marketNameIdx = header.findIndex(h => h.includes('market-name'));
  const plIdx = header.findIndex(h => h.includes('profit-loss'));
  const selectionNameIdx = header.findIndex(h => h.includes('selection-name'));
  const sideIdx = header.findIndex(h => h.includes('selection-side'));
  
  if (eventNameIdx === -1 || marketNameIdx === -1 || plIdx === -1) {
    throw new Error('Betfair Exchange CSV missing required columns');
  }
  
  // Group by event + market to aggregate multiple bets
  const marketMap = new Map();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < header.length) continue;
    
    const event = cols[eventNameIdx]?.trim();
    const marketName = cols[marketNameIdx]?.trim();
    const pl = parseFloat(cols[plIdx]?.replace(/[£€$,]/g, '') || '0');
    const selection = cols[selectionNameIdx]?.trim();
    const side = cols[sideIdx]?.trim();
    
    if (!event || !marketName || isNaN(pl) || pl === 0) continue;
    
    // Create unique key for this market
    const key = `${event}|||${marketName}`;
    
    if (!marketMap.has(key)) {
      marketMap.set(key, {
        event,
        marketName,
        totalPL: 0,
        selections: []
      });
    }
    
    const market = marketMap.get(key);
    market.totalPL += pl;
    if (selection && side) {
      market.selections.push(`${side === 'LAY' ? 'Lay ' : ''}${selection}`);
    }
  }
  
  // Convert to results array
  const results = [];
  for (const [key, data] of marketMap.entries()) {
    if (data.totalPL === 0) continue;
    
    // Detect sport from event name
    let sport = 'Other';
    const eventLower = data.event.toLowerCase();
    if (eventLower.includes(' vs ') || eventLower.includes(' v ')) {
      if (eventLower.match(/\d{2}:\d{2}/)) sport = 'Horse Racing';
      else sport = 'Football'; // Default for "vs" format
    }
    
    // Build market description
    let market = data.marketName;
    if (data.selections.length > 0) {
      market += ` (${data.selections.join(', ')})`;
    }
    
    results.push({
      sport,
      event: data.event,
      market,
      profitLoss: data.totalPL
    });
  }
  
  return results;
}

function parseSmarketsCSV(lines) {
  // Skip header row(s) - Smarkets has a title row and then column headers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].toLowerCase().includes('event') && lines[i].toLowerCase().includes('in/out')) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    throw new Error('Could not find Smarkets CSV header');
  }
  
  const header = parseCSVLine(lines[headerIdx]);
  const eventIdx = header.findIndex(h => h.toLowerCase().trim() === 'event');
  const detailsIdx = header.findIndex(h => h.toLowerCase().trim() === 'details');
  const inOutIdx = header.findIndex(h => h.toLowerCase().includes('in/out'));
  
  if (eventIdx === -1 || detailsIdx === -1 || inOutIdx === -1) {
    throw new Error('Smarkets CSV missing required columns');
  }
  
  const settledMarkets = new Map();
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < header.length) continue;
    
    const event = cols[eventIdx]?.trim();
    const details = cols[detailsIdx]?.trim();
    const inOut = parseFloat(cols[inOutIdx]?.replace(/[£€$,]/g, '') || '0');
    
    // Process "Market Settled" and "Market Voided" rows
    const isSettled = event === 'Market Settled';
    const isVoided = event === 'Market Voided';
    
    if ((!isSettled && !isVoided) || !details || isNaN(inOut)) continue;
    
    // For voided markets, we want to process them even if inOut is 0
    if (!isVoided && inOut === 0) continue;
    
    // Parse details: "Event Name / Market Name"
    // Find the main separator (usually the first major slash, not slashes within "over/under")
    // Look for pattern: "Team A vs Team B / Market" or "Player A vs Player B / Market"
    let slashIdx = -1;
    let eventName = '';
    let marketName = '';
    
    // Try to find " / " (space-slash-space) as separator first
    const spacedSlashIdx = details.indexOf(' / ');
    if (spacedSlashIdx !== -1) {
      eventName = details.substring(0, spacedSlashIdx).trim();
      marketName = details.substring(spacedSlashIdx + 3).trim();
    } else {
      // Fallback: find first slash after "vs" or "at"
      const vsIdx = Math.max(details.indexOf(' vs '), details.indexOf(' v '), details.indexOf(' at '));
      if (vsIdx !== -1) {
        slashIdx = details.indexOf('/', vsIdx);
        if (slashIdx !== -1) {
          eventName = details.substring(0, slashIdx).trim();
          marketName = details.substring(slashIdx + 1).trim();
        }
      }
    }
    
    if (!eventName || !marketName) continue;
    
    // Detect sport
    let sport = 'Other';
    const eventLower = eventName.toLowerCase();
    if (eventLower.includes(' vs ') || eventLower.includes(' v ')) sport = 'Football';
    if (eventLower.includes(' at ')) sport = 'Basketball';
    if (marketName.toLowerCase().includes('games') || marketName.toLowerCase().includes('sets')) sport = 'Tennis';
    if (marketName.toLowerCase().includes('shot') || marketName.toLowerCase().includes('corner') || marketName.toLowerCase().includes('card')) sport = 'Football';
    
    const key = `${eventName}|||${marketName}`;
    settledMarkets.set(key, {
      event: eventName,
      market: marketName,
      sport,
      profitLoss: inOut,
      isVoided: isVoided
    });
  }
  
  return Array.from(settledMarkets.values());
}

function parseCSVLine(line) {
  // Handle quoted CSV fields
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function processImportedData(plData, source) {
  console.log(`🔍 Processing ${plData.length} P/L entries from ${source}`);
  
  // Get all pending bets from storage
  const result = await browser.storage.local.get('bets');
  const allBets = result.bets || [];
  const pendingBets = allBets.filter(bet => bet.status === 'pending');
  
  console.log(`📊 Found ${pendingBets.length} pending bets to match against ${plData.length} P/L entries`);
  
  let matchedCount = 0;
  let updatedBets = [...allBets];
  
  for (const plEntry of plData) {
    const match = matchBetWithPL(plEntry, updatedBets);
    
    if (match) {
      const betIndex = updatedBets.findIndex(b => b.id === match.id);
      if (betIndex !== -1) {
        // Check if bet was voided
        let newStatus;
        if (plEntry.isVoided) {
          newStatus = 'void';
        } else {
          newStatus = plEntry.profitLoss > 0 ? 'won' : plEntry.profitLoss < 0 ? 'lost' : 'void';
        }
        updatedBets[betIndex].status = newStatus;
        updatedBets[betIndex].actualPL = plEntry.profitLoss;
        matchedCount++;
        console.log(`✅ Matched: ${match.event} - ${newStatus} (${plEntry.profitLoss})`);
      }
    } else {
      console.log(`❌ No match found for: "${plEntry.event}" - "${plEntry.market}"`);
    }
  }
  
  // Debug: Show what pending bets we have
  console.log(`\n📋 Current pending bets:`);
  pendingBets.forEach(bet => {
    console.log(`  - ${bet.event} | ${bet.market} | ${bet.sport}`);
  });
  
  // Save updated bets
  await browser.storage.local.set({ bets: updatedBets });
  try {
    await browser.runtime.sendMessage({ action: 'recalculateBankroll' });
  } catch (err) {
    console.warn('⚠️ Unable to trigger bankroll recalc from import page:', err?.message || err);
  }
  
  console.log(`✅ Import complete: ${matchedCount} bets updated`);
  
  showResults(
    'success',
    `✅ Import Complete!<br><br>` +
    `<strong>${matchedCount}</strong> bet(s) matched and updated<br>` +
    `${plData.length - matchedCount} entries had no matching bet<br><br>` +
    `<button onclick="window.close()">Close & Return to Extension</button>`
  );
}

function matchBetWithPL(plEntry, allBets) {
  const normalizeString = (str) => {
    return str.toLowerCase()
      // Normalize Greek transliterations
      .replace(/olympiakos/g, 'olympiacos')
      .replace(/olympiacos/g, 'olympiacos')  // Ensure consistent spelling
      .replace(/piräus/g, 'piraeus')
      .replace(/piraus/g, 'piraeus')
      // Normalize event separators: vs, v, @, at all become a single space
      .replace(/\s+(vs\.?|v\.?|versus|at)\s+/g, ' VERSUS ')
      // Remove common suffixes/prefixes
      .replace(/\s+(fc|sc|cf|ac|ac|bc|ii|u21|u23|women|reserves?)\b/g, '')
      // Remove "BC" prefix which appears inconsistently in basketball team names
      .replace(/\bbc\s+/g, '')
      // Normalize apostrophes and quotes
      .replace(/[''`]/g, '')
      // Remove special characters but keep letters, numbers, and spaces
      .replace(/[^\w\s]/g, ' ')
      // Normalize multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const normalizeMarket = (str, eventName = '') => {
    console.log(`    🔧 normalizeMarket v2.2 called: "${str}" (event: "${eventName}")`);
    
    // Extract team/player names from event to remove from market
    const eventParts = eventName.toLowerCase().split(/\s+(?:vs|v|at|versus)\s+/i);
    const teamNames = eventParts.flatMap(part => 
      part.split(/\s+/).filter(word => word.length > 2)
    );
    
    // Extract ALL numbers (handicaps, totals, etc.) - keep as normalized strings
    const numberMatches = str.match(/[\u2212+\-]?\d+\.?\d*/g) || [];
    const keyNumbers = numberMatches
      .map(n => {
        // Normalize minus signs (various unicode versions) to standard dash
        let clean = n.replace(/[−–—]/g, '-');
        // Remove leading + sign
        clean = clean.replace(/^\+/, '');
        // Replace decimal point with underscore to avoid tokenization issues
        clean = clean.replace(/\./g, '_');
        return clean;
      })
      .filter(n => {
        const num = parseFloat(n.replace('_', '.'));
        // Keep all reasonable betting numbers including negative handicaps
        return !isNaN(num) && Math.abs(num) < 1000;
      })
      .join(' ');
    
    let normalized = str.toLowerCase()
      // First, extract parentheses content and process it
      .replace(/\(([^)]+)\)/g, (match, content) => {
        // Keep important content from parentheses, strip "back" and "lay" labels
        return ' ' + content.replace(/\b(back|lay)\b/gi, '').trim() + ' ';
      })
      // Remove everything after first slash (player names in handicaps)
      .replace(/\/.*$/, '')
      // Remove "participant" keyword before player names
      .replace(/\bparticipant\b/g, '')
      // Remove player/team names from market description
      .replace(new RegExp('\\b(' + teamNames.join('|') + ')\\b', 'gi'), '')
      // Normalize periods and quarters FIRST before other replacements
    .replace(/\b(1st|first)\s+(half|quarter|period)\b/g, '_h1_')
    .replace(/\b(2nd|second)\s+(half|quarter|period)\b/g, '_h2_')
    .replace(/\b(3rd|third)\s+(quarter|period)\b/g, '_q3_')
    .replace(/\b(4th|fourth)\s+(quarter|period)\b/g, '_q4_')
    .replace(/\bquarter\s+(\d+)\b/g, '_q$1_')
      .replace(/\bset\s+(\d+)\b/g, '_SET$1_')
    // Normalize common market types to consistent keywords
    .replace(/\bdouble\s+chance\b/g, '_DOUBLECHANCE_')
    .replace(/\bdraw\s+no\s+bet\b/g, '_DNB_')
    .replace(/\bmatch\s+odds\b/g, '_MATCHWIN_')
    .replace(/\bmoneyline\b/g, '_MATCHWIN_')
    .replace(/\b(match\s+)?winner\b/g, '_MATCHWIN_')
    .replace(/\bfull\s*-?\s*time\s+result\b/g, '_MATCHWIN_')
    .replace(/\b(full\s*-?\s*time|ft)\s+result\b/g, '_MATCHWIN_')
    // Tennis-specific: normalize "to win" markets
    .replace(/\b(no\s+draw|2-way)\b/g, '_MATCHWIN_')
    .replace(/\bsets\b/g, '')
      .replace(/\b(asian\s+)?handicap\b/g, '_HANDICAP_')
      .replace(/\bspread\b/g, '_HANDICAP_')
      // Normalize over/under carefully to preserve meaning
      .replace(/\bover\s*\/\s*under\b/g, '_OVERUNDER_')
      .replace(/\btotal\s+(goals?|points?|games?)?\s*(over\s*\/\s*under|under|over)\b/g, '_OVERUNDER_')
      .replace(/\btotal\b/g, '_OVERUNDER_')
    // Now normalize individual over/under AFTER the above
    // Keep UNDER and OVER as is, but map both to OVERUNDER for better matching
    .replace(/\bunder\b/g, '_OVERUNDER_')
    .replace(/\bover\b/g, '_OVERUNDER_')
      // Normalize yes/no markets
      .replace(/\b(yes|to\s+score)\b/g, '_YES_')
      .replace(/\b(no|not\s+to\s+score)\b/g, '_NO_')
      // Normalize odd/even
      .replace(/\b(odd|score\s+odd)\b/g, '_ODD_')
      .replace(/\b(even|score\s+even)\b/g, '_EVEN_')
      // Normalize team/player indicators - REMOVE these as they cause mismatches
      .replace(/\b(1st|2nd)\s+(team|player)\b/g, '')
      .replace(/\bhome\s+(team)?\b/g, '_HOME_')
      .replace(/\baway\s+(team)?\b/g, '_AWAY_')
    // Normalize BACK/LAY sides consistently
    .replace(/\s*-?\s*lay\s+(odds|bet)?\s*/g, ' _LAY_ ')
    .replace(/\s*-?\s*back\s+(odds|bet)?\s*/g, ' ')
    .replace(/\bfor\b/g, '')
    .replace(/\bagainst\b/g, '_LAY_')
    // If market is ONLY "Lay" with no other market type, assume it's a match win lay
    .replace(/^_LAY_\s*_NUMS_/g, '_MATCHWIN__LAY__NUMS_')
      // Remove common filler words
      .replace(/\bto\s+win\b/g, '')
      .replace(/\bwith\s+a?\b/g, '')
      .replace(/\bof\b/g, '')
      .replace(/\bor\b/g, '')
      .replace(/\bthe\b/g, '')
      .replace(/\bscored\b/g, '')
      .replace(/\bincluding\s+overtime\b/g, '')
      .replace(/\bregular\s+time\b/g, '')
      .replace(/\bfull\s*time\b/g, '')
      // Remove measurement units
      .replace(/\s+(points?|pts?)\b/g, '')
      .replace(/\s+goals?\b/g, '')
      .replace(/\s+games?\b/g, '')
      .replace(/\s+shots?\b/g, '')
      .replace(/\s+on\s+target\b/g, '')
      .replace(/\s+corners?\b/g, '')
      .replace(/\s+cards?\b/g, '')
      .replace(/\s+score\b/g, '')
      // Remove generic words
      .replace(/\b(winner|result|odds|market)\b/g, '')
      // Remove team suffixes that cause issues
      .replace(/\s+(fc|sc|cf|ac|bc|ii|u21|u23)\b/g, '')
      // Clean up punctuation
      .replace(/[^\w\s_\-]/g, ' ')
      // Normalize multiple spaces and underscores
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .replace(/\s*_\s*/g, '_')
      .trim();
    
    // Build final string - use underscores to prevent token splitting
    let final = `${normalized}_NUMS_${keyNumbers}`.replace(/\s+/g, ' ').trim();
    
    // Post-process: if we only have LAY without a market type, add MATCHWIN
    if (final.includes('_LAY_') && !final.match(/_(?:MATCHWIN|HANDICAP|OVERUNDER|DNB|DOUBLECHANCE)_/)) {
      final = final.replace(/_LAY_/, '_MATCHWIN__LAY_');
    }
    
    return final;
  };
  
  const plEvent = normalizeString(plEntry.event);
  const plMarket = normalizeMarket(plEntry.market, plEntry.event);
  const plSport = normalizeString(plEntry.sport);
  
  console.log(`\n  📍 Checking CSV: "${plEntry.event}"`);
  console.log(`     Normalized: "${plEvent}"`);
  
  for (const bet of allBets) {
    if (bet.status !== 'pending') continue;
    
    const betEvent = normalizeString(bet.event || '');
    const betMarket = normalizeMarket(bet.market || '', bet.event || '');
    const betSport = normalizeString(bet.sport || '');
    
    console.log(`     vs Saved: "${bet.event}" → "${betEvent}" (${plEvent === betEvent ? '✅' : '❌'})`);
    
    // SKIP sport check - CSV files don't have reliable sport data
    // Tennis events are often mislabeled as "Football" in Exchange CSVs
    // Since we're already matching by event name, sport check is redundant
    
    // Check event match - allow some flexibility
    let eventMatches = false;
    
    if (plEvent === betEvent) {
      eventMatches = true;
    } else {
      // Check if events are very similar (e.g., reordered teams or partial names)
      const plEventTokens = plEvent.split(/\s+/).filter(t => t.length > 2);
      const betEventTokens = betEvent.split(/\s+/).filter(t => t.length > 2);
      const commonTokens = plEventTokens.filter(t => betEventTokens.includes(t));
      
      // If most tokens match, consider it an event match
      // Lower threshold to 60% to catch partial team names like "Wild Wings" vs "Schwenninger Wild Wings"
      const matchRatio = commonTokens.length / Math.min(plEventTokens.length, betEventTokens.length);
      if (matchRatio >= 0.6 && commonTokens.length >= 2) {
        eventMatches = true;
        console.log(`🔄 Fuzzy event match (${Math.round(matchRatio * 100)}%): "${plEntry.event}" ≈ "${bet.event}"`);
      }
    }
    
    if (!eventMatches) {
      continue;
    }
    
    // Events match - now check market
    console.log(`\n🔍 Event match found: "${plEntry.event}"`);
    console.log(`   CSV market: "${plEntry.market}" → normalized: "${plMarket}"`);
    console.log(`   Saved market: "${bet.market}" → normalized: "${betMarket}"`);
    
    // Check market match - exact or fuzzy
    if (plMarket === betMarket) {
      console.log(`✅ Exact match!`);
      return bet;
    }
    
    // Fuzzy match - check if markets share key components
    // Since events match, we're more confident about fuzzy market matching
    const similarity = 1 - (levenshteinDistance(plMarket, betMarket) / Math.max(plMarket.length, betMarket.length));
    console.log(`   Similarity: ${Math.round(similarity * 100)}%`);
    
    // More lenient threshold - if events match, accept 50%+ similarity
    if (similarity >= 0.5) {
      console.log(`✅ Fuzzy match accepted!`);
      return bet;
    }
    
    // Even more lenient: check if key tokens overlap
    // Split on both spaces and underscores to get all meaningful tokens
    const plTokens = new Set(plMarket.split(/[\s_]+/).filter(t => t.length > 1 && t !== 'NUMS'));
    const betTokens = new Set(betMarket.split(/[\s_]+/).filter(t => t.length > 1 && t !== 'NUMS'));
    const intersection = new Set([...plTokens].filter(t => betTokens.has(t)));
    const union = new Set([...plTokens, ...betTokens]);
    const tokenSimilarity = intersection.size / union.size;
    
    console.log(`   Token overlap: ${Math.round(tokenSimilarity * 100)}% (${intersection.size}/${union.size} tokens)`);
    console.log(`   Common tokens: [${Array.from(intersection).join(', ')}]`);
    
    // Lower threshold to 30% for token overlap
    if (tokenSimilarity >= 0.3) {
      console.log(`✅ Token match accepted!`);
      return bet;
    }
    
    // Special case: If both have key market identifiers (MATCHWIN, DOUBLECHANCE, DNB, HANDICAP, OVERUNDER)
    // and numbers match, accept even with lower token overlap
    const marketTypes = ['MATCHWIN', 'DOUBLECHANCE', 'DNB', 'HANDICAP', 'OVERUNDER', 'LAY', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4', 'ODD', 'EVEN'];
    const plHasMarketType = marketTypes.some(mt => plTokens.has(mt));
    const betHasMarketType = marketTypes.some(mt => betTokens.has(mt));
    const sharedMarketType = marketTypes.filter(mt => plTokens.has(mt) && betTokens.has(mt));
    
    if (sharedMarketType.length > 0) {
      // Extract numbers from both
      const plNums = new Set([...plTokens].filter(t => /^[\-\d_]+$/.test(t) && t.length > 0));
      const betNums = new Set([...betTokens].filter(t => /^[\-\d_]+$/.test(t) && t.length > 0));
      const sharedNums = [...plNums].filter(n => betNums.has(n));
      
      console.log(`   Shared market types: [${sharedMarketType.join(', ')}]`);
      console.log(`   Shared numbers: [${sharedNums.join(', ')}]`);
      
      // If same market type and numbers match (or no numbers in saved bet), accept
      if (sharedMarketType.length > 0 && (sharedNums.length > 0 || plNums.size === 0)) {
        console.log(`✅ Market type + numbers match accepted!`);
        return bet;
      }
    }
  }
  
  return null;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function showResults(type, message) {
  resultsDiv.className = `results ${type}`;
  resultsDiv.innerHTML = message;
  resultsDiv.style.display = 'block';
  
  // Hide file selection
  selectedFilesDiv.style.display = 'none';
  fileInput.value = '';
  selectedFiles = [];
}
