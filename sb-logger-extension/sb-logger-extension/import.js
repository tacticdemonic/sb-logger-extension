// Import page script - handles CSV and JSON file import from dedicated page
// Browser compatibility polyfill (Firefox uses 'browser', Chrome uses 'chrome')
const browser = typeof window !== 'undefined' && window.browser ? window.browser : 
               (typeof chrome !== 'undefined' ? chrome : null);

if (!browser) {
  console.error('❌ Browser API not available - import will not work');
}

const IMPORT_VERSION = '2.6';
const EXTENSION_VERSION = '1.0.90';
const GITHUB_REPO = 'tacticdemonic/surebet-helper-extension';

// Debug data capture for issue reporting
let lastImportDebug = {
  timestamp: null,
  csvFormat: null,
  csvEntries: [],        // Raw CSV entries
  pendingBets: [],       // Pending bets at time of import
  matchAttempts: [],     // Detailed match attempts with scores
  consoleLogs: [],       // Captured console logs for the import session
  matchedCount: 0,
  unmatchedCount: 0
};

console.log(`📥 Import page loaded v${IMPORT_VERSION} - Debug issue reporting enabled`);

// Helper to capture console logs into debug object
function captureConsole(msg, ...args) {
  try {
    lastImportDebug.consoleLogs = lastImportDebug.consoleLogs || [];
    const entry = {
      ts: new Date().toISOString(),
      msg: typeof msg === 'string' ? msg : (typeof msg === 'object' ? JSON.stringify(msg) : String(msg)),
      args: args
    };
    lastImportDebug.consoleLogs.push(entry);
  } catch (e) {
    // ignore capture errors
  }
  console.log(msg, ...args);
}

const fileInput = document.getElementById('csv-file-input');
const selectedFilesDiv = document.getElementById('selected-files');
const fileList = document.getElementById('file-list');
const importBtn = document.getElementById('import-btn');
const cancelBtn = document.getElementById('cancel-btn');
const resultsDiv = document.getElementById('results');

let selectedFiles = [];

// Detect import type from URL parameter or radio selection
const urlParams = new URLSearchParams(window.location.search);
let currentImportType = urlParams.get('type') || 'csv';

// Handle radio button selection
const radioButtons = document.querySelectorAll('input[name="import-type"]');
radioButtons.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentImportType = e.target.value;
    console.log(`📝 Import type changed to: ${currentImportType}`);
    updateUIForType();
  });
});

function updateUIForType() {
  if (currentImportType === 'json') {
    document.getElementById('page-title').textContent = '📥 Import Saved Bets (JSON)';
    document.getElementById('instructions-title').textContent = 'How to import your saved bets:';
    document.getElementById('instructions-list').innerHTML = `
      <li>Export bets from Surebet Helper (📥 Export JSON button in Analysis tab)</li>
      <li>Select your JSON file containing saved bets</li>
      <li>The extension will merge bets and update any settled results</li>
      <li>Duplicate bets are detected and skipped automatically</li>
    `;
    document.getElementById('file-label').textContent = '📁 Choose JSON File';
    fileInput.accept = '.json';
    fileInput.multiple = false;
  } else {
    document.getElementById('page-title').textContent = '📥 Import Bets';
    document.getElementById('instructions-title').textContent = 'How to import your CSV:';
    document.getElementById('instructions-list').innerHTML = `
      <li>Download your P/L report (CSV format)</li>
      <li>If you have multiple sports, download one CSV per sport</li>
      <li>Click "Choose Files" below and select your CSV file(s)</li>
      <li>The extension will automatically match bets and update their status</li>
    `;
    document.getElementById('file-label').textContent = '📁 Choose CSV File(s)';
    fileInput.accept = '.csv';
    fileInput.multiple = true;
  }
}

// Update UI based on initial import type
updateUIForType();

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
        const fileText = event.target.result;
        console.log(`✅ File loaded, length: ${fileText.length}`);
        
        // Detect file type - either JSON or CSV based on currentImportType or file extension
        const fileExtension = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
        const fileType = currentImportType === 'json' ? 'json' : fileExtension;
        
        if (fileType === 'json') {
          console.log('📋 Processing JSON file...');
          await processImportedJSON(fileText, file.name);
        } else {
          console.log('📋 Processing CSV file...');
          const plData = parseCSV(fileText, file.name);
          console.log(`📊 Parsed ${plData.length} settled bets from CSV`);
          await processImportedData(plData, file.name);
        }
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

