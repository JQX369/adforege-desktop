"""Setup script for Video Emotion Analyzer"""

import os
import sys
import subprocess
from pathlib import Path

def check_python_version():
    """Check if Python version is 3.8+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        print(f"   You have Python {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def create_virtual_env():
    """Create virtual environment"""
    print("\n📦 Creating virtual environment...")
    try:
        subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
        print("✅ Virtual environment created")
        return True
    except Exception as e:
        print(f"❌ Failed to create virtual environment: {e}")
        return False

def install_dependencies():
    """Install required packages"""
    print("\n📥 Installing dependencies...")
    
    # Determine pip path based on OS
    if sys.platform == "win32":
        pip_path = Path("venv/Scripts/pip.exe")
    else:
        pip_path = Path("venv/bin/pip")
        
    if not pip_path.exists():
        print("❌ Pip not found in virtual environment")
        return False
        
    try:
        # Upgrade pip first
        subprocess.run([str(pip_path), "install", "--upgrade", "pip"], check=True)
        
        # Install requirements
        subprocess.run([str(pip_path), "install", "-r", "requirements.txt"], check=True)
        print("✅ All dependencies installed successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def create_directories():
    """Create necessary directories"""
    print("\n📁 Creating directories...")
    dirs = ["video_analyses", "logs"]
    for dir_name in dirs:
        Path(dir_name).mkdir(exist_ok=True)
    print("✅ Directories created")

def main():
    """Main setup function"""
    print("🎭 Video Emotion Analyzer Setup")
    print("=" * 40)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
        
    # Create virtual environment
    if not create_virtual_env():
        sys.exit(1)
        
    # Install dependencies
    if not install_dependencies():
        sys.exit(1)
        
    # Create directories
    create_directories()
    
    print("\n✨ Setup complete!")
    print("\nTo run the application:")
    if sys.platform == "win32":
        print("   run_video_analyzer.bat")
    else:
        print("   source venv/bin/activate")
        print("   export PYTHONPATH=\"$PWD/src\"")
        print("   python -m app.main")
        
if __name__ == "__main__":
    main() 