# FILE: app/storage.py
"""Storage management for user profiles."""

import json
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from app.config import PROFILE_FILE

logger = logging.getLogger(__name__)


class ProfileStorage:
    """Manages storage and retrieval of user profiles."""
    
    def __init__(self):
        """Initialize profile storage."""
        self.profile_path = Path(PROFILE_FILE)
        self.profiles: Dict[str, Dict] = {}
        self.load_profiles()
    
    def load_profiles(self) -> None:
        """Load profiles from JSON file."""
        if self.profile_path.exists():
            try:
                with open(self.profile_path, 'r') as f:
                    self.profiles = json.load(f)
                logger.info(f"Loaded {len(self.profiles)} user profiles")
            except Exception as e:
                logger.error(f"Error loading profiles: {e}")
                self.profiles = {}
        else:
            logger.info("No existing profiles found, starting fresh")
            self.profiles = {}
    
    def save_profiles(self) -> None:
        """Save profiles to JSON file."""
        try:
            with open(self.profile_path, 'w') as f:
                json.dump(self.profiles, f, indent=2)
            logger.info(f"Saved {len(self.profiles)} user profiles")
        except Exception as e:
            logger.error(f"Error saving profiles: {e}")
    
    def hash_password(self, tokens: List[str]) -> str:
        """
        Generate SHA-256 hash of token sequence.
        
        Args:
            tokens: List of gesture/expression tokens
            
        Returns:
            Hex string of SHA-256 hash
        """
        # Join tokens with delimiter and hash
        password_string = "|".join(tokens)
        return hashlib.sha256(password_string.encode()).hexdigest()
    
    def create_profile(self, username: str, tokens: List[str]) -> bool:
        """
        Create a new user profile.
        
        Args:
            username: Username for the profile
            tokens: List of gesture/expression tokens
            
        Returns:
            True if created successfully, False if username exists
        """
        if username in self.profiles:
            logger.warning(f"Username '{username}' already exists")
            return False
        
        # Create profile entry
        self.profiles[username] = {
            "password_hash": self.hash_password(tokens),
            "created_at": datetime.now().isoformat(),
            "last_login": None
        }
        
        self.save_profiles()
        logger.info(f"Created profile for user '{username}'")
        return True
    
    def verify_password(self, username: str, tokens: List[str]) -> bool:
        """
        Verify password for a user.
        
        Args:
            username: Username to verify
            tokens: List of gesture/expression tokens to check
            
        Returns:
            True if password matches, False otherwise
        """
        if username not in self.profiles:
            logger.warning(f"Username '{username}' not found")
            return False
        
        stored_hash = self.profiles[username]["password_hash"]
        provided_hash = self.hash_password(tokens)
        
        if stored_hash == provided_hash:
            # Update last login time
            self.profiles[username]["last_login"] = datetime.now().isoformat()
            self.save_profiles()
            logger.info(f"Successful login for user '{username}'")
            return True
        else:
            logger.warning(f"Failed login attempt for user '{username}'")
            return False
    
    def get_usernames(self) -> List[str]:
        """Get list of all usernames."""
        return list(self.profiles.keys())
    
    def delete_profile(self, username: str) -> bool:
        """
        Delete a user profile.
        
        Args:
            username: Username to delete
            
        Returns:
            True if deleted successfully
        """
        if username in self.profiles:
            del self.profiles[username]
            self.save_profiles()
            logger.info(f"Deleted profile for user '{username}'")
            return True
        return False
    
    def get_profile_info(self, username: str) -> Optional[Dict]:
        """
        Get profile information for a user.
        
        Args:
            username: Username to look up
            
        Returns:
            Profile dict or None if not found
        """
        return self.profiles.get(username) 