"""Helper script to set Google API key in config file"""

import json
from pathlib import Path

def set_api_key(api_key: str):
    """Set Google API key in config file"""
    config_path = Path.home() / '.guerillascope' / 'config.json'
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    config = {
        'google_api_key': api_key,
        'analytics_enabled': True,
        'auto_update_check': True
    }
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
    
    print(f"[OK] API key saved to: {config_path}")
    print("[OK] Restart the app for changes to take effect")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python set_api_key.py YOUR_API_KEY")
        print("\nExample:")
        print('  python set_api_key.py "AIzaSy...your_key_here..."')
        sys.exit(1)
    
    api_key = sys.argv[1]
    set_api_key(api_key)

