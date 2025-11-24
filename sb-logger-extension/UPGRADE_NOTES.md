# Surebet Helper Extension - Upgrade Notes

## v1.0.37 - Cross-Origin Broker & Auto-Fill Complete 🎉

### What's New

**Final auto-fill implementation complete!** This release completes the end-to-end auto-fill workflow from Surebet to all exchanges:

#### 1. **Cross-Origin Broker Pattern** (v1.0.35-36)
- **Problem**: sessionStorage inaccessible across origins (Surebet → Smarkets)
- **Solution**: Implemented background broker using `chrome.runtime.sendMessage()` for safe cross-origin communication
- **Features**:
  - In-memory cache + persistent chrome.storage.local backup
  - Fallback chain: Broker → Storage → Referrer → Parent frame
  - Promise caching prevents duplicate clears
  - Tested and verified working with real bet data transfer

#### 2. **Stake Calculation Integration** (v1.0.37)
- **Problem**: Broker transferred bet data successfully, but stake wasn't calculated before auto-fill
- **Solution**: Added `calculateKellyStake(betData)` call in auto-fill flow
- **Result**: Stake amount now properly calculated and filled on all exchanges
- **Console logging**: "Calculated Kelly stake: {amount}" confirms stake computation

### Complete Auto-Fill Flow

1. **Click stake indicator on Surebet** → Broker sends to background service
2. **Navigate to exchange** → Page loads, content script queries broker
3. **Retrieve bet data** → Broker returns cached bet data
4. **Calculate Kelly stake** → `calculateKellyStake(betData)` computes optimal stake
5. **Auto-fill input** → Stake amount populates in betting slip
6. **Success notification** → User sees confirmation

### Testing the Complete Flow

1. On surebet.com, click a stake indicator (e.g., "$50")
2. Check console: "✓ Broker confirmed pendingBet saved"
3. You're redirected to exchange betting slip
4. Check console: "Calculated Kelly stake: [amount]"
5. Stake should auto-populate in the betting slip input
6. You review odds and place the bet manually

### Code Changes

**background.js**:
- Added `global_pendingBetCache` for in-memory broker storage
- Added `savePendingBet` message handler (stores data + backup to chrome.storage.local)
- Added `consumePendingBet` message handler (retrieves with intelligent cache clearing)

**contentScript.js**:
- Stake indicator click handler now uses broker messaging
- `getSurebetDataFromReferrer()` queries broker first with promise caching
- Added Kelly stake calculation step before `autoFillBetSlip()` call
- Console logs confirm each stage: saved → retrieved → calculated → filled

### Exchange Support Status

| Exchange | Status | Notes |
|----------|--------|-------|
| Betfair | ✅ | Fully supported |
| Smarkets | ✅ | **Complete in v1.0.37** (Broker + Kelly calculation) |
| Matchbook | ✅ | Fully supported |
| Betdaq | ✅ | Fully supported |

---

## v1.0.38 - Contributor Experience Improvements 🛠️

### What's New
- **New helper tools for reporting DOM structures:** Added a diagnostic helper script and a bookmarklet that collects betting slip DOM information, copies it to the clipboard and pre-fills a GitHub issue with our new Add Exchange Support issue template.
- **Standardized issue template:** `.github/ISSUE_TEMPLATE/add-exchange.md` included to make community submissions consistent and easy to triage.

### How this helps
- Faster triage and less back-and-forth for selector updates
- Lower barrier for users to contribute DOM structures for new exchanges
- More reliable auto-fill as selectors are updated more quickly by community contributions


## v1.0.29 - Smarkets Auto-Fill Fix 🔧

### What's Fixed

**Smarkets auto-fill was not working** - this release fixes three critical issues:

#### 1. **Incorrect CSS Selectors**
- **Problem**: Selectors were generic guesses that didn't match Smarkets actual DOM
- **Solution**: Updated to precise selectors from Smarkets' real betting slip:
  - Betting slip: `.bet-slip-container`, `.bet-slip-content`
  - Stake input: `input.box-input.numeric-value.input-value.with-prefix`
  - **Key finding**: Smarkets uses `type="text"` not `type="number"` for stake

#### 2. **Race Condition in Click Handler** 
- **Problem**: Bet data stored asynchronously, but browser navigated immediately
- **Solution**: 
  - Added `e.preventDefault()` to stop immediate navigation
  - Made click handler `async` and await storage completion
  - Only navigate after storage callback fires
  - Added "Storage complete, navigating..." log

#### 3. **Added Odds Validation** ⚠️
- **New Feature**: Warns if odds changed after you clicked the bet
- **How it works**: Compares stored odds with current betting slip odds
- **If different**: Shows warning toast "⚠️ Odds changed! Expected 1.87, now 2.22"
- **Auto-fill still happens**: User can verify odds before placing bet

