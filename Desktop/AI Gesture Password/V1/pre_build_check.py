"""Pre-build checklist for Guerilla Scope"""

import os
import sys
from pathlib import Path
import json

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
APP_DIR = SRC_DIR / "app"
if SRC_DIR.exists():
    sys.path.insert(0, str(SRC_DIR))

def check_item(description, condition, fix_hint=""):
    """Check a single item and print result"""
    if condition:
        print(f"✅ {description}")
        return True
    else:
        print(f"❌ {description}")
        if fix_hint:
            print(f"   FIX: {fix_hint}")
        return False

def main():
    print("\n" + "="*60)
    print("     GUERILLA SCOPE - Pre-Build Checklist")
    print("="*60 + "\n")
    
    all_passed = True
    
    # 1. Check Python version
    python_version = sys.version_info
    all_passed &= check_item(
        f"Python version (3.8+): {python_version.major}.{python_version.minor}",
        python_version >= (3, 8),
        "Install Python 3.8 or higher"
    )
    
    # 2. Check essential files exist
    essential_files = [
        ("src/app/main.py", "Main application file"),
        ("requirements.txt", "Dependencies file"),
        ("assets/icon.ico", "Application icon - run: python create_icon.py"),
        ("version_info.txt", "Windows version info"),
        ("GuerillaScope.spec", "PyInstaller spec file")
    ]
    
    print("\n📁 Essential Files:")
    for file, desc in essential_files:
        all_passed &= check_item(
            f"{file} exists",
            Path(file).exists(),
            desc
        )
    
    # 3. Check for hardcoded secrets
    print("\n🔐 Security Check:")
    
    # Check if config_secure exists
    config_secure_exists = (APP_DIR / "config_secure.py").exists()
    all_passed &= check_item(
        "Secure config system in place",
        config_secure_exists,
        "src/app/config_secure.py was created"
    )
    
    # Check for API keys in code
    sensitive_patterns = [
        ("AIzaSy", "Google API key"),
        ("sk-proj-", "OpenAI API key"),
    ]
    
    files_to_check = list(APP_DIR.glob("*.py")) if APP_DIR.exists() else []
    found_secrets = False
    
    for file in files_to_check:
        if file.name == "config_secure.py":
            continue
            
        content = file.read_text(encoding='utf-8', errors='ignore')
        for pattern, desc in sensitive_patterns:
            if pattern in content:
                print(f"   ⚠️  Found {desc} in {file.name}")
                found_secrets = True
    
    all_passed &= check_item(
        "No hardcoded API keys found",
        not found_secrets,
        "Remove API keys from code, use config_secure.py"
    )
    
    # 4. Check directories
    print("\n📂 Required Directories:")
    required_dirs = ["data", "assets", "temp_audio", "video_analyses"]
    for dir_name in required_dirs:
        all_passed &= check_item(
            f"{dir_name}/ directory exists",
            Path(dir_name).exists(),
            f"Create directory: mkdir {dir_name}"
        )
    
    # 5. Check dependencies
    print("\n📦 Dependencies:")
    try:
        import cv2
        import customtkinter
        import mediapipe
        import tensorflow
        import speech_recognition
        all_passed &= check_item("Core dependencies installed", True)
    except ImportError as e:
        all_passed &= check_item(
            "Core dependencies installed",
            False,
            f"Run: pip install -r requirements.txt (Missing: {e.name})"
        )
    
    # 6. Check for test files that shouldn't be distributed
    print("\n🧹 Clean Build:")
    test_files = list(Path(".").glob("test_*.py"))
    all_passed &= check_item(
        f"No test files in root ({len(test_files)} found)",
        len(test_files) == 0,
        "Move test files to tests/ folder"
    )
    
    # 7. Check file sizes
    print("\n💾 File Size Check:")
    large_files = []
    for file in Path(".").rglob("*"):
        if file.is_file() and file.stat().st_size > 50 * 1024 * 1024:  # 50MB
            large_files.append((file, file.stat().st_size / (1024 * 1024)))
    
    if large_files:
        print("   Large files found:")
        for file, size in large_files:
            print(f"   - {file}: {size:.1f}MB")
    
    all_passed &= check_item(
        "No unexpectedly large files",
        len(large_files) == 0,
        "Check if large files should be excluded"
    )
    
    # 8. Version check
    print("\n🏷️  Version Info:")
    try:
        from app.version import VERSION, BUILD_NUMBER
        all_passed &= check_item(
            f"Version configured: v{VERSION} (Build {BUILD_NUMBER})",
            True
        )
    except:
        all_passed &= check_item(
            "Version info available",
            False,
            "Check app/version.py"
        )
    
    # Summary
    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL CHECKS PASSED! Ready to build.")
        print("\nNext step: Run build_app.bat")
    else:
        print("❌ SOME CHECKS FAILED! Fix issues before building.")
        print("\nRerun this script after fixing issues.")
    print("="*60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main()) 