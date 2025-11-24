# Icon & Screenshot Update Tasks — Surebet Helper

This document outlines concrete steps to update visual assets for the rebrand.

## Which files to update
- Icons: `icons/icon48.png`, `icons/icon96.png` (and optionally 128/256 for stores)
- Screenshots: Add `screenshots/*.png` as listed in snapshots instructions in `screenshots/README.md`.
- README: update and reference the new screenshots and icons.
- `.gitignore`: decide whether to track icons and screenshots or keep them as local build assets.

## Recommended image sizes
- Icons:
  - 48×48 — UI action icon
  - 96×96 — store / larger displays
  - 128×128 — optional
  - 512×512 — store listing (Chrome Web Store): recommended for the web store assets
- Screenshots: 1280×720 or 1200×900 (store guidelines vary)

## Steps to create & add icons (recommended)
1. Design the new icons externally (transparent background PNGs).
2. Add icons to `icons/` with the final names `icon48.png`, `icon96.png`.
3. If you want icons checked into the repo (recommended for a public release):
   - Remove `icon48.png` and `icon96.png` from `.gitignore`.
   - Commit icons with proper `git add` and `git commit`.

Example (Powershell):
```powershell
# Copy new icons to the repo
Copy-Item -Path "C:\tmp\surebet-icon-48.png" -Destination ".\icons\icon48.png" -Force
Copy-Item -Path "C:\tmp\surebet-icon-96.png" -Destination ".\icons\icon96.png" -Force
# Stop ignoring icon files
# Edit .gitignore and remove icon48.png and icon96.png entries, then:
git add .\icons\icon48.png .\icons\icon96.png
git commit -m "chore(icons): add Surebet Helper icons"
``` 

## Adding screenshots for README and store
1. Take screenshots of the extension UI in the real browser.
2. Save them to `screenshots/` and update `screenshots/README.md` with file names.
3. Reference images in the `README.md` so they appear in the GitHub repo.

## Store assets & promotional images
- Use a `store-assets/` folder (not in `.gitignore`) for Chrome/Firefox promotional banners and listing icons. This helps maintain consistent store assets.
- Fill store pages: `headshot` icons, promotional images, screenshots.

## Guidelines & automation
- If you want a script to resize images, consider an optional `tools/resize_images.ps1` script to produce sizes from one source image.
- If you'd like, I can add a small PowerShell script to resize and create the canonical icon sizes.

Example resize script (needs ImageMagick or Windows installed tool):
```powershell
# Install ImageMagick on Windows or use your editor to produce icons.
magick convert "icons/source.svg" -resize 48x48 "icons/icon48.png"
magick convert "icons/source.svg" -resize 96x96 "icons/icon96.png"
magick convert "icons/source.svg" -resize 128x128 "icons/icon128.png"
magick convert "icons/source.svg" -resize 512x512 "icons/icon512.png"
``` 

---
If you'd like me to: 
- Add a resize script, or
- Remove the `icon48.png`/`icon96.png` lines from `.gitignore` and add placeholder icons, or
- Add a `store-assets/` folder and sample README content — tell me which and I’ll run it now.