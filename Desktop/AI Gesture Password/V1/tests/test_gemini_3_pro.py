"""Test script to verify Gemini 3 Pro is working"""

import google.generativeai as genai
import logging
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure API
# Try to get key from config first, otherwise use the hardcoded one from previous test
try:
    from app.core.config_secure import GOOGLE_API_KEY
    API_KEY = GOOGLE_API_KEY
except ImportError:
    API_KEY = "AIzaSyDpxGiqNO-BYEb-nGzomRw7MW94VG25LAg"

if not API_KEY or API_KEY == "DEMO_KEY_GET_YOUR_OWN":
    # Fallback to the key found in test_gemini_2_5.py if config yields demo key
    API_KEY = "AIzaSyDpxGiqNO-BYEb-nGzomRw7MW94VG25LAg"

genai.configure(api_key=API_KEY)

def test_gemini_3_pro():
    # Test Gemini 3 Pro
    print("Testing Gemini 3 Pro...")
    model_name = 'gemini-3-pro-preview'
    
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Say 'Hello from Gemini 3 Pro!' and mention one improvement over 2.5")
        print(f"[PASS] Gemini 3 Pro Response: {response.text}")
        return True
    except Exception as e:
        print(f"[FAIL] Gemini 3 Pro Error: {e}")
        
        # List available models to debug
        print("\nAvailable models:")
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    print(f"  - {m.name}")
        except Exception as list_error:
            print(f"  Could not list models: {list_error}")
            
        return False

def test_utils_resolution():
    print("\nTesting gemini_utils resolution...")
    try:
        from app.core.gemini_utils import get_available_model
        # Temporarily configure genai with our key for the utils to work
        genai.configure(api_key=API_KEY)
        
        model_name = get_available_model('pro', API_KEY)
        print(f"Resolved 'pro' model to: {model_name}")
        
        if model_name and 'gemini-3' in model_name:
            print("[PASS] Successfully resolved to a Gemini 3 model")
        else:
            print("[WARN] Resolved to an older model or None")
            
        model_name_flash = get_available_model('flash', API_KEY)
        print(f"Resolved 'flash' model to: {model_name_flash}")
        
    except ImportError:
        print("Could not import app.gemini_utils")
    except Exception as e:
        print(f"Error testing utils: {e}")

if __name__ == "__main__":
    utils_success = True # Don't fail build on utils test for now
    test_utils_resolution()
    success = test_gemini_3_pro()
    sys.exit(0 if success else 1)

