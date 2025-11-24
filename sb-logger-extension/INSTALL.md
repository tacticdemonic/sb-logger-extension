# Installation Guide - Surebet Helper Extension

This extension is now properly configured for permanent installation in all major browsers.

## Quick Start

### Chrome, Edge, or Brave (Recommended)
1. Open your browser's extensions page:
   - **Chrome**: Navigate to `chrome://extensions/`
   - **Edge**: Navigate to `edge://extensions/`
   - **Brave**: Navigate to `brave://extensions/`

2. **Enable Developer Mode**
   - Look for a toggle switch in the top-right corner
   - Turn it ON

3. **Load the Extension**
   - Click the "Load unpacked" button
   - Browse to and select the `surebet-helper-extension` folder
   - The extension will load with all features enabled

4. **Done!** The extension is now permanently installed
   - Icon appears in your browser toolbar
   - Works across all browser sessions
   - No need to reload after browser restart

### Firefox
**Option 1: Temporary Installation (Quick Test)**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from the `surebet-helper-extension` folder
4. ⚠️ Note: Removed when Firefox restarts

**Option 2: Permanent Installation (Recommended)**
1. Install web-ext tool: `npm install -g web-ext`
2. Navigate to the extension folder: `cd surebet-helper-extension`
3. Sign the extension through Mozilla (requires free developer account)
4. Install the signed .xpi file

For detailed Firefox signing instructions, see the main README.md

## Verification

After installation, verify the extension is working:
1. The extension icon should appear in your browser toolbar
2. Visit https://surebet.com/valuebets
3. You should see "💾 Save" buttons on each bet row
4. Click the toolbar icon to open the popup and manage saved bets

## Features

Once installed, you can:
- ✅ Save bets with one click from surebet.com
- 📊 Track your betting performance with P/L tracking
- ⚡ Auto-fill stakes on betting exchanges (optional, disabled by default)
- 🔍 Auto-check results using free sports APIs (optional)
- 📈 View performance charts
- 📥 Import/Export data as CSV or JSON
- ⚙️ Configure exchange commission rates and stake rounding

## Troubleshooting

**Extension not appearing after installation?**
- Make sure you selected the correct folder (`surebet-helper-extension`)
- Check that Developer Mode is enabled
- Try restarting your browser

**Save buttons not showing on surebet.com?**
- Refresh the page after installing the extension
- Check browser console for errors (F12 → Console tab)

**Need to update the extension?**
- Chrome/Edge/Brave: Click "Reload" button on the extension card in chrome://extensions
- Firefox: Remove and re-load the extension

## Support

For detailed features and API setup, see the main **README.md** file in this folder.

For API configuration to auto-check bet results, see **API_SETUP.md**.



