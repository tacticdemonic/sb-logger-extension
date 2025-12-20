# Quick Reference: New Analysis Features

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 ANALYSIS DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────┤
│  SUMMARY STATS (Always Visible)                                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │ Yield    │ P.Factor │ Turnover │ Net P/L  │ Avg Bet  │       │
│  │  5.23%   │  1.82    │ £1250    │ £65.38   │ £31.25   │       │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤       │
│  │ Max DD   │ Curr DD  │ Win Str. │ Loss Str │          │       │
│  │ £42.15   │ £12.50   │    8     │    5     │          │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  NAVIGATION                                                      │
│  [📈 Chart] [📊 Performance] [💧 Liquidity] [🏢 Bookmakers]    │
│  [⏰ Time] [🎲 Kelly] [💾 Export]                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 PERFORMANCE TAB (NEW)                                       │
│                                                                  │
│  1. ODDS BAND PERFORMANCE                                       │
│     ┌─────────────────────────────────────┐                    │
│     │ [==========] ROI 7.85%  ← 1.00-1.50│                    │
│     │ [=============] ROI 9.24% ← 1.51-2.00                   │
│     │ [======] ROI 4.15%   ← 2.01-3.00                        │
│     │ [=] ROI -2.31%     ← 3.01-5.00                          │
│     │ [=====] ROI 6.71%   ← 5.01+                             │
│     └─────────────────────────────────────┘                    │
│                                                                  │
│     │ Odds Band  │ n  │ Actual│ Expected │ Dev  │ ROI % │     │
│     ├────────────┼────┼───────┼──────────┼──────┼───────┤     │
│     │ 1.00-1.50  │ 24 │ 54.2% │ 53.1%    │+1.1% │ 7.85%│     │
│     │ 1.51-2.00  │ 28 │ 50.0% │ 49.2%    │+0.8% │ 9.24%│     │
│     │ 2.01-3.00  │ 27 │ 48.1% │ 50.5%    │-2.4% │ 4.15%│     │
│     │ 3.01-5.00  │  8 │ 37.5% │ 41.2%    │-3.7%*│-2.31%│ ⚠️ Low  │
│     │ 5.01+      │ 13 │ 46.2% │ 39.1%    │+7.1% │ 6.71%│     │
│     └────────────┴────┴───────┴──────────┴──────┴───────┘     │
│     * Low sample size (n<20) — use with caution               │
│                                                                  │
│  2. OVERVALUE DISTRIBUTION (Histogram)                         │
│     ┌─────────────────────────────────────┐                    │
│     │  30 ┤                                 │                  │
│     │     │     ┌─┐                        │                  │
│     │  20 ┤     │ │     ┌─┐                │                  │
│     │     │  ┌─┐│ │  ┌─┐│ │             ┌─┐│                │
│     │  10 ┤  │ ││ │  │ ││ │          ┌─┐│ ││                │
│     │     │  │ ││ │  │ ││ │       ┌──│ ││ ││                │
│     │   0 └──┴─┴─┴──┴─┴─┴─┴───────┴──┴─┴─┴─┘                │
│     │       0-1% 1-2% 2-3% 3-5%  5%+                          │
│     └─────────────────────────────────────┘                    │
│                                                                  │
│     │ Overvalue  │ n  │ ROI %  │ Calibration        │         │
│     ├────────────┼────┼────────┼────────────────────┤         │
│     │ 0-1%       │ 12 │ 2.45%  │ Slight underperform│ ⚠️ Low  │
│     │ 1-2%       │ 28 │ 5.12%  │ Well calibrated   │         │
│     │ 2-3%       │ 32 │ 7.84%  │ Well calibrated   │         │
│     │ 3-5%       │ 24 │ 9.67%  │ Outperforming ✓   │         │
│     │ 5%+        │ 14 │ 12.34% │ Strong outperform │ ⚠️ Low  │
│     └────────────┴────┴────────┴────────────────────┘         │
│                                                                  │
│  3. SPORT BREAKDOWN                                             │
│     ┌─────────────────────────────────────┐                    │
│     │ [===============] Football  8.34%    │                   │
│     │ [===========] Tennis      5.67%     │                   │
│     │ [======] Basketball      3.12%     │                   │
│     │ [=======] Other Sports   3.89%     │                   │
│     └─────────────────────────────────────┘                    │
│                                                                  │
│     │ Sport      │ n  │ ROI % │ Avg Odds│ Avg OV │ P/L    │   │
│     ├────────────┼────┼───────┼─────────┼────────┼────────┤   │
│     │ Football   │ 68 │ 8.34% │ 2.15    │ 3.2%   │ £124.50│   │
│     │ Tennis     │ 42 │ 5.67% │ 1.87    │ 2.8%   │ £72.30 │   │
│     │ Basketball │ 18 │ 3.12% │ 2.42    │ 2.5%   │ £25.80 │   │
│     │ Other      │ 13 │ 3.89% │ 2.01    │ 3.1%   │ £12.45 │   │
│     └────────────┴────┴───────┴─────────┴────────┴────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Color Coding

