#!/usr/bin/env python3
"""Debug OddsPortal HTML structure to find correct selectors."""

import asyncio
import sys
from pathlib import Path

# Add OddsHarvester to path
ODDS_HARVESTER_PATH = Path(__file__).parent / "OddsHarvester"
sys.path.insert(0, str(ODDS_HARVESTER_PATH / "src"))

from playwright.async_api import async_playwright

async def debug_oddsportal():
    """Debug the actual HTML structure of OddsPortal."""
    
    url = "https://www.oddsportal.com/basketball/usa/nba/"
    
    print(f"\n{'='*80}")
    print(f"Debugging OddsPortal HTML Structure")
    print(f"{'='*80}")
    print(f"URL: {url}\n")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)  # Show browser for debugging
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("📡 Navigating to OddsPortal NBA page...")
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)  # Wait for JS to load
            
            print("✅ Page loaded\n")
            
            # Check various selectors
            selectors_to_test = [
                # Old selector (not working)
                "div.flex.justify-between.border-b.border-black-borders",
                
                # Common alternatives
                "div[class*='eventRow']",
                "div[class*='event-row']",
                "div[class*='match']",
                "a[href*='/basketball/']",
                
                # Generic table/list structures
                "table tr",
                "div.table-container",
                "div[role='row']",
                
                # Try finding by text
                "div:has-text('vs')",
                "div:has-text('NBA')",
            ]
            
            print("🔍 Testing Selectors:\n")
            for selector in selectors_to_test:
                try:
                    elements = await page.query_selector_all(selector)
                    count = len(elements)
                    status = "✅" if count > 0 else "❌"
                    print(f"{status} {selector:<60} → {count} matches")
                    
                    # If we found matches, show sample
                    if count > 0 and count <= 5:
                        for i, elem in enumerate(elements[:3]):
                            html = await elem.inner_html()
                            text = await elem.inner_text() if await elem.is_visible() else "[hidden]"
                            print(f"   Sample {i+1}: {text[:100]}")
                            
                except Exception as e:
                    print(f"❌ {selector:<60} → Error: {e}")
            
            # Get full page HTML for analysis
            html = await page.content()
            
            # Save to file
            debug_file = Path(__file__).parent / "oddsportal_debug.html"
            debug_file.write_text(html, encoding='utf-8')
            print(f"\n💾 Full HTML saved to: {debug_file}")
            print(f"   Size: {len(html):,} bytes")
            
            # Look for class patterns in the HTML
            print("\n🔎 Analyzing HTML for class patterns...")
            import re
            classes = re.findall(r'class="([^"]+)"', html)
            unique_classes = set()
            for class_str in classes:
                unique_classes.update(class_str.split())
            
            # Filter to likely event/match/row classes
            event_classes = [c for c in unique_classes if any(kw in c.lower() for kw in ['event', 'match', 'row', 'game', 'fixture'])]
            
            print(f"\n📋 Potential event-related classes ({len(event_classes)} found):")
            for cls in sorted(event_classes)[:20]:
                print(f"   - {cls}")
            
            print("\n⏸️  Browser will stay open for manual inspection...")
            print("   Press Ctrl+C to close browser and exit")
            
            # Keep browser open for manual inspection
            await asyncio.sleep(300)  # 5 minutes
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            
        finally:
            await browser.close()

if __name__ == "__main__":
    print("\n🚀 Starting OddsPortal selector debugging...")
    print("   This will open a browser window for visual inspection")
    print("   Check the console output for selector test results\n")
    
    asyncio.run(debug_oddsportal())
