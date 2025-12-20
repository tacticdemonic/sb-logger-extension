# Unmatched Bets - Quick Summary

## The Bottom Line

**14 pending bets = 7 future events + 3 successful wins (not synced) + 4 placement failures**

---

## The 3 Confirmed Wins (Not Updated Locally)

✅ **Bets that WON on exchange but show as PENDING in app**:

1. **Sydney Flames vs Geelong Supercats** (Smarkets)
   - Placed: £1.50 @ 2.16
   - **Result: WON £1.74** ✓
   - Local status: Still "pending" ❌

2. **Pelicans Lahti vs JYP Jyvaskyla** (Smarkets)
   - Placed: £2.00 @ 2.54
   - **Result: WON £3.08** ✓
   - Local status: Still "pending" ❌

3. **Deccan Gladiators vs Aspin Stallions** (Matchbook)
   - Placed: £10.00 @ 1.50
   - **Result: LOST £10.00** ❌
   - Local status: Still "pending" ❌

**Why?** After auto-fill succeeds, **NO message is sent back to update the local database**.

---

## The 4 Failed Placements

❌ **Bets that were saved but never placed**:

1. **Cologne Haie vs Adler Mannheim** (Smarkets) - Selector failed or cache lost
2. **Strong Kirchheimer vs Daniel Dutra Da Silva** (Smarkets) - Selector mismatch
3. **Tennis Doubles** (Betdaq) - Market closed (event ended before placement)
4. **Slovakian Cup** (Betfair) - Selector mismatch or timeout

---

## The 7 Future Events

⏳ **Bets saved but events haven't happened yet** (Expected):

- FC Viktoria Plzen vs SC Freiburg (Nov 27, 17:45)
- Gandzasar Kapan vs BKMA Yerevan (Nov 28, 11:00)
- Rangers vs Braga (Nov 27, 20:00)
- PAOK vs Brann (Nov 27, 17:45)
- Lille OSC vs Dinamo Zagreb (Nov 27, 17:45)
- Genk vs Basel (Nov 27, 20:00)
- Red Star Belgrade vs FC FCSB (Nov 27, 20:00)

---

## Root Causes Identified

### 🔴 Critical: No Feedback Loop
- **Problem**: After auto-fill places bet, no confirmation sent back
- **Impact**: 3 successful bets not synced (£1.74 + £3.08 - £10.00 = -£5.18 net)
- **Fix**: Send `betPlaced` message after stake is filled
- **Time**: 30 minutes

### 🔴 Critical: Cache Timeout Too Aggressive
- **Problem**: Broker cache timeout = 3 seconds, storage fallback = 100ms
- **Impact**: If page takes >3s to load, bet data lost
- **Fix**: Increase both timeouts (5s and 500ms)
- **Time**: 10 minutes

### 🟡 Medium: Selector Mismatches
- **Problem**: Exchange DOM structures change; selectors become outdated
- **Impact**: 3-4 bets can't find stake input fields
- **Fix**: Validate and update selectors for each exchange
- **Time**: 30 minutes

### 🟡 Medium: No Market Closure Check
- **Problem**: Auto-fill attempts even when market is closed
- **Impact**: Race conditions, failed placements
- **Fix**: Check for "Closed" status before attempting auto-fill
- **Time**: 15 minutes

---

## What Happened with Each Bet

### Sydney Flames (Smarkets) ✓ WON
```
1. Saved from surebet.com: Nov 24, 19:12
2. Auto-fill worked: Stake filled (£1.5)
3. Bet placed on Smarkets: ✓
4. Event settled: Nov 26, 17:37
5. Result: WON £1.74
6. BUT: Local DB still shows "pending"
→ FIX: Send feedback message after step 3
```

### Pelicans Lahti (Smarkets) ✓ WON
```
Same issue - successful placement but no sync back to local DB
```

### Deccan Gladiators (Matchbook) ❌ LOST
```
Same issue - bet was placed and lost, but local DB never knew
```

### Cologne Haie (Smarkets) ❌ NOT PLACED
```
1. Saved from surebet.com: Nov 24, 12:34
2. Auto-fill attempted: ❌
3. Selector didn't find stake input
4. OR: Cache lost during navigation
5. Result: Never placed
→ FIX: Update Smarkets selector or increase cache timeout
```

### Kirchheimer (Smarkets) ❌ NOT PLACED
```
1. Saved: Nov 25, 11:15
2. Auto-fill attempted: ❌
3. Selector mismatch (Smarkets DOM changed)
4. Result: Never placed
→ FIX: Update Smarkets selector
```

### Tennis Doubles (Betdaq) ❌ NOT PLACED
```
1. Saved: Nov 26, 13:37 (event started 13:28!)
2. Auto-fill attempted: ❌
3. Market was already closed
4. Result: No betting slip available
→ FIX: Check market status before placing
```

### Slovakian Cup (Betfair) ❌ NOT PLACED
```
1. Saved: Nov 26, 13:33
2. Auto-fill attempted: ❌
3. Betfair selector didn't find stake input
4. Result: Never placed
→ FIX: Update Betfair selector
```

---

## Implementation Roadmap

### Phase 1: Critical Fixes (1 hour)
- [ ] Add `betPlaced` handler in background.js
- [ ] Send confirmation from contentScript after auto-fill
- [ ] Increase timeouts (3s→5s, 100ms→500ms)

### Phase 2: Validation (1 hour)
- [ ] Test Smarkets selector, update if needed
- [ ] Test Betfair selector, update if needed
- [ ] Add market closure detection
- [ ] Test all exchanges with live bets

### Phase 3: Monitoring (ongoing)
- [ ] Track placement failures in logs
- [ ] Alert when bets not synced after 1 hour
- [ ] Auto-reconcile with exchange exports (weekly)

---

## Testing the Fixes

### Test 1: Feedback Loop
```
1. Place a test bet manually on Smarkets
2. Fill stake (£5.00 @ 2.0)
3. Check DevTools: Should see "betPlaced" message
4. Refresh popup
5. Bet status should be "matched" (not "pending")
✓ PASS: Status updates correctly
```

### Test 2: Cache Timeout
```
1. Save a pending bet from surebet.com
2. In DevTools, go to Service Workers
3. "Stop" the service worker
4. Navigate to Smarkets
5. Should still retrieve bet from storage fallback
✓ PASS: Bet data retrieved even with dead service worker
```

### Test 3: Selector Update
```
1. Open Smarkets, add bet to slip
2. Console: debugSmarketsSelectors()
3. All selectors should show ✓ FOUND
✓ PASS: All selectors working
```

---

## Impact Assessment

### Current Losses (Not Synced)
- Sydney Flames WON: +£1.74 ← Should show as profit
- Pelicans Lahti WON: +£3.08 ← Should show as profit
- Deccan Gladiators LOST: -£10.00 ← Should show as loss
- **Net unsynced**: -£5.18

### Failure Rate
- 14 pending bets
- 3 successful but not synced (21% false negatives)
- 4 placement failures (28%)
- 7 future events (50%)

### Fix Priority: HIGH
- Quick fix (1-2 hours) recovers £5.18 in lost P&L tracking
- Prevents continued sync issues in future placements
- Essential for accurate reporting