### Testing the Fix

To test:
1. Click a clue stake link on surebet.com valuebets page
2. Check console for: "Storage complete, navigating..."
3. On Smarkets, verify: "Found stored bet data" + "Betting slip detected"
4. Stake should auto-populate
5. If odds changed, warning toast appears

### Code Changes

**contentScript.js** (3 updates):

1. **Lines 70-84**: Updated `BETTING_SLIP_SELECTORS.smarkets` with real selectors
2. **Lines 2597-2619**: Fixed race condition in click handler
3. **Lines 2141-2149**: Added odds validation before auto-fill

### Exchange Support Status

| Exchange | Status | Notes |
|----------|--------|-------|
| Betfair | ✅ | Fully supported |
| Smarkets | ✅ | **Fixed in v1.0.29** |
| Matchbook | ✅ | Fully supported |
| Betdaq | ⚠️ | Selectors may need updating |

---

## v1.0+ - Production Ready

Your extension has been upgraded from a temporary add-on to a **proper, production-ready browser extension**:

### 1. **Manifest V3 Upgrade**
   - ✅ Updated from Manifest V2 to V3 (current standard)
   - ✅ Changed from `browser_action` to `action` API
   - ✅ Converted background script to service worker
   - ✅ Split `permissions` into `permissions` and `host_permissions`
   - ✅ Added ES module support (`type: "module"`)

### 2. **Module System**
   - ✅ Converted `apiService.js` to ES module with export statements
   - ✅ Background script now properly imports ApiService
   - ✅ Maintains backward compatibility for popup window usage

### 3. **Installation Method**
   - ✅ Now installs **permanently** in Chrome/Edge/Brave (no reload needed after browser restart)
   - ✅ Works in Firefox with temporary or signed installation
   - ✅ Compatible with all major browsers

### 4. **Documentation**
   - ✅ Created comprehensive **INSTALL.md** with step-by-step instructions
   - ✅ Updated **README.md** with:
     - Chrome/Edge/Brave installation instructions
     - Firefox permanent installation guide
     - Distribution/packaging instructions
     - Chrome Web Store & Firefox Add-ons publishing info
   - ✅ Enhanced manifest metadata (author, homepage_url, better description)

## 📦 File Changes

### Modified Files:
1. **manifest.json** - Upgraded to Manifest V3
2. **background.js** - Converted to service worker with ES module imports
3. **apiService.js** - Added ES module exports
4. **README.md** - Updated installation and distribution instructions

### New Files:
1. **INSTALL.md** - User-friendly installation guide

## 🚀 How to Install (for end users)

### Chrome/Edge/Brave Users:
1. Open `chrome://extensions/` (or equivalent)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `surebet-helper-extension` folder
5. **Done!** Extension is permanently installed

### Firefox Users:
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from `surebet-helper-extension` folder
4. Note: Removed on browser restart (use signing for permanent install)

## 🎯 Next Steps (Optional)

### For Distribution:
1. **Chrome Web Store** - Follow instructions in README.md (requires $5 developer account)
2. **Firefox Add-ons** - Sign and distribute through Mozilla (free)
3. **Direct Distribution** - Create ZIP package and share with users

### For Development:
1. Test the extension in your target browser(s)
2. Update the `homepage_url` in manifest.json to your actual repository
3. Consider adding more icons (16px, 32px sizes)
4. Set up a GitHub repository for version control

## ✨ Benefits

### For You (Developer):
- ✅ Modern, standards-compliant codebase
- ✅ Ready for Chrome Web Store submission
- ✅ Better debugging and error handling
- ✅ Future-proof architecture

### For Users:
- ✅ No more "temporary extension" warnings
- ✅ Persists across browser sessions
- ✅ Works like any professional extension
- ✅ Can be easily distributed and updated

## 🔧 Testing Checklist

Before distribution, test these features:
- [ ] Extension loads without errors in chrome://extensions
- [ ] Icon appears in browser toolbar
- [ ] Popup opens and displays correctly
- [ ] Save buttons appear on surebet.com/valuebets
- [ ] Bets save successfully
- [ ] Export (JSON/CSV) works
- [ ] Chart visualization displays
- [ ] Auto-check results works (if APIs configured)
- [ ] Commission settings save properly
- [ ] Import Betfair P/L works

## 📝 Notes

- Extension now uses **Manifest V3** which is required for new Chrome extensions
- Service worker replaces traditional background page (more efficient)
- All browser storage APIs remain unchanged
- No impact on existing saved bets or user data

---

**Your extension is now production-ready!** 🎉

See **INSTALL.md** for end-user installation instructions.
See **README.md** for full feature documentation.


