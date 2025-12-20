# CLV Not Updating After Bet Settlement - Fix Applied

## Problem
Some bets were marked as CLV (Closing Line Value) tracked, but after being completed/settled, the CLV data was not fetched and updated. This occurred because:

1. **No automatic trigger on settlement**: When `handleCheckResults()` marked a bet as settled (won/lost), it didn't trigger CLV fetching for that bet
2. **Delay requirement**: The `autoFetchClv()` function had a configurable delay (default 2-6 hours) before fetching CLV, which meant newly settled bets weren't immediately eligible
3. **Retry count initialization**: Newly settled bets started with `clvRetryCount=0`, but the eligibility check didn't prioritize these newly marked bets

## Solution Implemented

### Change 1: Clear CLV Retry Markers on Settlement
**File**: `background.js` (line ~1435)

When a bet is settled in `handleCheckResults()`, we now clear the CLV retry markers:

```javascript
// Clear any CLV retry markers so CLV fetch will be attempted immediately
// This ensures newly settled bets get CLV data fetched ASAP
if (bet.clv === undefined || bet.clv === null) {
  delete bet.clvRetryCount;
  delete bet.clvLastRetry;
  console.log(`📈 Cleared CLV retry markers for ${bet.event} - will fetch CLV immediately`);
}
```

**Purpose**: Resets the retry counter so newly settled bets are eligible for immediate CLV fetching

### Change 2: Trigger CLV Fetch After Settlement
**File**: `background.js` (line ~1490)

After saving updated bets and recalculating bankroll, we now trigger `autoFetchClv()`:

```javascript
// Trigger CLV fetch for newly settled bets
// This ensures CLV data is fetched immediately after settlement
console.log('📈 Triggering CLV fetch for newly settled bets...');
autoFetchClv().catch(err => {
  console.error('📈 CLV auto-fetch error after settlement:', err);
});
```

**Purpose**: Initiates CLV fetching as soon as bets are settled, rather than waiting for the scheduled alarm

### Change 3: Prioritize Newly Settled Bets in Eligibility Check
**File**: `background.js` (line ~1750)

Modified the `autoFetchClv()` eligibility filter to bypass delay for newly settled bets:

```javascript
// Newly settled bets with no retry attempts bypass delay
// This ensures bets marked as CLV are updated immediately after settlement
if (retryCount === 0 && timeSinceSetting < delayMs) {
  console.log(`📈 Newly settled bet eligible for immediate CLV fetch: ${getBetKey(bet) || bet.id}`);
  return true;
}

// For retried bets, enforce the delay
if (timeSinceSetting < delayMs) return false;
```

**Purpose**: Ensures newly settled bets (retryCount=0) bypass the delay requirement and get CLV data immediately, while older retry attempts still respect the configurable delay

## How It Works Now

1. **Bet completes**: `handleCheckResults()` marks bet as "won", "lost", or "void" and sets `settledAt` timestamp
2. **CLV markers cleared**: Retry markers are deleted to reset eligibility
3. **CLV fetch triggered**: `autoFetchClv()` is called immediately
4. **Bypass delay**: Newly settled bets (retryCount=0) bypass the delay requirement
5. **CLV data fetched**: CSV or API CLV data is fetched and stored
6. **Bet updated**: Completed bet now shows CLV badge with +/- percentage

## Testing the Fix

### Manual Testing
1. Enable CLV in Settings
2. Place a value bet and mark it as complete manually or let it auto-settle
3. Check the extension popup - CLV badge should appear within seconds
4. If CLV doesn't appear, check extension Diagnostics for errors

### Expected Behavior
- **Before fix**: CLV badge would only appear after 2-6 hour delay or manual "Force CLV Check"
- **After fix**: CLV badge appears within seconds of settlement

## Related Files
- `background.js`: Main handler for settlement and CLV fetching
- `csvClvService.js`: CSV-based CLV calculation
- `popup.js`: Renders CLV badges in UI
- `analysis.js`: Uses CLV data for P/L analysis

## Logging
Look for these messages in extension Diagnostics to verify the fix:
- `📈 Cleared CLV retry markers for [event] - will fetch CLV immediately`
- `📈 Triggering CLV fetch for newly settled bets...`
- `📈 Newly settled bet eligible for immediate CLV fetch: [betId]`
- `📈 CLV updated for [n] bet(s)`

---

**Applied**: December 16, 2025
**Status**: ✅ Complete
