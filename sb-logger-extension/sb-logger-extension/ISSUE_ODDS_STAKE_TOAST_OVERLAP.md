# Odds change and stake auto-filled toast notifications overlap ⚠️

## Summary

When both the "Odds changed" warning and the "Stake auto-filled" success toasts appear almost simultaneously, they visually overlap in the top-right area and can obscure each other. This reduces clarity and can make one of the important messages unreadable.

---

## Where this happens (code references) 🔎

- Duplicate `showToast` implementations appear in `contentScript.js`:
  - `showToast(message, duration = 3000)` first defined in `contentScript.js`.
  - `showToast(text, success = true, duration = 2500)` later defined in `contentScript.js` and the `.surebet-helper-toast` class is used for styles.
- The relevant auto-fill and odds changed code is around these sections in `contentScript.js`:
  - Odds changed: `showToast(`⚠️ Odds changed! Expected ${expectedOdds}, now ${currentOdds}``, false);
  - Stake auto-fill success: `showToast(`✓ Stake auto-filled: ${betData.currency || '£'}${betData.stake}``, true, 2000);
- Toast styling: `.surebet-helper-toast` CSS block appears in `contentScript.js` and is used with a `position: fixed` style.

---

## Repro steps 🧭

1. Load the extension as unpacked in a Chromium-based browser (see `INSTALL.md`).
2. Enable auto-fill and include `smarkets` in the auto-fill bookmakers list.
3. Save a bet on surebet.com and navigate to the exchange.
4. Simulate a small odds change between the saved `betData.odds` and the exchange’s betslip odds (edit the input or use a test scenario).
5. Watch both toasts appear: one for "Odds changed" and one for "Stake auto-filled" — they often show at the same time and overlap.

---

## Observed behavior

- Multiple toasts are appended to the DOM at the same fixed coordinates, causing them to overlap.
- The user may not be able to see or read one of the messages (usually the "Odds changed" warning).
- There is no stacking, queueing, or container management for toasts.

---

## Expected behavior ✅

- Toasts should never overlap.
- Display multiple messages as stacked items or queue them sequentially so users can read each one.
- Preserve quick UX for confirmations while ensuring that warnings are visible.

---

## Root cause & code findings 🔧

- Duplicate `showToast` functions and duplicate toast style definitions exist in `contentScript.js` and produce inconsistent behavior.
- Both the "Odds changed" and the "Stake auto-filled" events trigger toasts and append them to `document.body` at the same coordinates without stacking logic.
- There is no central `toast container` to manage stacking and consistent placement.

---

## Suggested fixes / implementation plan 🛠️

High-priority, minimal changes:
1. Remove duplicate `showToast` definition (keep a single, consistent implementation).
2. Add a `#surebet-helper-toast-container` as a fixed container at the top-right:
   - Container CSS:
     ```css
     #surebet-helper-toast-container {
       position: fixed;
       top: 16px;
       right: 16px;
       display: flex;
       flex-direction: column;
       gap: 8px;
       z-index: 999999;
     }
     .surebet-helper-toast {
       pointer-events: auto;
       /* existing toast styles */
     }
     ```
   - Append toasts as children of this container so they stack vertically.
3. Standardize `showToast` signature and behavior:
   - Use `showToast(message, type='success'|'error'|'warn', duration=2500)` or a comparable signature.
   - Add `aria-live="polite"` to the container for accessibility.
4. Optional: Coalesce messages:
   - If `Odds changed` appears within a short timeframe before/after `Stake auto-filled`, consider coalescing them into a single toast or set a short debounce to prevent immediate overlap.
5. Clean up style duplicates:
   - Remove the inline bottom-right style (old `showToast`) or consolidate CSS into the `.surebet-helper-toast` class.

Suggested code snippet:
```javascript
// Create the toast container (call once at init)
function getToastContainer() {
  let container = document.getElementById('surebet-helper-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'surebet-helper-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 999999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

function showToast(text, success = true, duration = 2500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'surebet-helper-toast ' + (success ? 'success' : 'error');
  toast.style.pointerEvents = 'auto';
  toast.textContent = text;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}
```

---

## Tests to validate fix 🧪

- Manual:
  - Reproduce the original overlap by causing both messages to appear and verify stacking.
  - Rapidly trigger multiple toasts (≥3) and verify that stacking and removal behave correctly.
- Edge cases:
  - Verify `smarkets` and other exchange sites where odds validation occurs.
  - Ensure toasts appear in the correct order when timing differences exist.
  - Verify accessible announcements for screen readers (aria-live).

---

## Severity / priority

- Medium: UX clarity affects the user but does not break core functionality. Fix is low-risk and should be prioritized.

---

## PR checklist ✅

- Remove duplicate `showToast`.
- Add `#surebet-helper-toast-container` and consolidated CSS.
- Update `showToast` sign-in and calls across the codebase.
- Add sanitize/coalesce or debounce logic if needed.
- Add a small unit/minimal manual test and include instructions in the PR description.

---

## References

- `contentScript.js` - duplicate `showToast` functions and `.surebet-helper-toast` CSS definition.
- `contentScript.js` - `Odds changed` and `Stake auto-filled` call sites.
