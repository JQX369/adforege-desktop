"""Version and update management for Guerilla Scope"""

import json
from datetime import datetime
from typing import Optional, Dict

# Version information
VERSION = "1.0.0"
BUILD_NUMBER = "100"
BUILD_DATE = "2025-01-07"
APP_NAME = "One-Shot"
APP_ID = "com.adforge.desktop"

# Update configuration
UPDATE_CHECK_URL = "https://api.adforge.com/v1/updates/check"
DOWNLOAD_URL = "https://adforge.com/download"

class VersionInfo:
    """Manages version information and update checking"""
    
    def __init__(self):
        self.current_version = VERSION
        self.build_number = BUILD_NUMBER
        self.build_date = BUILD_DATE
        
    def get_version_string(self) -> str:
        """Get formatted version string"""
        return f"{APP_NAME} v{VERSION} (Build {BUILD_NUMBER})"
    
    def check_for_updates(self) -> Optional[Dict]:
        """Check if updates are available"""
        try:
            # For now, return None since we don't have a server yet
            # In the future, this will check the update server
            payload = {
                "current_version": VERSION,
                "build_number": BUILD_NUMBER,
                "platform": "windows"
            }
            
            # Uncomment when server is ready
            # response = requests.post(UPDATE_CHECK_URL, json=payload, timeout=5)
            # if response.status_code == 200:
            #     update_info = response.json()
            #     if update_info.get("update_available"):
            #         return update_info
            
            return None
            
        except Exception as e:
            # Silently fail - don't interrupt user experience
            return None
    
    def get_about_info(self) -> Dict:
        """Get full about information"""
        return {
            "app_name": APP_NAME,
            "version": VERSION,
            "build": BUILD_NUMBER,
            "build_date": BUILD_DATE,
            "copyright": f"© 2025 {APP_NAME}. All rights reserved.",
            "description": "Professional video emotion analysis for content creators",
            "website": "https://adforge.com"
        }

# Global instance
version_info = VersionInfo() 