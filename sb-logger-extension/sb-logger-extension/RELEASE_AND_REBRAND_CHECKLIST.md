# Surebet Helper — Release & Rebrand Checklist

This checklist helps you complete the final steps for rebranding and publishing the extension as "Surebet Helper".

## 1. GitHub repository rename (manual)
- Rename the repo on GitHub from `sb-logger-extension` → `surebet-helper-extension` (or desired repo name).
- Update `homepage_url` and all links already done in repo files; ensure GitHub redirects automatically.
- Update the repo description, topics, and README badges.
- Update the remote in your local clone (if needed):

```powershell
# From your working dir
git remote set-url origin git@github.com:tacticdemonic/surebet-helper-extension.git
# Verify
git remote -v
``` 

## 2. Update visual assets (icons & screenshots)
- Replace or create new icons in `icons/`:
  - Recommended sizes: 48x48, 96x96, 128x128 (and higher for store images)
  - Filenames: `icons/icon48.png`, `icons/icon96.png`.
  - Keep manifest icon paths consistent.
- Update favicon and store assets (if using web stores).

Screenshot file names suggested for `screenshots/`:
- `save-button.png`
- `popup-bets.png`
- `stake-prompt.png`
- `settled-bets.png`
- `chart-view.png`
- `export-options.png`
- `filter-presets.png`

Recommended steps:
```powershell
# Add icons/screenshot images to repo
# Example:
Copy-Item -Path "C:\path\to\new-icon48.png" -Destination ".\icons\icon48.png" -Force
Copy-Item -Path "C:\path\to\new-icon96.png" -Destination ".\icons\icon96.png" -Force
# Add screenshot files to screenshots/ folder
``` 

## 3. Smoke tests & verification
- Load extension unpacked in a Chromium-based browser (Chrome/Edge/Brave) and Firefox.
- On surebet.com value bets page, confirm:
  - Save button shows on value bets rows.
  - Clicking the save button stores a bet in the popup list.
  - The `Odds changed!` toast appears (and is not hidden by the plugin active toast). The old "Active" toast was removed.
  - Auto-fill on exchanges (Betfair, Smarkets, Matchbook) still finds betting slip inputs (use `BETTING_SLIP_SELECTORS` for each exchange).
  - Popup export filenames start with `surebet-bets-` for CSV/JSON.
- Verify no console errors (open extension DevTools for surebet.com and exchange domains).

## 4. Final manifest & versioning
- Confirm `manifest.json` contains:
  - `name`: `Surebet Helper - Save Bets`
  - `version`: bump appropriately (e.g., `1.0.46` for minor or `2.x.x` for major rebrand)
  - `homepage_url`, `author`, `browser_specific_settings.gecko.id` updated.

## 5. Packaging & signing
- For Firefox via web-ext (as used previously):
```powershell
cd "C:\Local\Surebet Helper\surebet-helper-extension\surebet-helper-extension"
# Sign with web-ext (existing API key)
web-ext sign --api-key=<API_KEY> --api-secret=<API_SECRET> --channel=unlisted
```
- For Chromium stores, create a release zip and upload to the Chrome Web Store developer console.

## 6. Release & publishing
- Create a GitHub Release with the new version and release notes.
- Tag the repo; push tags.
- Upload store assets (icons/screenshots) in respective dev consoles.
- After publishing, update the README with links to the store listings.

## 7. PR & Code changes to push
- Prepare a final PR with these metadata updates (or push directly if you're the repo owner):
  - Manifest changes
  - Visual assets
  - Documentation updates
  - Tests and smoke check notes
- Suggested PR description: rebrand to Surebet Helper + remove non-critical active toast + updated assets + version bump

## 8. Post-release checklist
- Monitor usage & bugs from initial users
- Update icons in both browsers if required
- Update CI & release scripts to use new repo name if present

---

If you want, I can now:
1) Run a quick static verification smoke-test script (search for `showToast`, `BETTING_SLIP_SELECTORS`, `manifest.json` metadata) — done earlier.
2) Replace icon files with new assets (if provided) and update the manifest.
3) Create a PR skeleton (branch, commit) and prepare a release note draft.

Tell me which of the follow-ups you want me to run next.