// Validate and fix imported bet data (permissive mode)
function validateImportedBet(bet) {
  if (!bet || typeof bet !== 'object') return null;
  
  // Required fields check
  if (!bet.event || !bet.odds || bet.stake === undefined || !bet.bookmaker) {
    console.warn('⚠️ Skipping bet missing required fields:', bet);
    return null;
  }
  
  // Create clean bet object with type coercion
  let overvalueRaw = parseFloat(bet.overvalue) || 0;
  // Convert ratio format (e.g., 1.06) to percentage (e.g., 6) if needed
  const overvalueAsPercentage = overvalueRaw < 2 ? parseFloat(((overvalueRaw - 1) * 100).toFixed(2)) : overvalueRaw;
  
  const cleanBet = {
    ...bet,
    odds: parseFloat(bet.odds) || 1.01,
    stake: parseFloat(bet.stake) || 0,
    probability: parseFloat(bet.probability) || 0,
    overvalue: overvalueAsPercentage,
    isLay: bet.isLay === true || bet.isLay === 'true',
    status: bet.status || 'pending',
    event: String(bet.event).trim(),
    bookmaker: String(bet.bookmaker).trim(),
    sport: String(bet.sport || '').trim(),
    tournament: String(bet.tournament || '').trim(),
    market: String(bet.market || '').trim(),
    note: String(bet.note || '').trim()
  };
  
  // Ensure identity fields for deduplication
  ensureBetIdentity(cleanBet);
  
  return cleanBet;
}

