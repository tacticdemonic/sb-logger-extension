# Bug Report: Unmatched Bets - Code Locations & Fixes

## Critical Issue #1: No Feedback Loop After Auto-Fill ⭐ HIGHEST PRIORITY

### Problem
When auto-fill succeeds, there's no message sent back to the local database to mark bet as "matched". Result: 3 bets won/lost on exchanges but still show as "pending" locally.

### Current Code Flow

**contentScript.js** - Auto-fill logic (around line 2750):
```javascript
// Current: After stake is filled, NO confirmation sent
// Stake gets filled, bet placed on exchange
// But local DB never knows it succeeded
```

**background.js** - Missing handler (lines 545-580):
```javascript
// savePendingBet handler exists
// But NO corresponding handler for "betPlaced" confirmation
// Missing: { action: 'betPlaced', betId, matchedAt, odds, stake }
```

### Fix Required

**Step 1**: Add handler in `background.js` after line 580:
```javascript
if (message.action === 'betPlaced') {
  const { betId, odds, stake, timestamp } = message;
  chrome.storage.local.get('bets', (result) => {
    const bets = result.bets || [];
    const betIndex = bets.findIndex(b => b.id === betId || b.uid === betId);
    if (betIndex >= 0) {
      bets[betIndex].status = 'matched';
      bets[betIndex].matched_at = timestamp;
      bets[betIndex].odds = odds;
      bets[betIndex].stake = stake;
      chrome.storage.local.set({ bets });
      console.log(`✓ Bet ${betId} marked as matched`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Bet not found' });
    }
  });
  return true;
}
```

**Step 2**: Send confirmation from `contentScript.js` after auto-fill succeeds

Find the auto-fill completion logic (search for "attemptAutoFill" or "fillBettingSlipStake") and add:
```javascript
// After successfully filling stake and placing bet:
chrome.runtime.sendMessage({
  action: 'betPlaced',
  betId: betData.id,
  odds: betData.odds,
  stake: betData.stake,
  timestamp: new Date().toISOString()
});
```

**Expected Result**: 
- Sydney Flames, Pelicans Lahti, Deccan Gladiators move from "pending" → "matched"
- Status updates trigger calculations
- Next auto-check skips already-settled bets

---

## Critical Issue #2: Cache Timeout Too Aggressive ⭐ HIGH PRIORITY

### Problem
Service worker cache timeout of 3000ms is too short for slow page loads. When browser restarts or tab takes >3s to respond, cache is lost and falls back to storage, but storage timeout is only 100ms.

### Current Code

**contentScript.js** lines 2570-2580:
```javascript
const timeout = setTimeout(() => {
  reject(new Error('Broker timeout'));
}, 3000);  // ← 3 seconds

chrome.runtime.sendMessage(
  { action: 'consumePendingBet' },
  (response) => {
    clearTimeout(timeout);
    // ...
  }
);
```

**contentScript.js** line 2602:
```javascript
setTimeout(() => {
  chrome.storage.local.get(['pendingBet'], (storageResult) => {
    // ...
  });
}, 100);  // ← 100ms fallback - TOO FAST!
```

### Fix Required

**Change 1**: Increase broker timeout to 5000ms:
```javascript
}, 5000);  // Was 3000ms
```

**Change 2**: Increase storage fallback timeout to 500ms:
```javascript
}, 500);  // Was 100ms
```

**Change 3**: Add diagnostic logging:
```javascript
const brokerStartTime = Date.now();
// ... later ...
console.log(`Surebet Helper: Broker response time: ${Date.now() - brokerStartTime}ms`);
```

**Why**: 
- Smarkets React load takes 400-800ms
- Service worker cold start takes 200-500ms  
- Need minimum 500ms for reliable fallback

---

## Issue #3: Smarkets Selector Mismatch

### Problem
Betting slip selectors for Smarkets may not match current DOM. Multiple failed placements on Smarkets suggest selector failure.

### Current Selectors

**contentScript.js** lines 123-130:
```javascript
smarkets: {
  bettingSlip: [
    '.bet-slip-container',
    '.bet-slip-content',
    '.bet-slip-bets-container'
  ],
  stakeInput: [
    '.bet-slip-container input.box-input.numeric-value.input-value.with-prefix',
    '.bet-slip-container input.box-input.numeric-value.input-value:not([disabled])',
    'input[type="text"].box-input.numeric-value.with-prefix'
  ],
```

### Diagnostic Required

Add this test function in contentScript.js to validate selectors:
```javascript
function debugSmarketsSelectors() {
  console.log('🔍 Smarkets selector debug:');
  
  const selectors = BETTING_SLIP_SELECTORS.smarkets.stakeInput;
  selectors.forEach((selector, i) => {
    const elem = document.querySelector(selector);
    console.log(`  [${i}] "${selector}": ${elem ? '✓ FOUND' : '❌ NOT FOUND'}`);
    if (elem) {
      console.log(`      Value: ${elem.value}, Type: ${elem.type}, Classes: ${elem.className}`);
    }
  });
  
  // Also check betting slip container
  const slip = document.querySelector(BETTING_SLIP_SELECTORS.smarkets.bettingSlip[0]);
  console.log(`Betting slip container: ${slip ? '✓ FOUND' : '❌ NOT FOUND'}`);
}

// Call this when auto-fill fails:
debugSmarketsSelectors();
```