| Color | Meaning |
|-------|---------|
| 🟢 Green (#28a745) | Positive ROI, positive deviation, winning streaks |
| 🔴 Red (#dc3545) | Negative ROI, negative deviation, drawdowns, losses |
| 🟡 Gray (50% opacity) | Low sample size (n<20) — insufficient data confidence |
| ⚪ Blue | Default/neutral metrics (odds, avg stake, etc.) |

---

## Key Metrics Explained

### **Yield (ROI %)**
```
Formula: (Net Profit ÷ Total Turnover) × 100
Example: £65.38 ÷ £1,250 × 100 = 5.23%
Interpretation: 5.23% return on every pound wagered (excellent)
Target: >2% is profitable, >5% is very strong
```

### **Profit Factor**
```
Formula: Total Wins ÷ Total Losses
Example: £2,100 total wins ÷ £1,034.62 total losses = 1.82
Interpretation: For every £1 lost, you win £1.82
Target: >1.5 is strong, >2.0 is excellent
```

### **Deviation (Actual vs Expected)**
```
Formula: Actual Win Rate - Expected Win Rate
Example: 52.0% actual - 50.5% expected = +1.5% deviation
Interpretation: Beating market probability estimates by 1.5%
High deviation (+5% to +10%): May indicate skill or luck
Very high deviation (+10%+): Possible systematic edge or data issue
Negative deviation: Underperforming probability estimates
```

### **Significance Indicator**
```
High:   n ≥ 20 bets  — Reliable (statistically sound)
Medium: 10 ≤ n < 20  — Provisional (need more data)
Low:    n < 10       — Unreliable (too small a sample)
```

---

## Workflow Examples

### **Calibrating Edge Detection**
1. Go to **📊 Performance → Overvalue Distribution**
2. Check if higher overvalue ranges have higher actual ROI%
3. If 5%+ edges don't beat 1-2% edges, adjust edge signal confidence
4. Look for consistent +2% to +5% deviation across all ranges

### **Identifying Profitable Markets**
1. Go to **📊 Performance → Sport Breakdown**
2. Sort by ROI % (highest first)
3. Identify sports with n≥20 and ROI >5%
4. Focus future bets in those high-confidence, high-ROI sports
5. Avoid sports with negative ROI or low sample size

### **Betting Condition Analysis**
1. Go to **📊 Performance → Odds Band Performance**
2. Identify which odds ranges give best ROI%
3. If 1.50-2.00 range vastly outperforms others, adjust odds targeting
4. Use this to optimize bet selection and placement

### **Bankroll Risk Assessment**
1. Check **Max Drawdown** in summary stats
2. If current bankroll £500 and max drawdown £250, you need >£250 safety margin
3. Adjust position sizing if drawdown exceeds 30% of bankroll
4. Use Kelly fill ratio to right-size bets going forward

---

## Export & Analysis

### **JSON Export Includes:**
- Full bet history
- Summary stats (yield, profit factor, drawdowns)
- Performance breakdown (odds bands, overvalue, sports)
- Liquidity tier analysis
- Bookmaker profiling
- Temporal analysis
- Kelly metrics

**Use for:** Long-term trend analysis, backtesting, detailed spreadsheet analysis

### **CSV Export Includes:**
- Individual bet details
- Calculated columns (commission, actual P/L, fill ratio)
- Limited to single-bet metrics (no aggregate analysis)

**Use for:** Spreadsheet analysis, pivot tables, row-level filtering

---

## Tips & Tricks

💡 **Use Low-Sample Rows as Learning Opportunities**
Even if a sport only has 8 bets, view it as preliminary data to gather before making strategic decisions.

💡 **Track Deviation Over Time**
Export JSON weekly to watch deviation trends. If deviation trends negative, recalibrate.

💡 **Profit Factor > Yield**
Monitor both metrics. High profit factor + low yield = good but small average win size. Adjust stake sizing upward.

💡 **Streaks as Risk Indicators**
Long loss streaks (5+) are normal variance. Long win streaks (8+) may indicate data quality issues or genuine edge. Investigate.

💡 **Combine Analyses**
High ROI in Football (Sport) + High ROI in 1.50-2.00 odds band (Odds) = Double-confirm: focus on Football bets in 1.50-2.00 range.

---

**Last Updated:** November 26, 2025 | **Version:** 1.0.76
