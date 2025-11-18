"""Test script to verify Video Emotion Analyzer setup"""

import sys
import importlib

def test_imports():
    """Test if all required packages can be imported"""
    packages = [
        ("cv2", "OpenCV"),
        ("numpy", "NumPy"),
        ("PIL", "Pillow"),
        ("mediapipe", "MediaPipe"),
        ("customtkinter", "CustomTkinter"),
        ("deepface", "DeepFace"),
        ("tensorflow", "TensorFlow"),
        ("moviepy", "MoviePy"),
        ("speech_recognition", "SpeechRecognition")
    ]
    
    all_good = True
    print("🔍 Testing package imports...\n")
    
    for module_name, display_name in packages:
        try:
            importlib.import_module(module_name)
            print(f"✅ {display_name} - OK")
        except ImportError as e:
            print(f"❌ {display_name} - FAILED: {e}")
            all_good = False
            
    return all_good

def test_camera():
    """Test if camera is accessible"""
    print("\n📷 Testing camera access...")
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            ret, frame = cap.read()
            cap.release()
            if ret:
                print("✅ Camera - OK")
                return True
            else:
                print("❌ Camera - Could not read frame")
        else:
            print("❌ Camera - Could not open")
        return False
    except Exception as e:
        print(f"❌ Camera - FAILED: {e}")
        return False

def test_gui():
    """Test if GUI can be created"""
    print("\n🖼️ Testing GUI creation...")
    try:
        import customtkinter as ctk
        root = ctk.CTk()
        root.withdraw()  # Don't show the window
        root.destroy()
        print("✅ GUI - OK")
        return True
    except Exception as e:
        print(f"❌ GUI - FAILED: {e}")
        return False

def test_storage():
    """Test if storage directories exist"""
    print("\n💾 Testing storage setup...")
    from pathlib import Path
    
    dirs = ["video_analyses", "logs"]
    all_good = True
    
    for dir_name in dirs:
        if Path(dir_name).exists():
            print(f"✅ {dir_name}/ - OK")
        else:
            print(f"❌ {dir_name}/ - Missing")
            all_good = False
            
    return all_good

def main():
    """Run all tests"""
    print("🎭 Video Emotion Analyzer - Setup Test")
    print("=" * 40)
    
    results = {
        "Imports": test_imports(),
        "Camera": test_camera(),
        "GUI": test_gui(),
        "Storage": test_storage()
    }
    
    print("\n📊 Summary")
    print("-" * 40)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
            
    print("\n" + "=" * 40)
    if all_passed:
        print("✨ All tests passed! Ready to run the application.")
    else:
        print("⚠️ Some tests failed. Please check the errors above.")
        print("\nTroubleshooting:")
        print("1. Make sure you're in the virtual environment")
        print("2. Run: pip install -r requirements.txt")
        print("3. Check camera permissions in Windows Settings")
        
if __name__ == "__main__":
    main() 