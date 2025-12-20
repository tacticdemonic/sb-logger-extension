# Market Filters Feature Guide

## Overview
The Market Filters feature allows you to hide or highlight specific bet types based on historical performance analysis. This helps you avoid underperforming markets (cards, Asian handicaps, DNB) and focus on profitable ones (goals, corners).

## Quick Start

### Accessing Market Filters

Go to **Settings → 🎯 Market Filters** to configure all filter settings and presets.

### Enabling Filters

1. Open Settings (⚙️ button in popup)
2. Navigate to **🎯 Market Filters** tab
3. Check **Enable Market Filter** checkbox
4. Choose your filter mode:
   - **Hide**: Completely remove filtered bets from view
   - **Highlight Red**: Keep filtered bets visible with red styling and ⚠️ warning badge
5. Click on preset boxes to toggle filters on/off (active presets show green border and "✓ Active" badge)

## Available Presets

### Blacklist Presets (Block These Markets)

#### 🚫 Cards/Bookings
- **Keywords**: card, booking, yellow, red
- **ROI**: Calculated dynamically from your settled bets
- **Examples**: "Yellow cards", "Total bookings over 3.5", "Red card - Yes"

#### 🚫 Asian Handicaps
- **Keywords**: asian handicap, ah
- **ROI**: Calculated dynamically from your settled bets
- **Examples**: "Asian handicap +1.5", "AH -0.5"

#### 🚫 Draw No Bet
- **Keywords**: draw no bet, dnb
- **ROI**: Calculated dynamically from your settled bets
- **Examples**: "Draw no bet - Home", "DNB - Away"

### Whitelist Presets (Show Only These Markets)

#### ✅ Goals Only
- **Keywords**: goal, btts, over, under, total
- **ROI**: Calculated dynamically from your settled bets
- **Examples**: "Over 2.5 goals", "BTTS - Yes", "Total goals under 3.5"

#### ✅ Corners Only
- **Keywords**: corner
- **ROI**: Calculated dynamically from your settled bets
- **Examples**: "Total corners over 9.5", "Corner handicap +2.5"

### Dynamic ROI Calculation

ROI percentages are calculated in real-time from your actual bet history:
- **No data**: "No settled bets yet - filter still available"
- **Low data** (< 10 bets): "ROI: +X% (N bets) ⚠️ Low data - use cautiously" (orange)
- **Profitable** (ROI ≥ 10%): "ROI: +X% (N bets) ✓ Recommended" (green)
- **Slightly positive** (0% ≤ ROI < 10%): "ROI: +X% (N bets)" (green)
- **Slightly negative** (-10% ≤ ROI < 0%): "ROI: -X% (N bets) ⚠️ Slightly negative" (yellow)
- **High risk** (-30% ≤ ROI < -10%): "ROI: -X% (N bets) ⚠️ High risk" (orange)
- **Very high risk** (ROI < -30%): "ROI: -X% (N bets) ⚠️ Very high risk" (red)

## How It Works

### Precise Matching
Filters use word-boundary matching to avoid false positives:
- ✅ "Yellow card" matches the "card" filter
- ❌ "Scorecard" does NOT match the "card" filter

### Whitelist Priority Logic
- If ANY whitelist preset is active (Goals Only or Corners Only), blacklist filters are ignored
- Only markets matching the whitelist pattern(s) will be shown
- This ensures "Goals Only" truly shows ONLY goals-related markets

### Filter Modes

#### Hide Mode
- Filtered bets are completely removed from the bet list
- Summary shows count: "X market filtered"
- Use when you want a clean view of only acceptable bets

#### Highlight Red Mode
- Filtered bets remain visible with visual warnings:
  - Red left border (3px)
  - Light red background (#fee)
  - ⚠️ Filtered badge next to market name
- Use when you want to see all bets but identify risky ones

## Usage Examples

### Example 1: Block High-Risk Markets
1. Open Settings → Market Filters
2. Enable Market Filter
3. Choose "Hide" mode
4. Click "Cards/Bookings" and "Asian Handicaps" preset boxes
5. Result: All cards and Asian handicap bets are hidden from popup

### Example 2: Focus on Goals Only
1. Open Settings → Market Filters
2. Enable Market Filter
3. Choose either mode (hide or highlight)
4. Click "Goals Only" preset box
5. Result: Only goals-related markets are shown (corners, cards, etc. are filtered out)

### Example 3: See All but Warn About Cards
1. Open Settings → Market Filters
2. Enable Market Filter
3. Choose "Highlight Red" mode
4. Click "Cards/Bookings" preset box
5. Result: All bets visible in popup, but cards markets have red styling and ⚠️ badge

## Performance Optimization

### Pattern Compilation
- Regex patterns are pre-compiled when popup loads
- Patterns are only re-compiled when presets change
- No performance impact on rendering thousands of bets

### Caching
- Filter preferences are persisted in `chrome.storage.local`
- Preset states are synced between popup and settings panel
- No duplicate API calls or storage reads

## Technical Details

### Storage Schema
```javascript
uiPreferences: {
  marketFilterEnabled: false,
  marketFilterMode: 'hide', // or 'highlight'
  activePresets: [] // e.g., ['cards', 'goals_only']
}
```

### Preset Definitions
Stored in `popup.js` as `MARKET_FILTER_PRESETS` constant:
```javascript
{
  cards: {
    name: '🚫 Cards/Bookings',
    keywords: ['card', 'booking', 'yellow', 'red'],
    type: 'block',
    roiWarning: 'Historical ROI: -65% (high risk)'
  },
  // ... other presets
}
```

### Pattern Matching
Uses compiled regex with word boundaries:
```javascript
/\b(card|booking|yellow|red)\b/i
```

## Troubleshooting

### Filter Not Working
1. Ensure "Enable Market Filter" checkbox is checked in Settings
2. Check that at least one preset box has green "✓ Active" badge
3. Verify your bets have `market` field populated
4. Check browser console for any errors
5. Close and reopen popup to refresh bet display

### Wrong Markets Being Filtered
1. Review preset keywords in Settings → Market Filters
2. Check for market name edge cases (e.g., "Goal handicap" contains both "goal" and "handicap")
3. Remember: whitelist presets override blacklist filters

### Preset Not Toggling
1. Reload the Settings page
2. Check that `uiPreferences.activePresets` is saving to storage (check console logs)
3. Try clicking the preset box again (should toggle green border and "✓ Active" badge)

## Version History

- **v1.0.95**: Added dynamic ROI calculation
  - ROI now calculated from actual settled bet history per market type
  - Low-data warning when fewer than 10 settled bets
  - Color-coded ROI indicators (green/yellow/orange/red)
  - Real-time updates when Settings panel is opened
  - Filters remain available even with no data
- **v1.0.94**: Initial release of Market Filters feature
  - 5 preset filters (3 blacklist, 2 whitelist)
  - Hide/Highlight modes
  - Whitelist-first logic
  - Performance optimizations (pattern caching)
  - Settings panel integration

## Future Enhancements

Potential additions in future versions:
- Custom keyword entry (user-defined filters)
- Regex pattern customization
- Per-sport filter presets
- Auto-enable filters based on ROI thresholds
- Filter analytics (show how many bets filtered per session)