// Ensure bet has uid and timestamp for deduplication
function ensureBetIdentity(bet) {
  if (!bet.uid) {
    // Generate UUID v4
    bet.uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  if (!bet.timestamp) {
    bet.timestamp = Date.now();
  }
}

// Get unique key for bet (uid or composite key)
function getBetKey(bet) {
  return bet.uid || `${bet.id}::${bet.timestamp}`;
}

// Merge imported bets with existing bets (deduplication)
function mergeJsonBets(existingBets, importedBets) {
  const merged = [...existingBets];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  
  importedBets.forEach(importedBet => {
    const cleanBet = validateImportedBet(importedBet);
    if (!cleanBet) {
      skippedCount++;
      return;
    }
    
    const importedKey = getBetKey(cleanBet);
    const existingIndex = merged.findIndex(b => getBetKey(b) === importedKey);
    
    if (existingIndex === -1) {
      // New bet - add it
      merged.push(cleanBet);
      addedCount++;
      console.log(`✅ Added new bet: ${cleanBet.event}`);
    } else {
      // Existing bet - check if we should update
      const existing = merged[existingIndex];
      
      // Update if: imported is settled and existing is pending
      if (cleanBet.status !== 'pending' && existing.status === 'pending') {
        merged[existingIndex] = {
          ...existing,
          ...cleanBet,
          timestamp: existing.timestamp // Preserve original timestamp
        };
        updatedCount++;
        console.log(`🔄 Updated pending bet with settlement: ${cleanBet.event} - Status: ${cleanBet.status}`);
      } else {
        skippedCount++;
        console.log(`⏭️ Skipped duplicate bet: ${cleanBet.event}`);
      }
    }
  });
  
  return { merged, addedCount, updatedCount, skippedCount };
}

// Process imported JSON file
async function processImportedJSON(jsonText, filename) {
  console.log(`📁 Processing JSON file: ${filename}`);
  
  try {
    let importData = JSON.parse(jsonText);
    
    // Handle both new export format {bets: [], analysis: {}} and legacy flat array
    let betsArray = [];
    if (Array.isArray(importData)) {
      // Legacy flat array format
      betsArray = importData;
      console.log('📋 Detected legacy flat array format');
    } else if (importData && Array.isArray(importData.bets)) {
      // New export format with analysis
      betsArray = importData.bets;
      console.log('📋 Detected new export format with analysis');
    } else {
      throw new Error('Invalid JSON structure: must contain array of bets or {bets: [...]}');
    }
    
    if (!Array.isArray(betsArray) || betsArray.length === 0) {
      throw new Error('JSON file contains no bets');
    }
    
    console.log(`📊 Processing ${betsArray.length} bets from import file`);
    
    // Get existing bets from storage
    const result = await browser.storage.local.get('bets');
    const existingBets = result.bets || [];
    console.log(`📦 Current storage has ${existingBets.length} bets`);
    
    // Merge with deduplication
    const { merged, addedCount, updatedCount, skippedCount } = mergeJsonBets(existingBets, betsArray);
    
    console.log(`✅ Import complete: Added ${addedCount}, Updated ${updatedCount}, Skipped ${skippedCount}`);
    
    // Write merged bets to storage
    await browser.storage.local.set({ bets: merged });
    console.log('💾 Merged bets saved to storage');
    
    // Trigger bankroll recalculation
    try {
      await browser.runtime.sendMessage({ action: 'recalculateBankroll' });
    } catch (err) {
      console.warn('⚠️ Unable to trigger bankroll recalc:', err?.message || err);
    }
    
    // Show success message
    let message = `✅ Import successful!<br><br><strong>${addedCount}</strong> new bets added`;
    if (updatedCount > 0) {
      message += `<br><strong>${updatedCount}</strong> settled bets updated`;
    }
    if (skippedCount > 0) {
      message += `<br><strong>${skippedCount}</strong> duplicates skipped`;
    }
    
    showResults(
      'success',
      message
    );
    
    console.log(`📥 JSON import completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`);
  } catch (error) {
    console.error('❌ JSON import error:', error);
    throw error;
  }
}

async function processImportedData(plData, source) {
  captureConsole(`🔍 Processing ${plData.length} P/L entries from ${source}`);
  captureConsole(`📋 P/L entries to process: ${plData.map(e => `${e.event} | ${e.market} | ${e.profitLoss}`).join(' || ')}`);
  
  // Reset debug data for this import session
  lastImportDebug = {
    timestamp: new Date().toISOString(),
    csvFormat: detectCSVFormat(source),
    csvEntries: plData.map(e => ({
      event: e.event,
      market: e.market,
      sport: e.sport,
      profitLoss: e.profitLoss,
      isVoided: e.isVoided || false
    })),
    pendingBets: [],
    consoleLogs: [],
    matchAttempts: [],
    matchedCount: 0,
    unmatchedCount: 0
  };
  
  // Get all pending bets from storage
  captureConsole('🔍 Attempting to read bets from storage...');
  captureConsole('🔍 Browser API available: ' + (!!browser));
  captureConsole('🔍 Browser storage available: ' + (!!(browser && browser.storage)));
  
  let result;
  try {
    result = await browser.storage.local.get('bets');
    captureConsole('🔍 Storage read successful, result: ' + JSON.stringify(result));
    captureConsole('🔍 Result has bets key: ' + ('bets' in result));
    captureConsole('🔍 Bets array length: ' + (result.bets ? result.bets.length : 'undefined/null'));
  } catch (err) {
    console.error('❌ Storage read failed:', err);
    result = { bets: [] };
  }
  
  const allBets = result.bets || [];
  const pendingBets = allBets.filter(bet => bet.status === 'pending');
  
  // Capture pending bets for debug
  lastImportDebug.pendingBets = pendingBets.map(b => ({
    event: b.event,
    market: b.market,
    sport: b.sport,
    bookmaker: b.bookmaker,
    stake: b.stake,
    odds: b.odds
  }));
  
  captureConsole(`📊 Found ${pendingBets.length} pending bets to match against ${plData.length} P/L entries`);
  captureConsole('📋 Pending bets: ' + pendingBets.map(b => `${b.event} | ${b.market} | ${b.bookmaker} | status=${b.status}`).join(' || '));
  
  let matchedCount = 0;
  let updatedBets = [...allBets];
  
  for (const plEntry of plData) {
    const matchResult = matchBetWithPLDebug(plEntry, updatedBets);
    
    // Capture match attempt for debug
    lastImportDebug.matchAttempts.push(matchResult.debugInfo);
    
    if (matchResult.match) {
      const betIndex = updatedBets.findIndex(b => b.id === matchResult.match.id);
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
        captureConsole(`✅ Matched: ${matchResult.match.event} - ${newStatus} (${plEntry.profitLoss})`);
      }
    } else {
      captureConsole(`❌ No match found for: "${plEntry.event}" - "${plEntry.market}"`);
    }
  }
  
  // Update debug stats
  lastImportDebug.matchedCount = matchedCount;
  lastImportDebug.unmatchedCount = plData.length - matchedCount;
  
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
  
  captureConsole(`✅ Import complete: ${matchedCount} bets updated`);
  captureConsole('🐛 Debug data captured: ' + JSON.stringify(lastImportDebug));
  
  showResults(
    'success',
    `✅ Import Complete!<br><br>` +
    `<strong>${matchedCount}</strong> bet(s) matched and updated<br>` +
    `${plData.length - matchedCount} entries had no matching bet`
  );
  
  // Show report issue button
  showReportIssueButton();
}

// Detect CSV format from filename/source
function detectCSVFormat(source) {
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('smarkets')) return 'Smarkets';
  if (sourceLower.includes('betfair')) return 'Betfair';
  if (sourceLower.includes('exchange')) return 'Betfair Exchange';
  return 'Unknown';
}

function matchBetWithPL(plEntry, allBets) {
  return matchBetWithPLDebug(plEntry, allBets).match;
}

