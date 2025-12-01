"""User authentication and management system for video analyzer"""

import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class UserManager:
    """Manages user authentication and authorization"""
    
    def __init__(self, data_dir: str = "data"):
        """Initialize user manager with data directory"""
        self.data_dir = data_dir
        self.users_file = os.path.join(data_dir, "users.json")
        self.sessions_file = os.path.join(data_dir, "sessions.json")
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
        
        # Load or create users database
        self.users = self._load_users()
        self.sessions = self._load_sessions()
        
        # Create default admin if no users exist
        if not self.users:
            self._create_default_admin()
    
    def _load_users(self) -> Dict:
        """Load users from file"""
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load users: {e}")
        return {}
    
    def _save_users(self):
        """Save users to file"""
        try:
            with open(self.users_file, 'w') as f:
                json.dump(self.users, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save users: {e}")
    
    def _load_sessions(self) -> Dict:
        """Load active sessions from file"""
        if os.path.exists(self.sessions_file):
            try:
                with open(self.sessions_file, 'r') as f:
                    sessions = json.load(f)
                    # Clean expired sessions
                    current_time = datetime.now().isoformat()
                    valid_sessions = {
                        token: data for token, data in sessions.items()
                        if data.get('expires_at', '') > current_time
                    }
                    return valid_sessions
            except Exception as e:
                logger.error(f"Failed to load sessions: {e}")
        return {}
    
    def _save_sessions(self):
        """Save sessions to file"""
        try:
            with open(self.sessions_file, 'w') as f:
                json.dump(self.sessions, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions: {e}")
    
    def _hash_password(self, password: str) -> str:
        """Hash password using SHA256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def _create_default_admin(self):
        """Create default admin account"""
        admin_username = "admin"
        admin_password = "admin123"  # Default password
        
        self.users[admin_username] = {
            'password_hash': self._hash_password(admin_password),
            'role': 'admin',
            'created_at': datetime.now().isoformat(),
            'created_by': 'system'
        }
        self._save_users()
        logger.info("Created default admin account (username: admin, password: admin123)")
    
    def authenticate(self, username: str, password: str) -> Optional[str]:
        """
        Authenticate user and return session token
        
        Args:
            username: Username to authenticate
            password: Password to verify
            
        Returns:
            Session token if successful, None otherwise
        """
        user = self.users.get(username)
        if not user:
            logger.warning(f"Login attempt for non-existent user: {username}")
            return None
        
        # Check password
        if user['password_hash'] != self._hash_password(password):
            logger.warning(f"Failed login attempt for user: {username}")
            return None
        
        # Create session token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=8)  # 8 hour session
        
        self.sessions[token] = {
            'username': username,
            'role': user['role'],
            'created_at': datetime.now().isoformat(),
            'expires_at': expires_at.isoformat()
        }
        self._save_sessions()
        
        logger.info(f"User {username} logged in successfully")
        return token
    
    def validate_session(self, token: str) -> Optional[Dict]:
        """
        Validate session token and return user info
        
        Args:
            token: Session token to validate
            
        Returns:
            User info dict if valid, None otherwise
        """
        session = self.sessions.get(token)
        if not session:
            return None
        
        # Check if expired
        if datetime.fromisoformat(session['expires_at']) < datetime.now():
            # Remove expired session
            del self.sessions[token]
            self._save_sessions()
            return None
        
        return {
            'username': session['username'],
            'role': session['role']
        }
    
    def logout(self, token: str):
        """Logout user by removing session"""
        if token in self.sessions:
            username = self.sessions[token]['username']
            del self.sessions[token]
            self._save_sessions()
            logger.info(f"User {username} logged out")
    
    def is_admin(self, token: str) -> bool:
        """Check if session token belongs to admin"""
        session = self.validate_session(token)
        return session and session.get('role') == 'admin'
    
    def add_user(self, admin_token: str, username: str, password: str, role: str = 'user') -> bool:
        """
        Add new user (admin only)
        
        Args:
            admin_token: Admin session token
            username: New username
            password: New user password
            role: User role (user or admin)
            
        Returns:
            True if successful
        """
        # Validate admin
        if not self.is_admin(admin_token):
            logger.warning("Unauthorized attempt to add user")
            return False
        
        # Check if username exists
        if username in self.users:
            logger.warning(f"Attempt to create duplicate user: {username}")
            return False
        
        # Get admin username
        admin_session = self.sessions[admin_token]
        admin_username = admin_session['username']
        
        # Create user
        self.users[username] = {
            'password_hash': self._hash_password(password),
            'role': role,
            'created_at': datetime.now().isoformat(),
            'created_by': admin_username
        }
        self._save_users()
        
        logger.info(f"User {username} created by {admin_username}")
        return True
    
    def remove_user(self, admin_token: str, username: str) -> bool:
        """
        Remove user (admin only)
        
        Args:
            admin_token: Admin session token
            username: Username to remove
            
        Returns:
            True if successful
        """
        # Validate admin
        if not self.is_admin(admin_token):
            logger.warning("Unauthorized attempt to remove user")
            return False
        
        # Check if user exists
        if username not in self.users:
            logger.warning(f"Attempt to remove non-existent user: {username}")
            return False
        
        # Don't allow removing last admin
        if self.users[username]['role'] == 'admin':
            admin_count = sum(1 for u in self.users.values() if u['role'] == 'admin')
            if admin_count <= 1:
                logger.warning("Cannot remove last admin user")
                return False
        
        # Remove user
        del self.users[username]
        self._save_users()
        
        # Remove any active sessions for this user
        tokens_to_remove = [
            token for token, session in self.sessions.items()
            if session['username'] == username
        ]
        for token in tokens_to_remove:
            del self.sessions[token]
        self._save_sessions()
        
        logger.info(f"User {username} removed")
        return True
    
    def change_password(self, token: str, old_password: str, new_password: str) -> bool:
        """
        Change user password
        
        Args:
            token: User session token
            old_password: Current password
            new_password: New password
            
        Returns:
            True if successful
        """
        session = self.validate_session(token)
        if not session:
            return False
        
        username = session['username']
        user = self.users[username]
        
        # Verify old password
        if user['password_hash'] != self._hash_password(old_password):
            logger.warning(f"Failed password change attempt for user: {username}")
            return False
        
        # Update password
        user['password_hash'] = self._hash_password(new_password)
        self._save_users()
        
        logger.info(f"Password changed for user: {username}")
        return True
    
    def reset_user_password(self, admin_token: str, username: str, new_password: str) -> bool:
        """
        Reset user password (admin only)
        
        Args:
            admin_token: Admin session token
            username: Username to reset
            new_password: New password
            
        Returns:
            True if successful
        """
        # Validate admin
        if not self.is_admin(admin_token):
            logger.warning("Unauthorized attempt to reset password")
            return False
        
        # Check if user exists
        if username not in self.users:
            logger.warning(f"Attempt to reset password for non-existent user: {username}")
            return False
        
        # Update password
        self.users[username]['password_hash'] = self._hash_password(new_password)
        self._save_users()
        
        logger.info(f"Password reset for user: {username}")
        return True
    
    def list_users(self, admin_token: str) -> Optional[List[Dict]]:
        """
        List all users (admin only)
        
        Args:
            admin_token: Admin session token
            
        Returns:
            List of user info dicts if authorized
        """
        # Validate admin
        if not self.is_admin(admin_token):
            logger.warning("Unauthorized attempt to list users")
            return None
        
        users_list = []
        for username, user_data in self.users.items():
            users_list.append({
                'username': username,
                'role': user_data['role'],
                'created_at': user_data['created_at'],
                'created_by': user_data.get('created_by', 'unknown')
            })
        
        return users_list 