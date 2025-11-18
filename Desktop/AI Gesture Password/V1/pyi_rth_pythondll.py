"""Runtime hook to ensure Python DLL is found"""
import os
import sys

# Add the executable directory to DLL search path
if hasattr(os, 'add_dll_directory'):
    os.add_dll_directory(os.path.dirname(sys.executable))
