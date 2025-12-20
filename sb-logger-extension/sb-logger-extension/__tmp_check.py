from pathlib import Path
import re
text=Path('background.js').read_text(encoding='utf-8')
pattern=r"  if \(message\.action === 'consumePendingBet'\) \{[\s\S]*?\n  \}\n"
m=re.search(pattern,text)
print(bool(m))
print(m.start() if m else None)
