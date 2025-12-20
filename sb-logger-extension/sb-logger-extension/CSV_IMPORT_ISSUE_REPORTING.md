# CSV Import Issue Reporting

## Overview

This document explains the new `Report Match Issue` feature added to the CSV import page. It helps you capture detailed debug data and open a pre-filled GitHub issue to help developers debug import/matching failures.

## What this feature captures

- Raw CSV entries parsed during import and their detected format (Smarkets, Betfair, Betfair Exchange, Unknown)
- Normalized CSV event/market strings
- Pending bets at time of import
- Detailed per-entry match attempts, including:
  - Event/Market normalization
  - Event similarity metric (token overlap)
  - Market similarity (Levenshtein distance and token overlap)
  - Common tokens and shared market types
  - Match reason (exact, fuzzy/levenshtein, token overlap, market type + numbers)
- Full JSON debug payload copied to clipboard
- A condensed Markdown summary pre-filled in a GitHub issue URL (truncated if >8KB)

## How to use the feature

1. Go to the Import page (popup `Import` or `import.html`).
2. Select your CSV and import it.
3. After import completes, the `🐛 Report Match Issue` button appears beneath the import results.
4. Click the button → a Privacy modal opens explaining what will be shared publicly (events, market names, stakes, P/L amounts, bookmaker names).
5. If you confirm, the full JSON debug data is copied to your clipboard and a pre-filled GitHub issue page opens.
6. If the issue body is truncated (due to URL size limits), paste the full JSON into the issue body from the clipboard.

## Privacy & Security

- The GitHub issue will contain event names, market details, P/L amounts and stakes. These are publicly visible. The user must confirm in the modal before the report page is opened.
- The full JSON will be copied to your clipboard and not directly uploaded. This reduces the risk of accidental data leaks.

## When to use

- When CSV import results in zero matches or unexpected unmatched entries
- When normalization or fuzzy matching appears to fail for specific entries
- To diagnose problems across different CSV formats (Smarkets, Betfair, Betfair Exchange)

## How developers can use the report

- The pre-filled issue includes a short table of unmatched entries and pending bets, plus a console-style match attempt log for several unmatched entries.
  - The report also includes the first ~50 captured console log lines from the import page, which are useful for checking normalization and matching flows.
- Paste the full JSON from clipboard into the issue if needed for deeper debugging.
- Use `matchAttempts` data to re-run matching logic in a dev environment and reproduce failure conditions.

## Added files
- `CSV_IMPORT_ISSUE_REPORTING.md` — this document
- `import.js` — new debug capture logic, GitHub issue building and GitHub flow
- `import.html` — UI button and modal

---

**Last Updated:** November 29, 2025