### Fix Strategy

1. Visit smarkets.com with live bet in slip
2. Open DevTools Console
3. Run: `debugSmarketsSelectors()`
4. Note which selector fails
5. Update selectors based on current DOM structure
6. Test with actual auto-fill

---

## Issue #4: No Market Closure Check Before Auto-Fill

### Problem
Auto-fill attempts to fill betting slip even when market is already closed/suspended. Example: Tennis Doubles saved at 13:37 but event ended at 13:28 - 2 minutes earlier.

### Current Code

There's NO check for market status. Auto-fill just tries to fill blindly:
```javascript
// No check like:
// if (marketIsClosed) { skipAutoFill(); return; }
```

### Fix Required

Add market status validation before auto-fill:

**In contentScript.js** (before auto-fill attempt):
```javascript
function isMarketClosed() {
  // Check for common "closed" indicators
  const closedIndicators = [
    document.body.innerText.includes('Market closed'),
    document.body.innerText.includes('Suspended'),
    document.body.innerText.includes('Unavailable'),
    document.querySelector('[aria-label*="closed" i]'),
    document.querySelector('[data-testid*="closed" i]')
  ];
  
  return closedIndicators.some(indicator => 
    indicator === true || indicator !== null
  );
}

// Before attempting auto-fill:
if (isMarketClosed()) {
  console.log('Surebet Helper: Market is closed, skipping auto-fill');
  showToast('❌ Market is closed');
  return;
}
```

---

## Issue #5: Betdaq Selector May Need Update

### Problem
Tennis Doubles bet on Betdaq not placed. Selector may be outdated.

### Current Selectors

**contentScript.js** lines 142-156:
```javascript
betdaq: {
  bettingSlip: [
    '.betslip-container',
    '.betslip3',
    '#betslip',
    '.betslip-common-wrapper'
  ],
  stakeInput: [
    '.back.polarity input.input.stake',
    '.betslip-container input.input.stake',
    '.betslip3 input.input.stake',
    '#betslip input.input.stake',
    'input.input.stake'
  ],
```

### Diagnostic Test

Add to browser console when on Betdaq:
```javascript
// Test each selector
const selectorTests = [
  '.back.polarity input.input.stake',
  '.betslip-container input.input.stake',
  '.betslip3 input.input.stake',
  '#betslip input.input.stake',
  'input.input.stake'
];

selectorTests.forEach((sel, i) => {
  const result = document.querySelector(sel);
  console.log(`[${i}] ${sel}: ${result ? '✓' : '❌'}`);
});
```

If all show ❌, selectors need updating. Visit Betdaq with live bet and inspect the stake input element.

---

## Logging Enhancement for Debugging

Add this to `contentScript.js` to get better diagnostics:

```javascript
// Add to getSurebetDataFromReferrer() success path
console.log('=== BROKER RETRIEVAL SUMMARY ===');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Method used: ${retrievalMethod}`); // 'memory' | 'storage' | 'referrer' | 'frame'
console.log(`Bet ID: ${result?.id}`);
console.log(`Odds: ${result?.odds}`);
console.log(`Stake: ${result?.stake}`);
console.log(`Exchange: ${result?.bookmaker}`);
console.log('==============================');

// Before auto-fill attempt:
console.log('🔄 AUTO-FILL ATTEMPT:');
console.log(`  Target Exchange: ${betData.bookmaker}`);
console.log(`  Bet Amount: £${betData.stake}`);
console.log(`  Odds: ${betData.odds}`);
console.log(`  Time: ${new Date().toISOString()}`);

// After auto-fill completion:
console.log('✅ AUTO-FILL COMPLETE:');
console.log(`  Status: Success|Failed`);
console.log(`  Duration: Xms`);
console.log(`  Input found: Yes|No`);
console.log(`  Value set: ${finalValue}`);
```

---

## Testing Checklist

- [ ] Test Smarkets auto-fill with active betting slip
- [ ] Test Betfair auto-fill with active betting slip
- [ ] Test Matchbook auto-fill with active betting slip
- [ ] Test Betdaq auto-fill with active betting slip
- [ ] Test broker cache timeout (kill background, navigate to exchange)
- [ ] Test storage fallback (disable memory cache, fast page load)
- [ ] Verify feedback loop sends "betPlaced" message
- [ ] Confirm "matched" status updates in local DB after placement
- [ ] Test market closure detection (bet on closed market)

---

## Summary of Changes Needed

| Priority | Issue | File | Lines | Fix Time |
|----------|-------|------|-------|----------|
| 🔴 HIGH | Feedback loop missing | background.js, contentScript.js | 545-580, ~2750 | 30 min |
| 🔴 HIGH | Cache timeout too aggressive | contentScript.js | 2570, 2602 | 10 min |
| 🟡 MED | Smarkets selector validation | contentScript.js | 123-130 | 20 min |
| 🟡 MED | Market closure check | contentScript.js | ~2700 | 15 min |
| 🟡 MED | Betdaq selector test | contentScript.js | 142-156 | 10 min |
| 🟢 LOW | Logging improvements | contentScript.js | Throughout | 20 min |

**Total Fix Time**: ~2 hours for all critical issues
