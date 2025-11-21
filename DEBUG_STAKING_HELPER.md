# Kelly Stake Helper - Debugging Guide

## Quick Diagnostic Steps

1. **Open DevTools** (F12) and go to the **Console** tab
2. **Reload the page** (Ctrl+R or Cmd+R)
3. **Look for these log messages** in order:

```
✅ SB Logger: Styles injected
✅ SB Logger: Staking settings loaded
✅ SB Logger: Stake panel injected
✅ SB Logger: Panel monitoring started
🎯 [StakePanel] injectStakePanel called | stakePanel exists: false | body exists: true
✅ [StakePanel] Panel injected successfully: <div class="sb-logger-stake-panel">...
📊 [StakePanel] Loaded settings from storage: { bankroll: 1000, baseBankroll: 1000, fraction: 0.25 }
📊 [StakePanel] Updating display: { bankroll: 1000, baseBankroll: 1000, fractionPercent: 25, ... }
📊 [StakePanel] Input values after update: { bankroll: "1000", fraction: "25", summaryHTML: "..." }
```

## What Each Log Means

### Loading Phase
- **"Staking settings loaded"** - Settings successfully retrieved from Chrome storage
- Look for: `📊 [StakePanel] Loaded settings from storage: { ... }`
- If you see different values, those are what's currently saved

### Injection Phase  
- **"injectStakePanel called"** - Function started executing
- **"Panel injected successfully"** - Panel DOM element created
- **"Elements found"** - Form inputs were located in the DOM

### Display Update Phase
- **"Updating display"** - Display update function ran
- **"Input values after update"** - Final values in the form inputs
- **bankroll, fraction, summaryHTML** - These should show values like "1000", "25", and HTML with the bank amounts

## Common Issues

### Issue 1: Panel Not Visible at All
**Look for:**
- "Panel in DOM: true" (element exists)
- "Panel computed style z-index: 2147483647" (correct z-index applied)
- "Panel in viewport" (position is correct)

**If z-index is wrong:**
- CSS wasn't injected properly
- Restart the extension in `chrome://extensions`

**If not in DOM:**
- Panel was removed after injection
- Check "Panel missing from DOM, re-injecting" messages

### Issue 2: Panel Shows But Values Are Empty
**Look for:**
- "Loaded settings from storage: { bankroll: 1000, ... }" 
  - If this shows correct values, proceed
  - If values are 0 or undefined, storage is empty → reset required
  
- "Input values after update: { bankroll: ..., fraction: ... }"
  - If these are empty strings or undefined, the inputs weren't found
  - Check: "Elements found - form: true, resetBtn: true, toggleBtn: true"

### Issue 3: Settings Not Persisting
**When you change values and click Save:**
1. Form submit listener should fire
2. Check for toast message: "Kelly staking updated"
3. Look for: `📊 [StakePanel] Loaded settings from storage:` again (should show new values)

## Advanced Debugging

### Run This in Console:

```javascript
// Check current staking settings
chrome.storage.local.get('stakingSettings', (res) => {
  console.log('Stored Settings:', res.stakingSettings);
});

// Force panel update
if (window.__sbLoggerUpdateDisplay) {
  window.__sbLoggerUpdateDisplay();
}

// Check panel in DOM
const panel = document.querySelector('.sb-logger-stake-panel');
console.log('Panel exists:', !!panel);
console.log('Panel visible:', panel ? window.getComputedStyle(panel).display : 'N/A');
console.log('Panel position:', panel ? window.getComputedStyle(panel).position : 'N/A');
console.log('Panel z-index:', panel ? window.getComputedStyle(panel).zIndex : 'N/A');
console.log('Panel in viewport:', panel ? panel.offsetParent !== null : 'N/A');

// Check form values
const bankrollInput = document.querySelector('#sb-logger-bankroll');
const fractionInput = document.querySelector('#sb-logger-fraction');
console.log('Bankroll input value:', bankrollInput?.value);
console.log('Fraction input value:', fractionInput?.value);
```

## Next Steps After Debugging

1. **Copy the console output** from DevTools
2. **Identify where the sequence breaks**:
   - Breaks at "Staking settings loaded" → Storage issue
   - Breaks at "Panel injected successfully" → DOM injection issue
   - Breaks at "Updating display" → Element reference issue
   
3. **Share the console output** and we can fix the specific issue

## Version Info
- Last Updated: Nov 21, 2025
- Changes: Added comprehensive logging to debug panel population issues
