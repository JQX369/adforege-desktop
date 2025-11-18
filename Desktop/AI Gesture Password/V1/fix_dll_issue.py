"""Fix Python DLL issue for PyInstaller builds"""

import sys
import os
import shutil
from pathlib import Path

def find_python_dll():
    """Find the Python DLL in various locations"""
    python_version = f"{sys.version_info.major}{sys.version_info.minor}"
    dll_name = f"python{python_version}.dll"
    
    print(f"Looking for {dll_name}...")
    
    # Possible locations
    locations = [
        # Python installation directory
        os.path.dirname(sys.executable),
        # System32
        r"C:\Windows\System32",
        # Python's DLLs folder
        os.path.join(os.path.dirname(sys.executable), "DLLs"),
        # Virtual environment
        os.path.join(os.path.dirname(sys.executable), "..", "DLLs"),
        # Common Python installations
        rf"C:\Python{python_version}",
        rf"C:\Program Files\Python{python_version}",
        rf"C:\Program Files (x86)\Python{python_version}",
        # User installations
        os.path.expanduser(rf"~\AppData\Local\Programs\Python\Python{python_version}"),
    ]
    
    for location in locations:
        if os.path.exists(location):
            dll_path = os.path.join(location, dll_name)
            if os.path.exists(dll_path):
                print(f"✓ Found {dll_name} at: {dll_path}")
                return dll_path
    
    print(f"✗ Could not find {dll_name}")
    return None

def copy_dll_to_dist():
    """Copy Python DLL to distribution folder"""
    dll_path = find_python_dll()
    
    if not dll_path:
        print("\nERROR: Python DLL not found!")
        print("This might be because:")
        print("1. Python was installed without shared libraries")
        print("2. Using embedded Python distribution")
        return False
    
    # Check if dist folder exists
    dist_paths = [
        "dist/GuerillaScope",
        "dist"
    ]
    
    copied = False
    for dist_path in dist_paths:
        if os.path.exists(dist_path):
            dest_path = os.path.join(dist_path, os.path.basename(dll_path))
            try:
                shutil.copy2(dll_path, dest_path)
                print(f"\n✓ Copied {os.path.basename(dll_path)} to {dist_path}")
                copied = True
            except Exception as e:
                print(f"✗ Failed to copy to {dist_path}: {e}")
    
    return copied

def create_runtime_hook():
    """Create a runtime hook to help PyInstaller find the DLL"""
    hook_content = '''"""Runtime hook to ensure Python DLL is found"""
import os
import sys

# Add the executable directory to DLL search path
if hasattr(os, 'add_dll_directory'):
    os.add_dll_directory(os.path.dirname(sys.executable))
'''
    
    hook_path = "pyi_rth_pythondll.py"
    with open(hook_path, 'w') as f:
        f.write(hook_content)
    
    print(f"\n✓ Created runtime hook: {hook_path}")
    print("  Add this to your spec file: runtime_hooks=['pyi_rth_pythondll.py']")

def main():
    print("Python DLL Diagnostic Tool")
    print("=" * 50)
    
    print(f"\nPython version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Is virtual environment: {hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)}")
    
    print("\n" + "=" * 50)
    
    # Try to find and copy DLL
    if copy_dll_to_dist():
        print("\n✓ DLL issue should be fixed!")
        print("\nTry running the executable again.")
    else:
        print("\n✗ Could not automatically fix the issue.")
        print("\nAlternative solutions:")
        print("1. Rebuild with: build_onefile.bat")
        print("2. Install Python with 'Add Python to PATH' option")
        print("3. Copy python311.dll manually to the dist folder")
    
    # Create runtime hook
    create_runtime_hook()

if __name__ == "__main__":
    main() 