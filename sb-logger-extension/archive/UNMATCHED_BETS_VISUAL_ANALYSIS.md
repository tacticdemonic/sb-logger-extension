# Unmatched Bets - Visual Analysis

## Bet Status Breakdown (Pie Chart)

```
14 Pending Bets
├── ✅ Successfully Won/Lost (Sync Issue): 3 bets (21%)
│   ├── Sydney Flames (WON £1.74)
│   ├── Pelicans Lahti (WON £3.08)
│   └── Deccan Gladiators (LOST £10.00)
├── ❌ Placement Failed: 4 bets (28%)
│   ├── Cologne Haie (Selector/Cache)
│   ├── Kirchheimer (Selector)
│   ├── Tennis Doubles (Market Closed)
│   └── Slovakian Cup (Selector)
└── ⏳ Future Events (Expected): 7 bets (50%)
    ├── FC Viktoria Plzen (Nov 27, 17:45)
    ├── Gandzasar Kapan (Nov 28, 11:00)
    ├── Rangers (Nov 27, 20:00)
    ├── PAOK (Nov 27, 17:45)
    ├── Lille (Nov 27, 17:45)
    ├── Genk (Nov 27, 20:00)
    └── Red Star Belgrade (Nov 27, 20:00)
```

---

## The Missing Feedback Loop (Data Flow)

### Current Flow (Broken)

```
┌─────────────────┐
│  surebet.com    │
│  User clicks    │
│  stake link     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ background.js:savePendingBet    │
│ ✓ Store in global_pendingBet    │
│ ✓ Backup to chrome.storage      │
└────────┬────────────────────────┘
         │
         ▼ (navigate)
┌─────────────────────────────────┐
│ smarkets.com (page loads)        │
│ React renders betting slip       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ contentScript.js:getSurebet...  │
│ ✓ Retrieve from broker          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ contentScript.js:autoFill()     │
│ ✓ Find stake input field        │
│ ✓ Set value = £1.50            │
│ ✓ Trigger 'change' event        │
│ ✓ Click 'Place Bet' button      │
│ ✓ Bet placed on exchange        │
└────────┬────────────────────────┘
         │
         ▼
         ❌ STOPS HERE - NO FEEDBACK! ❌
         
┌─────────────────────────────────┐
│ chrome.storage.local (bets DB)  │
│ Status: "pending" (WRONG!)      │
│ Should be: "matched"            │
│ Synced at: never                │
└─────────────────────────────────┘
         
Event settles after 2 days...

┌─────────────────────────────────┐
│ smarkets.com account history    │
│ ✓ Bet Won £1.74                │
└─────────────────────────────────┘
         
BUT:

┌─────────────────────────────────┐
│ Local app (popup.html)          │
│ Still shows: "pending"          │
│ P&L not updated                 │
│ User confused                   │
└─────────────────────────────────┘
```

### Fixed Flow (Proposed)

```
┌─────────────────────────────────┐
│ contentScript.js:autoFill()     │
│ ✓ Stake filled                  │
│ ✓ Bet placed on exchange        │
└────────┬────────────────────────┘
         │
         ▼ NEW: Send feedback
┌─────────────────────────────────┐
│ chrome.runtime.sendMessage      │
│ { action: 'betPlaced',          │
│   betId: 1627928682,            │
│   odds: 2.06,                   │
│   stake: 1.5,                   │
│   timestamp: ISO              }
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ background.js:onMessage()       │
│ NEW: 'betPlaced' handler        │
│ ✓ Update bet.status→"matched"   │
│ ✓ Save matched_at timestamp     │
│ ✓ Store to chrome.storage       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ chrome.storage.local (bets DB)  │
│ Status: "matched" ✓             │
│ Synced at: 2025-11-26 17:30    │
└─────────────────────────────────┘
         
Event settles...

┌─────────────────────────────────┐
│ smarkets.com account history    │
│ ✓ Bet Won £1.74                │
└─────────────────────────────────┘
         
AND:

┌─────────────────────────────────┐
│ Local app (popup.html)          │
│ Status: "matched"               │
│ P&L tracking correct            │
│ User informed                   │
└─────────────────────────────────┘
```

---

## Bet Placement Timeline

### Sydney Flames (Success - Wrong Status)

