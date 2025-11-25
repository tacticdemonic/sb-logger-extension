# Adding New Betting Sites to Auto-Fill

This guide explains how to add support for a new betting site's auto-stake fill feature.

## Prerequisites

1. Access to the target betting site with an account (logged in state may have different DOM)
2. The DOM collector tool (accessible via popup.html "Contribute" button)

## Step-by-Step Process

### Step 1: Collect DOM Information

1. Navigate to the target betting site
2. Add a bet to the betting slip (so the slip is visible with stake input)
3. Open the extension popup
4. Click the "Contribute" button to collect DOM data
5. The JSON data is copied to your clipboard - save it for reference

### Step 2: Analyze the DOM Structure

From the collected JSON, identify:
- **Betting slip container**: The main wrapper element (e.g., `.betslip-container`)
- **Stake input**: The input field where stake is entered (e.g., `input.stake`)
- **Odds element**: Where odds are displayed (for validation)
- **Selection name**: Where the bet selection is shown (for validation)

### Step 3: Update contentScript.js

#### 3a. Add to BETTING_SLIP_SELECTORS

```javascript
const BETTING_SLIP_SELECTORS = {
  // ... existing sites ...
  
  newsite: {
    bettingSlip: [
      '.betting-slip-container',  // Most specific first
      '#betslip',
      '[class*="betslip"]'
    ],
    stakeInput: [
      '.back-section input.stake-input',  // Most specific first
      'input[name="stake"]',
      'input.stake'
    ],
    odds: [
      '.odds-display',
      'input.odds'
    ],
    selection: '.selection-name, .bet-selection'
  }
};
```

#### 3b. Add to SUPPORTED_SITES

```javascript
const SUPPORTED_SITES = {
  // ... existing sites ...
  
  newsite: { 
    hostnames: ['newsite.com', 'newsite.co.uk'],  // URL patterns to match
    displayName: 'New Site',
    asyncLoading: true  // Set to true if site loads betting slip via JavaScript
  }
};
```

#### 3c. Add to DEFAULT_AUTOFILL_SETTINGS

```javascript
const DEFAULT_AUTOFILL_SETTINGS = {
  enabled: false,
  bookmakers: {
    betfair: true,
    smarkets: true,
    matchbook: true,
    betdaq: true,
    newsite: true  // Add here
  },
  // ...
};
```

#### 3d. Add to DEFAULT_COMMISSION_RATES

```javascript
const DEFAULT_COMMISSION_RATES = {
  'betfair': 0.05,
  'smarkets': 0.02,
  'matchbook': 0.01,
  'betdaq': 0.025,
  'newsite': 0.02  // Add commission rate as decimal
};
```

### Step 4: Update settings.html

Add a checkbox in the Auto-Fill section:

```html
<label class="form-group-checkbox">
  <input type="checkbox" id="autofill-newsite" />
  <span>New Site</span>
</label>
```

### Step 5: Update settings.js

#### 5a. Add to DEFAULT_AUTOFILL_SETTINGS

```javascript
const DEFAULT_AUTOFILL_SETTINGS = {
  enabled: false,
  bookmakers: {
    betfair: true,
    matchbook: true,
    smarkets: true,
    betdaq: true,
    newsite: true  // Add here
  },
  // ...
};
```

#### 5b. Add checkbox loading in loadAllSettings()

```javascript
document.getElementById('autofill-newsite').checked = autoFillSettings.bookmakers?.newsite !== false;
```

#### 5c. Add checkbox saving in save handler

```javascript
const newSettings = {
  enabled: enabled,
  bookmakers: {
    betfair: document.getElementById('autofill-betfair').checked,
    betdaq: document.getElementById('autofill-betdaq').checked,
    smarkets: document.getElementById('autofill-smarkets').checked,
    matchbook: document.getElementById('autofill-matchbook').checked,
    newsite: document.getElementById('autofill-newsite').checked  // Add here
  },
  // ...
};
```

## Testing Checklist

- [ ] Test with logged OUT state
- [ ] Test with logged IN state (DOM may differ!)
- [ ] Verify stake input is filled correctly
- [ ] Verify toast notification appears
- [ ] Check console for any errors
- [ ] Test the enable/disable toggle in settings

## Troubleshooting

### Stake input not found
- Check if the betting slip loads asynchronously (set `asyncLoading: true`)
- Verify selectors match the actual DOM
- Check if logged-in state has different selectors

### Betting slip not detected
- Add more container selectors
- Check if site uses iframes (not supported)

### Wrong input filled
- Make stake selectors more specific
- Add `.back-section` or similar prefix to avoid lay bet inputs

## Files to Modify Summary

| File | Changes |
|------|---------|
| `contentScript.js` | BETTING_SLIP_SELECTORS, SUPPORTED_SITES, DEFAULT_AUTOFILL_SETTINGS, DEFAULT_COMMISSION_RATES |
| `settings.html` | Add checkbox |
| `settings.js` | DEFAULT_AUTOFILL_SETTINGS, load handler, save handler |

## Example: Adding Betdaq (Completed)

Betdaq was added with:
- `asyncLoading: true` because it loads betting slip content via JavaScript
- More specific selectors targeting `.back.polarity` to avoid lay bet inputs
- Extended polling (30 attempts, 300ms) for async content