// Enhanced matching function that returns debug info
function matchBetWithPLDebug(plEntry, allBets) {
  const normalizeString = (str) => {
    return str.toLowerCase()
      // Normalize team name translations/localizations (Serbian, German, etc.)
      .replace(/crvena zvezda/g, 'red star belgrade')
      .replace(/roter stern belgrad/g, 'red star belgrade')
      .replace(/rode ster belgrado/g, 'red star belgrade')
      .replace(/partizan beograd/g, 'partizan belgrade')
      .replace(/fk crvena zvezda/g, 'red star belgrade')
      .replace(/dinamo zagreb/g, 'dinamo zagreb')
      .replace(/gnk dinamo zagreb/g, 'dinamo zagreb')
      .replace(/hajduk split/g, 'hajduk split')
      .replace(/hnk hajduk split/g, 'hajduk split')
      // Turkish team names
      .replace(/fenerbahçe/g, 'fenerbahce')
      .replace(/galatasaray/g, 'galatasaray')
      .replace(/beşiktaş/g, 'besiktas')
      .replace(/trabzonspor/g, 'trabzonspor')
      // Hungarian team names
      .replace(/ferencvárosi/g, 'ferencvaros')
      .replace(/ferencvarosi/g, 'ferencvaros')
      // Normalize Greek transliterations
      .replace(/olympiakos/g, 'olympiacos')
      .replace(/olympiacos/g, 'olympiacos')  // Ensure consistent spelling
      .replace(/panathinaikos/g, 'panathinaikos')
      .replace(/piräus/g, 'piraeus')
      .replace(/piraus/g, 'piraeus')
      // German team names
      .replace(/sk puntigamer sturm graz/g, 'sturm graz')
      .replace(/sk sturm graz/g, 'sturm graz')
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
  
  /**
   * normalizeMarket - Converts market strings to standardized tokens for matching
   * 
   * ⚠️  CRITICAL: BACKWARDS COMPATIBILITY CONSTRAINT ⚠️
   * 
   * This function is used to match BOTH:
   *   1. CSV entries from betting exchanges (Smarkets, Betfair)
   *   2. Saved pending bets already stored in user's extension data
   * 
   * The saved bets have ALREADY been normalized with this logic. If you change
   * how normalization works, OLD bets will no longer match NEW CSV imports.
   * 
   * DO NOT modify existing normalization rules. Instead:
   *   - ADD new patterns that produce the SAME tokens as existing rules
   *   - ADD new rules that convert NEW formats to EXISTING tokens
   *   - Example: If CSV has "Moneyline" and saved bet has "to win", add a rule
   *     to detect "to win" EARLIER and convert it to _MATCHWIN_ like Moneyline does
   * 
   * Test any changes against ALL supported CSV formats before merging.
   */
  const normalizeMarket = (str, eventName = '') => {
    captureConsole(`    🔧 normalizeMarket v2.3 called: "${str}" (event: "${eventName}")`);
    
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
      // Smarkets handicap format: "Team +0.5 / Team -0.5" - detect and normalize BEFORE removing slashes
      .replace(/[\+\-]?\d+\.?\d*\s*\/\s*[\+\-]?\d+\.?\d*/g, '_HANDICAP_')
      // FIX: Convert market types BEFORE slash removal (see CSV_IMPORT_DEBUGGING_GUIDE.md)
      .replace(/\bdraw\s+no\s+bet\b/gi, '_DNB_')
      .replace(/\bto\s+win\b/gi, '_MATCHWIN_')
      // Remove everything after first slash ONLY if not already processed as handicap
      .replace(/\s+\/\s+[^_].*$/g, '')
      // Remove "participant" keyword before player names
      .replace(/\bparticipant\b/g, '')
      // Remove "Regular time" prefix from Smarkets markets
      .replace(/\bregular\s+time\b/g, '')
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
    // NOTE: "draw no bet" is now converted earlier (before slash removal) - this catches any remaining instances
    .replace(/\bdraw\s+no\s+bet\b/g, '_DNB_')
    .replace(/\bmatch\s+odds\b/g, '_MATCHWIN_')
    .replace(/\bmoneyline\b/g, '_MATCHWIN_')
    // Tournament/Cup winner markets - "To Lift The Cup", "To Lift Trophy", etc.
    .replace(/\bto\s+lift\s+(?:the\s+)?(?:cup|trophy|title)\b/g, '_OUTRIGHTWIN_')
    .replace(/\b(?:tournament|cup|outright)\s+winner\b/g, '_OUTRIGHTWIN_')
    .replace(/\b(?:match\s+)?winner\b/g, '_MATCHWIN_')
    .replace(/\bfull\s*-?\s*time\s+result\b/g, '_MATCHWIN_')
    .replace(/\b(full\s*-?\s*time|ft)\s+result\b/g, '_MATCHWIN_')
    // Tennis-specific: normalize "to win" markets
    .replace(/\b(no\s+draw|2-way)\b/g, '_MATCHWIN_')
    .replace(/\bsets\b/g, '')
      // Normalize ALL handicap variations to single token
      .replace(/\b(asian\s+)?handicap\b/g, '_HANDICAP_')
      .replace(/\bspread\b/g, '_HANDICAP_')
      // Smarkets uses "+X.X / -X.X" format for Asian handicaps
      .replace(/[\+\-][\d\.]+\s*\/\s*[\+\-][\d\.]+/g, '_HANDICAP_')
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
      // NOTE: "to win" is now converted to _MATCHWIN_ earlier (before slash removal) - this only catches non-slash instances
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
    if (final.includes('_LAY_') && !final.match(/_(?:MATCHWIN|HANDICAP|OVERUNDER|DNB|DOUBLECHANCE|OUTRIGHTWIN)_/)) {
      final = final.replace(/_LAY_/, '_MATCHWIN__LAY_');
    }
    
    return final;
  };
  
  const plEvent = normalizeString(plEntry.event);
  const plMarket = normalizeMarket(plEntry.market, plEntry.event);
  const plSport = normalizeString(plEntry.sport);
  
  // Debug info object to capture match attempts
  const debugInfo = {
    csvEntry: {
      event: plEntry.event,
      eventNormalized: plEvent,
      market: plEntry.market,
      marketNormalized: plMarket,
      profitLoss: plEntry.profitLoss
    },
    candidates: [],
    matched: false,
    matchedBet: null,
    matchReason: null
  };
  
  captureConsole(`\n  📍 Checking CSV: "${plEntry.event}"`);
  captureConsole(`     Normalized: "${plEvent}"`);
  
  for (const bet of allBets) {
    if (bet.status !== 'pending') continue;
    
    const betEvent = normalizeString(bet.event || '');
    const betMarket = normalizeMarket(bet.market || '', bet.event || '');
    const betSport = normalizeString(bet.sport || '');
    
    captureConsole(`     vs Saved: "${bet.event}" → "${betEvent}" (${plEvent === betEvent ? '✅' : '❌'})`);
    
    // SKIP sport check - CSV files don't have reliable sport data
    // Tennis events are often mislabeled as "Football" in Exchange CSVs
    // Since we're already matching by event name, sport check is redundant
    
    // Check event match - allow some flexibility
    let eventMatches = false;
    let eventMatchRatio = 0;
    
    if (plEvent === betEvent) {
      eventMatches = true;
      eventMatchRatio = 1.0;
    } else {
      // Check if events are very similar (e.g., reordered teams or partial names)
      const plEventTokens = plEvent.split(/\s+/).filter(t => t.length > 2);
      const betEventTokens = betEvent.split(/\s+/).filter(t => t.length > 2);
      const commonTokens = plEventTokens.filter(t => betEventTokens.includes(t));
      
      // If most tokens match, consider it an event match
      // Lower threshold to 60% to catch partial team names like "Wild Wings" vs "Schwenninger Wild Wings"
      eventMatchRatio = commonTokens.length / Math.min(plEventTokens.length, betEventTokens.length);
      if (eventMatchRatio >= 0.6 && commonTokens.length >= 2) {
        eventMatches = true;
        captureConsole(`🔄 Fuzzy event match (${Math.round(eventMatchRatio * 100)}%): "${plEntry.event}" ≈ "${bet.event}"`);
      }
    }
    
    if (!eventMatches) {
      continue;
    }
    
    // Events match - now check market
    captureConsole(`\n🔍 Event match found: "${plEntry.event}"`);
    captureConsole(`   CSV market: "${plEntry.market}" → normalized: "${plMarket}"`);
    captureConsole(`   Saved market: "${bet.market}" → normalized: "${betMarket}"`);
    
    // Calculate all similarity scores
    const levenSimilarity = 1 - (levenshteinDistance(plMarket, betMarket) / Math.max(plMarket.length, betMarket.length));
    
    const plTokens = new Set(plMarket.split(/[\s_]+/).filter(t => t.length > 1 && t !== 'NUMS'));
    const betTokens = new Set(betMarket.split(/[\s_]+/).filter(t => t.length > 1 && t !== 'NUMS'));
    const intersection = new Set([...plTokens].filter(t => betTokens.has(t)));
    const union = new Set([...plTokens, ...betTokens]);
    const tokenSimilarity = intersection.size / union.size;
    
    const marketTypes = ['MATCHWIN', 'DOUBLECHANCE', 'DNB', 'HANDICAP', 'OVERUNDER', 'LAY', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4', 'ODD', 'EVEN', 'OUTRIGHTWIN'];
    const sharedMarketType = marketTypes.filter(mt => plTokens.has(mt) && betTokens.has(mt));
    
    const plNums = new Set([...plTokens].filter(t => /^[\-\d_]+$/.test(t) && t.length > 0));
    const betNums = new Set([...betTokens].filter(t => /^[\-\d_]+$/.test(t) && t.length > 0));
    const sharedNums = [...plNums].filter(n => betNums.has(n));
    
    // Add candidate to debug info
    const candidate = {
      bet: { event: bet.event, market: bet.market, bookmaker: bet.bookmaker },
      betNormalized: { event: betEvent, market: betMarket },
      eventMatchRatio: Math.round(eventMatchRatio * 100),
      levenshteinSimilarity: Math.round(levenSimilarity * 100),
      tokenSimilarity: Math.round(tokenSimilarity * 100),
      commonTokens: Array.from(intersection),
      sharedMarketTypes: sharedMarketType,
      sharedNumbers: sharedNums,
      matched: false,
      matchReason: null
    };
    
    // Check market match - exact or fuzzy
    if (plMarket === betMarket) {
      console.log(`✅ Exact match!`);
      candidate.matched = true;
      candidate.matchReason = 'exact_match';
      debugInfo.candidates.push(candidate);
      debugInfo.matched = true;
      debugInfo.matchedBet = bet;
      debugInfo.matchReason = 'exact_match';
      return { match: bet, debugInfo };
    }
    
    captureConsole(`   Similarity: ${Math.round(levenSimilarity * 100)}%`);
    
    // More lenient threshold - if events match, accept 50%+ similarity
    if (levenSimilarity >= 0.5) {
      captureConsole(`✅ Fuzzy match accepted!`);
      candidate.matched = true;
      candidate.matchReason = 'levenshtein_50pct';
      debugInfo.candidates.push(candidate);
      debugInfo.matched = true;
      debugInfo.matchedBet = bet;
      debugInfo.matchReason = 'levenshtein_50pct';
      return { match: bet, debugInfo };
    }
    
    captureConsole(`   Token overlap: ${Math.round(tokenSimilarity * 100)}% (${intersection.size}/${union.size} tokens)`);
    captureConsole(`   Common tokens: [${Array.from(intersection).join(', ')}]`);
    
    // Lower threshold to 30% for token overlap
    if (tokenSimilarity >= 0.3) {
      captureConsole(`✅ Token match accepted!`);
      candidate.matched = true;
      candidate.matchReason = 'token_overlap_30pct';
      debugInfo.candidates.push(candidate);
      debugInfo.matched = true;
      debugInfo.matchedBet = bet;
      debugInfo.matchReason = 'token_overlap_30pct';
      return { match: bet, debugInfo };
    }
    
    // Special case: If both have key market identifiers and numbers match
    if (sharedMarketType.length > 0) {
      captureConsole(`   Shared market types: [${sharedMarketType.join(', ')}]`);
      captureConsole(`   Shared numbers: [${sharedNums.join(', ')}]`);
      
      // If same market type and numbers match (or no numbers in saved bet), accept
      if (sharedMarketType.length > 0 && (sharedNums.length > 0 || plNums.size === 0)) {
        captureConsole(`✅ Market type + numbers match accepted!`);
        candidate.matched = true;
        candidate.matchReason = 'market_type_numbers';
        debugInfo.candidates.push(candidate);
        debugInfo.matched = true;
        debugInfo.matchedBet = bet;
        debugInfo.matchReason = 'market_type_numbers';
        return { match: bet, debugInfo };
      }
    }
    
    // No match - record candidate anyway for debug
    debugInfo.candidates.push(candidate);
  }
  
  return { match: null, debugInfo };
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
  resultsDiv.innerHTML = '';
  if (type === 'error') {
    resultsDiv.textContent = message;
  } else {
    const content = document.createElement('div');
    content.innerHTML = message.replace(/onclick="[^"]*"/g, '');
    resultsDiv.appendChild(content);
  }
  resultsDiv.style.display = 'block';
  
  // Hide file selection
  selectedFilesDiv.style.display = 'none';
  fileInput.value = '';
  selectedFiles = [];
}

// ============================================================================
// Report Issue Feature - GitHub Issue with Debug Data
// ============================================================================

// Show the report issue button after import
function showReportIssueButton() {
  const container = document.getElementById('report-issue-container');
  if (container) {
    container.style.display = 'block';
  }
}

// Initialize report issue button handlers
document.addEventListener('DOMContentLoaded', () => {
  const reportBtn = document.getElementById('report-issue-btn');
  const privacyModal = document.getElementById('privacy-modal');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');
  
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      // Show privacy warning modal
      if (privacyModal) {
        privacyModal.classList.add('active');
      }
    });
  }
  
  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      privacyModal.classList.remove('active');
    });
  }
  
  if (modalConfirm) {
    modalConfirm.addEventListener('click', () => {
      privacyModal.classList.remove('active');
      openGitHubIssue();
    });
  }
  
  // Close modal on overlay click
  if (privacyModal) {
    privacyModal.addEventListener('click', (e) => {
      if (e.target === privacyModal) {
        privacyModal.classList.remove('active');
      }
    });
  }
});