```
2025-11-24 19:12:41 ─ Saved from surebet.com
                      └─ Broker: save pendingBet
                      └─ Storage: backup to chrome.storage
                      
2025-11-24 19:12:50 ─ Navigated to Smarkets
                      └─ Page loads (React)
                      └─ contentScript loads
                      
2025-11-24 19:12:52 ─ Auto-fill triggered
                      └─ getSurebetDataFromReferrer()
                      └─ Retrieved from broker ✓
                      └─ Found stake input ✓
                      └─ Filled £1.50 ✓
                      └─ Clicked 'Place Bet' ✓
                      └─ ❌ NO FEEDBACK SENT
                      
2025-11-26 08:00:00 ─ Event: Sydney Flames vs Geelong
                      └─ Sydney Flames won +6.5 handicap
                      
2025-11-26 17:37:00 ─ Market settled
                      └─ Smarkets: "✓ Bet Won £1.74"
                      └─ Local DB: "pending" ❌
                      
2025-11-27 09:59:30 ─ Export debug data
                      └─ "Status: pending, lastApiCheck: 2025-11-26T15:51:51.459Z"
                      └─ Not marked as won
```

### Cologne Haie (Failed - Selector Issue)

```
2025-11-24 12:34:45 ─ Saved from surebet.com
                      └─ Broker: save pendingBet
                      └─ Storage: backup ✓
                      
2025-11-24 12:34:50 ─ Navigated to Smarkets
                      └─ Page loads
                      └─ Auto-fill triggered
                      
2025-11-24 12:34:52 ─ Selector lookup
                      ├─ '.bet-slip-container input.box-input.numeric-value.input-value.with-prefix'
                      │  └─ ❌ NOT FOUND (DOM changed?)
                      ├─ '.bet-slip-container input.box-input.numeric-value.input-value:not([disabled])'
                      │  └─ ❌ NOT FOUND
                      ├─ 'input[type="text"].box-input.numeric-value.with-prefix'
                      │  └─ ❌ NOT FOUND
                      │
                      └─ All selectors failed → Abort auto-fill
                      
2025-11-25 18:30:00 ─ Event: Cologne Haie vs Adler Mannheim
                      └─ Event ended
                      
2025-11-26 01:14:22 ─ Auto-check attempted
                      └─ API retry #5 reached limit
                      └─ Status: "pending" (never matched)
```

---

## Cache Timeout Issue Timeline

### Scenario: Slow Browser / Service Worker Restart

```
11:15:00 ─ Surebet.com
           └─ User clicks stake link
           └─ background.js:savePendingBet called
           └─ global_pendingBetCache = {id:123, odds:2.06, ...}
           └─ chrome.storage.local.set({pendingBet:...})
           
11:15:00.1 ─ Navigation initiated
            └─ window.location.href = "smarkets.com/..."
            
11:15:00.5 ─ Service worker receives message
            └─ "pendingBet stored"
            
[Browser restarts / SW crashes here]
            
11:15:02 ─ Smarkets page loads
           └─ contentScript loads
           └─ getSurebetDataFromReferrer() called
           │
           ├─ [ATTEMPT 1] Broker (3 sec timeout)
           │  └─ chrome.runtime.sendMessage → consumePendingBet
           │  └─ Service worker restarting... taking 1.5s
           │  └─ Response received at 11:15:03.5 ✓
           │  └─ global_pendingBetCache = null (restarted)
           │  └─ Fallback to storage
           │
           └─ [ATTEMPT 2] Storage (100ms timeout) ← TOO FAST!
              └─ setTimeout(..., 100)
              └─ Fires at 11:15:03.6
              └─ chrome.storage.local.get → pending
              └─ But storage I/O takes 50ms
              └─ Response arrives at 11:15:03.7
              └─ BUT: setTimeout callback already fired!
              └─ ❌ DATA LOST
              
11:15:04 ─ Auto-fill has no bet data
           └─ User must enter manually
           └─ Or: Bet not placed at all
```

**Fix: Increase timeouts**
- Broker timeout: 3s → 5s
- Storage timeout: 100ms → 500ms

---

## Exchange-Specific Success Rates (Inferred)

