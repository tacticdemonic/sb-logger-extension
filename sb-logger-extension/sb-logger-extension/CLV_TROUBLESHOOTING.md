# CLV Tracking Troubleshooting Guide

Use this guide when CLV checks in the extension return empty results, stay Pending, or show scrape errors.

---

## Fast Triage (do these first)

1) **CSV Cache / Settings**  
Verify CLV is enabled and CSV caches are present. Use Settings → CLV → Force CLV Check to trigger an immediate download and match attempt. There is no local API server to run.

2) **Supported sport/league**  
Ensure the bet sport is supported (football only for CSV CLV) and the tournament name maps to a known CSV league (see `footballDataLeagues.js`). If a league does not match, add an alias or report it.

3) **Seed the cache**  
Use Settings → CLV → Force CLV Check to pre-populate CSV caches. This triggers downloads for CSV files necessary for eligible bets. If you want automation, write a script that sends `forceClvCheck` messages to the extension.

4) **Check the log**  
Use the extension's Diagnostics → Load Log and browser DevTools console (background tab) to inspect CSV fetches, parse status, and match confidence. Use DevTools → Network for low-level tracing.

5) **Confirm cache growth**  
Inspect DevTools → Application → Local Storage for keys like `csv_cache_<league>_<season>` and check the cached rows count.

6) **Retry in the extension**  
Enable CLV in Settings → CLV, then use Force CLV Check to re-run lookups and confirm results in the Diagnostics logs.

---

### Populate CSV Cache (on demand)
CSV CLV downloads files on-demand from `football-data.co.uk`. The extension will cache CSVs for 7 days. To ensure data is available:

1. Use Settings → CLV → Force Check Now to trigger CLV lookups and download necessary CSVs for leagues required by settled bets.
2. To pre-populate the cache manually, run a script that requests CLV for selected leagues or temporarily enable CLV and visit the Force Check button.

Note: Manual scraping via OddsHarvester is no longer supported.

### Notes on manual operations (Deprecated)
Manual scraping using OddsHarvester has been deprecated. To pre-populate the CSV cache, use the Force CLV Check button or run a script that triggers CSV fetching for desired leagues. These operations are handled by the extension; there is no local scraping command to run anymore.

To observe the browser, drop `--headless`.

---

## Supported inputs

### Sports
| Sport | Value |
|-------|-------|
| Football/Soccer | `football` |
| Tennis | `tennis` |
| Basketball | `basketball` |
| Rugby League | `rugby-league` |
| Rugby Union | `rugby-union` |
| Ice Hockey | `ice-hockey` |
| Baseball | `baseball` |

### Common league slugs
| League | Identifier |
|--------|------------|
| English Premier League | `england-premier-league` |
| English Championship | `england-championship` |
| Spanish La Liga | `spain-laliga` |
| German Bundesliga | `germany-bundesliga` |
| Italian Serie A | `italy-serie-a` |
| French Ligue 1 | `france-ligue-1` |
| UEFA Champions League | `champions-league` |
| UEFA Europa League | `europa-league` |
| Netherlands Eredivisie | `eredivisie` |
| Belgium Pro League | `jupiler-pro-league` |
| Portugal Liga | `liga-portugal` |
| NBA | `nba` |

> **Tip:** League mapping now uses `footballDataLeagues.js` inside the extension. If a league isn't matched automatically, add an alias in `footballDataLeagues.js`.

### Command flags
| Flag | Description |
|------|-------------|
| `--sport` | Required sport value. |
| `--leagues` | OddsPortal slug for the league. |
| `--season` | Season, e.g., `2024-2025` or `2024`. |
| `--scrape_odds_history` | Required for CLV: grabs closing odds history. |
| `--headless` | Run without showing the browser. Remove it for debugging. |
| `--max_pages` | Optional: limit scraped result pages. |

---

## Logs and validation

### Extension diagnostics and logs
There is no API log for OddsHarvester since the service is removed. Use the extension's diagnostic logs in Settings → Diagnostics → Load Log for recent CLV operations, match attempts, and failures. The popup and background console may also show errors.

### What common messages mean
| Message | Meaning / Action |
|---------|------------------|
| `Found 0 event rows` | Page did not render or layout changed. Retry non-headless to inspect. |
| `Page.goto: Timeout 15000ms exceeded` | Page too slow or blocked. Retry; try visible browser. |
| `React event header selector not found` | OddsPortal structure changed; verify page markup manually. |
| `invalid choice: 'other'` | Bet uses an unsupported sport; correct the bet data. |

### Cache location and size (CSV-based cache)
CSV cache is stored in the extension's local storage with keys prefixed by `csv_cache_<league>_<season>`. To inspect via PowerShell/Chrome DevTools:

- Use the browser extension's diagnostics, or open DevTools → Application → Storage → Local Storage and search for keys starting with `csv_cache_`.

### No local API health check
CSV-based CLV runs without a local server; there is no health endpoint. Use the extension's Diagnostics > Load Log to inspect operations and errors.

---

# Restarting Services

There is no local CLV API server to start. To refresh CSV-based CLV behavior:
- Use Settings → CLV → Clear CSV Cache to remove current caches; the extension will redownload CSVs on demand.
- Use Settings → CLV → Force CLV Check to re-run CLV lookup on eligible bets.

---

## Known limitations and quirks

### Supported Markets
**✅ CSV-Based CLV** supports the following market types for **22 European football leagues**:

#### Fully Supported (Pinnacle Closing Odds)
- **1X2 / Match Odds**: Home, Draw, Away
- **Over/Under 2.5 Goals**: Over 2.5, Under 2.5
- **Asian Handicap**: Any handicap line (e.g., -0.5, +1.0)

#### NOT Supported
- Shots on target (e.g., "Total over 8.5 - shot on target")
- Corners (e.g., "Total over 9.5 - corners")
- Cards (e.g., "Total over 3.5 - cards")
- Both Teams to Score (BTTS)
- Correct Score
- Player props
- Any other exotic markets

Data source: **football-data.co.uk** provides FREE Pinnacle closing odds for all supported markets. If your bets use unsupported markets, CLV data will not be available.

### Other Limitations
- OddsPortal rate limiting can slow or block scrapes; rerun with delays if needed.
- Individual pages can timeout after 15s; scraper continues to next page.
- Sport value `other` is unsupported for CLV scraping.
- Very recent events may not have closing odds indexed yet.
- Full season scrapes can take 10-15 minutes (API timeout is 15 minutes).

---

## Extension settings to verify
- Enable CLV Tracking is on.
- API URL is `http://localhost:8765`.
- Check Interval and Delay After Settlement are set to your preference.
- Use Force CLV Check after you know the cache contains the needed leagues.

---

Last updated: December 2024
