from pathlib import Path
import re
path = Path('background.js')
text = path.read_text(encoding='utf-8')
pattern = r"  if \(message\.action === 'consumePendingBet'\) \{[\s\S]*?\n  \}\n"
m = re.search(pattern, text)
if not m:
    raise SystemExit('not found')
new_block = """  if (message.action === 'consumePendingBet') {\n    (async () => {\n      console.log('Surebet Helper: ?Y"? Broker consuming pendingBet');\n\n      let betData = global_pendingBetCache || null;\n\n      // Clear memory cache\n      global_pendingBetCache = null;\n\n      // If nothing in memory, try storage before clearing\n      if (!betData) {\n        try {\n          const storageResult = await new Promise((resolve) => {\n            chrome.storage.local.get(['pendingBet'], resolve);\n          });\n          if (storageResult && storageResult.pendingBet && storageResult.pendingBet.id) {\n            betData = storageResult.pendingBet;\n            console.log(`Surebet Helper: ?o" Retrieved pendingBet from storage (ID: ${betData.id})`);\n          }\n        } catch (err) {\n          console.warn('Surebet Helper: ?s? Failed to read pendingBet from storage:', err && err.message);\n        }\n      }\n\n      // Clear from storage only if something was found\n      if (betData) {\n        chrome.storage.local.remove('pendingBet', () => {\n          if (chrome.runtime.lastError) {\n            console.warn('Surebet Helper: ?s? Failed to clear pendingBet from storage:', chrome.runtime.lastError);\n          } else {\n            console.log('Surebet Helper: ?o" Cleared pendingBet from chrome.storage.local');\n          }\n        });\n      }\n\n      if (betData) {\n        console.log(`Surebet Helper: ?o" Broker returned pendingBet (ID: ${betData.id})`);\n      } else {\n        console.log('Surebet Helper: ?s? Broker found no pendingBet');\n      }\n\n      sendResponse({ success: true, betData });\n    })();\n    return true;\n  }\n"""
text = text[:m.start()] + new_block + text[m.end():]
path.write_text(text, encoding='utf-8')

