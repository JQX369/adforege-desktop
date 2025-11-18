"""Test script to verify Gemini 2.5 Pro is working"""

import google.generativeai as genai

# Configure API
API_KEY = "AIzaSyDpxGiqNO-BYEb-nGzomRw7MW94VG25LAg"
genai.configure(api_key=API_KEY)

# Test both models
print("Testing Gemini 2.5 Pro...")
try:
    model_25 = genai.GenerativeModel('gemini-2.5-pro')
    response = model_25.generate_content("Say 'Hello from Gemini 2.5 Pro!' and mention one improvement over 1.5")
    print(f"✅ Gemini 2.5 Pro Response: {response.text}")
except Exception as e:
    print(f"❌ Gemini 2.5 Pro Error: {e}")

print("\nAvailable models:")
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(f"  - {model.name}") 