```
Smarkets (5 saved, 2 success, 2 failed, 1 future)
├─ Sydney Flames (WON) ✓
├─ Pelicans Lahti (WON) ✓
├─ Cologne Haie (FAILED)
├─ Kirchheimer (FAILED)
└─ Future event (1)
Result: 40% success rate (2/5)

Matchbook (1 saved, 1 success, 0 failed)
└─ Deccan Gladiators (LOST) ✓
Result: 100% success rate (1/1)

Betfair (2 saved, 0 success, 1 failed, 1 future)
├─ Slovakian Cup (FAILED)
└─ Future event (1)
Result: 0% success rate (0/1)

Betdaq (1 saved, 0 success, 1 failed)
└─ Tennis Doubles (FAILED)
Result: 0% success rate (0/1)

TOTAL: 8 attempted placements, 3 succeeded (37.5%)
       4 failed (50%)
       1 market closed (12.5%)
```

---

## The 3-Way Sync Problem

### Current Problem

```
                        Smarkets Account
                        (Exchange)
                             ▲
                             │ ✓ Bet placed
                             │ ✓ Won £1.74
                             │ ✓ Settled Nov 26
                             │
   No connection!         [MISMATCH]
     between             
    local DB          
   and exchange     
                             │
                             ▼
                    Local App Database
                    (chrome.storage.local)
                    
                    Status: "pending"
                    LastCheck: Nov 26 15:51
                    Result: Unknown
                    ❌ Out of sync
```

### Proposed Solution

```
                        Smarkets Account
                        (Exchange)
                             ▲
                             │ ✓ Bet placed
                             │ ✓ Won £1.74
                             ▼
                    [FEEDBACK MESSAGE]
                    (contentScript → background)
                             │
                             ▼
                    Local App Database
                    (chrome.storage.local)
                    
                    Status: "matched"
                    PlacedAt: Nov 24 19:12:52
                    Result: Won
                    SyncedAt: Nov 24 19:12:55
                    ✓ In sync
                    
                    (Weekly reconciliation with
                     exchange CSV imports)
```

---

## Code Locations (Quick Reference)

```
contentScript.js
├─ Line 43-87: Auto-fill settings & selectors
├─ Line 2554: getSurebetDataFromReferrer() START
├─ Line 2570: Broker timeout (3000ms - CHANGE TO 5000ms)
├─ Line 2602: Storage fallback timeout (100ms - CHANGE TO 500ms)
├─ Line 2689: injectSaveButtonOnSmarkets()
├─ Line 2750: Auto-fill success point ← ADD FEEDBACK HERE
├─ Line 3067: clickHandlers.surebetLink
└─ Line 3118: Event listener setup

background.js
├─ Line 6: global_pendingBetCache declaration
├─ Line 545: savePendingBet handler
├─ Line 572: consumePendingBet handler
├─ Line 620: End of message listener ← ADD betPlaced HANDLER HERE
└─ Line 843: EOF
```

---

## Summary Table: All 14 Bets

| # | Event | Exchange | Saved | Status | Reason | Fix |
|---|-------|----------|-------|--------|--------|-----|
| 1 | Cologne Haie | Smarkets | 11-24 | Failed | Selector | Update selector |
| 2 | Sydney Flames | Smarkets | 11-24 | Won (not synced) | No feedback | Add handler |
| 3 | Kirchheimer | Smarkets | 11-25 | Failed | Selector | Update selector |
| 4 | Deccan Glad. | Matchbook | 11-25 | Lost (not synced) | No feedback | Add handler |
| 5 | Pelicans | Smarkets | 11-25 | Won (not synced) | No feedback | Add handler |
| 6 | Tennis | Betdaq | 11-26 | Failed | Market closed | Check closure |
| 7 | Slovakian | Betfair | 11-26 | Failed | Selector | Update selector |
| 8 | Plzen | Smarkets | 11-26 | Pending | Future | None |
| 9 | Kapan | Betfair | 11-26 | Pending | Future | None |
| 10 | Rangers | Smarkets | 11-26 | Pending | Future | None |
| 11 | PAOK | Smarkets | 11-26 | Pending | Future | None |
| 12 | Lille | Smarkets | 11-26 | Pending | Future | None |
| 13 | Genk | Smarkets | 11-26 | Pending | Future | None |
| 14 | Red Star | Smarkets | 11-26 | Pending | Future | None |

**Summary**:
- 3 sync issues (feedback loop needed)
- 4 selector issues (validation needed)
- 1 market closure issue (detection needed)
- 7 future events (working as designed)