// Build the debug report markdown
function buildDebugReport() {
  const debug = lastImportDebug;
  
  // Get unmatched entries only
  const unmatchedAttempts = debug.matchAttempts.filter(a => !a.matched);
  
  // Truncate for URL (max 10 entries each)
  const maxEntries = 10;
  const truncatedUnmatched = unmatchedAttempts.slice(0, maxEntries);
  const truncatedPending = debug.pendingBets.slice(0, maxEntries);
  
  let report = `## CSV Import Match Failure Report\n\n`;
  report += `> 📖 **For contributors:** See [CSV_IMPORT_DEBUGGING_GUIDE.md](https://github.com/${GITHUB_REPO}/blob/master/sb-logger-extension/CSV_IMPORT_DEBUGGING_GUIDE.md) for debugging instructions.\n\n`;
  report += `**Extension Version:** ${EXTENSION_VERSION}\n`;
  report += `**Import Version:** ${IMPORT_VERSION}\n`;
  report += `**CSV Format Detected:** ${debug.csvFormat || 'Unknown'}\n`;
  report += `**Timestamp:** ${debug.timestamp}\n\n`;
  
  report += `### Summary\n`;
  report += `- **Matched:** ${debug.matchedCount}\n`;
  report += `- **Unmatched:** ${debug.unmatchedCount}\n`;
  report += `- **Total CSV Entries:** ${debug.csvEntries.length}\n`;
  report += `- **Pending Bets Available:** ${debug.pendingBets.length}\n\n`;
  
  // Unmatched CSV Entries
  report += `### Unmatched CSV Entries`;
  if (unmatchedAttempts.length > maxEntries) {
    report += ` (showing ${maxEntries} of ${unmatchedAttempts.length})`;
  }
  report += `\n\n`;
  
  if (truncatedUnmatched.length === 0) {
    report += `_All entries matched successfully!_\n\n`;
  } else {
    report += `| Event | Market | P/L |\n`;
    report += `|-------|--------|-----|\n`;
    for (const attempt of truncatedUnmatched) {
      const csv = attempt.csvEntry;
      report += `| ${escapeMarkdown(csv.event)} | ${escapeMarkdown(csv.market)} | ${csv.profitLoss} |\n`;
    }
    report += `\n`;
  }
  
  // Pending Bets
  report += `### Pending Bets Available`;
  if (debug.pendingBets.length > maxEntries) {
    report += ` (showing ${maxEntries} of ${debug.pendingBets.length})`;
  }
  report += `\n\n`;
  
  if (truncatedPending.length === 0) {
    report += `_No pending bets in storage_\n\n`;
  } else {
    report += `| Event | Market | Bookmaker |\n`;
    report += `|-------|--------|----------|\n`;
    for (const bet of truncatedPending) {
      report += `| ${escapeMarkdown(bet.event)} | ${escapeMarkdown(bet.market)} | ${escapeMarkdown(bet.bookmaker)} |\n`;
    }
    report += `\n`;
  }
  
  // Normalization Examples (first unmatched)
  if (truncatedUnmatched.length > 0) {
    report += `### Normalization Debug (First Unmatched)\n\n`;
    const first = truncatedUnmatched[0];
    report += `**CSV Entry:**\n`;
    report += `- Raw Event: \`${first.csvEntry.event}\`\n`;
    report += `- Normalized: \`${first.csvEntry.eventNormalized}\`\n`;
    report += `- Raw Market: \`${first.csvEntry.market}\`\n`;
    report += `- Normalized: \`${first.csvEntry.marketNormalized}\`\n\n`;
    
    if (first.candidates && first.candidates.length > 0) {
      report += `**Best Candidate:**\n`;
      const best = first.candidates[0];
      report += `- Event: \`${best.bet.event}\` → \`${best.betNormalized.event}\`\n`;
      report += `- Market: \`${best.bet.market}\` → \`${best.betNormalized.market}\`\n`;
      report += `- Event Match: ${best.eventMatchRatio}%\n`;
      report += `- Levenshtein: ${best.levenshteinSimilarity}%\n`;
      report += `- Token Overlap: ${best.tokenSimilarity}%\n`;
      report += `- Common Tokens: [${best.commonTokens.join(', ')}]\n`;
      report += `- Shared Market Types: [${best.sharedMarketTypes.join(', ')}]\n\n`;
    }
  }
  
  // Detailed Match Attempt Log (console-style)
  report += `### Match Attempt Log\n\n`;
  report += `<details>\n<summary>Click to expand detailed matching log (first 5 unmatched)</summary>\n\n`;
  report += `\`\`\`\n`;
  
  const logEntries = truncatedUnmatched.slice(0, 5);
  for (const attempt of logEntries) {
    const csv = attempt.csvEntry;
    report += `📍 CSV Entry: "${csv.event}"\n`;
    report += `   Normalized Event: "${csv.eventNormalized}"\n`;
    report += `   Market: "${csv.market}"\n`;
    report += `   Normalized Market: "${csv.marketNormalized}"\n`;
    report += `   P/L: ${csv.profitLoss}\n\n`;
    
    if (attempt.candidates && attempt.candidates.length > 0) {
      report += `   Candidates checked:\n`;
      for (const cand of attempt.candidates.slice(0, 3)) {
        const eventMatch = cand.eventMatchRatio >= 60 ? '✅' : '❌';
        report += `   ${eventMatch} "${cand.bet.event}" → "${cand.betNormalized.event}"\n`;
        report += `      Market: "${cand.bet.market}" → "${cand.betNormalized.market}"\n`;
        report += `      Event Match: ${cand.eventMatchRatio}% | Levenshtein: ${cand.levenshteinSimilarity}% | Token: ${cand.tokenSimilarity}%\n`;
        report += `      Common tokens: [${cand.commonTokens.join(', ')}]\n`;
        report += `      Shared types: [${cand.sharedMarketTypes.join(', ')}] | Numbers: [${cand.sharedNumbers.join(', ')}]\n\n`;
      }
    } else {
      report += `   No event matches found among pending bets\n\n`;
    }
    report += `---\n`;
  }
  
  report += `\`\`\`\n\n`;
  report += `</details>\n\n`;

  // Captured console logs (first 50 entries)
  report += `### Captured Console Logs\n\n`;
  report += `<details>\n<summary>Captured console output (first 50 lines)</summary>\n\n`;
  report += `\`\`\`\n`;
  const consoleLogs = (debug.consoleLogs || []).slice(0, 50);
  for (const entry of consoleLogs) {
    const ts = entry.ts || '';
    const msg = typeof entry.msg === 'string' ? entry.msg : JSON.stringify(entry.msg);
    report += `${ts} ${msg}\n`;
  }
  report += `\`\`\`\n\n`;
  report += `</details>\n\n`;
  
  // Full JSON placeholder
  report += `### Full Debug JSON\n\n`;
  report += `<details>\n<summary>Click to expand (paste from clipboard if truncated)</summary>\n\n`;
  report += `\`\`\`json\n`;
  report += `PASTE_FULL_JSON_HERE\n`;
  report += `\`\`\`\n\n`;
  report += `</details>\n`;
  
  return report;
}

