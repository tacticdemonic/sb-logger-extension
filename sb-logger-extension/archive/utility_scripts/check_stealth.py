import sys
print(f"Python: {sys.executable}")
print(f"Path: {sys.path}")
try:
    import playwright_stealth
    from playwright_stealth import stealth_async
    print("SUCCESS: playwright_stealth imported")
    print(f"Location: {playwright_stealth.__file__}")
except ImportError as e:
    print(f"ERROR: {e}")
except Exception as e:
    print(f"ERROR: {e}")
