# Browser API Compatibility Guide

## Overview

This document describes a critical compatibility issue between Firefox and Chrome browser extensions, and how to fix it. This is a common pitfall when developing cross-browser extensions.

---

## The Problem

### Symptom
- Feature works in Firefox but fails silently in Chrome
- Console shows: `ReferenceError: browser is not defined`
- Functions that use `browser.storage`, `browser.runtime`, etc. fail completely

### Root Cause

Firefox and Chrome use different global objects for their extension APIs:

| Browser | API Object | Example |
|---------|------------|---------|
| Firefox | `browser` | `browser.storage.local.get()` |
| Chrome  | `chrome`   | `chrome.storage.local.get()` |

Firefox also supports `chrome` for compatibility, but Chrome does **not** support `browser`.

### Why It's Hard to Catch

1. **Silent failures** - If the code is wrapped in try/catch or async, errors may not surface
2. **Works in Firefox** - Developers testing in Firefox won't see the issue
3. **Partial functionality** - Some files may have the polyfill while others don't
4. **No build step** - Pure JS extensions don't have bundlers that catch undefined references

---

## The Solution

### Browser Compatibility Polyfill

Add this code at the **top** of any `.js` file that uses browser extension APIs:

```javascript
// Browser API compatibility - Firefox uses 'browser', Chrome uses 'chrome'
const browser = typeof window !== 'undefined' && window.browser ? window.browser : 
               (typeof chrome !== 'undefined' ? chrome : null);
```

### Where to Add It

Every JavaScript file that uses extension APIs needs this polyfill:

| File | Needs Polyfill? | Reason |
|------|-----------------|--------|
| `contentScript.js` | ✅ Yes | Uses `browser.storage`, `browser.runtime` |
| `background.js` | ✅ Yes | Uses `browser.storage`, `browser.downloads`, `browser.alarms` |
| `popup.js` | ✅ Yes | Uses `browser.storage`, `browser.tabs` |
| `import.js` | ✅ Yes | Uses `browser.storage` |
| `settings.js` | ✅ Yes | Uses `browser.storage` |
| `apiService.js` | ✅ Yes | Uses `browser.storage` |
| `analysis.js` | ✅ Yes | Uses `browser.storage` |

### Alternative: Use `chrome` Everywhere

Another approach is to use `chrome` everywhere since Firefox supports it:

```javascript
// This works in both browsers
chrome.storage.local.get(['bets'], function(result) { ... });
```

However, this loses Firefox's Promise-based API advantages.

---

## Debugging Checklist

When extension features fail silently:

### 1. Check the Console
Open DevTools on the extension page (popup, import page, etc.):
- Chrome: Right-click popup → "Inspect"
- Firefox: `about:debugging` → Inspect extension

Look for:
```
ReferenceError: browser is not defined
```

### 2. Verify Polyfill Exists
Search the file for:
```javascript
const browser = 
```

If not present, add the polyfill.

### 3. Check All Entry Points
Extension has multiple entry points - each needs the polyfill:
- Background service worker
- Content scripts (injected into web pages)
- Popup scripts
- Options/settings pages
- Import/export pages

### 4. Add Debug Logging
After the polyfill, add a version log:
```javascript
console.log('📥 [FileName] loaded v1.0 - Browser API:', browser ? 'available' : 'missing');
```

---

## Real-World Example: CSV Import Fix

### The Bug
CSV import showed "0 matched" despite correct matching logic.

### Investigation Steps

1. **Tested normalization functions** - All worked correctly in isolation
2. **Checked CSV parsing** - Data was being parsed correctly
3. **Examined storage calls** - Found `browser.storage.local.get()` usage
4. **Found missing polyfill** - `import.js` used `browser` without defining it

### The Fix

Added at top of `import.js`:
```javascript
// Browser API compatibility - Firefox uses 'browser', Chrome uses 'chrome'
const browser = typeof window !== 'undefined' && window.browser ? window.browser : 
               (typeof chrome !== 'undefined' ? chrome : null);

console.log('📥 Import page loaded v2.5 - Added browser API polyfill');
```

### Why It Failed Silently

The import flow:
1. User selects CSV file ✅
2. CSV gets parsed correctly ✅
3. Code tries to get pending bets: `browser.storage.local.get(['bets'])` ❌
4. `browser` is undefined → ReferenceError
5. Promise chain breaks, no matches returned
6. UI shows "0 matched" with no error visible

---

## Prevention Strategies

### 1. Consistent Codebase Audit
Run this search to find files using `browser.` without the polyfill:
```powershell
# Find files using browser API
Get-ChildItem -Path . -Filter "*.js" -Recurse | Select-String "browser\." | 
    Select-Object Path -Unique

# Check if polyfill exists in each
Get-ChildItem -Path . -Filter "*.js" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'browser\.' -and $content -notmatch 'const browser\s*=') {
        Write-Host "Missing polyfill: $($_.Name)"
    }
}
```

### 2. Standard File Header
Use a consistent header for all extension JS files:
```javascript
/**
 * [Component Name] - SB Logger Extension
 * @description Brief description
 */

// Browser API compatibility - Firefox uses 'browser', Chrome uses 'chrome'
const browser = typeof window !== 'undefined' && window.browser ? window.browser : 
               (typeof chrome !== 'undefined' ? chrome : null);

console.log('📥 [ComponentName] loaded vX.X');
```

### 3. Test in Both Browsers
Always test in:
- Chrome/Edge/Brave (Chromium-based)
- Firefox

### 4. ESLint Rule (Future)
Consider adding ESLint with `no-undef` rule to catch undefined `browser` usage.

---

## Quick Reference

### Symptom → Fix Mapping

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Feature works in Firefox, fails in Chrome | Missing browser polyfill | Add polyfill to top of file |
| `ReferenceError: browser is not defined` | Missing browser polyfill | Add polyfill to top of file |
| Storage operations return undefined | Missing browser polyfill OR async handling | Add polyfill, check await/then |
| "0 matched" or empty results | Storage get failed silently | Add debug logging, check polyfill |

### The Universal Fix

```javascript
const browser = typeof window !== 'undefined' && window.browser ? window.browser : 
               (typeof chrome !== 'undefined' ? chrome : null);
```

---

## Related Files

- `IMPLEMENTATION_GUIDE.md` - General implementation patterns
- `TESTING_GUIDE.md` - Testing procedures
- `DEBUG_LOGGING_QUICK_REFERENCE.md` - Debug logging patterns

---

**Last Updated**: November 2025  
**Issue Fixed**: CSV Import showing 0 matches in Chrome  
**Version**: v1.0.89