// Escape special markdown characters
function escapeMarkdown(str) {
  if (!str) return '';
  return str
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .substring(0, 100); // Truncate long strings
}

// Show toast notification
function showToast(message, duration = 4000) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

// Open GitHub issue with debug data
async function openGitHubIssue() {
  console.log('🐛 Building debug report for GitHub issue...');
  
  // Build the full debug JSON
  const fullDebugJson = JSON.stringify(lastImportDebug, null, 2);
  
  // Copy full JSON to clipboard first
  const copied = await copyToClipboard(fullDebugJson);
  if (copied) {
    showToast('📋 Full debug data copied to clipboard - paste into issue if needed', 5000);
  }
  
  // Build markdown report
  const report = buildDebugReport();
  
  // Build issue title
  const title = `CSV Import: ${lastImportDebug.unmatchedCount} unmatched entries (${lastImportDebug.csvFormat || 'Unknown'} format)`;
  
  // Build issue URL
  const baseUrl = `https://github.com/${GITHUB_REPO}/issues/new`;
  const params = new URLSearchParams({
    title: title,
    body: report,
    labels: 'bug,csv-import'
  });
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  
  // Check URL length - GitHub has ~8KB limit
  if (fullUrl.length > 8000) {
    console.warn('⚠️ URL too long, opening with truncated body');
    // Create truncated version
    const truncatedReport = report.substring(0, 6000) + '\n\n---\n_Report truncated. Please paste full debug JSON from clipboard._';
    const truncatedParams = new URLSearchParams({
      title: title,
      body: truncatedReport,
      labels: 'bug,csv-import'
    });
    window.open(`${baseUrl}?${truncatedParams.toString()}`, '_blank');
  } else {
    window.open(fullUrl, '_blank');
  }
  
  console.log('✅ GitHub issue page opened');
}

