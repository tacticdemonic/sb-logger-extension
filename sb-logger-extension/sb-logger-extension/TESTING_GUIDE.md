# Quick Installation Test

## This guide helps you verify the extension is properly installed

### Step 1: Load the Extension

**Chrome/Edge/Brave:**
1. Open your browser
2. Type in address bar: `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `surebet-helper-extension` folder
6. ✅ You should see "Surebet Helper - Save Bets" appear in the list

**Firefox:**
1. Open Firefox
2. Type in address bar: `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to `surebet-helper-extension` folder
5. Select the `manifest.json` file
6. ✅ You should see "Surebet Helper - Save Bets" appear in the list

---

### Step 2: Verify Installation

After loading, check these indicators:

✅ **Toolbar Icon**
- Look for the extension icon in your browser toolbar
- If not visible, click the extensions puzzle icon and pin it

✅ **Extension Details**
- Click "Details" (Chrome) or inspect the extension
- Should show:
  - Name: "Surebet Helper - Save Bets"
  - Version: 1.0.0
  - Manifest Version: 3

✅ **No Errors**
- Check that no error messages appear
- Background color should be normal (not red/orange)

---

### Step 3: Test Basic Functionality

1. **Open Popup**
   - Click the extension icon in the toolbar
   - Popup window should open showing "Surebet Helper — Saved Bets"
   - Should see buttons: Check Results, API Setup, Import, View Chart, Export

2. **Test on Surebet.com**
   - Visit: https://surebet.com/valuebets
   - Look for "💾 Save" buttons on bet rows
   - Try clicking one to save a test bet
   - Open popup again - your bet should appear

3. **Test Export**
   - Click "Export JSON" or "Export CSV" in popup
   - File should download automatically

4. **Export Pending Bets (Debug)**
   - Open the extension Settings (⚙️ Settings)
   - Go to the **Data** tab
   - Click **🐛 Debug Export → Export Pending Bets (JSON)**
   - The file will download with only bets that are currently pending/unsettled — use this for debugging CSV import parser issues or verifying pending bet structure

   ---

   ### CSV Import - Report Issue Test

   This test validates that the CSV import report feature captures the necessary debug data and opens a pre-filled GitHub issue.

   1. Load the extension and open the Import page (`import.html`).
   2. Select a CSV file and click **Import Now**.
   3. When the import completes and the results are shown, click **🐛 Report Match Issue**.
   4. Confirm the Privacy modal.
   5. A GitHub issue page should open with a pre-filled summary and a `PASTE_FULL_JSON_HERE` placeholder.
   6. Confirm your clipboard contains the full JSON debug payload; paste it into the issue body if needed.
   7. Verify the issue contains a readable table of unmatched entries and a condensed log of match attempts.

   Success Criteria:
   - The GitHub issue editor opens containing a pre-filled summary and tables
   - The clipboard contains the full JSON debug payload
   - The `PASTE_FULL_JSON_HERE` placeholder is present to paste full JSON if body is truncated


---

### Troubleshooting

❌ **"Manifest file is invalid"**
- Make sure you selected the `surebet-helper-extension` folder, not the parent folder
- Verify `manifest.json` exists in the folder

❌ **"Service worker registration failed"**
- This is normal during development in some browsers
- The extension should still function correctly
- If issues persist, check browser console (F12)

❌ **Save buttons not appearing**
- Refresh the surebet.com page after installing
- Check that content script loaded (F12 → Console → look for Surebet Helper messages)
- Try disabling other extensions that might conflict

❌ **Extension removed after browser restart (Firefox)**
- This is expected with "Load Temporary Add-on"
- Use signing for permanent installation (see README.md)
- Or reload the temporary add-on each time

---

### Success! ✅

If all tests pass, your extension is properly installed and working!

**Next steps:**
- Configure API keys for auto-result checking (see API_SETUP.md)
- Customize bookmaker presets in contentScript.js
- Start tracking your bets!

**Need help?**
- Check INSTALL.md for detailed installation instructions
- Check README.md for feature documentation
- Check API_SETUP.md for API configuration


