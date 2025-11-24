# PR: Rebrand to Surebet Helper + Active toast removal

Checklist for reviewer:

- [ ] Confirm the `manifest.json` name, id, author, homepage_url and version are updated.
- [ ] Confirm all UI strings show `Surebet Helper` in console logs and extension UI.
- [ ] Confirm `contentScript.js` no longer shows the old “Active” toast.
- [ ] Confirm `popup.js` export filenames use `surebet-bets-`.
- [ ] Confirm `BETTING_SLIP_SELECTORS` include correct exchange selectors and that `findElement()` excludes the extension's UI.
- [ ] Confirm `.gitignore` changes if icons are now included, and icons have correct names (optional).
- [ ] Confirm `screenshots/` added and referenced in `README.md`.
- [ ] Confirm tests run without errors: run smoke tests and manual checks across surebet.com and exchange domains.

Suggested PR title: `Rebrand: Surebet Helper + Remove Active Toast (UI tidy)`

Suggested release note draft:
> Rebranded extension to "Surebet Helper". Removed the non-critical "Active" popup that was occluding the important "Odds changed!" warning. Updated UI strings, manifest metadata, helper scripts, and documentation. See `RELEASE_AND_REBRAND_CHECKLIST.md` for publishing steps.

Include screenshots and QA checklist in PR body.
