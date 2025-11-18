# FILE: app/video_analyzer_gui.py
"""Modern Video Emotion Analyzer GUI"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import customtkinter as ctk
from PIL import Image, ImageTk
import cv2
import numpy as np
import logging
import json
import os
import re
from datetime import datetime
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional, Set, Tuple
import pygame  # For audio playback
import base64
from io import BytesIO
import glob
import time
import subprocess

from app.enhanced_emotion_tracker import EnhancedEmotionTracker
from app.video_storage import VideoAnalysisStorage
from app.user_auth import UserManager
from app.clearcast_checker import ClearcastChecker
from app.ai_video_breakdown import AIVideoBreakdown
from app.enhanced_reaction_analyzer import EnhancedReactionAnalyzer
from app.enhanced_transcript_analyzer import EnhancedTranscriptAnalyzer
from app.clearcast_updater import ClearcastUpdater
from app.public_reaction import PublicReactionManager
from app.effectiveness_benchmarks import (
    get_tier, get_tier_color, get_tier_definition, format_score_with_tier
)
from app.pdf_generator import (
    ClearcastPDFGenerator,
    AIBreakdownPDFGenerator,
    resolve_ad_name,
    resolve_brand_name,
)
from app.clearcast_autofix import (
    AUTO_FIX_ACTIONS,
    AUTO_FIX_CATEGORIES,
    AUTO_FIX_CATEGORY_ORDER,
    actions_by_category,
    can_auto_apply_action,
    validate_auto_fix_plan,
)

# Import MOVIEPY_AVAILABLE from emotion tracker
try:
    from moviepy.editor import VideoFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False

logger = logging.getLogger(__name__)

# Modern color scheme - Cleaner, more polished
COLORS = {
    'bg': '#F5F5F7',  # Clean light gray background (Apple-style)
    'card': '#FFFFFF',
    'primary': '#FF3B30',  # iOS Red
    'secondary': '#34C759',  # iOS Green
    'text': '#1C1C1E',
    'text_light': '#8E8E93',
    'border': '#E5E5EA',
    'dark': '#1C1C1E',
    'yellow': '#FFCC00',  # iOS Yellow
    'blue': '#007AFF'  # iOS Blue
}

AUTO_FIX_CATEGORY_ICONS = {
    "technical_audio": "🔊",
    "technical_video": "🎥",
    "technical_format": "📐",
    "broadcast_delivery": "📺",
    "disclaimers": "⚖️",
    "script_language": "✍️",
}

class VideoAnalyzerGUI:
    """Main GUI for Video Emotion Analyzer"""
    
    def __init__(self):
        """Initialize the GUI"""
        # Configure customtkinter
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        
        # Create main window with polished settings
        self.root = ctk.CTk()
        
        # Import version info
        try:
            from app.version import version_info
            title = f"{version_info.get_version_string()} - Video Emotion Analysis"
        except:
            title = "Guerilla Scope - Video Emotion Analysis"
            
        self.root.title(title)
        self.root.geometry("1280x800")
        self.root.configure(fg_color=COLORS['bg'])
        
        # Set minimum window size
        self.root.minsize(1024, 700)
        
        # Center window on screen
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
        
        # Initialize components
        self.user_manager = UserManager()
        self.emotion_tracker = EnhancedEmotionTracker()
        self.storage = VideoAnalysisStorage()
        
        # User session state
        self.current_session_token = None
        self.current_user = None
        
        # Initialize Clearcast updater with API key
        self.clearcast_last_updated_var = tk.StringVar(
            value="Clearcast rules last updated: unavailable"
        )
        try:
            from app.config import GOOGLE_API_KEY
            self.clearcast_updater = ClearcastUpdater(GOOGLE_API_KEY)
            self.clearcast_last_updated_var.set(self.clearcast_updater.get_last_updated_text())
            # Start background checking
            self.clearcast_updater.start_background_checker(
                callback=lambda updates: self._on_clearcast_updates(updates)
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Clearcast updater: {e}")
            self.clearcast_updater = None
        
        # Pre-warm models in background to reduce first-run lag
        self.models_ready = False
        def prewarm_models():
            try:
                logger.info("Pre-warming emotion detection models...")
                # Use the comprehensive warm_models method
                if self.emotion_tracker.warm_models():
                    logger.info("All models pre-warmed successfully")
                else:
                    logger.warning("Some models failed to pre-warm")
                
                # Also pre-initialize webcam
                self.emotion_tracker.pre_initialize_webcam()
                
                # Mark models as ready
                self.models_ready = True
            except Exception as e:
                logger.warning(f"Model pre-warming failed: {e}")
                self.models_ready = True  # Allow operation even if pre-warming fails
        
        # Start pre-warming in background
        self.prewarm_thread = threading.Thread(target=prewarm_models, daemon=True)
        self.prewarm_thread.start()
        
        # State variables
        self.current_page = "home"
        self.current_video_path = None
        self.current_analysis_id = None
        self.ai_detail_var = tk.StringVar(value="Full")
        self.ai_airing_country_var = tk.StringVar(value="United Kingdom")
        self.selected_analysis_id = None
        self.is_playing = False
        self.is_fullscreen = False
        self.video_window = None
        
        # Initialize pygame for audio
        pygame.mixer.init()
        
        # Import centralized emotion colors
        from .emotion_colors import EMOTION_COLORS_HEX
        self.emotion_colors = EMOTION_COLORS_HEX
        
        # Initialize emotion graph data
        self.emotion_graph_data = []
        self._ai_regen_inflight: Set[str] = set()
        
        # Error tracking
        self.last_error = None
        
        # Quality warning throttling
        self.last_quality_warning_time = 0
        self.quality_warning_cooldown = 5.0  # 5 seconds between warnings
        
        # Create UI (adopt theme)
        try:
            from app.ui_theme import Theme
            self.theme = Theme()
            self.theme.apply_global("light", "blue")
        except Exception:
            self.theme = None

        self._create_ui()
        
        # Show webcam usage notification after a short delay
        self.root.after(500, self._show_webcam_notice)
        
        # Set up closing handler
        self.root.protocol("WM_DELETE_WINDOW", self._on_closing)
        
    def _show_webcam_notice(self):
        """Show webcam usage notice to user"""
        # Create custom dialog
        dialog = tk.Toplevel(self.root)
        dialog.title("Webcam Notice")
        dialog.geometry("450x250")
        dialog.configure(bg=COLORS['bg'])
        
        # Center the dialog
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Position dialog in center of main window
        dialog.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - (450 // 2)
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - (250 // 2)
        dialog.geometry(f"450x250+{x}+{y}")
        
        # Content frame
        content = ctk.CTkFrame(dialog, fg_color=COLORS['card'], corner_radius=15)
        content.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Icon and title
        title_frame = ctk.CTkFrame(content, fg_color="transparent")
        title_frame.pack(pady=(20, 15))
        
        icon_label = ctk.CTkLabel(
            title_frame,
            text="📷",
            font=("SF Pro Display", 36)
        )
        icon_label.pack(side=tk.LEFT, padx=(0, 10))
        
        title_label = ctk.CTkLabel(
            title_frame,
            text="Webcam Access",
            font=("SF Pro Display", 24, "bold"),
            text_color=COLORS['text']
        )
        title_label.pack(side=tk.LEFT)
        
        # Message
        message_label = ctk.CTkLabel(
            content,
            text="To keep this app running stable for emotion capture,\nwebcam is auto-enabled during video analysis.\n\nNo video is recorded or stored - only emotions\nare tracked for analysis purposes.",
            font=("SF Pro Text", 14),
            text_color=COLORS['text'],
            justify="center"
        )
        message_label.pack(pady=(10, 20))
        
        # OK button
        ok_btn = ctk.CTkButton(
            content,
            text="I Understand",
            font=("SF Pro Text", 16, "bold"),
            width=200,
            height=40,
            corner_radius=20,
            fg_color=COLORS['blue'],
            hover_color="#0051D5",
            command=dialog.destroy
        )
        ok_btn.pack()
        
        # Auto-close after 10 seconds
        dialog.after(10000, lambda: dialog.destroy() if dialog.winfo_exists() else None)
        
    def _create_ui(self):
        """Create the main UI structure"""
        # Main container
        self.main_container = ctk.CTkFrame(self.root, fg_color=COLORS['bg'])
        self.main_container.pack(fill=tk.BOTH, expand=True)
        
        # Show login page initially
        self._show_login_page()
        
    def _show_login_page(self):
        """Show the login page"""
        self._clear_container()
        self.current_page = "login"
        
        # Center container
        center_frame = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS['card'],
            corner_radius=20,
            border_width=1,
            border_color=COLORS['border']
        )
        center_frame.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        
        # Inner padding frame
        inner_frame = ctk.CTkFrame(center_frame, fg_color="transparent")
        inner_frame.pack(padx=60, pady=50)
        
        # Logo/Title
        logo_label = ctk.CTkLabel(
            inner_frame,
            text="GUERILLA SCOPE",
            font=("SF Pro Display", 36, "bold"),
            text_color=COLORS['text']
        )
        logo_label.pack(pady=(0, 10))
        
        # Login subtitle
        subtitle_label = ctk.CTkLabel(
            inner_frame,
            text="Sign in to continue",
            font=("SF Pro Text", 16),
            text_color=COLORS['text_light']
        )
        subtitle_label.pack(pady=(0, 30))
        
        # Username field
        username_label = ctk.CTkLabel(
            inner_frame,
            text="Username",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        username_label.pack(anchor="w", pady=(0, 5))
        
        self.username_entry = ctk.CTkEntry(
            inner_frame,
            width=300,
            height=40,
            placeholder_text="Enter username",
            font=("SF Pro Text", 14)
        )
        self.username_entry.pack(pady=(0, 20))
        
        # Password field
        password_label = ctk.CTkLabel(
            inner_frame,
            text="Password",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        password_label.pack(anchor="w", pady=(0, 5))
        
        self.password_entry = ctk.CTkEntry(
            inner_frame,
            width=300,
            height=40,
            placeholder_text="Enter password",
            font=("SF Pro Text", 14),
            show="•"
        )
        self.password_entry.pack(pady=(0, 30))
        
        # Login button
        login_btn = ctk.CTkButton(
            inner_frame,
            text="Sign In",
            font=("SF Pro Text", 16, "bold"),
            width=300,
            height=48,
            corner_radius=24,
            fg_color=COLORS['blue'],
            hover_color="#0051D5",
            command=self._handle_login
        )
        login_btn.pack()
        
        # Admin info (temporary)
        admin_info = ctk.CTkLabel(
            inner_frame,
            text="Default: admin / admin123",
            font=("SF Pro Text", 12),
            text_color=COLORS['text_light']
        )
        admin_info.pack(pady=(20, 0))
        
        # Bind Enter key to login
        self.username_entry.bind("<Return>", lambda e: self.password_entry.focus())
        self.password_entry.bind("<Return>", lambda e: self._handle_login())
        
        # Focus on username field
        self.username_entry.focus()
    
    def _handle_login(self):
        """Handle login attempt"""
        username = self.username_entry.get().strip()
        password = self.password_entry.get()
        
        if not username or not password:
            self._show_notification("Please enter both username and password", "warning")
            return
        
        # Attempt login
        token = self.user_manager.authenticate(username, password)
        
        if token:
            # Login successful
            self.current_session_token = token
            self.current_user = self.user_manager.validate_session(token)
            self._show_notification(f"Welcome, {username}!", "success")
            
            # Check if admin
            if self.user_manager.is_admin(token):
                self._show_admin_home()
            else:
                self._show_home_page()
        else:
            # Login failed
            self._show_notification("Invalid username or password", "error")
            self.password_entry.delete(0, tk.END)
            self.password_entry.focus()
    
    def _show_admin_home(self):
        """Show admin home page with user management"""
        self._clear_container()
        self.current_page = "admin_home"
        
        # Header
        if self.theme:
            header, _ = self.theme.header(self.main_container, "Admin")
        else:
            header = ctk.CTkFrame(
                self.main_container,
                height=60,
                fg_color=COLORS['card'],
                corner_radius=0
            )
            header.pack(fill=tk.X)
            header.pack_propagate(False)
        
        # User info and logout
        user_frame = ctk.CTkFrame(header, fg_color="transparent")
        user_frame.pack(side=tk.RIGHT, padx=20, pady=10)
        
        user_label = ctk.CTkLabel(
            user_frame,
            text=f"Admin: {self.current_user['username']}",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        user_label.pack(side=tk.LEFT, padx=(0, 20))
        
        logout_btn = ctk.CTkButton(
            user_frame,
            text="Logout",
            font=("SF Pro Text", 14),
            width=80,
            height=32,
            fg_color="transparent",
            hover_color=COLORS['bg'],
            border_width=1,
            border_color=COLORS['border'],
            text_color=COLORS['text'],
            command=self._logout
        )
        logout_btn.pack(side=tk.LEFT)
        
        # Main content
        content_frame = ctk.CTkFrame(self.main_container, fg_color=COLORS['bg'])
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Left side - Admin actions
        left_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        # Admin title
        admin_title = ctk.CTkLabel(
            left_frame,
            text="Admin Dashboard",
            font=("SF Pro Display", 28, "bold"),
            text_color=COLORS['text']
        )
        admin_title.pack(anchor="w", pady=(0, 20))
        
        # Action buttons
        actions_frame = ctk.CTkFrame(left_frame, fg_color=COLORS['card'], corner_radius=15)
        actions_frame.pack(fill=tk.X, pady=(0, 20))
        
        action_title = ctk.CTkLabel(
            actions_frame,
            text="Actions",
            font=("SF Pro Text", 18, "bold"),
            text_color=COLORS['text']
        )
        action_title.pack(anchor="w", padx=20, pady=(20, 10))
        
        # Go to app button
        app_btn = ctk.CTkButton(
            actions_frame,
            text="Go to App",
            font=("SF Pro Text", 16),
            width=250,
            height=48,
            corner_radius=24,
            fg_color=COLORS['blue'],
            hover_color="#0051D5",
            command=self._show_home_page
        )
        app_btn.pack(padx=20, pady=(0, 10))
        
        # Add user button
        add_user_btn = ctk.CTkButton(
            actions_frame,
            text="Add New User",
            font=("SF Pro Text", 16),
            width=250,
            height=48,
            corner_radius=24,
            fg_color=COLORS['secondary'],
            hover_color="#248A3D",
            command=self._show_add_user_dialog
        )
        add_user_btn.pack(padx=20, pady=(0, 20))
        
        # Right side - User list
        right_frame = ctk.CTkFrame(content_frame, fg_color=COLORS['card'], corner_radius=15)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        # User list title
        list_title = ctk.CTkLabel(
            right_frame,
            text="Users",
            font=("SF Pro Text", 18, "bold"),
            text_color=COLORS['text']
        )
        list_title.pack(anchor="w", padx=20, pady=(20, 10))
        
        # User list scroll frame
        self.user_list_frame = ctk.CTkScrollableFrame(
            right_frame,
            fg_color="transparent"
        )
        self.user_list_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 20))
        
        # Load user list
        self._refresh_user_list()
    
    def _refresh_user_list(self):
        """Refresh the user list display"""
        # Clear existing
        for widget in self.user_list_frame.winfo_children():
            widget.destroy()
        
        # Get users
        users = self.user_manager.list_users(self.current_session_token)
        
        if not users:
            no_users_label = ctk.CTkLabel(
                self.user_list_frame,
                text="No users found",
                font=("SF Pro Text", 14),
                text_color=COLORS['text_light']
            )
            no_users_label.pack(pady=20)
            return
        
        # Display each user
        for user in users:
            user_frame = ctk.CTkFrame(
                self.user_list_frame,
                fg_color=COLORS['bg'],
                corner_radius=10
            )
            user_frame.pack(fill=tk.X, pady=5)
            
            # User info
            info_frame = ctk.CTkFrame(user_frame, fg_color="transparent")
            info_frame.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=15, pady=10)
            
            username_label = ctk.CTkLabel(
                info_frame,
                text=user['username'],
                font=("SF Pro Text", 16, "bold"),
                text_color=COLORS['text']
            )
            username_label.pack(anchor="w")
            
            role_label = ctk.CTkLabel(
                info_frame,
                text=f"Role: {user['role']} • Created by: {user['created_by']}",
                font=("SF Pro Text", 12),
                text_color=COLORS['text_light']
            )
            role_label.pack(anchor="w")
            
            # Actions
            if user['username'] != self.current_user['username']:
                # Can't delete yourself
                delete_btn = ctk.CTkButton(
                    user_frame,
                    text="Delete",
                    font=("SF Pro Text", 14),
                    width=80,
                    height=32,
                    fg_color="#E74C3C",
                    hover_color="#C0392B",
                    command=lambda u=user['username']: self._delete_user(u)
                )
                delete_btn.pack(side=tk.RIGHT, padx=15)
    
    def _show_add_user_dialog(self):
        """Show dialog to add new user"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Add New User")
        dialog.geometry("400x350")
        dialog.configure(bg=COLORS['bg'])
        
        # Center the dialog
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Content frame
        content = ctk.CTkFrame(dialog, fg_color=COLORS['card'], corner_radius=15)
        content.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Title
        title = ctk.CTkLabel(
            content,
            text="Add New User",
            font=("SF Pro Display", 20, "bold"),
            text_color=COLORS['text']
        )
        title.pack(pady=(20, 20))
        
        # Username field
        username_label = ctk.CTkLabel(
            content,
            text="Username",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        username_label.pack(anchor="w", padx=30, pady=(0, 5))
        
        username_entry = ctk.CTkEntry(
            content,
            width=300,
            height=40,
            placeholder_text="Enter username",
            font=("SF Pro Text", 14)
        )
        username_entry.pack(padx=30, pady=(0, 15))
        
        # Password field
        password_label = ctk.CTkLabel(
            content,
            text="Password",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        password_label.pack(anchor="w", padx=30, pady=(0, 5))
        
        password_entry = ctk.CTkEntry(
            content,
            width=300,
            height=40,
            placeholder_text="Enter password",
            font=("SF Pro Text", 14)
        )
        password_entry.pack(padx=30, pady=(0, 30))
        
        # Buttons
        button_frame = ctk.CTkFrame(content, fg_color="transparent")
        button_frame.pack(pady=(0, 20))
        
        def add_user():
            username = username_entry.get().strip()
            password = password_entry.get()
            
            if not username or not password:
                self._show_notification("Please fill all fields", "warning")
                return
            
            if self.user_manager.add_user(self.current_session_token, username, password):
                self._show_notification(f"User {username} created successfully", "success")
                self._refresh_user_list()
                dialog.destroy()
            else:
                self._show_notification("Failed to create user", "error")
        
        add_btn = ctk.CTkButton(
            button_frame,
            text="Add User",
            font=("SF Pro Text", 14),
            width=120,
            height=40,
            fg_color=COLORS['secondary'],
            hover_color="#248A3D",
            command=add_user
        )
        add_btn.pack(side=tk.LEFT, padx=5)
        
        cancel_btn = ctk.CTkButton(
            button_frame,
            text="Cancel",
            font=("SF Pro Text", 14),
            width=120,
            height=40,
            fg_color="transparent",
            hover_color=COLORS['bg'],
            border_width=1,
            border_color=COLORS['border'],
            text_color=COLORS['text'],
            command=dialog.destroy
        )
        cancel_btn.pack(side=tk.LEFT, padx=5)
        
        # Focus on username
        username_entry.focus()
    
    def _delete_user(self, username: str):
        """Delete a user"""
        # Confirm deletion
        result = messagebox.askyesno(
            "Confirm Delete",
            f"Are you sure you want to delete user '{username}'?",
            icon='warning'
        )
        
        if result:
            if self.user_manager.remove_user(self.current_session_token, username):
                self._show_notification(f"User {username} deleted", "success")
                self._refresh_user_list()
            else:
                self._show_notification("Failed to delete user", "error")
    
    def _logout(self):
        """Logout current user"""
        if self.current_session_token:
            self.user_manager.logout(self.current_session_token)
        self.current_session_token = None
        self.current_user = None
        self._show_login_page()
    
    def _go_back_home(self):
        """Go back to appropriate home page based on user role"""
        if self.user_manager.is_admin(self.current_session_token):
            self._show_admin_home()
        else:
            self._show_home_page()
    
    def _show_home_page(self):
        """Show the home page"""
        self._clear_container()
        self.current_page = "home"
        
        # Header with user info
        if self.theme:
            header, _ = self.theme.header(self.main_container, "Home")
        else:
            header = ctk.CTkFrame(
                self.main_container,
                height=60,
                fg_color=COLORS['card'],
                corner_radius=0
            )
            header.pack(fill=tk.X)
            header.pack_propagate(False)
        
        # User info and logout
        user_frame = ctk.CTkFrame(header, fg_color="transparent")
        user_frame.pack(side=tk.RIGHT, padx=20, pady=10)
        
        user_label = ctk.CTkLabel(
            user_frame,
            text=f"User: {self.current_user['username']}",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        user_label.pack(side=tk.LEFT, padx=(0, 20))
        
        # Admin button if admin
        if self.user_manager.is_admin(self.current_session_token):
            admin_btn = ctk.CTkButton(
                user_frame,
                text="Admin",
                font=("SF Pro Text", 14),
                width=80,
                height=32,
                fg_color=COLORS['yellow'],
                hover_color="#E6B800",
                text_color=COLORS['text'],
                command=self._show_admin_home
            )
            admin_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        logout_btn = ctk.CTkButton(
            user_frame,
            text="Logout",
            font=("SF Pro Text", 14),
            width=80,
            height=32,
            fg_color="transparent",
            hover_color=COLORS['bg'],
            border_width=1,
            border_color=COLORS['border'],
            text_color=COLORS['text'],
            command=self._logout
        )
        logout_btn.pack(side=tk.LEFT)
        
        # Create gradient background effect
        gradient_frame = ctk.CTkFrame(self.main_container, fg_color=COLORS['bg'])
        gradient_frame.pack(fill=tk.BOTH, expand=True)
        
        # Center container with subtle shadow effect
        center_frame = ctk.CTkFrame(
            gradient_frame, 
            fg_color=COLORS['card'],
            corner_radius=20,
            border_width=1,
            border_color=COLORS['border']
        )
        center_frame.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        
        # Inner padding frame
        inner_frame = ctk.CTkFrame(center_frame, fg_color="transparent")
        inner_frame.pack(padx=60, pady=50)
        
        # Logo/Title with better typography
        logo_label = ctk.CTkLabel(
            inner_frame,
            text="GUERILLA",
            font=("SF Pro Display", 72, "bold"),
            text_color=COLORS['text']
        )
        logo_label.pack()
        
        scope_label = ctk.CTkLabel(
            inner_frame,
            text="SCOPE",
            font=("SF Pro Display", 72, "bold"),
            text_color=COLORS['yellow']
        )
        scope_label.pack(pady=(0, 10))
        
        # Subtitle
        subtitle_label = ctk.CTkLabel(
            inner_frame,
            text="Video Emotion Analysis",
            font=("SF Pro Text", 18),
            text_color=COLORS['text_light']
        )
        subtitle_label.pack(pady=(0, 50))
        
        # Buttons container
        buttons_frame = ctk.CTkFrame(inner_frame, fg_color="transparent")
        buttons_frame.pack()
        
        # Analyze New Video button - Primary action
        if hasattr(self, 'theme') and self.theme:
            analyze_btn = self.theme.primary_button(
                buttons_frame,
                text="New Project (Upload)",
                command=self._show_upload_page,
                width=280,
                height=56
            )
        else:
            analyze_btn = ctk.CTkButton(
                buttons_frame,
                text="New Project (Upload)",
                font=("SF Pro Text", 16, "bold"),
                width=280,
                height=56,
                corner_radius=28,
                fg_color=COLORS['blue'],
                hover_color="#0051D5",
                border_width=0,
                command=self._show_upload_page
            )
        analyze_btn.pack(pady=(0, 16))
        
        # Projects hub button - Secondary action
        if hasattr(self, 'theme') and self.theme:
            view_btn = self.theme.outline_button(
                buttons_frame,
                text="Projects",
                command=self._show_gallery_page,
                width=280,
                height=56
            )
        else:
            view_btn = ctk.CTkButton(
                buttons_frame,
                text="Projects",
                font=("SF Pro Text", 16),
                width=280,
                height=56,
                corner_radius=28,
                fg_color="transparent",
                hover_color=COLORS['bg'],
                border_width=2,
                border_color=COLORS['blue'],
                text_color=COLORS['blue'],
                command=self._show_gallery_page
            )
        view_btn.pack()
        
    def _show_upload_page(self, from_reaction=False):
        """Show video upload/analysis page"""
        self._clear_container()
        self.current_page = "upload"
        
        # Clear video state if NOT coming from add reaction
        if not from_reaction:
            self.current_video_path = None
            self.current_analysis_id = None
            self.emotion_graph_data = []
            self._from_reaction = False
        else:
            self._from_reaction = True
        
        # Header with blur effect simulation
        if self.theme:
            header, _ = self.theme.header(self.main_container, "New Project")
        else:
            header = ctk.CTkFrame(
                self.main_container, 
                height=60, 
                fg_color=COLORS['card'],
                corner_radius=0,
                border_width=0
            )
            header.pack(fill=tk.X)
            header.pack_propagate(False)
        
        # Add bottom border to header
        header_border = ctk.CTkFrame(header, height=1, fg_color=COLORS['border'])
        header_border.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Back button with SF Pro font
        back_btn = ctk.CTkButton(
            header,
            text="← Back",
            font=("SF Pro Text", 15),
            width=100,
            fg_color="transparent",
            hover_color=COLORS['bg'],
            text_color=COLORS['blue'],
            command=self._go_back_home
        )
        back_btn.pack(side=tk.LEFT, padx=20, pady=10)
        
        # Main content area
        content_frame = ctk.CTkFrame(self.main_container, fg_color=COLORS['bg'])
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Prompt to use Projects if user likely wants to add a reaction to an existing video
        try:
            if not from_reaction:
                user_id = self.current_user['username'] if self.current_user else None
                existing = self.storage.get_all_analyses(user_id)
                if existing:
                    tip_frame = ctk.CTkFrame(
                        content_frame,
                        fg_color="#FFF9E6",  # soft yellow tint
                        corner_radius=12
                    )
                    tip_frame.pack(fill=tk.X, padx=10, pady=(10, 15))

                    tip_label = ctk.CTkLabel(
                        tip_frame,
                        text=(
                            "Tip: Uploading here creates a NEW project. "
                            "To add a reaction to an existing project, go to Projects."
                        ),
                        font=("SF Pro Text", 13),
                        text_color=COLORS['text']
                    )
                    tip_label.pack(side=tk.LEFT, padx=15, pady=12)

                    go_projects_btn = ctk.CTkButton(
                        tip_frame,
                        text="Go to Projects",
                        font=("SF Pro Text", 13, "bold"),
                        width=140,
                        height=32,
                        corner_radius=16,
                        fg_color=COLORS['blue'],
                        hover_color="#0051D5",
                        command=self._show_gallery_page
                    )
                    go_projects_btn.pack(side=tk.RIGHT, padx=15)
        except Exception:
            pass
        
        # Left side - Video display with clean card design
        if hasattr(self, 'theme') and self.theme:
            video_frame = self.theme.card(content_frame)
        else:
            video_frame = ctk.CTkFrame(
                content_frame,
                fg_color=COLORS['card'],
                corner_radius=16,
                border_width=1,
                border_color=COLORS['border']
            )
        video_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        # Video label header
        video_header = ctk.CTkLabel(
            video_frame,
            text="Video Preview",
            font=("SF Pro Display", 20, "bold"),
            text_color=COLORS['text']
        )
        video_header.pack(anchor=tk.W, padx=24, pady=(20, 0))
        
        # Video display container
        video_container = ctk.CTkFrame(
            video_frame,
            fg_color="#000000",
            corner_radius=12
        )
        video_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        self.video_label = tk.Label(
            video_container,
            bg='#000000',
            text="",  # No text, we'll use the overlay
            fg='#CCCCCC',
            font=("SF Pro Text", 16)
        )
        self.video_label.pack(fill=tk.BOTH, expand=True)
        
        # Upload prompt overlay (shown when no video is loaded)
        self.upload_overlay = ctk.CTkFrame(
            video_container,
            fg_color="#000000",
            corner_radius=0
        )
        # Don't place it yet - will be shown conditionally
        
        # Upload icon and text
        upload_icon_label = ctk.CTkLabel(
            self.upload_overlay,
            text="📹",
            font=("SF Pro Display", 48)
        )
        upload_icon_label.pack()
        
        upload_text_label = ctk.CTkLabel(
            self.upload_overlay,
            text="No video loaded",
            font=("SF Pro Text", 16),
            text_color="#CCCCCC"
        )
        upload_text_label.pack(pady=(10, 20))
        
        # Upload button in the center
        center_upload_btn = (
            self.theme.primary_button(
                self.upload_overlay, text="Choose Video", command=self._upload_video, width=180, height=44
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                self.upload_overlay, text="Choose Video", font=("SF Pro Text", 15, "bold"), width=180, height=44,
                corner_radius=22, fg_color=COLORS['blue'], hover_color="#0051D5", command=self._upload_video
            )
        )
        center_upload_btn.pack()
        
        # Supported formats text
        formats_label = ctk.CTkLabel(
            self.upload_overlay,
            text="MP4, AVI, MOV, MKV",
            font=("SF Pro Text", 12),
            text_color="#666666"
        )
        formats_label.pack(pady=(8, 0))
        
        # Make clicking the video area trigger upload when no video is loaded
        def on_video_click(event):
            if not self.current_video_path and hasattr(self, 'upload_overlay') and self.upload_overlay.winfo_viewable():
                self._upload_video()
        
        # Add hover effect
        def on_enter(event):
            if not self.current_video_path and hasattr(self, 'upload_overlay') and self.upload_overlay.winfo_viewable():
                self.video_label.configure(cursor="hand2")
                
        def on_leave(event):
            self.video_label.configure(cursor="")
        
        self.video_label.bind("<Button-1>", on_video_click)
        self.video_label.bind("<Enter>", on_enter)
        self.video_label.bind("<Leave>", on_leave)
        video_container.bind("<Button-1>", on_video_click)
        
        # Add fullscreen button overlay with cleaner design
        self.fullscreen_btn = ctk.CTkButton(
            video_frame,
            text="⛶",  # Fullscreen icon
            font=("SF Pro Text", 18),
            width=36,
            height=36,
            corner_radius=18,
            fg_color="white",
            hover_color=COLORS['bg'],
            text_color=COLORS['text'],
            command=self._toggle_fullscreen
        )
        self.fullscreen_btn.place(relx=0.96, rely=0.08, anchor="ne")
        
        # Video controls overlay with dark background
        controls_overlay = ctk.CTkFrame(
            video_container,
            fg_color="#1C1C1E",  # Dark color instead of rgba
            corner_radius=8,
            height=60
        )
        controls_overlay.place(relx=0.5, rely=0.94, anchor="s", relwidth=0.92)
        
        # Progress bar with iOS style
        self.video_progress = ctk.CTkProgressBar(
            controls_overlay,
            width=400,
            height=6,
            progress_color=COLORS['blue'],
            fg_color="#3C3C3E"  # Dark gray instead of rgba
        )
        self.video_progress.pack(pady=(15, 5))
        self.video_progress.set(0)
        
        # Time label
        self.time_label = ctk.CTkLabel(
            controls_overlay,
            text="00:00 / 00:00",
            font=("SF Pro Text", 11),
            text_color="white"
        )
        self.time_label.pack()
        
        # Right side - Webcam and controls
        right_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        
        # Webcam display with clean design
        if hasattr(self, 'theme') and self.theme:
            webcam_frame = self.theme.card(right_frame)
            webcam_frame.configure(width=320, height=260)
        else:
            webcam_frame = ctk.CTkFrame(
                right_frame,
                fg_color=COLORS['card'],
                corner_radius=16,
                width=320,
                height=260,
                border_width=1,
                border_color=COLORS['border']
            )
        webcam_frame.pack(pady=(0, 20))
        webcam_frame.pack_propagate(False)
        
        # Webcam header
        webcam_header = ctk.CTkLabel(
            webcam_frame,
            text="Your Reaction",
            font=("SF Pro Display", 17, "bold"),
            text_color=COLORS['text']
        )
        webcam_header.pack(anchor=tk.W, padx=20, pady=(15, 0))
        
        # Webcam display container
        webcam_container = ctk.CTkFrame(
            webcam_frame,
            fg_color="#000000",
            corner_radius=8
        )
        webcam_container.pack(fill=tk.BOTH, expand=True, padx=16, pady=(10, 16))
        
        self.webcam_label = tk.Label(
            webcam_container,
            bg='#000000',
            text="Camera will activate on play",
            fg='#CCCCCC',
            font=("SF Pro Text", 13)
        )
        self.webcam_label.pack(fill=tk.BOTH, expand=True)
        
        # Ensure webcam doesn't retain old images
        self.webcam_label.configure(image="")
        self.webcam_label.image = None
        
        # Control buttons with polished design
        controls_frame = ctk.CTkFrame(right_frame, fg_color="transparent")
        controls_frame.pack(pady=(10, 0))
        
        # Upload button - Primary style
        self.upload_btn = (
            self.theme.primary_button(
                controls_frame, text="Upload Video", command=self._upload_video, width=280, height=48
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                controls_frame, text="Upload Video", font=("SF Pro Text", 15, "bold"), width=280, height=48,
                corner_radius=24, fg_color=COLORS['blue'], hover_color="#0051D5", command=self._upload_video
            )
        )
        self.upload_btn.pack(pady=(0, 12))
        
        # Play/Pause button - Secondary style when disabled
        self.play_btn = ctk.CTkButton(
            controls_frame,
            text="Play",
            font=("SF Pro Text", 15, "bold"),
            width=280,
            height=48,
            corner_radius=24,
            fg_color=COLORS['bg'],
            hover_color=COLORS['border'],
            text_color=COLORS['text_light'],
            state="disabled",
            command=self._toggle_playback
        )
        self.play_btn.pack()
        
        # Current emotion display with clean card
        if hasattr(self, 'theme') and self.theme:
            emotion_frame = self.theme.card(right_frame)
            emotion_frame.configure(height=100)
        else:
            emotion_frame = ctk.CTkFrame(
                right_frame,
                fg_color=COLORS['card'],
                corner_radius=16,
                height=100,
                border_width=1,
                border_color=COLORS['border']
            )
        emotion_frame.pack(fill=tk.X, pady=(20, 0))
        emotion_frame.pack_propagate(False)
        
        emotion_label = ctk.CTkLabel(
            emotion_frame,
            text="Current Emotion",
            font=("SF Pro Text", 14),
            text_color=COLORS['text_light']
        )
        emotion_label.pack(pady=(15, 0))
        
        self.current_emotion_label = ctk.CTkLabel(
            emotion_frame,
            text="Ready",
            font=("SF Pro Display", 28, "bold"),
            text_color=COLORS['text']
        )
        self.current_emotion_label.pack()
        
        # Face Quality Indicator with clean design
        if hasattr(self, 'theme') and self.theme:
            quality_frame = self.theme.card(right_frame)
            quality_frame.configure(height=85)
        else:
            quality_frame = ctk.CTkFrame(
                right_frame,
                fg_color=COLORS['card'],
                corner_radius=16,
                height=85,
                border_width=1,
                border_color=COLORS['border']
            )
        quality_frame.pack(fill=tk.X, pady=(15, 20))
        quality_frame.pack_propagate(False)
        
        quality_label = ctk.CTkLabel(
            quality_frame,
            text="Face Quality",
            font=("SF Pro Text", 14),
            text_color=COLORS['text_light']
        )
        quality_label.pack(pady=(12, 0))
        
        # Quality bar container for better styling
        bar_container = ctk.CTkFrame(quality_frame, fg_color="transparent")
        bar_container.pack(pady=(8, 0))
        
        self.quality_bar = ctk.CTkProgressBar(
            bar_container,
            width=220,
            height=8,
            progress_color=COLORS['secondary'],
            fg_color=COLORS['bg']
        )
        self.quality_bar.pack()
        self.quality_bar.set(1.0)
        
        self.quality_text = ctk.CTkLabel(
            quality_frame,
            text="Excellent",
            font=("SF Pro Text", 12),
            text_color=COLORS['secondary']
        )
        self.quality_text.pack(pady=(4, 0))
        
        # Bottom - Emotion graph with clean design
        if hasattr(self, 'theme') and self.theme:
            graph_frame = self.theme.card(self.main_container)
            graph_frame.configure(height=160)
        else:
            graph_frame = ctk.CTkFrame(
                self.main_container,
                fg_color=COLORS['card'],
                corner_radius=16,
                height=160,
                border_width=1,
                border_color=COLORS['border']
            )
        graph_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        graph_frame.pack_propagate(False)
        
        # Graph header
        graph_header = ctk.CTkLabel(
            graph_frame,
            text="Live Emotion Timeline",
            font=("SF Pro Display", 17, "bold"),
            text_color=COLORS['text']
        )
        graph_header.pack(anchor=tk.W, padx=24, pady=(16, 0))
        
        # Graph canvas with rounded corners
        canvas_container = ctk.CTkFrame(
            graph_frame,
            fg_color="#FAFAFA",
            corner_radius=8
        )
        canvas_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=(12, 20))
        
        self.graph_canvas = tk.Canvas(
            canvas_container,
            bg='#FAFAFA',
            highlightthickness=0,
            height=100
        )
        self.graph_canvas.pack(fill=tk.BOTH, expand=True)
        
        # Start video update loop
        self._update_video_display()
        
        # Handle upload overlay and video display based on state
        if not self.current_video_path:
            # No video loaded - show upload overlay
            if hasattr(self, 'upload_overlay'):
                self.upload_overlay.place(relx=0.5, rely=0.5, anchor="center")
        else:
            # We have a video path
            if from_reaction:
                # Coming from add reaction - hide overlay and show video preview
                logger.info(f"Restoring video for reaction: {self.current_video_path}")
                
                # Hide upload overlay
                if hasattr(self, 'upload_overlay'):
                    self.upload_overlay.place_forget()
                
                # Update upload button text
                filename = os.path.basename(self.current_video_path)
                if len(filename) > 25:
                    display_name = filename[:22] + "..."
                else:
                    display_name = filename
                self.upload_btn.configure(text=f"📹 {display_name}")
                
                # Load first frame if file exists
                if os.path.exists(self.current_video_path):
                    try:
                        cap = cv2.VideoCapture(self.current_video_path)
                        if cap.isOpened():
                            ret, frame = cap.read()
                            if ret:
                                # Display first frame
                                frame = cv2.resize(frame, (640, 480))
                                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                                img = Image.fromarray(frame)
                                imgtk = ImageTk.PhotoImage(image=img)
                                self.video_label.configure(image=imgtk, text="")
                                self.video_label.image = imgtk
                            cap.release()
                            
                            # Enable play button
                            self.play_btn.configure(
                                state="normal",
                                fg_color=COLORS['secondary'],
                                hover_color="#248A3D",
                                text_color="white"
                            )
                    except Exception as e:
                        logger.error(f"Failed to restore video preview: {e}")
                        self.current_video_path = None
                        self.current_analysis_id = None
                        # Show overlay since video failed
                        if hasattr(self, 'upload_overlay'):
                            self.upload_overlay.place(relx=0.5, rely=0.5, anchor="center")
                else:
                    # Video file no longer exists
                    self.current_video_path = None
                    self.current_analysis_id = None
                    self._show_notification("Previous video file not found", type="warning")
                    # Show overlay since video is gone
                    if hasattr(self, 'upload_overlay'):
                        self.upload_overlay.place(relx=0.5, rely=0.5, anchor="center")
            else:
                # Not from reaction but somehow have a video path - this shouldn't happen
                # since we clear video path when not from reaction, but handle it anyway
                logger.warning("Unexpected state: have video path but not from reaction")
                # Show upload overlay
                if hasattr(self, 'upload_overlay'):
                    self.upload_overlay.place(relx=0.5, rely=0.5, anchor="center")
        
    def _show_gallery_page(self):
        """Show videos gallery page"""
        self._clear_container()
        self.current_page = "gallery"
        
        # Header with clean design
        if self.theme:
            header, _ = self.theme.header(self.main_container, "Projects")
        else:
            header = ctk.CTkFrame(
                self.main_container, 
                height=80, 
                fg_color=COLORS['card'],
                corner_radius=0
            )
            header.pack(fill=tk.X)
            header.pack_propagate(False)
        
        # Add bottom border only for non-themed header (theme.header already includes it)
        if not self.theme:
            header_border = ctk.CTkFrame(header, height=1, fg_color=COLORS['border'])
            header_border.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Back button
        back_btn = ctk.CTkButton(
            header,
            text="← Back",
            font=("SF Pro Text", 15),
            width=100,
            fg_color="transparent",
            hover_color=COLORS['bg'],
            text_color=COLORS['blue'],
            command=self._go_back_home
        )
        back_btn.pack(side=tk.LEFT, padx=20, pady=20)
        
        # Title
        title_label = ctk.CTkLabel(
            header,
            text="Projects",
            font=("SF Pro Display", 28, "bold"),
            text_color=COLORS['text']
        )
        title_label.pack(side=tk.LEFT, padx=20)

        # New Project (Upload) button on the right
        if hasattr(self, 'theme') and self.theme:
            new_project_btn = self.theme.primary_button(
                header,
                text="+ New Project",
                command=self._upload_video_to_library,
                width=170,
                height=40
            )
        else:
            new_project_btn = ctk.CTkButton(
                header,
                text="+ New Project",
                font=("SF Pro Text", 14, "bold"),
                width=150,
                height=36,
                corner_radius=18,
                fg_color=COLORS['blue'],
                hover_color="#0051D5",
                text_color="white",
                command=self._upload_video_to_library
            )
        new_project_btn.pack(side=tk.RIGHT, padx=20)
        
        # Scrollable frame for videos
        scroll_frame = ctk.CTkScrollableFrame(
            self.main_container,
            fg_color=COLORS['bg']
        )
        scroll_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Ensure consistent grid layout
        for i in range(3):
            scroll_frame.grid_columnconfigure(i, weight=1)
        
        # PHASE 2: Show skeleton loading cards while fetching data
        def show_skeleton_cards():
            """Show skeleton loading cards"""
            for i in range(6):  # Show 6 skeleton cards
                row = i // 3
                col = i % 3
                
                skeleton_card = ctk.CTkFrame(
                    scroll_frame,
                    fg_color=COLORS['card'],
                    corner_radius=15,
                    width=280,
                    height=200
                )
                skeleton_card.grid(row=row, column=col, padx=10, pady=10, sticky="nsew")
                skeleton_card.grid_propagate(False)
                
                # Skeleton thumbnail
                skeleton_thumb = ctk.CTkFrame(
                    skeleton_card,
                    fg_color="#E0E0E0",
                    corner_radius=10,
                    height=140
                )
                skeleton_thumb.pack(fill=tk.X, padx=10, pady=(10, 5))
                
                # Animated loading effect
                loading_bar = ctk.CTkProgressBar(
                    skeleton_thumb,
                    width=200,
                    height=4,
                    progress_color="#BDBDBD"
                )
                loading_bar.pack(expand=True)
                loading_bar.set(0.3)
                loading_bar.configure(mode="indeterminate")
                loading_bar.start()
                
                # Skeleton text
                skeleton_text = ctk.CTkFrame(
                    skeleton_card,
                    fg_color="#E0E0E0",
                    corner_radius=5,
                    height=20
                )
                skeleton_text.pack(fill=tk.X, padx=10, pady=5)
                
        # Show skeleton cards first
        show_skeleton_cards()
        self.root.update()
        
        # Load actual data after a brief delay
        def load_videos():
            # Clear skeleton cards
            for widget in scroll_frame.winfo_children():
                widget.destroy()
                
            # Get analyzed videos for current user
            user_id = self.current_user['username'] if self.current_user else None
            videos = self.storage.get_all_analyses(user_id)
            
            # If no videos, show sample/instructions
            if not videos:
                # Create instruction card
                instruction_frame = ctk.CTkFrame(
                    scroll_frame,
                    fg_color=COLORS['card'],
                    corner_radius=20
                )
                instruction_frame.pack(fill=tk.X, padx=20, pady=20)
                
                title = ctk.CTkLabel(
                    instruction_frame,
                    text="📹 No Videos Analyzed Yet",
                    font=("Arial Black", 24),
                    text_color=COLORS['text']
                )
                title.pack(pady=(20, 10))
                
                instructions = ctk.CTkLabel(
                    instruction_frame,
                    text="Start by analyzing your first video!\n\n"
                         "1. Click 'ANYLISE NEW VIDEO' from the home screen\n"
                         "2. Upload a video file (MP4, AVI, MOV, MKV)\n"
                         "3. Position yourself in front of the webcam\n"
                         "4. Click PLAY to start the analysis\n\n"
                         "The system will track your emotional reactions in real-time\n"
                         "and create a detailed analysis of your engagement.",
                    font=("Arial", 14),
                    text_color=COLORS['text_light'],
                    justify="left"
                )
                instructions.pack(padx=40, pady=(0, 20))
                
                # Add sample button
                sample_btn = ctk.CTkButton(
                    instruction_frame,
                    text="View Sample Analysis",
                    font=("Arial", 14),
                    width=200,
                    height=40,
                    corner_radius=20,
                    fg_color=COLORS['secondary'],
                    command=self._show_sample_analysis
                )
                sample_btn.pack(pady=(0, 20))
            else:
                # Create grid of video thumbnails
                row = 0
                col = 0
                for video_data in videos:
                    self._create_video_thumbnail(scroll_frame, video_data, row, col)
                    col += 1
                    if col >= 3:  # 3 videos per row for wider 16:9 thumbnails
                        col = 0
                        row += 1
                        
        # Load videos after 500ms to show skeleton screens
        self.root.after(500, load_videos)

    def _select_project(self, analysis_id: str):
        """Toggle selection of a project and refresh the gallery to show actions panel."""
        if self.selected_analysis_id == analysis_id:
            self.selected_analysis_id = None
        else:
            self.selected_analysis_id = analysis_id
        self._show_gallery_page()

    def _create_project_actions_panel(self, parent, video_data: Dict):
        """Create an actions panel for the selected project under the grid."""
        panel = self.theme.card(parent) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(parent, fg_color=COLORS['card'], corner_radius=12)
        panel.grid(column=0, columnspan=3, padx=10, pady=(0, 20), sticky="nsew")

        # Header with project info
        header = ctk.CTkLabel(
            panel,
            text=f"Selected: {video_data.get('video_name','Untitled')}",
            font=("SF Pro Display", 18, "bold"),
            text_color=COLORS['text']
        )
        header.pack(anchor="w", padx=20, pady=(15, 10))

        # Description
        desc = ctk.CTkLabel(
            panel,
            text="Choose what to do with this project:",
            font=("SF Pro Text", 12),
            text_color=COLORS['text_light']
        )
        desc.pack(anchor="w", padx=20, pady=(0, 10))

        # Actions row
        actions = ctk.CTkFrame(panel, fg_color="transparent")
        actions.pack(fill=tk.X, padx=20, pady=(0, 16))

        # Add Reaction
        add_reaction_btn = (
            self.theme.primary_button(
                actions, text="+ Add Reaction", command=lambda vid=video_data['id']: self._add_reaction(vid), width=160, height=40
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                actions, text="+ Add Reaction", font=("SF Pro Text", 14, "bold"), width=160, height=40, corner_radius=20,
                fg_color=COLORS['blue'], hover_color="#0051D5", command=lambda vid=video_data['id']: self._add_reaction(vid)
            )
        )
        add_reaction_btn.pack(side=tk.LEFT, padx=(0, 10))

        # Clearcast Check
        clearcast_btn = (
            self.theme.outline_button(
                actions, text="Check Clearcast", command=lambda vid=video_data['id']: self._check_clearcast_from_gallery(vid), width=160, height=40
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                actions, text="Check Clearcast", font=("SF Pro Text", 14), width=160, height=40, corner_radius=20,
                fg_color=COLORS['yellow'], hover_color="#E6B800", text_color=COLORS['text'],
                command=lambda vid=video_data['id']: self._check_clearcast_from_gallery(vid)
            )
        )
        clearcast_btn.pack(side=tk.LEFT, padx=10)

        # AI Breakdown
        breakdown_btn = (
            self.theme.secondary_button(
                actions, text="AI Breakdown", command=lambda vid=video_data['id']: self._analyze_breakdown_from_gallery(vid), width=160, height=40
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                actions, text="AI Breakdown", font=("SF Pro Text", 14), width=160, height=40, corner_radius=20,
                fg_color=COLORS['secondary'], hover_color="#248A3D",
                command=lambda vid=video_data['id']: self._analyze_breakdown_from_gallery(vid)
            )
        )
        breakdown_btn.pack(side=tk.LEFT, padx=10)

        # View Transcript
        transcript_btn = (
            self.theme.outline_button(
                actions, text="View Transcript", command=lambda vid=video_data['id']: self._show_analysis_dashboard(vid), width=160, height=40
            ) if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                actions, text="View Transcript", font=("SF Pro Text", 14), width=160, height=40, corner_radius=20,
                fg_color="transparent", border_width=2, border_color=COLORS['blue'], text_color=COLORS['blue'], hover_color=COLORS['bg'],
                command=lambda vid=video_data['id']: self._show_analysis_dashboard(vid)
            )
        )
        transcript_btn.pack(side=tk.LEFT, padx=10)

        # Export
        export_btn = ctk.CTkButton(
            actions,
            text="Export",
            font=("SF Pro Text", 14),
            width=120,
            height=40,
            corner_radius=20,
            fg_color="transparent",
            border_width=2,
            border_color=COLORS['border'],
            text_color=COLORS['text'],
            hover_color=COLORS['bg'],
            command=lambda vid=video_data['id']: self._export_project(vid)
        )
        export_btn.pack(side=tk.LEFT, padx=10)

    def _check_clearcast_from_gallery(self, analysis_id: str):
        """Trigger Clearcast check and refresh the gallery when done."""
        # Run the dashboard flow which already persists and renders results
        self._show_analysis_dashboard(analysis_id)
        # The user can click 'Check Clearcast' there; keeps logic in one place

    def _analyze_breakdown_from_gallery(self, analysis_id: str):
        """Trigger AI Breakdown from dashboard for consistency."""
        self._show_analysis_dashboard(analysis_id)

    def _export_project(self, analysis_id: str):
        """Export analysis data to a JSON file."""
        export_path = filedialog.asksaveasfilename(
            title="Export Analysis",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json")]
        )
        if not export_path:
            return
        ok = self.storage.export_analysis(analysis_id, export_path)
        if ok:
            self._show_notification("Exported analysis", "success")
        else:
            self._show_notification("Failed to export analysis", "error")

    def _upload_video_to_library(self):
        """Upload a video and create a project without starting analysis."""
        file_path = filedialog.askopenfilename(
            title="Select Video",
            filetypes=[("Video files", "*.mp4 *.avi *.mov *.mkv")]
        )
        if not file_path:
            return

        # Basic validation (size and readability)
        try:
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            if file_size_mb > 500:
                self._show_notification("Video file too large (max 500MB)", "error")
                return
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                self._show_notification("Unable to open video file", "error")
                return
            cap.release()
        except Exception:
            self._show_notification("Invalid video file", "error")
            return

        # Create analysis entry (project) without starting webcam
        user_id = self.current_user['username'] if self.current_user else None
        is_admin = self.current_user.get('role') == 'admin' if self.current_user else False
        analysis_result = self.storage.create_analysis(file_path, user_id, is_admin)

        if isinstance(analysis_result, str) and analysis_result.startswith("ERROR:"):
            self._show_notification(analysis_result[6:], "error")
            return

        # Success — refresh projects list
        self._show_notification("Project created", "success")
        self._show_gallery_page()
        
    def _create_video_thumbnail(self, parent, video_data, row, col):
        """Create a video thumbnail card"""
        # Card frame with 16:9 aspect ratio
        if hasattr(self, 'theme') and self.theme:
            card = self.theme.card(parent)
            card.configure(width=280, height=200)
        else:
            card = ctk.CTkFrame(
                parent,
                fg_color=COLORS['card'],
                corner_radius=15,
                width=280,  # Wider for 16:9
                height=200
            )
        card.grid(row=row, column=col, padx=10, pady=10, sticky="nsew")
        card.grid_propagate(False)
        
        # Configure grid weights for proper spacing
        parent.grid_columnconfigure(col, weight=1)
        
        # Thumbnail image with 16:9 aspect
        thumbnail_frame = ctk.CTkFrame(
            card,
            fg_color=COLORS['dark'],
            corner_radius=10,
            height=140  # 16:9 ratio (280/16*9 ≈ 157, adjusted for padding)
        )
        thumbnail_frame.pack(fill=tk.X, padx=10, pady=(10, 5))
        thumbnail_frame.pack_propagate(False)
        
        # Try to load actual video thumbnail
        thumbnail_loaded = False
        if 'thumbnail' in video_data and video_data['thumbnail']:
            try:
                # Load thumbnail from storage
                img_data = video_data['thumbnail']
                if isinstance(img_data, bytes):
                    img = Image.open(BytesIO(img_data))
                else:
                    img = Image.open(BytesIO(base64.b64decode(img_data)))
                
                # Resize to fit 16:9
                img = img.resize((260, 146), Image.Resampling.LANCZOS)
                photo = ImageTk.PhotoImage(img)
                
                img_label = tk.Label(
                    thumbnail_frame,
                    image=photo,
                    bg=COLORS['dark']
                )
                img_label.image = photo
                img_label.pack(expand=True)
                thumbnail_loaded = True
            except Exception as e:
                logger.error(f"Failed to load video thumbnail: {e}")
        
        if not thumbnail_loaded:
            # Fallback to icon
            thumbnail_label = tk.Label(
                thumbnail_frame,
                bg=COLORS['dark'],
                text="📹",
                font=("Arial", 48)
            )
            thumbnail_label.pack(expand=True)
        
        # Video name
        video_name = video_data.get('video_name', 'Untitled')
        display_name = video_name[:22] + '...' if len(video_name) > 25 else video_name
        
        name_label = ctk.CTkLabel(
            card,
            text=display_name,
            font=("Arial", 12, "bold"),
            text_color=COLORS['text']
        )
        name_label.pack(pady=(5, 2))
        
        # Stats row (reactions count and engagement)
        stats_frame = ctk.CTkFrame(card, fg_color="transparent", height=20)
        stats_frame.pack()
        stats_frame.pack_propagate(False)
        
        # Reaction count
        reaction_count = len(video_data.get('reactions', []))
        reaction_text = f"🎭 {reaction_count} reaction{'s' if reaction_count != 1 else ''}"
        
        # Average engagement if available
        avg_engagement = video_data.get('avg_engagement', 0)
        if avg_engagement > 0:
            stats_text = f"{reaction_text}  •  📊 {avg_engagement:.0%}"
        else:
            stats_text = reaction_text
            
        stats_label = ctk.CTkLabel(
            stats_frame,
            text=stats_text,
            font=("Arial", 10),
            text_color=COLORS['text_light']
        )
        stats_label.pack()

        # Badges row for Clearcast/AI breakdown status
        badges_frame = ctk.CTkFrame(card, fg_color="transparent", height=20)
        badges_frame.pack()
        badges_frame.pack_propagate(False)

        if video_data.get('clearcast_checked'):
            cc_badge = ctk.CTkLabel(
                badges_frame,
                text="✓ Clearcast",
                font=("Arial", 10, "bold"),
                text_color="#2ECC71"
            )
            cc_badge.pack(side=tk.LEFT, padx=4)

        if video_data.get('ai_breakdown_checked'):
            ai_badge = ctk.CTkLabel(
                badges_frame,
                text="✓ AI Breakdown",
                font=("Arial", 10, "bold"),
                text_color=COLORS['blue']
            )
            ai_badge.pack(side=tk.LEFT, padx=4)
        
        # Buttons frame
        buttons_frame = ctk.CTkFrame(card, fg_color="transparent")
        buttons_frame.pack(pady=(5, 10))

        # Highlight selection state by border color
        if self.selected_analysis_id == video_data.get('id'):
            try:
                card.configure(border_width=2, border_color=COLORS['blue'])
            except Exception:
                pass
        
        # View button
        if hasattr(self, 'theme') and self.theme:
            view_btn = self.theme.secondary_button(
                buttons_frame,
                text="VIEW",
                command=lambda: self._show_analysis_dashboard(video_data['id']),
                width=100,
                height=36
            )
        else:
            view_btn = ctk.CTkButton(
                buttons_frame,
                text="VIEW",
                font=("Arial Black", 12),
                width=100,
                height=35,
                corner_radius=20,
                fg_color=COLORS['primary'],
                command=lambda: self._show_analysis_dashboard(video_data['id'])
            )
        view_btn.pack(side=tk.LEFT, padx=5)
        
        # Select button (toggles actions panel)
        if hasattr(self, 'theme') and self.theme:
            select_btn = self.theme.outline_button(
                buttons_frame,
                text="SELECT",
                command=lambda: self._select_project(video_data['id']),
                width=100,
                height=36
            )
        else:
            select_btn = ctk.CTkButton(
                buttons_frame,
                text="SELECT",
                font=("Arial Black", 12),
                width=100,
                height=35,
                corner_radius=20,
                fg_color=COLORS['secondary'],
                hover_color="#248A3D",
                command=lambda: self._select_project(video_data['id'])
            )
        select_btn.pack(side=tk.LEFT, padx=5)

        # Delete button
        delete_btn = ctk.CTkButton(
            buttons_frame,
            text="DELETE",
            font=("Arial Black", 12),
            width=100,
            height=35,
            corner_radius=20,
            fg_color="#E74C3C",
            hover_color="#C0392B",
            command=lambda: self._delete_video(video_data['id'])
        )
        delete_btn.pack(side=tk.LEFT, padx=5)

        # If this card is selected, show the actions panel spanning the row below the grid
        if self.selected_analysis_id == video_data.get('id'):
            # Determine row span container by creating an actions panel right after this card
            # We place a full-width panel by using parent's grid with columnspan=3
            self._create_project_actions_panel(parent, video_data)
        
    def _show_analysis_dashboard(self, analysis_id):
        """Show the analysis dashboard for a video"""
        self._clear_container()
        
        # Get analysis data
        analysis = self.storage.get_analysis(analysis_id) if analysis_id != 'sample' else self._get_sample_analysis()
        
        if not analysis:
            messagebox.showerror("Error", "Analysis not found")
            self._show_home_page()
            return
            
        # Header
        header_frame = ctk.CTkFrame(self.main_container, fg_color=COLORS['dark'], height=80)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)
        
        # Back button
        back_btn = ctk.CTkButton(
            header_frame,
            text="← Back",
            font=("Arial", 14),
            width=100,
            command=self._show_gallery_page,
            fg_color="transparent",
            hover_color=COLORS['secondary']
        )
        back_btn.pack(side=tk.LEFT, padx=20, pady=20)
        
        # Title
        title = ctk.CTkLabel(
            header_frame,
            text=f"Analysis: {analysis['video_name']}",
            font=("Arial Black", 24),
            text_color="white"
        )
        title.pack(pady=20)
        
        # Main content area with ONE scroll for entire page
        main_scroll = ctk.CTkScrollableFrame(self.main_container, fg_color=COLORS['bg'])
        main_scroll.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Create layout with two columns
        left_column = ctk.CTkFrame(main_scroll, fg_color="transparent")
        left_column.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        right_column = ctk.CTkFrame(main_scroll, fg_color="transparent")
        right_column.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        # Overall stats card
        stats_card = self.theme.card(left_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(left_column, fg_color=COLORS['card'], corner_radius=15)
        stats_card.pack(fill=tk.X, pady=(0, 20))
        
        stats_title = ctk.CTkLabel(
            stats_card,
            text="OVERALL ENGAGEMENT",
            font=(self.theme.FONTS['h2'] if hasattr(self, 'theme') and self.theme else ("Arial Black", 16)),
            text_color=COLORS['text']
        )
        stats_title.pack(anchor=tk.W, padx=20, pady=(20, 10))
        
        # Engagement score with visual indicator
        engagement_frame = ctk.CTkFrame(stats_card, fg_color="transparent")
        engagement_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        engagement_score = analysis.get('avg_engagement', 0)
        engagement_label = ctk.CTkLabel(
            engagement_frame,
            text=f"{engagement_score:.1%}",
            font=("Arial Black", 48),
            text_color=COLORS['primary']
        )
        engagement_label.pack(side=tk.LEFT)
        
        # Engagement description
        engagement_desc = ctk.CTkLabel(
            engagement_frame,
            text=self._get_engagement_description(engagement_score),
            font=("Arial", 14),
            text_color=COLORS['text_light']
        )
        engagement_desc.pack(side=tk.LEFT, padx=20)
        
        # Emotion summary card
        emotion_card = self.theme.card(left_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(left_column, fg_color=COLORS['card'], corner_radius=15)
        emotion_card.pack(fill=tk.X, pady=(0, 20))
        
        emotion_title = ctk.CTkLabel(
            emotion_card,
            text="EMOTION BREAKDOWN",
            font=(self.theme.FONTS['h2'] if hasattr(self, 'theme') and self.theme else ("Arial Black", 16)),
            text_color=COLORS['text']
        )
        emotion_title.pack(anchor=tk.W, padx=20, pady=(20, 10))
        
        # Emotion bars
        emotion_frame = ctk.CTkFrame(emotion_card, fg_color="transparent")
        emotion_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        emotion_summary = analysis.get('emotion_summary', {})
        if emotion_summary:
            # Sort emotions by percentage
            sorted_emotions = sorted(emotion_summary.items(), key=lambda x: x[1], reverse=True)
            for emotion, percentage in sorted_emotions[:6]:  # Show top 6
                self._create_emotion_bar(emotion_frame, emotion, percentage)
        else:
            no_data_label = ctk.CTkLabel(
                emotion_frame,
                text="No emotion data available yet",
                font=("Arial", 14),
                text_color=COLORS['text_light']
            )
            no_data_label.pack(pady=20)
        
        # Reactions list card
        reactions_card = self.theme.card(right_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(right_column, fg_color=COLORS['card'], corner_radius=15)
        reactions_card.pack(fill=tk.X, pady=(0, 20))
        
        reactions_header = ctk.CTkFrame(reactions_card, fg_color="transparent")
        reactions_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        
        reactions_title = ctk.CTkLabel(
            reactions_header,
            text=f"VIEWER REACTIONS ({len(analysis.get('reactions', []))})",
            font=(self.theme.FONTS['h2'] if hasattr(self, 'theme') and self.theme else ("Arial Black", 16)),
            text_color=COLORS['text']
        )
        reactions_title.pack(side=tk.LEFT)
        
        # Add reaction button with iOS style
        add_btn = (
            self.theme.primary_button(reactions_header, text="+ Add Your Reaction", command=lambda: self._add_reaction(analysis_id), width=180, height=36)
            if hasattr(self, 'theme') and self.theme else ctk.CTkButton(
                reactions_header, text="+ Add Your Reaction", font=("SF Pro Text", 14, "bold"), width=180, height=36, corner_radius=18,
                fg_color=COLORS['blue'], hover_color="#0051D5", command=lambda: self._add_reaction(analysis_id)
            )
        )
        add_btn.pack(side=tk.RIGHT)
        
        # Reactions grid
        reactions = analysis.get('reactions', [])
        if reactions:
            reactions_grid = ctk.CTkFrame(reactions_card, fg_color="transparent")
            reactions_grid.pack(fill=tk.X, padx=20, pady=(0, 20))
            
            for i, reaction in enumerate(reactions[:6]):  # Show max 6
                row = i // 3
                col = i % 3
                self._create_reaction_thumbnail(reactions_grid, reaction, row, col)
        else:
            no_reactions_label = ctk.CTkLabel(
                reactions_card,
                text="No reactions yet. Click 'Add Reaction' to record viewer emotions!",
                font=("Arial", 14),
                text_color=COLORS['text_light'],
                wraplength=300
            )
            no_reactions_label.pack(pady=40)
        
        # Emotion timeline visualization
        timeline_card = self.theme.card(left_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(left_column, fg_color=COLORS['card'], corner_radius=15)
        timeline_card.pack(fill=tk.X, pady=(0, 20))
        
        timeline_title = ctk.CTkLabel(
            timeline_card,
            text="EMOTION TIMELINE",
            font=(self.theme.FONTS['h2'] if hasattr(self, 'theme') and self.theme else ("Arial Black", 16)),
            text_color=COLORS['text']
        )
        timeline_title.pack(anchor=tk.W, padx=20, pady=(20, 10))
        
        # Timeline canvas
        timeline_canvas = tk.Canvas(
            timeline_card,
            height=200,
            bg=COLORS['card'],
            highlightthickness=0
        )
        timeline_canvas.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        # Draw emotion timeline
        self._draw_emotion_timeline(timeline_canvas, analysis)
        
        # AI ClearCast Review card
        ai_review_card = self.theme.card(left_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(left_column, fg_color=COLORS['card'], corner_radius=15)
        ai_review_card.pack(fill=tk.X, pady=(20, 0))
        
        # Header with title and button
        clearcast_header = ctk.CTkFrame(ai_review_card, fg_color="transparent")
        clearcast_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        
        # Check if already checked
        clearcast_checked = analysis.get('clearcast_checked', False)
        clearcast_results = analysis.get('clearcast_check', None)
        fallback_video_name = self._get_video_display_name()
        ad_display_name = resolve_ad_name(clearcast_results or {}, fallback_video_name)
        header_container = self._render_custom_stories_header(
            clearcast_header,
            "Compliance & Risk View",
            ad_display_name,
        )
        self._render_clearcast_last_updated(header_container)
        
        if not clearcast_checked and analysis_id != 'sample':
            # Show check button
            clearcast_btn = ctk.CTkButton(
                clearcast_header,
                text="Check Clearcast",
                font=("SF Pro Text", 14, "bold"),
                width=140,
                height=32,
                corner_radius=16,
                fg_color=COLORS['yellow'],
                hover_color="#E6B800",
                text_color=COLORS['text'],
                command=lambda: self._check_clearcast_compliance(analysis_id, ai_review_card)
            )
            clearcast_btn.pack(side=tk.RIGHT)
            
            # Placeholder content
            placeholder_label = ctk.CTkLabel(
            ai_review_card,
                text="Click 'Check Clearcast' to analyze this video for TV advertising compliance.\nThis will check against Clearcast guidelines for prohibited content.",
            font=("Arial", 13),
            text_color=COLORS['text_light'],
            justify="left",
            anchor="w"
        )
            placeholder_label.pack(anchor=tk.W, padx=20, pady=(0, 20))
        else:
            # Show results
            if clearcast_results:
                self._display_clearcast_results(ai_review_card, clearcast_results)
            else:
                # Sample or error case
                sample_label = ctk.CTkLabel(
                    ai_review_card,
                    text="Clearcast compliance checking available for uploaded videos.",
                    font=("Arial", 13),
                    text_color=COLORS['text_light']
                )
                sample_label.pack(padx=20, pady=(0, 20))
        
        # Video transcript card with emotions
        transcript_card = self.theme.card(right_column) if hasattr(self, 'theme') and self.theme else ctk.CTkFrame(right_column, fg_color=COLORS['card'], corner_radius=15)
        transcript_card.pack(fill=tk.X)  # Changed from fill=tk.BOTH to prevent excessive expansion
        
        transcript_header = ctk.CTkFrame(transcript_card, fg_color="transparent")
        transcript_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        
        transcript_title = ctk.CTkLabel(
            transcript_header,
            text="TRANSCRIPT - WITH PHRASES HIGHLIGHTED BY EMOTION",
            font=(self.theme.FONTS['h2'] if hasattr(self, 'theme') and self.theme else ("Arial Black", 16)),
            text_color=COLORS['text']
        )
        transcript_title.pack(side=tk.LEFT)
        
        # Transcription status indicator
        transcription_status = analysis.get('transcription_status', 'unknown')
        transcription = analysis.get('transcription', {})
        is_ai_enhanced = isinstance(transcription, dict) and transcription.get('ai_enhancement', {}).get('enhanced', False)
        
        status_color = {
            'processing': '#F39C12',
            'complete': '#27AE60',
            'no_audio': '#95A5A6',
            'failed': '#E74C3C',
            'unknown': '#95A5A6'
        }.get(transcription_status, '#95A5A6')
        
        status_text = {
            'processing': '🔄 Processing...',
            'complete': '✓ Complete' + (' (AI Enhanced)' if is_ai_enhanced else ''),
            'no_audio': '🔇 No Audio',
            'failed': '❌ Failed',
            'unknown': ''
        }.get(transcription_status, '')
        
        if status_text:
            status_label = ctk.CTkLabel(
                transcript_header,
                text=status_text,
                font=("Arial", 12),
                text_color=status_color
            )
            status_label.pack(side=tk.RIGHT)
        
        # Create custom transcript widget frame
        transcript_display_frame = ctk.CTkFrame(
            transcript_card,
            fg_color="#FFFFFF",
            corner_radius=8
        )
        transcript_display_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 20))
        
        # Create hover info label
        self.hover_info = ctk.CTkLabel(
            transcript_card,
            text="",
            font=("Arial", 11),
            text_color=COLORS['text_light'],
            fg_color="#F0F0F0",
            corner_radius=6,
            height=30
        )
        # Initially hide hover info
        
        # Create the word-by-word transcript display
        transcript_text = self._create_word_by_word_transcript(transcript_display_frame, analysis)
        
        # Show AI-identified elements if available
        if isinstance(transcription, dict) and transcription.get('ai_enhancement', {}).get('identified_elements'):
            elements = transcription['ai_enhancement']['identified_elements']
            if any(elements.get(key) for key in ['brands', 'products', 'technical_terms']):
                elements_frame = ctk.CTkFrame(transcript_card, fg_color="#F0F0F0", corner_radius=8)
                elements_frame.pack(fill=tk.X, padx=20, pady=(10, 20))
                
                elements_title = ctk.CTkLabel(
                    elements_frame,
                    text="🤖 AI-Identified Elements:",
                    font=("Arial", 12, "bold"),
                    text_color=COLORS['text']
                )
                elements_title.pack(anchor="w", padx=10, pady=(10, 5))
                
                # Display each category
                if elements.get('brands'):
                    brands_label = ctk.CTkLabel(
                        elements_frame,
                        text=f"Brands: {', '.join(elements['brands'])}",
                        font=("Arial", 11),
                        text_color=COLORS['blue']
                    )
                    brands_label.pack(anchor="w", padx=20, pady=2)
                    
                if elements.get('products'):
                    products_label = ctk.CTkLabel(
                        elements_frame,
                        text=f"Products: {', '.join(elements['products'])}",
                        font=("Arial", 11),
                        text_color=COLORS['secondary']
                    )
                    products_label.pack(anchor="w", padx=20, pady=2)
                    
                if elements.get('technical_terms'):
                    terms_label = ctk.CTkLabel(
                        elements_frame,
                        text=f"Technical Terms: {', '.join(elements['technical_terms'])}",
                        font=("Arial", 11),
                        text_color=COLORS['text_light']
                    )
                    terms_label.pack(anchor="w", padx=20, pady=2)

        
        # Store references for refresh
        self.current_analysis_id = analysis_id
        self.transcript_display_frame = transcript_display_frame
        self.transcript_card = transcript_card
        
        # Schedule periodic refresh if transcription is processing
        if transcription_status == 'processing' and analysis_id != 'sample':
            self._schedule_transcript_refresh(analysis_id)
        
        # AI Video Breakdown card
        ai_breakdown_card = ctk.CTkFrame(right_column, fg_color=COLORS['card'], corner_radius=15)
        ai_breakdown_card.pack(fill=tk.X, pady=(20, 0))
        
        # Header with title and button
        breakdown_header = ctk.CTkFrame(ai_breakdown_card, fg_color="transparent")
        breakdown_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        
        # Check if already analyzed
        ai_breakdown_checked = analysis.get('ai_breakdown_checked', False)
        ai_breakdown_results = analysis.get('ai_breakdown', None)
        stored_airing_country = (
            analysis.get("ai_airing_country")
            or (ai_breakdown_results or {}).get("audience_context", {}).get("airing_country")
            or "United Kingdom"
        )
        self.ai_airing_country_var.set(stored_airing_country)
        fallback_video_name = self._get_video_display_name()
        ad_display_name = resolve_ad_name(ai_breakdown_results or {}, fallback_video_name)
        confidence_value, low_confidence, _ = self._extract_ad_confidence(ai_breakdown_results)
        self._render_custom_stories_header(
            breakdown_header,
            "Creative Performance View",
            ad_display_name,
            confidence_value,
            low_confidence,
        )
        self._render_airing_country_selector(ai_breakdown_card, analysis_id)
        
        if not ai_breakdown_checked and analysis_id != 'sample':
            detail_menu = ctk.CTkOptionMenu(
                breakdown_header,
                values=["Quick", "Full"],
                variable=self.ai_detail_var,
                width=110
            )
            detail_menu.pack(side=tk.RIGHT, padx=(0, 10))
            # Show analyze button
            breakdown_btn = ctk.CTkButton(
                breakdown_header,
                text="Analyze Video",
                font=("SF Pro Text", 14, "bold"),
                width=140,
                height=32,
                corner_radius=16,
                fg_color=COLORS['blue'],
                hover_color="#0051D5",
                text_color="white",
                command=lambda: self._analyze_video_breakdown(analysis_id, ai_breakdown_card)
            )
            breakdown_btn.pack(side=tk.RIGHT)
            
            # Placeholder content
            placeholder_label = ctk.CTkLabel(
            ai_breakdown_card,
                text="Click 'Analyze Video' to get AI-powered insights including:\n• Content breakdown and narrative structure\n• Estimated outcomes (sales, awareness, etc.)\n• What's working well and areas for improvement\n• Simulated audience reactions from different demographics",
            font=("Arial", 13),
            text_color=COLORS['text_light'],
            justify="left",
            anchor="w"
        )
            placeholder_label.pack(anchor=tk.W, padx=20, pady=(0, 20))
        else:
            # Show results
            if ai_breakdown_results:
                self._display_ai_breakdown_results(ai_breakdown_card, ai_breakdown_results)
            else:
                # Sample or error case
                sample_label = ctk.CTkLabel(
                    ai_breakdown_card,
                    text="AI video analysis available for uploaded videos.",
                    font=("Arial", 13),
                    text_color=COLORS['text_light']
                )
                sample_label.pack(padx=20, pady=(0, 20))
        
    def _create_emotion_bar(self, parent, emotion, percentage):
        """Create an emotion percentage bar"""
        bar_frame = ctk.CTkFrame(parent, fg_color="transparent")
        bar_frame.pack(fill=tk.X, padx=20, pady=5)
        
        # Emotion label
        label = ctk.CTkLabel(
            bar_frame,
            text=f"{emotion.upper()}: {percentage:.1f}%",
            font=("Arial", 12),
            text_color=COLORS['text'],
            width=150,
            anchor="w"
        )
        label.pack(side=tk.LEFT)
        
        # Progress bar
        progress = ctk.CTkProgressBar(
            bar_frame,
            width=200,
            height=20,
            progress_color=self.emotion_colors.get(emotion, '#95A5A6')
        )
        progress.pack(side=tk.LEFT, padx=10)
        progress.set(percentage / 100)
        
    def _create_reaction_thumbnail(self, parent, reaction, row, col):
        """Create a reaction thumbnail with enhanced demographic display"""
        thumb_frame = ctk.CTkFrame(
            parent,
            fg_color=COLORS['bg'],
            corner_radius=10,
            width=120,
            height=140  # Increased height for demographic info
        )
        thumb_frame.grid(row=row, column=col, padx=5, pady=5)
        thumb_frame.grid_propagate(False)
        
        # Store reference for updates
        reaction_id = reaction.get('id', '')
        if not hasattr(self, 'reaction_thumbnails'):
            self.reaction_thumbnails = {}
        self.reaction_thumbnails[reaction_id] = thumb_frame
        
        # Try to load webcam snapshot if available
        snapshot_loaded = False
        enhanced_data = None
        
        if 'reaction_snapshots' in reaction and reaction['reaction_snapshots']:
            # Get the first snapshot
            snapshot = reaction['reaction_snapshots'][0]
            if 'image_data' in snapshot:
                try:
                    # Convert base64 to image
                    img_data = snapshot['image_data']
                    if isinstance(img_data, bytes):
                        img = Image.open(BytesIO(img_data))
                    else:
                        img = Image.open(BytesIO(base64.b64decode(img_data)))
                    
                    # Resize to fit thumbnail
                    img.thumbnail((100, 100), Image.Resampling.LANCZOS)
                    photo = ImageTk.PhotoImage(img)
                    
                    # Display image
                    img_label = tk.Label(
                        thumb_frame,
                        image=photo,
                        bg=COLORS['bg']
                    )
                    img_label.image = photo  # Keep reference
                    img_label.pack(expand=True, pady=(10, 5))
                    snapshot_loaded = True
                    
                    # Get enhanced analysis data if available
                    if 'enhanced_analysis' in snapshot:
                        enhanced_data = snapshot['enhanced_analysis']
                except Exception as e:
                    logger.error(f"Failed to load reaction snapshot: {e}")
        
        if not snapshot_loaded:
                    self._add_reaction_emoji(thumb_frame)
        
        # Create info frame for demographics/emotion
        info_frame = ctk.CTkFrame(thumb_frame, fg_color="transparent")
        info_frame.pack(fill=tk.X, padx=5, pady=(0, 5))
        
        # Display enhanced demographic info or loading state
        if enhanced_data and 'demographics' in enhanced_data:
            # We have demographic data - display it
            demo = enhanced_data['demographics']
            emotion_data = enhanced_data.get('emotion_analysis', {})
            
            # Gender and Age
            demo_text = f"{demo.get('gender', 'Unknown')}\n{demo.get('age_estimate', '?')} years"
            demo_label = ctk.CTkLabel(
                info_frame,
                text=demo_text,
                font=("Arial", 10),
                text_color=COLORS['text_light']
            )
            demo_label.pack()
            
            # Emotion with color
            emotion = emotion_data.get('primary_emotion', reaction.get('dominant_emotion', 'neutral'))
            emotion_label = ctk.CTkLabel(
                info_frame,
                text=emotion.upper(),
                font=("Arial", 11, "bold"),
                text_color=self.emotion_colors.get(emotion, COLORS['text'])
            )
            emotion_label.pack()
        else:
            # Check if we're still processing
            # Always show loading state for new reactions since analysis is async
            if reaction_id:
                loading_label = ctk.CTkLabel(
                    info_frame,
                    text="Analyzing...",
                    font=("Arial", 10, "italic"),
                    text_color=COLORS['text_light']
                )
                loading_label.pack()
                
                # Schedule periodic checks for updates
                self._schedule_thumbnail_update(reaction_id, thumb_frame, info_frame)
            else:
                # Fallback to simple emotion display
                if 'dominant_emotion' in reaction:
                    emotion_label = ctk.CTkLabel(
                        info_frame,
                        text=reaction['dominant_emotion'].upper(),
                        font=("Arial", 10),
                        text_color=COLORS['text']
                    )
                    emotion_label.pack()
        
        # Click binding
        thumb_frame.bind("<Button-1>", lambda e: self._view_reaction_enhanced(reaction))
        for child in thumb_frame.winfo_children():
            child.bind("<Button-1>", lambda e: self._view_reaction_enhanced(reaction))
            
    def _schedule_thumbnail_update(self, reaction_id: str, thumb_frame: ctk.CTkFrame, info_frame: ctk.CTkFrame):
        """Schedule periodic checks for enhanced analysis updates"""
        def check_for_updates():
            try:
                if not thumb_frame.winfo_exists():
                    return
                    
                # Get updated reaction data
                reaction = self.storage.get_reaction(reaction_id)
                if not reaction:
                    return
                
                # Check if we now have enhanced analysis in ANY snapshot
                enhanced_data = None
                if 'reaction_snapshots' in reaction and reaction['reaction_snapshots']:
                    # Check all snapshots for enhanced analysis
                    for snapshot in reaction['reaction_snapshots']:
                        if 'enhanced_analysis' in snapshot and 'demographics' in snapshot['enhanced_analysis']:
                            enhanced_data = snapshot['enhanced_analysis']
                            break  # Use the first one we find
                
                if enhanced_data and 'demographics' in enhanced_data:
                    # Clear the loading state
                    for widget in info_frame.winfo_children():
                        widget.destroy()
                    
                    # Display the demographic data
                    demo = enhanced_data['demographics']
                    emotion_data = enhanced_data.get('emotion_analysis', {})
                    
                    # Gender and Age
                    demo_text = f"{demo.get('gender', 'Unknown')}\n{demo.get('age_estimate', '?')} years"
                    demo_label = ctk.CTkLabel(
                        info_frame,
                        text=demo_text,
                        font=("Arial", 10),
                        text_color=COLORS['text_light']
                    )
                    demo_label.pack()
                    
                    # Emotion with color
                    emotion = emotion_data.get('primary_emotion', reaction.get('dominant_emotion', 'neutral'))
                    emotion_label = ctk.CTkLabel(
                        info_frame,
                        text=emotion.upper(),
                        font=("Arial", 11, "bold"),
                        text_color=self.emotion_colors.get(emotion, COLORS['text'])
                    )
                    emotion_label.pack()
                else:
                    # Check how long we've been waiting
                    if not hasattr(self, '_thumbnail_check_count'):
                        self._thumbnail_check_count = {}
                    
                    if reaction_id not in self._thumbnail_check_count:
                        self._thumbnail_check_count[reaction_id] = 0
                    
                    self._thumbnail_check_count[reaction_id] += 1
                    
                    # Give up after 10 checks (20 seconds)
                    if self._thumbnail_check_count[reaction_id] >= 10:
                        # Clear loading state and show basic info
                        for widget in info_frame.winfo_children():
                            widget.destroy()
                        
                        # Show basic emotion info
                        if 'dominant_emotion' in reaction:
                            emotion_label = ctk.CTkLabel(
                                info_frame,
                                text=reaction['dominant_emotion'].upper(),
                                font=("Arial", 10),
                                text_color=self.emotion_colors.get(reaction['dominant_emotion'], COLORS['text'])
                            )
                            emotion_label.pack()
                        
                        # Clean up counter
                        del self._thumbnail_check_count[reaction_id]
                    else:
                        # Not ready yet, check again in 2 seconds
                        self.root.after(2000, check_for_updates)
                    
            except Exception as e:
                logger.error(f"Error updating reaction thumbnail: {e}")
        
        # Start checking after 1 second
        self.root.after(1000, check_for_updates)
            
    def _add_reaction_emoji(self, parent):
        """Add emoji fallback for reaction thumbnail"""
        emoji_label = tk.Label(
            parent,
            bg=COLORS['bg'],
            text="🎭",
            font=("Arial", 32)
        )
        emoji_label.pack(expand=True)
        
    def _clear_container(self):
        """Clear all widgets from main container"""
        # Stop any running analysis first
        if hasattr(self, 'emotion_tracker') and self.emotion_tracker and self.is_playing:
            self.emotion_tracker.stop_analysis()
            self.is_playing = False
            
        # Don't reset video path - keep it for persistence
        # Only clear widgets
        for widget in self.main_container.winfo_children():
            widget.destroy()
        
    def _upload_video(self):
        """Handle video upload"""
        file_path = filedialog.askopenfilename(
            title="Select Video",
            filetypes=[("Video files", "*.mp4 *.avi *.mov *.mkv")]
        )
        
        if file_path:
            # PHASE 2: Show loading overlay
            loading_overlay = ctk.CTkFrame(
                self.main_container,
                fg_color="black",
                corner_radius=0
            )
            loading_overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
            
            loading_content = ctk.CTkFrame(
                loading_overlay,
                fg_color=COLORS['card'],
                corner_radius=20,
                width=300,
                height=150
            )
            loading_content.place(relx=0.5, rely=0.5, anchor="center")
            
            loading_label = ctk.CTkLabel(
                loading_content,
                text="Processing Video...",
                font=("Arial", 18, "bold"),
                text_color=COLORS['text']
            )
            loading_label.pack(pady=(30, 10))
            
            progress_bar = ctk.CTkProgressBar(
                loading_content,
                width=200,
                height=10,
                mode="indeterminate"
            )
            progress_bar.pack(pady=10)
            progress_bar.start()
            
            self.root.update()
            
            # Validate file
            try:
                # Check file size
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                if file_size > 500:  # 500MB limit
                    loading_overlay.destroy()
                    self._show_notification("Video file too large (max 500MB)", "error")
                    return
                    
                # Test if file can be opened
                test_cap = cv2.VideoCapture(file_path)
                if not test_cap.isOpened():
                    loading_overlay.destroy()
                    self._show_notification("Unable to open video file", "error")
                    return
                test_cap.release()
                
            except Exception as e:
                logger.error(f"Video validation error: {e}")
                loading_overlay.destroy()
                self._show_notification("Invalid video file", "error")
                return
                
            self.current_video_path = file_path
            filename = os.path.basename(file_path)
            if len(filename) > 25:
                display_name = filename[:22] + "..."
            else:
                display_name = filename
            
            # Only update button if it exists
            if hasattr(self, 'upload_btn'):
                self.upload_btn.configure(text=f"📹 {display_name}")
            
            # Reset emotion tracker
            if hasattr(self, 'emotion_tracker'):
                self.emotion_tracker.reset()
                
            # Reset graph data
            self.emotion_graph_data = []
            
            # Clear from_reaction flag since this is a new upload
            self._from_reaction = False
            
            # Clear video display completely for new video
            self.video_label.configure(image="", text="")
            self.video_label.image = None
            
            # Clear webcam display
            if hasattr(self, 'webcam_label'):
                self.webcam_label.configure(image="", text="Camera will activate on play")
                self.webcam_label.image = None
            
            # Hide upload overlay when video is loaded
            if hasattr(self, 'upload_overlay'):
                self.upload_overlay.place_forget()
            
            # Show loading state
            self.video_label.configure(text="🔄 Loading video...", fg='#FFC107', font=("SF Pro Text", 24))
            self.root.update_idletasks()  # Force UI update
            
            # Create new analysis
            user_id = self.current_user['username'] if self.current_user else None
            is_admin = self.current_user.get('role') == 'admin' if self.current_user else False
            analysis_result = self.storage.create_analysis(file_path, user_id, is_admin)
            
            # Check if it's an error
            if isinstance(analysis_result, str) and analysis_result.startswith("ERROR:"):
                # Remove loading overlay
                loading_overlay.destroy()
                # Show error message
                self._show_notification(analysis_result[6:], "error")  # Remove "ERROR:" prefix
                return
            
            self.current_analysis_id = analysis_result
            
            # Remove loading overlay
            loading_overlay.destroy()
            
            # Show success notification
            self._show_notification(f"Video loaded: {os.path.basename(file_path)}", "success")
            
            # Pre-initialize video in emotion tracker
            self.root.after(100, self._initialize_video)
            
    def _initialize_video(self):
        """Initialize video after upload"""
        try:
            # Show webcam loading state
            if hasattr(self, 'webcam_label'):
                self.webcam_label.configure(text="🔄 Initializing webcam...", fg='#FFC107')
            
            # Pre-load video to check if it's valid
            cap = cv2.VideoCapture(self.current_video_path)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    # Show video preview only when coming from reaction
                    if hasattr(self, '_from_reaction') and self._from_reaction:
                        frame = cv2.resize(frame, (640, 480))
                        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        img = Image.fromarray(frame)
                        imgtk = ImageTk.PhotoImage(image=img)
                        self.video_label.configure(image=imgtk, text="")
                        self.video_label.image = imgtk
                    # Otherwise keep the upload overlay visible
                cap.release()
                
                # Update UI to ready state with a slight delay to ensure webcam is ready
                self.root.after(500, self._show_ready_state)
                
                # Extract audio in background
                threading.Thread(target=self._preprocess_audio, daemon=True).start()
            else:
                self.video_label.configure(text="Failed to load video", fg='red')
                logger.error(f"Failed to open video: {self.current_video_path}")
        except Exception as e:
            logger.error(f"Failed to initialize video: {e}")
            self.video_label.configure(text="Error loading video", fg='red')
            
    def _show_ready_state(self):
        """Show ready state after initialization"""
        # Clear loading messages
        self.video_label.configure(text="")
        if hasattr(self, 'webcam_label'):
            self.webcam_label.configure(text="Camera will activate on play")
        
        # Handle upload overlay visibility
        if hasattr(self, 'upload_overlay'):
            if hasattr(self, '_from_reaction') and self._from_reaction:
                # Coming from reaction - ensure overlay is hidden
                self.upload_overlay.place_forget()
            elif not self.current_video_path:
                # No video loaded and not from reaction - show overlay
                self.upload_overlay.place(relx=0.5, rely=0.5, anchor="center")
            else:
                # Have video but not from reaction - hide overlay
                self.upload_overlay.place_forget()
        
        # Show ready overlay on video
        # Position it centered for reactions, lower for new uploads (to avoid overlapping with upload overlay)
        if hasattr(self, '_from_reaction') and self._from_reaction:
            ready_position = 0.5  # Centered for reactions
        else:
            ready_position = 0.85  # Lower for new uploads
            
        overlay_label = ctk.CTkLabel(
            self.video_label.master,
            text="✓ Ready to play",
            font=("SF Pro Display", 28, "bold"),
            text_color="#4CAF50",
            fg_color="#000000",
            corner_radius=20
        )
        overlay_label.place(relx=0.5, rely=ready_position, anchor="center")
        
        # Enable play button with proper styling - ensure it's truly enabled
        self.play_btn.configure(
            state="normal",
            text="Play",
            fg_color=COLORS['secondary'],
            hover_color="#248A3D",
            text_color="white"
        )
        
        # Force UI update to ensure button state change is applied
        self.play_btn.update()
        
        # Log button state for debugging
        logger.info(f"Play button enabled. State: {self.play_btn.cget('state')}")
        
        # Fade out overlay after 2 seconds
        self.root.after(2000, overlay_label.destroy)
        
    def _preprocess_audio(self):
        """Pre-extract audio to avoid playback delay"""
        try:
            if MOVIEPY_AVAILABLE:
                temp_audio = Path(self.current_video_path).stem + "_temp_audio.mp3"
                
                # Check if already extracted
                if not Path(temp_audio).exists():
                    video_clip = VideoFileClip(self.current_video_path)
                    if video_clip.audio:
                        video_clip.audio.write_audiofile(temp_audio, logger=None, verbose=False)
                    video_clip.close()
        except Exception as e:
            logger.error(f"Failed to preprocess audio: {e}")
        
    def _toggle_playback(self):
        """Toggle video playback"""
        if not self.current_video_path:
            # No video path: guide user back to Projects to select a video to react to
            self._show_notification("Select a project first (Projects → Select → Add Reaction)", type="warning")
            return
            
        if not self.is_playing:
            # Disable button to prevent double clicks
            self.play_btn.configure(state="disabled", text="Loading...")
            
            # Check if models are ready
            if not self.models_ready:
                self._show_notification("Models are still loading, please wait...", type="info")
                self.play_btn.configure(text="Waiting for models...", fg_color="#FF9500")
                
                # Wait for models to be ready in background
                def wait_and_start():
                    # Wait up to 10 seconds for models to be ready
                    for i in range(100):
                        if self.models_ready:
                            break
                        time.sleep(0.1)
                    
                    # Update button and start playback on UI thread
                    self.root.after(0, lambda: [
                        self.play_btn.configure(state="normal", text="Starting...", fg_color=COLORS['secondary']),
                        self._actually_start_playback()
                    ])
                
                threading.Thread(target=wait_and_start, daemon=True).start()
            else:
                # Models are ready, start immediately
                self.play_btn.configure(state="normal", text="Starting...", fg_color=COLORS['secondary'])
                self.root.after(100, self._actually_start_playback)
        else:
            # Stop playing
            self.emotion_tracker.stop_analysis()
            self.is_playing = False
            self.play_btn.configure(
                text="Play", 
                fg_color=COLORS['secondary'],
                state="normal"
            )
            
            # Clear webcam to prevent frozen frame
            if hasattr(self, 'webcam_label') and self.webcam_label.winfo_exists():
                self.webcam_label.configure(image="", text="Camera will activate on play")
                self.webcam_label.image = None
    
    def _actually_start_playback(self):
        """Actually start the playback after models are ready"""
        # Check if we're already playing
        if self.is_playing:
            logger.info("Already playing, ignoring duplicate request")
            return
            
        # Start countdown
        self._show_countdown_direct()
    
    def _show_countdown_direct(self):
        """Show countdown directly without loading screens"""
        # Create countdown overlay
        countdown_overlay = ctk.CTkFrame(
            self.video_label.master,
            fg_color="black",
            corner_radius=0
        )
        countdown_overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        
        # Countdown container
        countdown_container = ctk.CTkFrame(
            countdown_overlay,
            fg_color="transparent"
        )
        countdown_container.place(relx=0.5, rely=0.5, anchor="center")
        
        # Countdown label
        countdown_label = ctk.CTkLabel(
            countdown_container,
            text="3",
            font=("SF Pro Display", 120, "bold"),
            text_color="#FF5252"
        )
        countdown_label.pack()
        
        # Instructions label
        instructions_label = ctk.CTkLabel(
            countdown_container,
            text="Get ready!",
            font=("SF Pro Display", 24),
            text_color="#FFFFFF"
        )
        instructions_label.pack(pady=(20, 0))
        
        # Baseline info label
        baseline_label = ctk.CTkLabel(
            countdown_container,
            text="We'll calibrate to your natural expression",
            font=("SF Pro Display", 16),
            text_color="#CCCCCC"
        )
        baseline_label.pack(pady=(10, 0))
        
        def update_countdown(count):
            if count > 0:
                countdown_label.configure(text=str(count))
                # Color transitions
                if count == 3:
                    countdown_label.configure(text_color="#FF5252")
                elif count == 2:
                    countdown_label.configure(text_color="#FFC107")
                elif count == 1:
                    countdown_label.configure(text_color="#4CAF50")
                self.root.after(1000, lambda: update_countdown(count - 1))
            else:
                # GO!
                countdown_label.configure(text="GO!", text_color="#4CAF50")
                instructions_label.configure(text="")
                
                # Start analysis after short delay
                self.root.after(300, lambda: self._start_analysis_simple(countdown_overlay))
        
        # Start countdown
        update_countdown(3)
    
    def _start_analysis_simple(self, countdown_overlay):
        """Start analysis without extra overlays"""
        # Remove countdown
        countdown_overlay.destroy()
        
        # Update button state
        self.is_playing = True
        self.play_btn.configure(
            text="Pause",
            fg_color=COLORS['primary'],
            hover_color="#D70015",
            text_color="white",
            state="normal"
        )
        
        # Start emotion analysis
        success = self.emotion_tracker.start_analysis(
            self.current_video_path,
            self._on_emotion_update,
            self._on_analysis_complete,
            self.current_analysis_id,
            quality_callback=None  # Disable quality warnings
        )
        
        if not success:
            self.is_playing = False
            self.play_btn.configure(
                text="Play", 
                fg_color=COLORS['secondary'],
                state="normal"
            )
            self._show_notification("Failed to start analysis", type="error")
    
    def _on_emotion_update(self, emotion_data):
        """Callback when emotion is detected"""
        # Check if we're still on the analysis page
        if self.current_page != "upload":
            return
            
        # Update emotion display
        self._update_emotion_display(emotion_data)
        # Update emotion graph
        self._update_emotion_graph(emotion_data)
        
        # PHASE 1: Update face quality indicator
        if 'quality' in emotion_data and hasattr(self, 'quality_bar'):
            try:
                if self.quality_bar.winfo_exists():
                    quality_score = emotion_data['quality']
                    self.quality_bar.set(quality_score)
                    
                    # Update quality text and color with iOS colors
                    if hasattr(self, 'quality_text') and self.quality_text.winfo_exists():
                        if quality_score >= 0.8:
                            self.quality_text.configure(text="Excellent", text_color=COLORS['secondary'])
                            self.quality_bar.configure(progress_color=COLORS['secondary'])
                        elif quality_score >= 0.6:
                            self.quality_text.configure(text="Good", text_color="#FF9500")
                            self.quality_bar.configure(progress_color="#FF9500")
                        elif quality_score >= 0.4:
                            self.quality_text.configure(text="Fair - Adjust lighting", text_color="#FF6482")
                            self.quality_bar.configure(progress_color="#FF6482")
                        else:
                            self.quality_text.configure(text="Poor - Check position", text_color=COLORS['primary'])
                            self.quality_bar.configure(progress_color=COLORS['primary'])
            except tk.TclError:
                pass  # Widget was destroyed
                
    def _on_quality_warning(self, quality_metrics):
        """Callback when face quality is poor"""
        # Throttle warnings to prevent spam
        current_time = time.time()
        if current_time - self.last_quality_warning_time < self.quality_warning_cooldown:
            return  # Skip if too soon after last warning
            
        # Update last warning time
        self.last_quality_warning_time = current_time
        
        # Show notification about poor quality
        warning_msg = "Face detection quality is low. "
        
        if quality_metrics['brightness'] < 0.3:
            warning_msg += "Too dark! "
        elif quality_metrics['brightness'] > 0.7:
            warning_msg += "Too bright! "
            
        if quality_metrics['blur_score'] < 0.3:
            warning_msg += "Too blurry! "
            
        if quality_metrics['face_size'] < 0.3:
            warning_msg += "Move closer! "
        elif quality_metrics['face_size'] > 0.7:
            warning_msg += "Move back! "
            
        self._show_notification(warning_msg, "warning", duration=5000)
        
    def _update_emotion_display(self, emotion_data):
        """Update emotion display in main thread"""
        try:
            if hasattr(self, 'current_emotion_label') and self.current_emotion_label.winfo_exists():
                # Check if we're collecting baseline
                if emotion_data.get('collecting_baseline', False):
                    self.current_emotion_label.configure(
                        text="📊 CALIBRATING...",
                        text_color=COLORS['yellow']
                    )
                else:
                    emotion_text = emotion_data.get('emotion', 'Unknown').upper()
                    if emotion_data.get('baseline_collected', False):
                        # Show a small indicator that baseline is active
                        emotion_text = f"✓ {emotion_text}"
                    self.current_emotion_label.configure(
                        text=emotion_text,
                        text_color=COLORS['text']
                    )
                
                # Update emotion graph
                self._update_emotion_graph(emotion_data)
                
                # Update video progress
                if hasattr(self, 'video_progress'):
                    try:
                        if self.video_progress.winfo_exists() and emotion_data.get('video_progress'):
                            self.video_progress.set(emotion_data['video_progress'])
                    except:
                        pass
                    
                # Update time label
                if hasattr(self, 'time_label'):
                    try:
                        if self.time_label.winfo_exists() and emotion_data.get('timestamp'):
                            current_time = emotion_data['timestamp']
                            total_time = self.emotion_tracker.total_frames / self.emotion_tracker.video_fps if self.emotion_tracker.video_fps > 0 else 0
                            self.time_label.configure(
                                text=f"{self._format_time(current_time)} / {self._format_time(total_time)}"
                            )
                    except:
                        pass
        except (tk.TclError, AttributeError):
            # Widget was destroyed or not available, ignore
            pass
        
    def _on_analysis_complete(self, results):
        """Handle analysis completion"""
        try:
            self.is_playing = False
            self.play_btn.configure(
                text="Play",
                fg_color=COLORS['secondary'],
                state="normal"
            )
            
            # Validate results
            if not results:
                self._show_notification("Analysis completed but no data was captured", "error")
                return
                
            # Check if we have meaningful data
            if not results.get('emotion_timeline') or len(results.get('emotion_timeline', [])) < 10:
                self._show_notification("Not enough emotion data captured. Try a longer recording.", "error")
                return
                
            # Save results
            if self.current_analysis_id:
                reaction_id = self.storage.save_reaction(self.current_analysis_id, results)
                
                if reaction_id:
                    # Store reaction ID in emotion tracker for async updates
                    self.emotion_tracker._reaction_id = reaction_id
                    
                    # Analyze emotion triggers based on timing
                    self.storage.analyze_emotion_triggers(self.current_analysis_id)
                    
                    # Show success notification
                    engagement = results.get('engagement_score', 0)
                    self._show_notification(
                        f"Analysis saved! Engagement: {engagement:.0%}", 
                        "success",
                        duration=2000
                    )
                else:
                    self._show_notification("Failed to save analysis", "error")
                    return
                    
            # Show brief completion message on video
            completion_label = ctk.CTkLabel(
                self.video_label.master,
                text="✓ Analysis Complete!",
                font=("Arial", 32, "bold"),
                text_color="#4CAF50",
                fg_color="#000000",
                corner_radius=20
            )
            completion_label.place(relx=0.5, rely=0.5, anchor="center")
            
            # Auto-redirect to dashboard after brief delay
            self.root.after(1500, lambda: [
                completion_label.destroy(),
                self._show_analysis_dashboard(self.current_analysis_id)
            ])
            
            # Clear webcam to prevent frozen frame
            if hasattr(self, 'webcam_label') and self.webcam_label.winfo_exists():
                self.webcam_label.configure(image="", text="Camera will activate on play")
                self.webcam_label.image = None
        except Exception as e:
            logger.error(f"Error in analysis completion: {e}")
            self._show_notification("An error occurred while saving the analysis", "error")
        
    def _update_video_display(self):
        """Update video and webcam displays"""
        # Check if we should still be updating
        if not hasattr(self, 'root') or not self.root.winfo_exists():
            return
            
        if self.current_page == "upload" and self.emotion_tracker:
            try:
                # Update video frame
                video_frame = self.emotion_tracker.get_video_frame()
                if video_frame is not None:
                    # Get original frame dimensions
                    orig_height, orig_width = video_frame.shape[:2]
                    
                    # Resize and display
                    if self.is_fullscreen and self.video_window:
                        # Fullscreen display
                        screen_width = self.video_window.winfo_width()
                        screen_height = self.video_window.winfo_height()
                        if screen_width > 1 and screen_height > 1:
                            # Calculate aspect ratio preserving dimensions
                            aspect_ratio = orig_width / orig_height
                            if screen_width / screen_height > aspect_ratio:
                                # Screen is wider, fit to height
                                new_height = screen_height
                                new_width = int(new_height * aspect_ratio)
                            else:
                                # Screen is taller, fit to width
                                new_width = screen_width
                                new_height = int(new_width / aspect_ratio)
                            
                            video_frame = cv2.resize(video_frame, (new_width, new_height))
                            video_frame = cv2.cvtColor(video_frame, cv2.COLOR_BGR2RGB)
                            img = Image.fromarray(video_frame)
                            imgtk = ImageTk.PhotoImage(image=img)
                            if hasattr(self, 'fullscreen_video_label') and self.fullscreen_video_label.winfo_exists():
                                self.fullscreen_video_label.configure(image=imgtk)
                                self.fullscreen_video_label.image = imgtk
                    else:
                        # Normal display - preserve aspect ratio within bounds
                        max_width = 640
                        max_height = 480
                        
                        # Calculate aspect ratio preserving dimensions
                        aspect_ratio = orig_width / orig_height
                        if max_width / max_height > aspect_ratio:
                            # Container is wider, fit to height
                            new_height = max_height
                            new_width = int(new_height * aspect_ratio)
                        else:
                            # Container is taller, fit to width
                            new_width = max_width
                            new_height = int(new_width / aspect_ratio)
                        
                        video_frame = cv2.resize(video_frame, (new_width, new_height))
                        video_frame = cv2.cvtColor(video_frame, cv2.COLOR_BGR2RGB)
                        img = Image.fromarray(video_frame)
                        imgtk = ImageTk.PhotoImage(image=img)
                        if hasattr(self, 'video_label') and self.video_label.winfo_exists():
                            self.video_label.configure(image=imgtk, text="")
                            self.video_label.image = imgtk
                    
                # Update webcam frame (smaller update rate)
                if not hasattr(self, '_webcam_update_counter'):
                    self._webcam_update_counter = 0
                self._webcam_update_counter += 1
                
                # Update webcam only every 3rd frame (10 FPS) to reduce load
                # AND only if we're actually playing
                if self._webcam_update_counter % 3 == 0 and self.is_playing:
                    webcam_frame = self.emotion_tracker.get_webcam_frame()
                    if webcam_frame is not None:
                        # Resize and display
                        webcam_frame = cv2.resize(webcam_frame, (240, 180))
                        webcam_frame = cv2.cvtColor(webcam_frame, cv2.COLOR_BGR2RGB)
                        img = Image.fromarray(webcam_frame)
                        imgtk = ImageTk.PhotoImage(image=img)
                        if hasattr(self, 'webcam_label') and self.webcam_label.winfo_exists():
                            self.webcam_label.configure(image=imgtk, text="")
                            self.webcam_label.image = imgtk
                elif not self.is_playing and hasattr(self, 'webcam_label'):
                    # If not playing, ensure webcam shows placeholder text
                    if self.webcam_label.winfo_exists() and not self.webcam_label.cget("text"):
                        self.webcam_label.configure(image="", text="Camera will activate on play")
                        self.webcam_label.image = None
            except Exception as e:
                # Don't spam logs with tkinter errors during shutdown
                if "invalid command name" not in str(e):
                    logger.error(f"Error updating video display: {e}")
                    
        # Schedule next update
        if hasattr(self, 'root') and self.root.winfo_exists():
            self.root.after(40, self._update_video_display)  # 25 FPS instead of 30
        
    def _update_emotion_graph(self, emotion_data):
        """Update the live emotion graph"""
        if not emotion_data or not hasattr(self, 'graph_canvas'):
            return
            
        # Check if we're still on the correct page
        if self.current_page != "upload":
            return
            
        # Check if canvas still exists and is visible
        try:
            if not self.graph_canvas.winfo_exists():
                return
        except tk.TclError:
            # Widget was destroyed
            return
            
        try:
            # Add new data point
            self.emotion_graph_data.append(emotion_data)
            
            # Keep only last 100 points for performance
            if len(self.emotion_graph_data) > 100:
                self.emotion_graph_data.pop(0)
                
            # Clear canvas
            self.graph_canvas.delete("all")
            
            # Get canvas dimensions
            try:
                self.graph_canvas.update_idletasks()
                width = self.graph_canvas.winfo_width()
                height = self.graph_canvas.winfo_height()
            except tk.TclError:
                # Widget was destroyed during update
                return
            
            if width <= 1 or height <= 1 or len(self.emotion_graph_data) < 2:
                return
                
            # Draw emotion lines
            emotions_to_plot = ['happy', 'sad', 'angry', 'bored', 'neutral']
            
            for emotion in emotions_to_plot:
                points = []
                for i, data in enumerate(self.emotion_graph_data):
                    x = (i / (len(self.emotion_graph_data) - 1)) * (width - 40) + 20
                    
                    # Get emotion value from scores dict
                    if 'scores' in data and emotion in data['scores']:
                        value = data['scores'][emotion]
                    else:
                        # Fallback for old format
                        value = 1.0 if data.get('emotion') == emotion else 0.0
                        
                    y = height - (value * (height - 40)) - 20
                    points.extend([x, y])
                    
                if len(points) >= 4:
                    self.graph_canvas.create_line(
                        points,
                        fill=self.emotion_colors.get(emotion, '#ffffff'),
                        width=2,
                        smooth=True,
                        tags=emotion
                    )
                    
            # Draw current emotion indicator with polished design
            if self.emotion_graph_data:
                current = self.emotion_graph_data[-1]
                current_emotion = current.get('emotion', 'Unknown')
                
                # Draw emotion label with rounded background
                x = width - 100
                y = 20
                
                # Calculate text width for proper background
                temp_text = self.graph_canvas.create_text(0, 0, text=current_emotion.upper(), font=("SF Pro Text", 12, "bold"))
                bbox = self.graph_canvas.bbox(temp_text)
                self.graph_canvas.delete(temp_text)
                text_width = 60 if not bbox else bbox[2] - bbox[0] + 20
                
                # Rounded background (simulate with oval)
                self.graph_canvas.create_oval(
                    x - 5, y - 14, x + text_width + 5, y + 14,
                    fill=self.emotion_colors.get(current_emotion, COLORS['text']),
                    outline="",
                    tags="current"
                )
                
                # Text label
                self.graph_canvas.create_text(
                    x + text_width/2, y,
                    text=current_emotion.upper(),
                    fill='white',
                    font=("SF Pro Text", 12, "bold"),
                    anchor="center",
                    tags="current"
                )
                
            # Add mini legend at bottom
            legend_y = height - 10
            for i, emotion in enumerate(emotions_to_plot[:3]):  # Show only first 3
                x = 20 + i * 80
                color = self.emotion_colors.get(emotion, '#ffffff')
                
                # Color dot
                self.graph_canvas.create_oval(
                    x, legend_y - 3, x + 6, legend_y + 3,
                    fill=color,
                    outline=""
                )
                
                # Label
                self.graph_canvas.create_text(
                    x + 10, legend_y,
                    text=emotion.capitalize(),
                    fill=COLORS['text'],
                    font=("SF Pro Text", 10),
                    anchor="w"
                )
                
        except tk.TclError as e:
            # Widget was destroyed during drawing
            logger.debug(f"Widget destroyed during emotion graph update: {e}")
        except Exception as e:
            # Only log non-TclError exceptions
            if "invalid command name" not in str(e):
                logger.error(f"Error updating emotion graph: {e}")
        
    def _draw_emotion_timeline(self, canvas, analysis):
        """Draw emotion timeline on canvas"""
        canvas.delete("all")
        
        width = canvas.winfo_width()
        height = canvas.winfo_height()
        
        if width <= 1 or height <= 1:
            # Schedule redraw when canvas is ready
            self.root.after(100, lambda: self._draw_emotion_timeline(canvas, analysis))
            return
            
        # Get emotion timeline data
        timeline = analysis.get('emotion_timeline', [])
        
        # If no timeline data, show informative message
        if not timeline:
            # Draw placeholder chart axes
            margin = 40
            canvas.create_line(
                margin, height - margin, width - margin, height - margin,
                fill=COLORS['text_light'], width=1, dash=(2, 2)
            )
            canvas.create_line(
                margin, margin, margin, height - margin,
                fill=COLORS['text_light'], width=1, dash=(2, 2)
            )
            
            # Show centered message
            canvas.create_text(
                width // 2, height // 2,
                text="📈 Emotion timeline will appear here\nafter recording reactions",
                fill=COLORS['text'],
                font=("Arial", 14),
                anchor="center"
            )
            
            # Add sample legend to show what will appear
            legend_y = height - 20
            sample_emotions = ['happy', 'sad', 'angry', 'neutral']
            for i, emotion in enumerate(sample_emotions):
                x = margin + i * 80
                canvas.create_rectangle(
                    x, legend_y, x + 15, legend_y + 15,
                    fill=self.emotion_colors.get(emotion, '#95A5A6'),
                    outline=""
                )
                canvas.create_text(
                    x + 20, legend_y + 7,
                    text=emotion.capitalize(),
                    fill=COLORS['text_light'],
                    font=("Arial", 8),
                    anchor="w"
                )
            return
            
        # Calculate time range
        max_time = max([entry.get('timestamp', 0) for entry in timeline]) if timeline else 60
        if max_time == 0:
            max_time = 60  # Default to 60 seconds
        
        # Draw axes
        margin = 40
        
        # X-axis (time)
        canvas.create_line(
            margin, height - margin, width - margin, height - margin,
            fill=COLORS['text'], width=2
        )
        
        # Y-axis (emotion intensity)
        canvas.create_line(
            margin, margin, margin, height - margin,
            fill=COLORS['text'], width=2
        )
        
        # Y-axis label
        canvas.create_text(
            margin - 10, margin,
            text="100%",
            fill=COLORS['text_light'],
            font=("Arial", 8),
            anchor="e"
        )
        canvas.create_text(
            margin - 10, height - margin,
            text="0%",
            fill=COLORS['text_light'],
            font=("Arial", 8),
            anchor="e"
        )
        
        # Draw time labels
        time_intervals = 5 if max_time > 60 else 4
        for i in range(time_intervals + 1):
            x = margin + (i / time_intervals) * (width - 2 * margin)
            time_val = (i / time_intervals) * max_time
            
            # Draw tick mark
            canvas.create_line(
                x, height - margin,
                x, height - margin + 5,
                fill=COLORS['text'],
                width=1
            )
            
            # Draw label
            canvas.create_text(
                x, height - margin + 10,
                text=f"{int(time_val)}s",
                fill=COLORS['text'],
                font=("Arial", 9),
                anchor="n"
            )
            
        # Process timeline data for smoother visualization
        emotion_series = {}
        
        for entry in timeline:
            timestamp = entry.get('timestamp', 0)
            
            # Handle different data formats
            if 'scores' in entry:
                # New format with scores dict
                scores = entry['scores']
                for emotion, score in scores.items():
                    if emotion not in emotion_series:
                        emotion_series[emotion] = []
                    emotion_series[emotion].append({
                        'time': timestamp,
                        'value': score
                    })
            else:
                # Old format with just emotion name
                emotion = entry.get('emotion', 'neutral')
                if emotion not in emotion_series:
                    emotion_series[emotion] = []
                
                # Give binary value for old format
                for em in self.emotion_colors.keys():
                    if em not in emotion_series:
                        emotion_series[em] = []
                    emotion_series[em].append({
                        'time': timestamp,
                        'value': 1.0 if em == emotion else 0.0
                    })
        
        # Draw emotion lines
        lines_drawn = 0
        for emotion, data_points in emotion_series.items():
            if len(data_points) < 2 or emotion not in self.emotion_colors:
                continue
                
            # Sort by time
            data_points.sort(key=lambda x: x['time'])
            
            # Create line points
            points = []
            for point in data_points:
                x = margin + (point['time'] / max_time) * (width - 2 * margin)
                y = height - margin - (point['value'] * (height - 2 * margin))
                points.extend([x, y])
                
            # Draw line with emotion color
            if len(points) >= 4:
                canvas.create_line(
                    points,
                    fill=self.emotion_colors.get(emotion, '#95A5A6'),
                    width=2,
                    smooth=True,
                    tags=emotion
                )
                lines_drawn += 1
                
        # Add legend for emotions that have data
        legend_x = margin
        legend_y = 10
        emotions_shown = 0
        
        for emotion in emotion_series.keys():
            if emotion in self.emotion_colors and emotions_shown < 6:
                # Draw color box
                canvas.create_rectangle(
                    legend_x, legend_y, legend_x + 15, legend_y + 15,
                    fill=self.emotion_colors[emotion],
                    outline=""
                )
                
                # Draw label
                canvas.create_text(
                    legend_x + 20, legend_y + 7,
                    text=emotion.capitalize(),
                    fill=COLORS['text'],
                    font=("Arial", 9),
                    anchor="w"
                )
                
                legend_x += 90
                emotions_shown += 1
                
                # Move to next row if needed
                if emotions_shown == 3:
                    legend_x = margin
                    legend_y += 20
        
    def _create_word_by_word_transcript(self, parent_frame, analysis):
        """Create an interactive word-by-word transcript display with hover effects"""
        # Create scrollable frame with constrained height
        scroll_frame = ctk.CTkScrollableFrame(
            parent_frame,
            fg_color=(self.theme.COLORS['card'] if hasattr(self, 'theme') and self.theme else "#FFFFFF"),
            scrollbar_button_color="#E0E0E0",
            scrollbar_button_hover_color="#C0C0C0",
            height=400
        )
        scroll_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        transcription = analysis.get('transcription', {})
        
        if not transcription:
            loading_label = ctk.CTkLabel(
                scroll_frame,
                text="🎙️ Transcription in progress... Please check back in a few moments.",
                font=("Arial", 14),
                text_color=(self.theme.COLORS['text_light'] if hasattr(self, 'theme') and self.theme else COLORS['text_light'])
            )
            loading_label.pack(pady=20)
            return scroll_frame
        
        # Get transcript segments and emotion data
        transcript_data = transcription if isinstance(transcription, dict) else {'full_text': transcription, 'segments': []}
        segments = transcript_data.get('segments', [])
        
        if not segments:
            # If no segments, try to create from full text
            full_text = transcript_data.get('full_text', '')
            if full_text:
                # Create a single segment from full text
                segments = [{
                    'start_time': 0,
                    'end_time': 10,
                    'text': full_text,
                    'emotion': 'neutral',
                    'emotion_scores': {}
                }]
            else:
                no_data_label = ctk.CTkLabel(
                    scroll_frame,
                    text="No transcript available",
                    font=("Arial", 14),
                    text_color=(self.theme.COLORS['text_light'] if hasattr(self, 'theme') and self.theme else COLORS['text_light'])
                )
                no_data_label.pack(pady=20)
                return scroll_frame
        
        # Process each segment
        line_frame = None
        words_in_line = 0
        max_words_per_line = 12
        
        for segment in segments:
            text = segment.get('text', '')
            emotion = segment.get('emotion', 'neutral')
            start_time = segment.get('start_time', 0)
            end_time = segment.get('end_time', 0)
            emotion_scores = segment.get('emotion_scores', {})
            reaction_count = segment.get('reaction_count', 0)
            
            # Split text into words
            words = text.split()
            word_count = len(words)
            
            for i, word in enumerate(words):
                # Create new line if needed
                if line_frame is None or words_in_line >= max_words_per_line:
                    line_frame = ctk.CTkFrame(scroll_frame, fg_color="transparent")
                    line_frame.pack(anchor="w", pady=2)
                    words_in_line = 0
                
                # Calculate approximate timestamp for this word
                if word_count > 0:
                    word_progress = i / word_count
                    word_timestamp = start_time + (end_time - start_time) * word_progress
                else:
                    word_timestamp = start_time
                
                # Create word label with emotion-based styling
                bg_color = self._get_emotion_bg_color(emotion)
                text_color = self._get_emotion_text_color(emotion)
                
                word_label = ctk.CTkLabel(
                    line_frame,
                    text=word,
                    font=("Arial", 14),
                    text_color=text_color,
                    fg_color=bg_color,
                    corner_radius=4,
                    padx=6,
                    pady=3
                )
                word_label.pack(side=tk.LEFT, padx=2)
                
                # Prepare hover data
                hover_data = {
                    'word': word,
                    'emotion': emotion,
                    'timestamp': word_timestamp,
                    'emotion_scores': emotion_scores,
                    'reaction_count': reaction_count
                }
                
                # Bind hover events
                word_label.bind("<Enter>", lambda e, data=hover_data: self._on_word_hover(e, data))
                word_label.bind("<Leave>", lambda e: self._on_word_leave(e))
                word_label.bind("<Button-1>", lambda e, time=word_timestamp: self._on_word_click(time))
                
                # Add cursor change on hover
                word_label.configure(cursor="hand2")
                
                words_in_line += 1
        
        # Add legend at the bottom
        legend_frame = ctk.CTkFrame(scroll_frame, fg_color=(self.theme.COLORS['bg'] if hasattr(self, 'theme') and self.theme else "#F5F5F5"), corner_radius=8)
        legend_frame.pack(fill=tk.X, pady=(20, 10))
        
        legend_title = ctk.CTkLabel(
            legend_frame,
            text="Emotion Color Guide:",
            font=("Arial", 12, "bold"),
            text_color=COLORS['text']
        )
        legend_title.pack(anchor="w", padx=10, pady=(10, 5))
        
        # Create emotion legend
        emotions_row1 = ctk.CTkFrame(legend_frame, fg_color="transparent")
        emotions_row1.pack(fill=tk.X, padx=10, pady=(0, 5))
        
        emotions_row2 = ctk.CTkFrame(legend_frame, fg_color="transparent")
        emotions_row2.pack(fill=tk.X, padx=10, pady=(0, 10))
        
        emotion_list = list(self.emotion_colors.keys())
        for i, emotion in enumerate(emotion_list):
            row = emotions_row1 if i < 5 else emotions_row2
            
            sample_label = ctk.CTkLabel(
                row,
                text=emotion.capitalize(),
                font=("Arial", 11),
                text_color=self._get_emotion_text_color(emotion),
                fg_color=self._get_emotion_bg_color(emotion),
                corner_radius=4,
                padx=8,
                pady=2
            )
            sample_label.pack(side=tk.LEFT, padx=3)
        
        return scroll_frame
    
    def _get_emotion_bg_color(self, emotion):
        """Get background color for emotion"""
        emotion_bg_colors = {
            'happy': '#FFF8DC',      # Softer yellow
            'sad': '#E6E6FA',        # Softer blue
            'angry': '#FFE4E1',      # Softer red
            'surprise': '#FFF0F5',   # Softer pink
            'fear': '#F5FFFA',       # Softer mint
            'disgust': '#F0FFFF',    # Softer cyan
            'neutral': '#F5F5F5',    # Light gray
            'bored': '#FAFAFA',      # Very light gray
            'stressed': '#FFF5EE',   # Softer orange
            'confused': '#F0F8FF',   # Softer blue-gray
            'mixed': '#FFFACD'       # Light yellow for mixed
        }
        return emotion_bg_colors.get(emotion, '#FFFFFF')
    
    def _get_emotion_text_color(self, emotion):
        """Get text color for emotion"""
        # Use darker versions of emotion colors for better readability
        emotion_text_colors = {
            'happy': '#B8860B',      # Dark golden
            'sad': '#4169E1',        # Royal blue
            'angry': '#DC143C',      # Crimson
            'surprise': '#FF1493',   # Deep pink
            'fear': '#228B22',       # Forest green
            'disgust': '#008B8B',    # Dark cyan
            'neutral': '#696969',    # Dim gray
            'bored': '#808080',      # Gray
            'stressed': '#FF8C00',   # Dark orange
            'confused': '#483D8B',   # Dark slate blue
            'mixed': '#B8860B'       # Dark golden
        }
        return emotion_text_colors.get(emotion, COLORS['text'])
    
    def _on_word_hover(self, event, hover_data):
        """Handle word hover event"""
        # Update hover info
        emotion = hover_data['emotion']
        timestamp = hover_data['timestamp']
        reaction_count = hover_data.get('reaction_count', 0)
        emotion_scores = hover_data.get('emotion_scores', {})
        
        # Create hover text
        hover_text = f"[{self._format_time(timestamp)}] "
        hover_text += f"{emotion.upper()}"
        
        # Add top emotions if available
        if emotion_scores:
            top_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)[:3]
            if top_emotions:
                hover_text += " - "
                hover_text += ", ".join([f"{e[0]}: {e[1]:.0%}" for e in top_emotions])
        
        # Update and show hover info
        self.hover_info.configure(text=hover_text)
        
        # Position hover info above the transcript
        self.hover_info.place(x=20, y=10)
    
    def _on_word_leave(self, event):
        """Handle word leave event"""
        # Hide hover info
        self.hover_info.place_forget()
    
    def _on_word_click(self, timestamp):
        """Handle word click - could seek to that time in video"""
        logger.info(f"Word clicked at timestamp: {timestamp}")
        # TODO: Implement video seeking if needed
        self._show_notification(f"Timestamp: {self._format_time(timestamp)}", "info", duration=1500)
        
    def _insert_highlighted_transcript(self, text_widget, analysis):
        """Insert transcript with aggregated emotion highlighting from all reactions"""
        transcription = analysis.get('transcription', {})
        
        if not transcription:
            text_widget.configure(state="normal")
            text_widget.insert("1.0", "🎙️ Transcription in progress... Please check back after a few moments.")
            text_widget.configure(state="disabled")
            return
            
        # Get transcript segments
        transcript_data = transcription if isinstance(transcription, dict) else {'full_text': transcription, 'segments': []}
        
        if isinstance(transcript_data, dict) and 'segments' in transcript_data:
            text_widget.configure(state="normal")
            text_widget.delete("1.0", "end")
            
            # Add header explaining the display
            text_widget.insert("end", "📊 VIEWER REACTIONS BY SEGMENT\n", "header")
            text_widget.insert("end", "This shows how viewers felt at different parts of the video\n\n", "subtitle")
            
            # Configure header tags
            text_widget.tag_config("header", font=('Arial', 16, 'bold'), foreground='#2C3E50')
            text_widget.tag_config("subtitle", font=('Arial', 12, 'italic'), foreground='#7F8C8D')
            text_widget.tag_config("reaction_count", font=('Arial', 10), foreground='#34495E')
            
            # Enhanced emotion tags with softer colors
            emotion_tags = {
                'happy': {
                    'background': '#FFF8DC',  # Softer yellow
                    'foreground': '#D4A017',
                    'font': ('Arial', 13)
                },
                'sad': {
                    'background': '#E6E6FA',  # Softer blue
                    'foreground': '#4169E1',
                    'font': ('Arial', 13)
                },
                'angry': {
                    'background': '#FFE4E1',  # Softer red
                    'foreground': '#DC143C',
                    'font': ('Arial', 13)
                },
                'surprise': {
                    'background': '#FFF0F5',  # Softer pink
                    'foreground': '#FF1493',
                    'font': ('Arial', 13)
                },
                'fear': {
                    'background': '#F5FFFA',  # Softer mint
                    'foreground': '#228B22',
                    'font': ('Arial', 13)
                },
                'disgust': {
                    'background': '#F0FFFF',  # Softer cyan
                    'foreground': '#008B8B',
                    'font': ('Arial', 13)
                },
                'neutral': {
                    'background': '#F5F5F5',
                    'foreground': '#696969',
                    'font': ('Arial', 13)
                },
                'bored': {
                    'background': '#FAFAFA',
                    'foreground': '#808080',
                    'font': ('Arial', 13)
                },
                'stressed': {
                    'background': '#FFF5EE',  # Softer orange
                    'foreground': '#FF8C00',
                    'font': ('Arial', 13)
                },
                'confused': {
                    'background': '#F0F8FF',  # Softer blue-gray
                    'foreground': '#483D8B',
                    'font': ('Arial', 13)
                },
                'mixed': {
                    'background': '#FFFACD',  # Light yellow for mixed emotions
                    'foreground': '#B8860B',
                    'font': ('Arial', 13, 'italic')
                }
            }
            
            # Configure all emotion tags
            for emotion, config in emotion_tags.items():
                text_widget.tag_config(emotion, **config)
                
            # Configure timestamp tag
            text_widget.tag_config("timestamp", 
                                 foreground='#95A5A6', 
                                 font=('Arial', 10))
            
            # Display segments with aggregated emotion data
            for i, segment in enumerate(transcript_data['segments']):
                # Get emotion and reaction data
                emotion = segment.get('emotion', 'neutral')
                text = segment['text']
                start_time = segment.get('start_time', 0)
                end_time = segment.get('end_time', 0)
                reaction_count = segment.get('reaction_count', 0)
                emotion_scores = segment.get('emotion_scores', {})
                
                # Add timestamp
                timestamp_text = f"[{self._format_time(start_time)} - {self._format_time(end_time)}] "
                text_widget.insert("end", timestamp_text, "timestamp")
                
                # Add reaction count if multiple reactions
                if reaction_count > 1:
                    count_text = f"({reaction_count} reactions) "
                    text_widget.insert("end", count_text, "reaction_count")
                
                # Add emotion indicator
                if emotion == 'mixed':
                    # Show top emotions for mixed segments
                    if emotion_scores:
                        top_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)[:2]
                        emotion_text = f"[{'/'.join([e[0].upper() for e in top_emotions])}] "
                    else:
                        emotion_text = "[MIXED] "
                elif emotion != 'neutral':
                    emotion_text = f"[{emotion.upper()}] "
                else:
                    emotion_text = ""
                
                if emotion_text:
                    text_widget.insert("end", emotion_text, emotion)
                
                # Add the segment text
                text_widget.insert("end", text + " ", emotion)
                
                # Add emotion breakdown for segments with multiple reactions
                if reaction_count > 1 and emotion_scores:
                    text_widget.insert("end", "\n  ", "")
                    
                    # Show mini emotion bars
                    sorted_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)
                    for emo, score in sorted_emotions[:3]:  # Top 3 emotions
                        if score > 0.1:  # Only show significant emotions
                            bar_length = int(score * 10)
                            bar = "▪" * bar_length
                            text_widget.insert("end", f"{emo}: {bar} ", emo)
                    text_widget.insert("end", "\n")
                
                # Add spacing between segments
                if (i + 1) < len(transcript_data['segments']):
                    text_widget.insert("end", "\n\n")
                    
            # Add summary at the end
            text_widget.insert("end", "\n\n" + "="*50 + "\n", "")
            text_widget.insert("end", "📈 EMOTION SUMMARY\n", "header")
            
            # Calculate overall emotion distribution
            if transcript_data['segments']:
                emotion_counts = {}
                for segment in transcript_data['segments']:
                    emotion = segment.get('emotion', 'neutral')
                    emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
                
                # Display emotion distribution
                total_segments = len(transcript_data['segments'])
                for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
                    percentage = (count / total_segments) * 100
                    text_widget.insert("end", f"  • {emotion.capitalize()}: {percentage:.1f}% ({count} segments)\n", emotion)
                    
            # Disable all text selection and editing
            text_widget.configure(state="disabled")
            
            # Bind events to completely prevent any interaction
            def block_all(event):
                return "break"
                
            # Block all mouse events
            text_widget.bind("<Button-1>", block_all)
            text_widget.bind("<B1-Motion>", block_all)
            text_widget.bind("<Double-Button-1>", block_all)
            text_widget.bind("<Triple-Button-1>", block_all)
            text_widget.bind("<ButtonRelease-1>", block_all)
            
            # Block all keyboard events
            text_widget.bind("<Key>", block_all)
            text_widget.bind("<Control-a>", block_all)
            text_widget.bind("<Control-c>", block_all)
            text_widget.bind("<Control-x>", block_all)
            text_widget.bind("<Control-v>", block_all)
            
            # Remove focus capability
            text_widget.bind("<FocusIn>", lambda e: text_widget.master.focus())
            
        elif isinstance(transcript_data, str):
            # Legacy format
            text_widget.configure(state="normal")
            text_widget.insert("1.0", transcript_data)
            text_widget.configure(state="disabled")
        else:
            text_widget.configure(state="normal")
            text_widget.insert("1.0", "🎤 No transcription available.\n\nThis video may not have audio, or speech recognition failed.\nTranscription happens automatically when you upload a video.")
            text_widget.configure(state="disabled")
        
    def _add_reaction(self, analysis_id):
        """Add a new reaction to existing video"""
        # Get the video path from analysis
        analysis = self.storage.get_analysis(analysis_id)
        if analysis:
            self.current_video_path = analysis['video_path']
            self.current_analysis_id = analysis_id
            
            # Reset emotion tracker state but keep video display
            if hasattr(self, 'emotion_tracker'):
                self.emotion_tracker.reset()
                
            # Reset graph data
            self.emotion_graph_data = []
            
            # Show upload page with from_reaction=True
            self._show_upload_page(from_reaction=True)
            
    def _initialize_video_for_reaction(self):
        """Initialize video for reaction without clearing display"""
        try:
            # Just show ready state without reloading first frame
            self.play_btn.configure(state="normal")
            
            # Show ready message
            # Hide upload overlay if it exists
            if hasattr(self, 'upload_overlay'):
                self.upload_overlay.place_forget()
            
            ready_label = ctk.CTkLabel(
                self.video_label.master,
                text="✓ Ready to record reaction",
                font=("SF Pro Display", 24, "bold"),
                text_color="#34C759",
                fg_color="#000000",
                corner_radius=20
            )
            ready_label.place(relx=0.5, rely=0.9, anchor="center")
            
            # Fade out message
            self.root.after(2000, ready_label.destroy)
            
            # Extract audio in background if needed
            threading.Thread(target=self._preprocess_audio, daemon=True).start()
        except Exception as e:
            logger.error(f"Failed to initialize for reaction: {e}")
        
    def _view_reaction_enhanced(self, reaction):
        """View specific reaction details with enhanced demographic information"""
        # Get reaction data
        reaction = self.storage.get_reaction(reaction['id'])
        if not reaction:
            messagebox.showerror("Error", "Reaction not found")
            return
            
        # Create reaction detail window
        detail_window = tk.Toplevel(self.root)
        detail_window.title("Reaction Details")
        detail_window.geometry("800x600")
        detail_window.configure(bg=COLORS['bg'])
        
        # Header
        header_frame = ctk.CTkFrame(detail_window, fg_color=COLORS['dark'], height=60)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)
        
        title = ctk.CTkLabel(
            header_frame,
            text=f"Reaction Analysis - {reaction.get('dominant_emotion', 'Unknown').upper()}",
            font=("Arial Black", 20),
            text_color="white"
        )
        title.pack(pady=15)
        
        # Content
        content_frame = ctk.CTkScrollableFrame(detail_window, fg_color=COLORS['bg'])
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Stats card
        stats_card = ctk.CTkFrame(content_frame, fg_color=COLORS['card'], corner_radius=15)
        stats_card.pack(fill=tk.X, pady=(0, 20))
        
        # Engagement score
        engagement_label = ctk.CTkLabel(
            stats_card,
            text=f"Engagement Score: {reaction.get('engagement_score', 0):.1%}",
            font=("Arial", 18, "bold"),
            text_color=COLORS['primary']
        )
        engagement_label.pack(pady=(20, 10))
        
        # Emotion breakdown
        emotion_frame = ctk.CTkFrame(stats_card, fg_color="transparent")
        emotion_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        for emotion, percentage in reaction.get('emotion_summary', {}).items():
            self._create_emotion_bar(emotion_frame, emotion, percentage)
            
        # Key moments
        if reaction.get('key_moments'):
            moments_card = ctk.CTkFrame(content_frame, fg_color=COLORS['card'], corner_radius=15)
            moments_card.pack(fill=tk.X, pady=(0, 20))
            
            moments_label = ctk.CTkLabel(
                moments_card,
                text="KEY MOMENTS",
                font=("Arial Black", 16),
                text_color=COLORS['text']
            )
            moments_label.pack(anchor=tk.W, padx=20, pady=(20, 10))
            
            for moment in reaction.get('key_moments', [])[:5]:
                moment_text = ctk.CTkLabel(
                    moments_card,
                    text=f"• {self._format_time(moment['timestamp'])} - {moment['emotion']} ({moment['reason']})",
                    font=("Arial", 12),
                    text_color=COLORS['text_light'],
                    anchor="w"
                )
                moment_text.pack(anchor=tk.W, padx=40, pady=2)
                
            moments_label.pack(pady=(0, 20))
            
        # Close button
        close_btn = ctk.CTkButton(
            content_frame,
            text="Close",
            font=("Arial", 14),
            width=200,
            height=40,
            corner_radius=20,
            fg_color=COLORS['secondary'],
            command=detail_window.destroy
        )
        close_btn.pack(pady=20)
        
    def _on_closing(self):
        """Handle window closing event"""
        try:
            logger.info("Application closing...")
            
            # Stop any running analysis
            if hasattr(self, 'emotion_tracker') and self.emotion_tracker:
                try:
                    self.emotion_tracker.stop_analysis()
                except Exception as e:
                    logger.debug(f"Error stopping emotion tracker: {e}")
            
            # Stop any update loops
            self.is_playing = False
            
            # Clean up temp files
            try:
                self._cleanup_temp_files()
            except Exception as e:
                logger.debug(f"Error cleaning temp files: {e}")
            
            # Close video window if open
            if hasattr(self, 'video_window') and self.video_window:
                try:
                    self.video_window.destroy()
                except:
                    pass
                    
            # Destroy main window
            if hasattr(self, 'root') and self.root:
                try:
                    self.root.quit()
                    self.root.destroy()
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            # Force quit
            try:
                self.root.quit()
            except:
                pass
        
    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        try:
            # Clean up temp audio files
            temp_files = glob.glob("*_temp_audio.mp3") + glob.glob("*_temp_audio.wav") + glob.glob("*_transcript_temp.wav")
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                    logger.info(f"Cleaned up temp file: {temp_file}")
                except:
                    pass
        except Exception as e:
            logger.error(f"Error cleaning temp files: {e}")
        
    def _show_sample_analysis(self):
        """Show a sample analysis for demonstration"""
        self._show_analysis_dashboard('sample')
        
    def _get_sample_analysis(self):
        """Get sample analysis data"""
        # Create realistic sample data
        sample_emotions = []
        emotions = ['happy', 'neutral', 'surprised', 'bored', 'happy', 'sad', 'neutral', 'happy']
        
        # Generate realistic timeline data
        for i in range(120):  # 2 minutes of data
            timestamp = i * 0.5
            emotion_idx = int(timestamp / 15) % len(emotions)
            current_emotion = emotions[emotion_idx]
            
            # Create scores that favor the current emotion
            scores = {
                'happy': 0.1, 'sad': 0.1, 'angry': 0.05, 'surprise': 0.1,
                'fear': 0.05, 'disgust': 0.05, 'neutral': 0.3, 'bored': 0.15,
                'stressed': 0.05, 'confused': 0.05
            }
            
            # Boost current emotion
            scores[current_emotion] = 0.6
            
            # Add some variation
            import random
            for emotion in scores:
                scores[emotion] += random.uniform(-0.05, 0.05)
                scores[emotion] = max(0, min(1, scores[emotion]))
                
            sample_emotions.append({
                'timestamp': timestamp,
                'emotion': current_emotion,
                'scores': scores,
                'engagement': 0.7 + random.uniform(-0.2, 0.2),
                'confidence': 0.8 + random.uniform(-0.1, 0.1)
            })
            
        return {
            'id': 'sample',
            'video_name': 'Sample_Video_Demo.mp4',
            'created_at': datetime.now().isoformat(),
            'avg_engagement': 0.75,
            'emotion_summary': {
                'happy': 35.5,
                'neutral': 25.3,
                'surprised': 15.2,
                'bored': 10.5,
                'sad': 8.2,
                'angry': 2.1,
                'fear': 1.8,
                'disgust': 0.9,
                'stressed': 0.5
            },
            'reactions': [
                {
                    'id': 'reaction1', 
                    'engagement_score': 0.78,
                    'dominant_emotion': 'happy',
                    'emotion_summary': {'happy': 45, 'neutral': 30, 'surprised': 25}
                },
                {
                    'id': 'reaction2', 
                    'engagement_score': 0.72,
                    'dominant_emotion': 'surprised',
                    'emotion_summary': {'surprised': 40, 'happy': 35, 'neutral': 25}
                }
            ],
            'transcription_status': 'complete',
            'transcription': {
                'full_text': "Welcome to this exciting demonstration! This video showcases "
                           "amazing content that might make you feel happy or surprised. "
                           "Sometimes the content can be relaxing, and other times it might "
                           "be thought-provoking. Overall, it aims to keep you engaged "
                           "and entertained throughout the viewing experience.",
                'segments': [
                    {
                        'start_time': 0,
                        'end_time': 5,
                        'text': 'Welcome to this exciting demonstration!',
                        'emotion': 'happy',
                        'reaction_count': 2,
                        'emotion_scores': {'happy': 0.45, 'neutral': 0.3, 'surprised': 0.25}
                    },
                    {
                        'start_time': 5,
                        'end_time': 10,
                        'text': 'This video showcases amazing content',
                        'emotion': 'surprised',
                        'reaction_count': 2,
                        'emotion_scores': {'surprised': 0.4, 'happy': 0.35, 'neutral': 0.25}
                    },
                    {
                        'start_time': 10,
                        'end_time': 15,
                        'text': 'that might make you feel happy or surprised.',
                        'emotion': 'mixed',
                        'reaction_count': 2,
                        'emotion_scores': {'happy': 0.35, 'surprised': 0.35, 'neutral': 0.3}
                    },
                    {
                        'start_time': 15,
                        'end_time': 20,
                        'text': 'Sometimes the content can be relaxing,',
                        'emotion': 'neutral',
                        'reaction_count': 1,
                        'emotion_scores': {'neutral': 0.6, 'happy': 0.2, 'surprised': 0.2}
                    },
                    {
                        'start_time': 20,
                        'end_time': 25,
                        'text': 'and other times it might be thought-provoking.',
                        'emotion': 'confused',
                        'reaction_count': 1,
                        'emotion_scores': {'confused': 0.4, 'neutral': 0.3, 'surprised': 0.3}
                    },
                    {
                        'start_time': 25,
                        'end_time': 30,
                        'text': 'Overall, it aims to keep you engaged',
                        'emotion': 'happy',
                        'reaction_count': 2,
                        'emotion_scores': {'happy': 0.5, 'neutral': 0.3, 'surprised': 0.2}
                    },
                    {
                        'start_time': 30,
                        'end_time': 35,
                        'text': 'and entertained throughout the viewing experience.',
                        'emotion': 'happy',
                        'reaction_count': 2,
                        'emotion_scores': {'happy': 0.6, 'surprised': 0.25, 'neutral': 0.15}
                    }
                ]
            },
            'emotion_timeline': sample_emotions,
            'key_moments': [
                {'timestamp': 5, 'emotion': 'surprised', 'reason': 'High engagement'},
                {'timestamp': 15, 'emotion': 'happy', 'reason': 'Positive emotion spike'},
                {'timestamp': 45, 'emotion': 'bored', 'reason': 'Low engagement period'}
            ],
            'thumbnail': None,  # Will show default icon
            'clearcast_checked': True,  # Sample has been checked
            'clearcast_check': {
                'compliance_status': 'REVIEW_NEEDED',
                'overall_risk': 'MEDIUM',
                'summary': 'This advertisement requires review. Some claims may need substantiation and certain visual elements should be clarified.',
                'red_flags': [
                    {
                        'issue': 'Unsubstantiated performance claim at 00:15',
                        'severity': 'HIGH',
                        'timestamp': '00:15-00:20',
                        'category': 'Misleading Claims',
                        'required_action': 'Provide evidence for "50% faster" claim or remove'
                    }
                ],
                'yellow_flags': [
                    {
                        'issue': 'Price comparison lacks clear terms',
                        'severity': 'MEDIUM', 
                        'timestamp': '00:25-00:30',
                        'category': 'Pricing Information',
                        'suggested_action': 'Add clear disclaimer about comparison basis'
                    },
                    {
                        'issue': 'Environmental claim needs verification',
                        'severity': 'MEDIUM',
                        'timestamp': '00:45-00:50', 
                        'category': 'Environmental Claims',
                        'suggested_action': 'Provide lifecycle assessment or modify claim'
                    }
                ],
                'compliant_elements': [
                    'Age-appropriate content',
                    'Clear brand identification',
                    'No prohibited content detected'
                ]
            },
            'ai_breakdown_checked': True,  # Sample has been analyzed
            'ai_breakdown': {
                'analysis_status': 'COMPLETE',
                'breakdown': {
                    'content_type': 'Advertisement/Promotional',
                    'duration_category': 'Short (0-30s)',
                    'key_elements': ['Dynamic visuals', 'Upbeat music', 'Product showcase', 'Call-to-action'],
                    'narrative_structure': 'Problem-solution narrative with emotional appeal and clear CTA',
                    'target_audience': 'Young professionals aged 25-40, tech-savvy urban dwellers',
                    'production_quality': 'High - Professional cinematography and editing',
                    'key_messages': ['Innovation meets simplicity', 'Time-saving solution', 'Premium quality'],
                    'call_to_action': 'Visit website for 20% discount'
                },
                'estimated_outcome': {
                    'primary_goal': 'Drive Sales',
                    'effectiveness_score': 75,
                    'reasoning': 'Strong emotional connection with clear benefits, though CTA could be more prominent',
                    'expected_metrics': {
                        'engagement_rate': 'High',
                        'conversion_potential': 'Medium',
                        'shareability': 'High',
                        'memorability': 'High'
                    }
                },
                'green_highlights': [
                    {
                        'aspect': 'Visual storytelling',
                        'explanation': 'Compelling narrative arc keeps viewers engaged throughout',
                        'impact': 'High'
                    },
                    {
                        'aspect': 'Brand consistency',
                        'explanation': 'Colors, fonts, and messaging align perfectly with brand identity',
                        'impact': 'High'
                    },
                    {
                        'aspect': 'Emotional resonance',
                        'explanation': 'Successfully taps into viewer aspirations and pain points',
                        'impact': 'Medium'
                    }
                ],
                'yellow_highlights': [
                    {
                        'aspect': 'Call-to-action visibility',
                        'suggestion': 'Make CTA more prominent with contrasting colors and longer display time',
                        'priority': 'High'
                    },
                    {
                        'aspect': 'Mobile optimization',
                        'suggestion': 'Ensure text is readable on small screens',
                        'priority': 'Medium'
                    }
                ],
                'audience_reactions': [
                    {
                        'profile': 'Tech-Savvy Millennial (28, Urban Professional)',
                        'reaction': 'Love the sleek design! This looks like exactly what I need for my busy lifestyle.',
                        'engagement_level': 'High',
                        'likely_action': 'Click through to website and explore features'
                    },
                    {
                        'profile': 'Busy Parent (42, Suburban, 2 Kids)',
                        'reaction': 'Interesting, but I need to know more about safety and family features.',
                        'engagement_level': 'Medium',
                        'likely_action': 'Save for later research when have more time'
                    },
                    {
                        'profile': 'Retired Senior (68, Conservative Values)',
                        'reaction': 'Too fast-paced for me. What does it actually do?',
                        'engagement_level': 'Low',
                        'likely_action': 'Skip or ask younger family member about it'
                    },
                    {
                        'profile': 'Gen Z Student (19, Social Media Native)',
                        'reaction': 'Aesthetic is on point! Would share this with my followers.',
                        'engagement_level': 'High',
                        'likely_action': 'Share on social media and check for student discounts'
                    }
                ],
                'summary': 'This advertisement demonstrates strong production values and emotional appeal, effectively targeting young professionals. The visual storytelling and brand consistency are exceptional. To maximize impact, consider making the call-to-action more prominent and ensuring mobile optimization. The content successfully balances entertainment with product benefits, though different age demographics show varying levels of engagement.'
            }
        }
        
    def _toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        if not self.is_fullscreen:
            # Only allow fullscreen if playing
            if not self.is_playing:
                self._show_notification("Start playing the video first", type="info")
                return
                
            # Create fullscreen window
            self.video_window = tk.Toplevel(self.root)
            self.video_window.attributes('-fullscreen', True)
            self.video_window.configure(bg='black')
            
            # Disable events that might interfere
            self.video_window.attributes('-topmost', True)
            
            # Create video label in fullscreen
            self.fullscreen_video_label = tk.Label(
                self.video_window,
                bg='black'
            )
            self.fullscreen_video_label.pack(fill=tk.BOTH, expand=True)
            
            # Exit fullscreen on Escape or double-click
            self.video_window.bind('<Escape>', lambda e: self._toggle_fullscreen())
            self.fullscreen_video_label.bind('<Double-Button-1>', lambda e: self._toggle_fullscreen())
            
            # Exit fullscreen button - semi-transparent overlay
            exit_frame = ctk.CTkFrame(
                self.video_window,
                fg_color="black",
                bg_color="transparent",
                corner_radius=20
            )
            exit_frame.place(relx=0.5, rely=0.95, anchor="s")
            
            exit_btn = ctk.CTkButton(
                exit_frame,
                text="Exit Fullscreen (ESC)",
                font=("Arial", 14),
                width=200,
                height=40,
                corner_radius=20,
                fg_color=("gray30", "gray20"),
                hover_color=("gray40", "gray30"),
                bg_color="transparent",
                command=self._toggle_fullscreen
            )
            exit_btn.pack(padx=10, pady=10)
            
            # Auto-hide exit button after 3 seconds
            def hide_exit_btn():
                if hasattr(self, 'video_window') and self.video_window and self.video_window.winfo_exists():
                    exit_frame.place_forget()
                    # Show on mouse movement
                    def show_on_mouse(event):
                        exit_frame.place(relx=0.5, rely=0.95, anchor="s")
                        # Hide again after 3 seconds
                        self.video_window.after(3000, hide_exit_btn)
                    self.video_window.bind('<Motion>', show_on_mouse)
            
            self.video_window.after(3000, hide_exit_btn)
            
            self.is_fullscreen = True
            # Update fullscreen button text
            if hasattr(self, 'fullscreen_btn') and self.fullscreen_btn and self.fullscreen_btn.winfo_exists():
                try:
                    self.fullscreen_btn.configure(text="Exit")
                except:
                    pass
                    
            # Focus on fullscreen window
            self.video_window.focus_force()
        else:
            # Exit fullscreen
            if self.video_window:
                try:
                    self.video_window.destroy()
                except:
                    pass
                self.video_window = None
                self.fullscreen_video_label = None
                
            self.is_fullscreen = False
            # Update fullscreen button text
            if hasattr(self, 'fullscreen_btn') and self.fullscreen_btn and self.fullscreen_btn.winfo_exists():
                try:
                    self.fullscreen_btn.configure(text="Fullscreen")
                except:
                    pass
                    
            # Return focus to main window
            self.root.focus_force()
        
    def _format_time(self, seconds):
        """Format seconds to MM:SS"""
        minutes = int(seconds // 60)
        seconds = int(seconds % 60)
        return f"{minutes:02d}:{seconds:02d}"
        
    def _delete_video(self, video_id):
        """Delete a video from the gallery"""
        # Confirm deletion
        result = messagebox.askyesno(
            "Confirm Delete",
            "Are you sure you want to delete this video and all its analysis data?",
            icon='warning'
        )
        
        if result:
            self.storage.delete_analysis(video_id)
            # Refresh the gallery page
            self._show_gallery_page()
        
    def _show_notification(self, message, type="info", duration=3000):
        """Show a notification message to the user"""
        # Create notification frame directly without shadow
        notification = ctk.CTkFrame(
            self.root,
            fg_color="white",
            corner_radius=12,
            border_width=1,
            border_color=COLORS['border']
        )
        
        # Inner content frame
        content_frame = ctk.CTkFrame(notification, fg_color="transparent")
        content_frame.pack(padx=20, pady=12)
        
        # Icon based on type with colored background
        icon_colors = {
            "error": {"icon": "X", "bg": COLORS['primary'], "fg": "white"},
            "warning": {"icon": "!", "bg": COLORS['yellow'], "fg": "white"},
            "success": {"icon": "OK", "bg": COLORS['secondary'], "fg": "white"},
            "info": {"icon": "i", "bg": COLORS['blue'], "fg": "white"}
        }
        
        icon_data = icon_colors.get(type, icon_colors["info"])
        
        # Icon circle
        icon_frame = ctk.CTkFrame(
            content_frame,
            width=28,
            height=28,
            corner_radius=14,
            fg_color=icon_data["bg"]
        )
        icon_frame.pack(side=tk.LEFT, padx=(0, 12))
        icon_frame.pack_propagate(False)
        
        icon_label = ctk.CTkLabel(
            icon_frame,
            text=icon_data["icon"],
            font=("SF Pro Text", 16, "bold"),
            text_color=icon_data["fg"]
        )
        icon_label.place(relx=0.5, rely=0.5, anchor="center")
        
        # Message label
        msg_label = ctk.CTkLabel(
            content_frame,
            text=message,
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        msg_label.pack(side=tk.LEFT)
        
        # Place at top of window
        notification.place(relx=0.5, y=30, anchor="n")
        
        # Fade in animation
        notification.place_configure(y=20)
        self.root.after(50, lambda: notification.place_configure(y=30))
        
        # Auto hide after duration
        def hide_notification():
            notification.destroy()
            
        self.root.after(duration, hide_notification)
        
    def _schedule_transcript_refresh(self, analysis_id):
        """Schedule periodic refresh of transcript while processing"""
        def check_transcript():
            if hasattr(self, 'current_analysis_id') and self.current_analysis_id == analysis_id:
                # Get updated analysis
                analysis = self.storage.get_analysis(analysis_id)
                if analysis:
                    status = analysis.get('transcription_status', 'unknown')
                    
                    # Update transcript if status changed
                    if status != 'processing':
                        # Re-render transcript
                        if hasattr(self, 'transcript_display_frame') and self.transcript_display_frame.winfo_exists():
                            # Clear existing content
                            for widget in self.transcript_display_frame.winfo_children():
                                widget.destroy()
                            # Recreate word-by-word transcript
                            self._create_word_by_word_transcript(self.transcript_display_frame, analysis)
                            
                            # Update status indicator
                            if hasattr(self, 'transcript_card'):
                                # Find and update status label
                                for widget in self.transcript_card.winfo_children():
                                    if isinstance(widget, ctk.CTkFrame):
                                        for child in widget.winfo_children():
                                            if isinstance(child, ctk.CTkLabel) and '🔄' in child.cget('text'):
                                                status_text = {
                                                    'complete': '✓ Complete',
                                                    'no_audio': '🔇 No Audio',
                                                    'failed': '❌ Failed'
                                                }.get(status, '')
                                                
                                                status_color = {
                                                    'complete': '#27AE60',
                                                    'no_audio': '#95A5A6',
                                                    'failed': '#E74C3C'
                                                }.get(status, '#95A5A6')
                                                
                                                if status_text:
                                                    child.configure(text=status_text, text_color=status_color)
                                                break
                            
                            # Analyze emotion triggers if reactions exist
                            if analysis.get('reactions') and status == 'complete':
                                self.storage.analyze_emotion_triggers(analysis_id)
                                # Refresh again to show emotion highlights
                                def refresh_transcript():
                                    if hasattr(self, 'transcript_display_frame') and self.transcript_display_frame.winfo_exists():
                                        for widget in self.transcript_display_frame.winfo_children():
                                            widget.destroy()
                                        self._create_word_by_word_transcript(
                                            self.transcript_display_frame, 
                                    self.storage.get_analysis(analysis_id)
                                        )
                                self.root.after(1000, refresh_transcript)
                    else:
                        # Still processing, check again in 3 seconds
                        self.root.after(3000, check_transcript)
                        
        # Start checking after 3 seconds
        self.root.after(3000, check_transcript)
        
    def _check_clearcast_compliance(self, analysis_id: str, card_frame: ctk.CTkFrame):
        """Check video for Clearcast compliance"""
        # Get analysis data
        analysis = self.storage.get_analysis(analysis_id)
        if not analysis:
            self._show_notification("Analysis not found", "error")
            return
        
        video_path = analysis.get('video_path')
        if not video_path or not os.path.exists(video_path):
            self._show_notification("Video file not found", "error")
            return
        
        # Show loading state
        for widget in card_frame.winfo_children():
            widget.destroy()
        
        # Recreate header
        clearcast_header = ctk.CTkFrame(card_frame, fg_color="transparent")
        clearcast_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        fallback_video_name = Path(analysis.get('video_name', '')).stem if analysis.get('video_name') else self._get_video_display_name()
        header_container = self._render_custom_stories_header(
            clearcast_header,
            "Compliance & Risk View",
            fallback_video_name,
        )
        self._render_clearcast_last_updated(header_container)
        
        # Loading indicator
        loading_frame = ctk.CTkFrame(card_frame, fg_color="transparent")
        loading_frame.pack(pady=20)
        
        loading_label = ctk.CTkLabel(
            loading_frame,
            text="🔄 Analyzing video for compliance...",
            font=("Arial", 14),
            text_color=COLORS['text']
        )
        loading_label.pack()
        
        progress_bar = ctk.CTkProgressBar(
            loading_frame,
            width=300,
            height=8,
            mode="indeterminate"
        )
        progress_bar.pack(pady=10)
        progress_bar.start()
        
        # Run check in background
        def run_check():
            try:
                # Initialize checker
                checker = ClearcastChecker()
                
                transcription = (analysis.get('transcription') or {})
                script_excerpt = transcription.get('full_text')

                breakdown = (analysis.get('ai_breakdown') or {})
                breakdown_meta = (breakdown.get('breakdown') if isinstance(breakdown, dict) else {}) or {}
                estimated_outcome = (breakdown.get('estimated_outcome') if isinstance(breakdown, dict) else {}) or {}

                def _compact(data: Dict[str, Optional[str]]) -> Dict[str, str]:
                    return {k: v for k, v in data.items() if v}

                product_notes = _compact(
                    {
                        "what_is_advertised": breakdown_meta.get("what_is_advertised"),
                        "specific_product": breakdown_meta.get("specific_product"),
                        "product_category": breakdown_meta.get("product_category"),
                        "content_type": breakdown_meta.get("content_type"),
                        "target_audience": breakdown_meta.get("target_audience"),
                        "call_to_action": breakdown_meta.get("call_to_action"),
                        "primary_goal": estimated_outcome.get("primary_goal"),
                    }
                )

                brand_notes = _compact(
                    {
                        "brand_name": breakdown_meta.get("brand_name")
                        or resolve_brand_name(breakdown_meta),
                        "identification_confidence": str(breakdown_meta.get("identification_confidence"))
                        if breakdown_meta.get("identification_confidence") is not None
                        else None,
                    }
                )

                results = checker.check_video_compliance(
                    video_path,
                    script_excerpt=script_excerpt,
                    product_notes=product_notes,
                    brand_notes=brand_notes,
                )
                results['delivery_metadata'] = self.storage.get_delivery_metadata(analysis_id)
                
                # Save results
                self.storage.save_clearcast_check(analysis_id, results)
                
                # Update UI on main thread
                self.root.after(0, lambda: self._update_clearcast_display(card_frame, results))
                
            except Exception as e:
                logger.error(f"Clearcast check failed: {e}")
                error_results = {
                    "error": str(e),
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": f"Failed to analyze: {str(e)}",
                    "delivery_metadata": self.storage.get_delivery_metadata(analysis_id),
                }
                self.root.after(0, lambda: self._update_clearcast_display(card_frame, error_results))
        
        # Start background thread
        import threading
        threading.Thread(target=run_check, daemon=True).start()
    
    def _update_clearcast_display(self, card_frame: ctk.CTkFrame, results: Dict):
        """Update the display after Clearcast check completes"""
        # Clear loading state
        for widget in card_frame.winfo_children():
            widget.destroy()
        
        analysis = self.storage.get_analysis(analysis_id) if analysis_id else None
        stored_country = (
            (analysis.get("ai_airing_country") if analysis else None)
            or (results.get("audience_context") or {}).get("airing_country")
            or "United Kingdom"
        )
        self.ai_airing_country_var.set(stored_country)
        
        # Recreate header
        clearcast_header = ctk.CTkFrame(card_frame, fg_color="transparent")
        clearcast_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        fallback_video_name = self._get_video_display_name()
        ad_display_name = resolve_ad_name(results or {}, fallback_video_name)
        header_container = self._render_custom_stories_header(
            clearcast_header,
            "Compliance & Risk View",
            ad_display_name,
        )
        self._render_clearcast_last_updated(header_container)
        
        # Status badge
        status = results.get('compliance_status', 'UNKNOWN')
        status_colors = {
            'PASS': COLORS['secondary'],
            'FAIL': COLORS['primary'],
            'REVIEW_NEEDED': COLORS['yellow'],
            'ERROR': COLORS['text_light']
        }
        
        # Right side container for status and download button
        right_container = ctk.CTkFrame(clearcast_header, fg_color="transparent")
        right_container.pack(side=tk.RIGHT)
        
        status_label = ctk.CTkLabel(
            right_container,
            text=f"Status: {status}",
            font=("SF Pro Text", 14, "bold"),
            text_color=status_colors.get(status, COLORS['text'])
        )
        status_label.pack(side=tk.LEFT, padx=(0, 10))
        
        # Download PDF button
        download_btn = ctk.CTkButton(
            right_container,
            text="📥 Download PDF",
            font=("SF Pro Text", 12),
            width=120,
            height=30,
            corner_radius=15,
            fg_color=COLORS['blue'],
            hover_color="#0056CC",
            command=lambda: self._download_clearcast_pdf(results, card_frame)
        )
        download_btn.pack(side=tk.LEFT)
        
        # Display results (don't add download button here since it's already added above)
        self._display_clearcast_results(card_frame, results, add_download_button=False)
    
    def _display_clearcast_results(self, parent: ctk.CTkFrame, results: Dict, add_download_button: bool = True):
        """Display Clearcast compliance results
        
        Args:
            parent: Parent frame to display results in
            results: Clearcast results dictionary
            add_download_button: Whether to add PDF download button (default True)
        """
        # Add PDF download button at the top if results exist and button requested
        if add_download_button and results and results.get('status') != 'ERROR':
            header_frame = ctk.CTkFrame(parent, fg_color="transparent")
            header_frame.pack(fill=tk.X, padx=20, pady=(0, 10))
            
            download_btn = ctk.CTkButton(
                header_frame,
                text="📥 Download PDF",
                font=("SF Pro Text", 12),
                width=120,
                height=30,
                corner_radius=15,
                fg_color=COLORS['blue'],
                hover_color="#0056CC",
                command=lambda: self._download_clearcast_pdf(results, parent)
            )
            download_btn.pack(side=tk.RIGHT)
        
        # Results container
        results_frame = ctk.CTkFrame(parent, fg_color="transparent")
        results_frame.pack(fill=tk.BOTH, padx=20, pady=(0, 20))

        content_frame = ctk.CTkFrame(results_frame, fg_color="transparent")
        content_frame.pack(fill=tk.BOTH, expand=True)
        content_frame.grid_columnconfigure(0, weight=3)
        content_frame.grid_columnconfigure(1, weight=2)

        # Overview card (summary + prediction)
        overview_card = ctk.CTkFrame(content_frame, fg_color=COLORS["card"], corner_radius=12)
        overview_card.grid(row=0, column=0, sticky="nsew", padx=(0, 15))
        self._render_clearcast_overview(overview_card, results)

        classification = results.get("classification") or {}
        focus_summary = results.get("classification_focus", []) or []
        disclaimers_required = results.get("disclaimers_required", []) or []
        delivery_metadata = results.get("delivery_metadata") or {}
        audio_report = results.get("audio_normalization") or {}

        if any([classification, focus_summary, disclaimers_required, audio_report, delivery_metadata]):
            classification_column = ctk.CTkFrame(content_frame, fg_color="transparent")
            classification_column.grid(row=1, column=0, sticky="nsew", padx=(0, 15), pady=(15, 0))
            self._render_classification_summary(
                classification_column,
                classification,
                focus_summary,
                disclaimers_required,
                audio_report,
                delivery_metadata,
            )

        flags_column = ctk.CTkFrame(content_frame, fg_color="transparent")
        flags_column.grid(row=0, column=1, rowspan=2, sticky="nsew")

        red_flags = results.get("red_flags", [])
        yellow_flags = results.get("yellow_flags", [])
        blue_flags = results.get("blue_flags", [])
        compliant = results.get("compliant_elements", [])

        self._render_flag_section(
            flags_column,
            title="🚫 Must-Fix Compliance Risks",
            flags=red_flags,
            accent_color=COLORS["primary"],
            badge_text="High risk • Blocks clearance",
            badge_color="#FFCDD2",
        )
        self._render_flag_section(
            flags_column,
            title="⚠️ Review Risks",
            flags=yellow_flags,
            accent_color="#FFA500",
            badge_text="Moderate risk • Needs clarification",
            badge_color="#FFF3CD",
        )
        self._render_flag_section(
            flags_column,
            title="🔧 Technical & Delivery Issues",
            flags=blue_flags,
            accent_color="#2196F3",
            badge_text="Technical fix",
            badge_color="#E3F2FD",
        )

        if compliant and not red_flags and not yellow_flags:
            self._render_compliant_section(flags_column, compliant)

        # Polish Video Button (if no RED flags or admin)
        self._add_polish_button_if_eligible(results_frame, results)
    
    def _render_classification_summary(
        self,
        parent: ctk.CTkFrame,
        classification: Dict,
        focus_summary: List[Dict],
        disclaimers: List[str],
        audio_report: Dict[str, Any],
        delivery_metadata: Dict[str, Any],
    ):
        """Render script/product/brand tags plus risk focus summary."""
        section = ctk.CTkFrame(parent, fg_color=COLORS['card'], corner_radius=12)
        section.pack(fill=tk.X, pady=(10, 15))

        title = ctk.CTkLabel(
            section,
            text="📚 Classification Snapshot",
                font=("Arial", 14, "bold"),
            text_color=COLORS['text'],
        )
        title.pack(anchor="w", padx=15, pady=(10, 5))

        profiles_frame = ctk.CTkFrame(section, fg_color="transparent")
        profiles_frame.pack(fill=tk.X, padx=10)

        script_profile = classification.get("script", {})
        product_profile = classification.get("product", {})
        brand_profile = classification.get("brand", {})

        def _make_profile(frame_parent, heading, rows):
            card = ctk.CTkFrame(frame_parent, fg_color=COLORS["bg"], corner_radius=8)
            card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
            ctk.CTkLabel(
                card,
                text=heading,
                font=("Arial", 12, "bold"),
                text_color=COLORS["text"],
            ).pack(anchor="w", padx=10, pady=(8, 4))
            for label, value in rows:
                if not value:
                    continue
                display = ", ".join(value) if isinstance(value, list) else value
                ctk.CTkLabel(
                    card,
                    text=f"{label}: {display}",
                    font=("Arial", 11),
                    text_color=COLORS["text_light"],
                    wraplength=220,
                    justify="left",
                ).pack(anchor="w", padx=10, pady=(0, 2))

        _make_profile(
            profiles_frame,
            "Script",
            [
                ("Claims", script_profile.get("primary_claims")),
                ("Tone", script_profile.get("tone")),
                ("Audience", script_profile.get("target_audience")),
                ("Sensitive topics", script_profile.get("sensitive_topics")),
            ],
        )
        _make_profile(
            profiles_frame,
            "Product / Offer",
            [
                ("Category", product_profile.get("sector")),
                ("Sub-category", product_profile.get("subcategory")),
                ("Inherent risk", product_profile.get("inherent_risk")),
                ("Regulatory flags", product_profile.get("regulatory_flags")),
            ],
        )
        _make_profile(
            profiles_frame,
            "Brand",
            [
                ("Name", brand_profile.get("name")),
                ("Industry", brand_profile.get("industry")),
                ("Tone", brand_profile.get("tone")),
                ("History", brand_profile.get("clearcast_history")),
            ],
        )

        if focus_summary:
            focus_title = ctk.CTkLabel(
                section,
                text="🎯 Priority Focus Areas",
                font=("Arial", 13, "bold"),
                text_color=COLORS["text"],
            )
            focus_title.pack(anchor="w", padx=15, pady=(12, 4))
            for entry in focus_summary:
                pill = ctk.CTkFrame(section, fg_color=COLORS["bg"], corner_radius=8)
                pill.pack(fill=tk.X, padx=12, pady=3)
                label = entry.get("label") or "Focus Area"
                severity = entry.get("severity", "INFO")
                ctk.CTkLabel(
                    pill,
                    text=f"{label} • {severity}",
                    font=("Arial", 11, "bold"),
                    text_color=self._focus_color_for_severity(severity),
                ).pack(anchor="w", padx=10, pady=(6, 0))
                if entry.get("reason"):
                    ctk.CTkLabel(
                        pill,
                        text=entry["reason"],
                        font=("Arial", 11),
                        text_color=COLORS["text_light"],
                        wraplength=520,
                        justify="left",
                    ).pack(anchor="w", padx=10, pady=(0, 4))
                related = entry.get("related_flags") or []
                if related:
                    rel_texts = [
                        f"- {flag.get('issue', 'Flag')} ({flag.get('guideline_code') or 'Guideline'})"
                        for flag in related
                    ]
                    ctk.CTkLabel(
                        pill,
                        text="\n".join(rel_texts),
                        font=("Arial", 10),
                        text_color=COLORS["text_light"],
                        wraplength=520,
                        justify="left",
                    ).pack(anchor="w", padx=12, pady=(0, 6))

        if disclaimers:
            disclaimers_frame = ctk.CTkFrame(section, fg_color="transparent")
            disclaimers_frame.pack(fill=tk.X, padx=15, pady=(8, 6))
            ctk.CTkLabel(
                disclaimers_frame,
                text="⚖ Required Disclaimers",
                font=("Arial", 12, "bold"),
                text_color=COLORS["text"],
            ).pack(anchor="w", pady=(0, 4))
            for disclaimer in disclaimers:
                ctk.CTkLabel(
                    disclaimers_frame,
                    text=f"• {disclaimer}",
                    font=("Arial", 11),
                    text_color=COLORS["text_light"],
                    wraplength=520,
                    justify="left",
                ).pack(anchor="w", padx=4)

        if audio_report:
            audio_frame = ctk.CTkFrame(section, fg_color="transparent")
            audio_frame.pack(fill=tk.X, padx=15, pady=(8, 6))
            ctk.CTkLabel(
                audio_frame,
                text="🔊 Audio Readiness",
                font=("Arial", 12, "bold"),
                text_color=COLORS["text"],
            ).pack(anchor="w", pady=(0, 4))
            status = audio_report.get("status", "unknown").replace("_", " ").title()
            recommendation = audio_report.get("recommendation") or "Review audio manually."
            lufs = audio_report.get("integrated_lufs")
            metrics = []
            if lufs is not None:
                metrics.append(f"Integrated loudness: {lufs:.1f} LUFS")
            if audio_report.get("true_peak") is not None:
                metrics.append(f"True peak: {audio_report['true_peak']:.1f} dBFS")
            metrics_text = " | ".join(metrics)

            ctk.CTkLabel(
                audio_frame,
                text=f"Status: {status}",
                    font=("Arial", 11, "bold"),
                text_color=COLORS["text"],
            ).pack(anchor="w")
            if metrics_text:
                ctk.CTkLabel(
                    audio_frame,
                    text=metrics_text,
                    font=("Arial", 11),
                    text_color=COLORS["text_light"],
                ).pack(anchor="w")
            ctk.CTkLabel(
                audio_frame,
                text=recommendation,
                font=("Arial", 11),
                text_color=COLORS["text_light"],
                wraplength=520,
                    justify="left",
            ).pack(anchor="w", pady=(2, 0))

        if delivery_metadata:
            delivery_frame = ctk.CTkFrame(section, fg_color="transparent")
            delivery_frame.pack(fill=tk.X, padx=15, pady=(8, 6))
            ctk.CTkLabel(
                delivery_frame,
                text="⏱ Clock & Countdown Readiness",
                font=("Arial", 12, "bold"),
                text_color=COLORS["text"],
            ).pack(anchor="w", pady=(0, 4))
            if delivery_metadata.get("clock_number"):
                ctk.CTkLabel(
                    delivery_frame,
                    text=f"Clock Number: {delivery_metadata['clock_number']}",
                    font=("Arial", 11),
                    text_color=COLORS["text_light"],
                ).pack(anchor="w")
            slate_fields = [
                ("Client", delivery_metadata.get("client_name")),
                ("Agency", delivery_metadata.get("agency_name")),
                ("Product", delivery_metadata.get("product_name")),
                ("Title", delivery_metadata.get("title")),
            ]
            for label, value in slate_fields:
                if value:
                    ctk.CTkLabel(
                        delivery_frame,
                        text=f"{label}: {value}",
                        font=("Arial", 10),
                        text_color=COLORS["text_light"],
                    ).pack(anchor="w")
            status_parts = []
            if delivery_metadata.get("countdown_added"):
                status_parts.append("Countdown included")
            if delivery_metadata.get("padding_added"):
                status_parts.append("Black/silence padding added")
            status_text = " | ".join(status_parts) if status_parts else "Countdown not generated yet"
            ctk.CTkLabel(
                delivery_frame,
                text=status_text,
                        font=("Arial", 10, "italic"),
                text_color=COLORS["text_light"],
                wraplength=520,
                        justify="left",
            ).pack(anchor="w", pady=(2, 0))
            ready_label = "✅ Slate ready for delivery" if delivery_metadata.get("ready") else "⚠️ Slate metadata incomplete"
            ctk.CTkLabel(
                delivery_frame,
                text=ready_label,
                font=("Arial", 11, "bold"),
                text_color=COLORS["secondary"] if delivery_metadata.get("ready") else COLORS["primary"],
            ).pack(anchor="w", pady=(2, 0))

    def _render_clearcast_overview(self, parent: ctk.CTkFrame, results: Dict):
        """Overview card with summary + prediction badge."""
        parent.grid_columnconfigure(0, weight=1)
        title = ctk.CTkLabel(
            parent,
            text="Overview",
            font=("Arial", 14, "bold"),
            text_color=COLORS["text"],
        )
        title.grid(row=0, column=0, sticky="w", padx=15, pady=(12, 4))

        summary = results.get("summary") or "No summary available."
        summary_label = ctk.CTkLabel(
            parent,
            text=summary,
            font=("Arial", 12),
            text_color=COLORS["text_light"],
                        justify="left",
            wraplength=520,
        )
        summary_label.grid(row=1, column=0, sticky="we", padx=15, pady=(0, 12))

        prediction = results.get("clearance_prediction", "Unknown")
        pred_color = {
            "Will likely clear": COLORS["secondary"],
            "Unlikely to clear": COLORS["primary"],
            "Needs modifications": COLORS["yellow"],
        }.get(prediction, COLORS["text"])
        prediction_badge = ctk.CTkLabel(
            parent,
            text=f"📊 Clearance Prediction: {prediction}",
            font=("Arial", 13, "bold"),
            text_color=pred_color,
        )
        prediction_badge.grid(row=2, column=0, sticky="w", padx=15, pady=(0, 12))

    def _render_flag_section(
        self,
        parent: ctk.CTkFrame,
        title: str,
        flags: List[Dict[str, Any]],
        accent_color: str,
        badge_text: str,
        badge_color: str,
        max_items: int = 5,
    ):
        if not flags:
            return

        section = ctk.CTkFrame(parent, fg_color=COLORS["card"], corner_radius=12)
        section.pack(fill=tk.BOTH, expand=True, pady=(0, 15))

        header = ctk.CTkLabel(
            section,
            text=title,
            font=("Arial", 13, "bold"),
            text_color=accent_color,
        )
        header.pack(anchor="w", padx=15, pady=(12, 4))

        badge = ctk.CTkLabel(
            section,
            text=badge_text,
            font=("Arial", 10, "bold"),
            text_color=accent_color,
            fg_color=badge_color,
        )
        badge.pack(anchor="w", padx=15, pady=(0, 8))

        for flag in flags[:max_items]:
            card = ctk.CTkFrame(section, fg_color="#F5F5F7", corner_radius=10)
            card.pack(fill=tk.X, padx=15, pady=6)

            issue = flag.get("issue") or "Unspecified issue"
            issue_label = ctk.CTkLabel(
                card,
                text=issue,
                font=("Arial", 12, "bold"),
                text_color=COLORS["text"],
                    justify="left",
                wraplength=400,
            )
            issue_label.pack(anchor="w", padx=12, pady=(8, 4))

            timestamp = flag.get("timestamp")
            if timestamp:
                ctk.CTkLabel(
                    card,
                    text=f"Timestamp: {timestamp}",
                        font=("Arial", 10),
                    text_color=COLORS["text_light"],
                ).pack(anchor="w", padx=12, pady=(0, 4))

            guideline = flag.get("guideline_reference") or flag.get("guideline_code")
            if guideline:
                ctk.CTkLabel(
                    card,
                    text=f"Guideline: {guideline}",
                    font=("Arial", 10, "italic"),
                    text_color=accent_color,
                ).pack(anchor="w", padx=12, pady=(0, 4))

            evidence = flag.get("evidence_text") or flag.get("description")
            if evidence:
                ctk.CTkLabel(
                    card,
                    text=f"“{evidence.strip()}”",
                    font=("Arial", 11, "italic"),
                    text_color=COLORS["text_light"],
                    justify="left",
                    wraplength=420,
                ).pack(anchor="w", padx=12, pady=(0, 6))

            action = flag.get("required_action") or flag.get("suggested_action") or flag.get("impact")
            if action:
                ctk.CTkLabel(
                    card,
                    text=action,
                        font=("Arial", 11),
                    text_color=COLORS["text_light"],
                        justify="left",
                    wraplength=420,
                ).pack(anchor="w", padx=12, pady=(0, 8))

    def _render_compliant_section(self, parent: ctk.CTkFrame, compliant: List[str]):
        section = ctk.CTkFrame(parent, fg_color=COLORS["card"], corner_radius=12)
        section.pack(fill=tk.X, pady=(0, 15))
        title = ctk.CTkLabel(
            section,
            text="✅ Compliant Elements",
            font=("Arial", 13, "bold"),
            text_color=COLORS["secondary"],
        )
        title.pack(anchor="w", padx=15, pady=(12, 4))

        for element in compliant[:3]:
            ctk.CTkLabel(
                section,
                text=f"• {element}",
                font=("Arial", 11),
                text_color=COLORS["text_light"],
                justify="left",
                wraplength=420,
            ).pack(anchor="w", padx=20, pady=(0, 4))

    def _focus_color_for_severity(self, severity: str) -> str:
        severity_upper = (severity or "").upper()
        if severity_upper == "HIGH":
            return COLORS["primary"]
        if severity_upper == "MEDIUM":
            return COLORS["yellow"]
        if severity_upper == "LOW":
            return COLORS["secondary"]
        return COLORS["text_light"]
    
    def _add_polish_button_if_eligible(self, parent: ctk.CTkFrame, clearcast_results: Dict):
        """Add Polish button if video is eligible (no RED flags or admin user)"""
        # Check eligibility
        red_flags = clearcast_results.get('red_flags', [])
        is_admin = hasattr(self, 'current_user') and self.current_user.get('username') == 'admin'
        
        # Only show button if no RED flags OR if admin
        if not red_flags or is_admin:
            # Button container
            button_frame = ctk.CTkFrame(parent, fg_color="transparent")
            button_frame.pack(fill=tk.X, pady=(20, 0))
            
            # Polish button with gradient effect
            polish_btn = ctk.CTkButton(
                button_frame,
                text="✨ POLISH FOR BROADCAST",
                font=("Arial", 14, "bold"),
                fg_color="#2196F3",
                hover_color="#1976D2",
                height=45,
                corner_radius=10,
                command=lambda: self._polish_video_for_clearcast()
            )
            polish_btn.pack(pady=(0, 5))
            
            # Info text
            info_text = "Convert video to Clearcast-ready format (technical fixes only)"
            if red_flags and is_admin:
                info_text += "\n⚠️ Admin override: Video has RED flags"
                
            info_label = ctk.CTkLabel(
                button_frame,
                text=info_text,
                font=("Arial", 11),
                text_color=COLORS['text_light']
            )
            info_label.pack()
    
    def _polish_video_for_clearcast(self):
        """Process video to make it Clearcast-ready"""
        # Get current analysis
        if not hasattr(self, 'current_analysis_id'):
            self._show_notification("No video selected", "error")
            return
            
        analysis = self.storage.get_analysis(self.current_analysis_id)
        if not analysis:
            self._show_notification("Analysis not found", "error")
            return
            
        video_path = analysis.get('video_path')
        if not video_path or not os.path.exists(video_path):
            self._show_notification("Video file not found", "error")
            return
        
        # Create options dialog first
        options_dialog = ctk.CTkToplevel(self.root)
        options_dialog.title("Polish Options")
        options_dialog.geometry("650x850")
        options_dialog.transient(self.root)
        options_dialog.grab_set()
        
        # Center dialog
        options_dialog.update_idletasks()
        x = (options_dialog.winfo_screenwidth() // 2) - (325)
        y = (options_dialog.winfo_screenheight() // 2) - (425)
        options_dialog.geometry(f"650x850+{x}+{y}")
        
        # Options content
        options_frame = ctk.CTkScrollableFrame(options_dialog, fg_color=COLORS['bg'])
        options_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Title
        title_label = ctk.CTkLabel(
            options_frame,
            text="🎬 Polish Options",
            font=("Arial", 24, "bold"),
            text_color=COLORS['text']
        )
        title_label.pack(pady=(0, 20))
        
        # Description
        desc_label = ctk.CTkLabel(
            options_frame,
            text="Select which technical fixes to apply:",
            font=("Arial", 14),
            text_color=COLORS['text_light']
        )
        desc_label.pack(pady=(0, 20))
        
        polish_options = {}
        grouped_actions = actions_by_category()
        slate_fields_frame = None
        
        for category_id in AUTO_FIX_CATEGORY_ORDER:
            category = AUTO_FIX_CATEGORIES.get(category_id)
            if not category:
                continue
            section_frame = ctk.CTkFrame(options_frame, fg_color=COLORS['card'], corner_radius=10)
            section_frame.pack(fill=tk.X, pady=(0, 15))
            
            icon = AUTO_FIX_CATEGORY_ICONS.get(category_id, "🛠️")
            title_parts = [icon, category.label]
            if not category.auto_apply:
                title_parts.append("(Manual review only)")
            section_title = ctk.CTkLabel(
                section_frame,
                text=" ".join(title_parts),
            font=("Arial", 16, "bold"),
            text_color=COLORS['text']
        )
            section_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            actions = grouped_actions.get(category_id, [])
            if category.auto_apply:
                for action in actions:
                    if not can_auto_apply_action(action.id):
                        continue
                    var = ctk.BooleanVar(value=action.default_enabled)
                    polish_options[action.id] = var
                    cb = ctk.CTkCheckBox(
                        section_frame,
                        text=action.label,
                        variable=var,
            font=("Arial", 13)
        )
                    cb.pack(anchor="w", padx=25, pady=5)
                    if action.description:
                        ctk.CTkLabel(
                            section_frame,
                            text=action.description,
                            font=("Arial", 11),
                            text_color=COLORS['text_light'],
                            wraplength=520,
                            justify="left"
                        ).pack(anchor="w", padx=30, pady=(0, 6))
                    if action.requires_metadata and action.id == "add_slate":
                        slate_fields_frame = self._build_slate_fields(section_frame, polish_options)
                        cb.configure(command=lambda frame=slate_fields_frame, var=var: self._toggle_slate_fields(frame, var.get()))
                        self._toggle_slate_fields(slate_fields_frame, var.get())
            else:
                manual_actions = [a for a in actions if not can_auto_apply_action(a.id)]
                text_lines = [category.description]
                if manual_actions:
                    for action in manual_actions:
                        text_lines.append(f"• {action.label}: {action.description}")
                ctk.CTkLabel(
                    section_frame,
                    text="\n".join(text_lines),
                    font=("Arial", 12),
                    text_color=COLORS['text_light'],
                    justify="left",
                    wraplength=540
                ).pack(anchor="w", padx=20, pady=(0, 10))
        
        # 5. OUTPUT QUALITY
        quality_frame = ctk.CTkFrame(options_frame, fg_color=COLORS['card'], corner_radius=10)
        quality_frame.pack(fill=tk.X, pady=(0, 15))
        
        quality_title = ctk.CTkLabel(
            quality_frame,
            text="📊 Output Quality",
            font=("Arial", 16, "bold"),
            text_color=COLORS['text']
        )
        quality_title.pack(anchor="w", padx=15, pady=(10, 5))
        
        # Quality radio buttons
        polish_options['quality'] = ctk.StringVar(value="standard")
        
        high_radio = ctk.CTkRadioButton(
            quality_frame,
            text="High quality (ProRes - very large file)",
            variable=polish_options['quality'],
            value="high",
            font=("Arial", 13)
        )
        high_radio.pack(anchor="w", padx=25, pady=5)
        
        standard_radio = ctk.CTkRadioButton(
            quality_frame,
            text="Standard (H.264 50Mbps - recommended)",
            variable=polish_options['quality'],
            value="standard",
            font=("Arial", 13)
        )
        standard_radio.pack(anchor="w", padx=25, pady=5)
        
        web_radio = ctk.CTkRadioButton(
            quality_frame,
            text="Web optimized (H.264 10Mbps - smaller file)",
            variable=polish_options['quality'],
            value="web",
            font=("Arial", 13)
        )
        web_radio.pack(anchor="w", padx=25, pady=(5, 15))
        
        # Buttons frame
        button_frame = ctk.CTkFrame(options_frame, fg_color="transparent")
        button_frame.pack(fill=tk.X, pady=(20, 0))
        
        # Cancel button
        cancel_btn = ctk.CTkButton(
            button_frame,
            text="Cancel",
            width=120,
            height=40,
            fg_color=COLORS['border'],
            hover_color=COLORS['text_light'],
            command=options_dialog.destroy
        )
        cancel_btn.pack(side=tk.LEFT, padx=(50, 10))
        
        # Process button
        process_btn = ctk.CTkButton(
            button_frame,
            text="Process Video",
            width=200,
            height=40,
            fg_color="#2196F3",
            hover_color="#1976D2",
            font=("Arial", 14, "bold"),
            command=lambda: self._process_with_options(options_dialog, polish_options, video_path)
        )
        process_btn.pack(side=tk.RIGHT, padx=(10, 50))
        
    def _toggle_slate_fields(self, fields_frame, show):
        """Toggle visibility of slate fields"""
        if show:
            fields_frame.pack(fill=tk.X, padx=40, pady=(0, 15))
        else:
            fields_frame.pack_forget()
    
    def _collect_script_and_supers(self, analysis: Dict) -> tuple[str, List[str]]:
        """Collect transcript text and any supers/overlays for AI prompts."""
        script_text = ""
        supers: List[str] = []
        transcription = analysis.get("transcription") or {}
        if isinstance(transcription, dict):
            script_text = (transcription.get("full_text") or "").strip()
            if not script_text:
                segments = transcription.get("segments") or []
                if isinstance(segments, list) and segments:
                    script_text = " ".join(
                        seg.get("text", "").strip()
                        for seg in segments
                        if seg.get("text")
                    ).strip()
            supers_sources = [
                transcription.get("supers"),
                transcription.get("ai_enhancement", {})
                .get("identified_elements", {})
                .get("supers"),
                analysis.get("detected_supers"),
            ]
            for source in supers_sources:
                if not source:
                    continue
                if isinstance(source, list):
                    for entry in source:
                        if isinstance(entry, dict):
                            text = entry.get("text")
                        else:
                            text = entry
                        if text:
                            supers.append(str(text).strip())
        if script_text and len(script_text) > 4000:
            script_text = script_text[:4000].rsplit(" ", 1)[0] + "…"
        unique_supers = []
        seen = set()
        for super_text in supers:
            normalized = super_text.strip()
            if normalized and normalized.lower() not in seen:
                seen.add(normalized.lower())
                unique_supers.append(normalized)
        return script_text, unique_supers[:8]

    def _extract_polish_values(self, polish_options: Dict[str, Any]) -> Dict[str, Any]:
        """Snapshot widget values before destroying the options dialog."""
        extracted: Dict[str, Any] = {
            "quality": "standard",
            "clock_number": "",
            "client_name": "",
            "agency_name": "",
            "product_name": "",
            "title": "",
            "actions": {},
        }

        def _safe_get(option_key: str, default: Any = "") -> Any:
            value = polish_options.get(option_key)
            try:
                if hasattr(value, "get"):
                    result = value.get()
                    return result if result is not None else default
                return value if value is not None else default
            except Exception as exc:  # pragma: no cover - defensive guard
                logger.warning("Failed to read polish option '%s': %s", option_key, exc)
                return default

        extracted["quality"] = (_safe_get("quality", "standard") or "standard")

        for field in ["clock_number", "client_name", "agency_name", "product_name", "title"]:
            raw_value = _safe_get(field, "")
            if isinstance(raw_value, str):
                extracted[field] = raw_value.strip()
            else:
                extracted[field] = str(raw_value).strip() if raw_value is not None else ""

        actions: Dict[str, bool] = {}
        for action in AUTO_FIX_ACTIONS:
            option = polish_options.get(action.id)
            try:
                value = option.get() if hasattr(option, "get") else option
            except Exception as exc:  # pragma: no cover - defensive guard
                logger.warning("Failed to read polish action '%s': %s", action.id, exc)
                value = False
            actions[action.id] = bool(value)
        extracted["actions"] = actions
        return extracted

    def _build_delivery_metadata(
        self,
        polish_values: Dict[str, Any],
        action_plan: Dict[str, bool],
        duration_seconds: int,
    ) -> Dict[str, Any]:
        metadata = {
            "clock_number": None,
            "client_name": None,
            "agency_name": None,
            "product_name": None,
            "title": None,
            "countdown_added": bool(action_plan.get("add_slate")),
            "padding_added": bool(action_plan.get("add_padding")),
            "ready": False,
            "duration": duration_seconds,
        }
        if metadata["countdown_added"]:
            def _clean_text(value: Any) -> Optional[str]:
                if value is None:
                    return None
                if isinstance(value, str):
                    cleaned = value.strip()
                else:
                    cleaned = str(value).strip()
                return cleaned or None

            metadata.update(
                {
                    "clock_number": _clean_text(polish_values.get("clock_number")),
                    "client_name": _clean_text(polish_values.get("client_name")),
                    "agency_name": _clean_text(polish_values.get("agency_name")),
                    "product_name": _clean_text(polish_values.get("product_name")),
                    "title": _clean_text(polish_values.get("title")),
                }
            )
        metadata["ready"] = bool(metadata["clock_number"] and metadata["countdown_added"])
        return metadata
    
    def _build_slate_fields(self, parent_frame, polish_options: Dict[str, Any]):
        """Build metadata entry fields for clock slate options."""
        slate_fields_frame = ctk.CTkFrame(parent_frame, fg_color="transparent")
        slate_fields_frame.pack(fill=tk.X, padx=40, pady=(0, 15))
        slate_fields_frame.pack_forget()
        
        ctk.CTkLabel(
            slate_fields_frame,
            text="Clock Number (e.g., ABC/PROD001/030):",
            font=("Arial", 12),
            text_color=COLORS['text_light']
        ).pack(anchor="w", pady=(5, 2))
        
        polish_options['clock_number'] = ctk.CTkEntry(
            slate_fields_frame,
            placeholder_text="AAA/BBBB123/030",
            width=300,
            height=32
        )
        polish_options['clock_number'].pack(anchor="w", pady=(0, 10))
        
        fields_row1 = ctk.CTkFrame(slate_fields_frame, fg_color="transparent")
        fields_row1.pack(fill=tk.X, pady=5)
        
        client_frame = ctk.CTkFrame(fields_row1, fg_color="transparent")
        client_frame.pack(side=tk.LEFT, padx=(0, 10))
        ctk.CTkLabel(
            client_frame,
            text="Client/Advertiser:",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        ).pack(anchor="w")
        polish_options['client_name'] = ctk.CTkEntry(
            client_frame,
            placeholder_text="Client Name",
            width=200,
            height=28
        )
        polish_options['client_name'].pack()
        
        agency_frame = ctk.CTkFrame(fields_row1, fg_color="transparent")
        agency_frame.pack(side=tk.LEFT)
        ctk.CTkLabel(
            agency_frame,
            text="Agency:",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        ).pack(anchor="w")
        polish_options['agency_name'] = ctk.CTkEntry(
            agency_frame,
            placeholder_text="Agency Name",
            width=200,
            height=28
        )
        polish_options['agency_name'].pack()
        
        fields_row2 = ctk.CTkFrame(slate_fields_frame, fg_color="transparent")
        fields_row2.pack(fill=tk.X, pady=5)
        
        product_frame = ctk.CTkFrame(fields_row2, fg_color="transparent")
        product_frame.pack(side=tk.LEFT, padx=(0, 10))
        ctk.CTkLabel(
            product_frame,
            text="Product:",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        ).pack(anchor="w")
        polish_options['product_name'] = ctk.CTkEntry(
            product_frame,
            placeholder_text="Product Name",
            width=200,
            height=28
        )
        polish_options['product_name'].pack()
        
        title_frame = ctk.CTkFrame(fields_row2, fg_color="transparent")
        title_frame.pack(side=tk.LEFT)
        ctk.CTkLabel(
            title_frame,
            text="Title/Campaign:",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        ).pack(anchor="w")
        polish_options['title'] = ctk.CTkEntry(
            title_frame,
            placeholder_text="Ad Title",
            width=200,
            height=28
        )
        polish_options['title'].pack()
        
        return slate_fields_frame
    
    def _process_with_options(self, options_dialog, polish_options, video_path):
        """Process video with selected options"""
        polish_values = self._extract_polish_values(polish_options)
        # Close options dialog
        options_dialog.destroy()
        
        # Create progress dialog
        progress_dialog = ctk.CTkToplevel(self.root)
        progress_dialog.title("Processing Video")
        progress_dialog.geometry("500x300")
        progress_dialog.transient(self.root)
        progress_dialog.grab_set()
        
        # Center dialog
        progress_dialog.update_idletasks()
        x = (progress_dialog.winfo_screenwidth() // 2) - (250)
        y = (progress_dialog.winfo_screenheight() // 2) - (150)
        progress_dialog.geometry(f"500x300+{x}+{y}")
        
        # Dialog content
        content_frame = ctk.CTkFrame(progress_dialog)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        title_label = ctk.CTkLabel(
            content_frame,
            text="🎬 Converting to Broadcast Format",
            font=("Arial", 18, "bold"),
            text_color=COLORS['text']
        )
        title_label.pack(pady=(0, 20))
        
        # Progress info
        progress_label = ctk.CTkLabel(
            content_frame,
            text="Initializing...",
            font=("Arial", 13),
            text_color=COLORS['text_light']
        )
        progress_label.pack(pady=(0, 10))
        
        # Progress bar
        progress_bar = ctk.CTkProgressBar(
            content_frame,
            width=400,
            height=20,
            progress_color="#2196F3"
        )
        progress_bar.pack(pady=(0, 20))
        progress_bar.set(0)
        
        # Status text
        status_label = ctk.CTkLabel(
            content_frame,
            text="",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        )
        status_label.pack()
        
        # Cancel button (disabled during processing)
        cancel_btn = ctk.CTkButton(
            content_frame,
            text="Cancel",
            width=100,
            fg_color=COLORS['border'],
            hover_color=COLORS['bg'],
            state="disabled"
        )
        cancel_btn.pack(pady=(20, 0))
        
        # Process video in background
        def process_video():
            try:
                from app.video_processor import ClearcastVideoProcessor
                processor = ClearcastVideoProcessor()
                
                # Generate output filename
                input_name = os.path.splitext(os.path.basename(video_path))[0]
                output_name = f"{input_name}_clearcast_ready.mp4"
                output_path = os.path.join(os.path.dirname(video_path), output_name)
                
                # Estimate duration from video
                duration_seconds = 30
                try:
                    cap = cv2.VideoCapture(video_path)
                    fps = cap.get(cv2.CAP_PROP_FPS) or 0
                    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                    if fps and fps > 0:
                        duration_seconds = int(total_frames / fps)
                    cap.release()
                except Exception:
                    pass

                action_plan = {}
                for action in AUTO_FIX_ACTIONS:
                    action_plan[action.id] = bool(polish_values["actions"].get(action.id, False))
                validate_auto_fix_plan(action_plan)

                processing_options = {
                    action_id: enabled
                    for action_id, enabled in action_plan.items()
                    if can_auto_apply_action(action_id)
                }
                processing_options['quality'] = polish_values.get('quality', 'standard')
                
                # Add slate info if enabled
                if processing_options.get('add_slate'):
                    processing_options['slate_info'] = {
                        'clock_number': polish_values.get('clock_number') or "ABC/PROD001/030",
                        'client_name': polish_values.get('client_name') or "Client Name",
                        'agency_name': polish_values.get('agency_name') or "Agency Name",
                        'product_name': polish_values.get('product_name') or "Product",
                        'title': polish_values.get('title') or "Advertisement",
                        'duration': duration_seconds,
                        'ratio': "HD"  # Assuming HD
                    }
                
                delivery_metadata = self._build_delivery_metadata(
                    polish_values, action_plan, duration_seconds
                )
                
                # Process with progress callback
                def update_progress(progress, message):
                    try:
                        if progress_dialog.winfo_exists():
                            if progress_bar.winfo_exists():
                                self.root.after(0, lambda: progress_bar.set(progress))
                            if progress_label.winfo_exists():
                                self.root.after(0, lambda: progress_label.configure(text=message))
                    except Exception:
                        pass  # Dialog was closed
                
                results = processor.process_video(
                    video_path,
                    output_path,
                    progress_callback=update_progress,
                    options=processing_options
                )
                results['delivery_metadata'] = delivery_metadata
                
                # Handle results
                if results['success']:
                    # Show fixes applied
                    fixes_text = "Fixes applied:\n" + "\n".join(f"• {fix}" for fix in results['fixes_applied'])
                    self.root.after(0, lambda: status_label.configure(text=fixes_text))
                    
                    # Show download button and update dialog
                    def show_download():
                        # Update progress to complete
                        progress_bar.set(1.0)
                        progress_label.configure(text="✅ Processing complete!")
                        
                        # Show download button
                        self._show_download_button(
                            content_frame, 
                            output_path,
                            results
                        )
                    
                    self.root.after(0, show_download)
                    
                    # Close dialog button
                    self.root.after(0, lambda: cancel_btn.configure(
                        text="Close",
                        state="normal",
                        command=progress_dialog.destroy
                    ))
                    
                    # Save processing results
                    self.storage.save_video_processing(self.current_analysis_id, results)
                    
                else:
                    error_msg = results.get('error', 'Unknown error')
                    self.root.after(0, lambda: self._show_notification(f"Processing failed: {error_msg}", "error"))
                    self.root.after(0, lambda: progress_dialog.destroy())
                    
            except Exception as e:
                logger.error(f"Video processing error: {e}")
                self.root.after(0, lambda: self._show_notification(f"Error: {str(e)}", "error"))
                self.root.after(0, lambda: progress_dialog.destroy())
        
        # Start processing
        import threading
        threading.Thread(target=process_video, daemon=True).start()
    
    def _show_download_button(self, parent: ctk.CTkFrame, output_path: str, results: Dict):
        """Show download button for processed video"""
        download_frame = ctk.CTkFrame(parent, fg_color="#F0F0F0", corner_radius=10)
        download_frame.pack(fill=tk.X, pady=(20, 0))
        
        # Success icon and text
        success_label = ctk.CTkLabel(
            download_frame,
            text="✅ Video successfully converted!",
            font=("Arial", 14, "bold"),
            text_color=COLORS['secondary']
        )
        success_label.pack(pady=(10, 5))
        
        # File info
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        info_label = ctk.CTkLabel(
            download_frame,
            text=f"Output: {os.path.basename(output_path)} ({file_size_mb:.1f} MB)",
            font=("Arial", 11),
            text_color=COLORS['text_light']
        )
        info_label.pack(pady=(0, 10))
        
        # Warnings if any
        if results.get('warnings'):
            warning_text = "⚠️ Warnings:\n" + "\n".join(results['warnings'])
            warning_label = ctk.CTkLabel(
                download_frame,
                text=warning_text,
                font=("Arial", 10),
                text_color=COLORS['yellow'],
                justify="left"
            )
            warning_label.pack(pady=(0, 10))
        
        # Download button
        download_btn = ctk.CTkButton(
            download_frame,
            text="📥 DOWNLOAD BROADCAST FILE",
            font=("Arial", 13, "bold"),
            fg_color=COLORS['secondary'],
            hover_color="#45a049",
            height=40,
            command=lambda: self._download_processed_video(output_path)
        )
        download_btn.pack(pady=(0, 10))
    
    def _download_processed_video(self, file_path: str):
        """Open file location or prompt for download"""
        try:
            if os.name == 'nt':  # Windows
                # Open containing folder and select file
                subprocess.run(['explorer', '/select,', file_path])
            elif os.name == 'posix':  # macOS/Linux
                subprocess.run(['open', '-R', file_path])
            else:
                # Fallback - just open the directory
                os.startfile(os.path.dirname(file_path))
                
            self._show_notification("File location opened", "success")
            
        except Exception as e:
            logger.error(f"Failed to open file location: {e}")
            self._show_notification(f"File saved to: {file_path}", "info", duration=5000)

    def _analyze_video_breakdown(
        self,
        analysis_id: str,
        card_frame: ctk.CTkFrame,
        regenerate: bool = False,
    ):
        """Analyze video with AI for comprehensive breakdown"""
        # Get analysis data
        analysis = self.storage.get_analysis(analysis_id)
        if not analysis:
            self._show_notification("Analysis not found", "error")
            if regenerate:
                self._ai_regen_inflight.discard(analysis_id)
            return
        
        video_path = analysis.get('video_path')
        if not video_path or not os.path.exists(video_path):
            self._show_notification("Video file not found", "error")
            if regenerate:
                self._ai_regen_inflight.discard(analysis_id)
            return
        
        if regenerate:
            if analysis_id in self._ai_regen_inflight:
                self._show_notification("Regeneration already running", "info")
                return
            self._ai_regen_inflight.add(analysis_id)
        
        # Show loading state
        for widget in card_frame.winfo_children():
            widget.destroy()
        
        detail_level = self.ai_detail_var.get().strip().lower() if hasattr(self, 'ai_detail_var') else "full"
        if detail_level not in ("quick", "full"):
            detail_level = "full"
        airing_country = (self.ai_airing_country_var.get() or "").strip()
        if not airing_country:
            airing_country = (
                analysis.get("ai_airing_country")
                or (analysis.get("ai_breakdown") or {}).get("audience_context", {}).get("airing_country")
                or "United Kingdom"
            )
            self.ai_airing_country_var.set(airing_country)
        if analysis_id != 'sample':
            self.storage.set_ai_airing_country(analysis_id, airing_country)
            analysis["ai_airing_country"] = airing_country
        
        # Recreate header
        breakdown_header = ctk.CTkFrame(card_frame, fg_color="transparent")
        breakdown_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        fallback_video_name = self._get_video_display_name()
        self._render_custom_stories_header(
            breakdown_header,
            "Creative Performance View",
            fallback_video_name,
            None,
            False,
        )
        
        # Loading indicator
        loading_frame = ctk.CTkFrame(card_frame, fg_color="transparent")
        loading_frame.pack(pady=20)
        
        loading_label = ctk.CTkLabel(
            loading_frame,
            text=f"🤖 {'Regenerating' if regenerate else 'Analyzing'} ({detail_level.title()} mode)...",
            font=("Arial", 14),
            text_color=COLORS['text']
        )
        loading_label.pack()
        
        progress_bar = ctk.CTkProgressBar(
            loading_frame,
            width=300,
            height=8,
            mode="indeterminate"
        )
        progress_bar.pack(pady=10)
        progress_bar.start()
        
        # Run analysis in background
        def run_analysis():
            try:
                # Initialize analyzer
                analyzer = AIVideoBreakdown()
                
                script_text, supers_texts = self._collect_script_and_supers(analysis)
                
                # Analyze video
                results = analyzer.analyze_video(
                    video_path,
                    detail_level=detail_level,
                    script_text=script_text,
                    supers_texts=supers_texts,
                    audience_country=airing_country,
                )
                
                # Save results
                self.storage.save_ai_breakdown(analysis_id, results)
                
                # Update UI on main thread
                self.root.after(0, lambda: self._update_ai_breakdown_display(analysis_id, card_frame, results))
                
            except Exception as e:
                logger.error(f"AI breakdown failed: {e}")
                error_results = {
                    "error": str(e),
                    "analysis_status": "ERROR",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": f"Analysis failed: {str(e)}"
                }
                error_results["audience_context"] = {"airing_country": airing_country}
                self.root.after(0, lambda: self._update_ai_breakdown_display(analysis_id, card_frame, error_results))
            finally:
                if regenerate:
                    self._ai_regen_inflight.discard(analysis_id)
        
        # Start background thread
        import threading
        threading.Thread(target=run_analysis, daemon=True).start()
    
    def _regenerate_ai_breakdown(self, analysis_id: str, card_frame: ctk.CTkFrame):
        """Trigger a fresh AI breakdown without re-uploading video."""
        if not analysis_id:
            self._show_notification("No analysis selected", "error")
            return
        self._analyze_video_breakdown(analysis_id, card_frame, regenerate=True)
    
    def _render_airing_country_selector(self, parent: ctk.CTkFrame, analysis_id: str):
        """Render the airing country selector used for AI audience context."""
        airing_row = ctk.CTkFrame(parent, fg_color="transparent")
        airing_row.pack(fill=tk.X, padx=20, pady=(0, 12))
        
        label = ctk.CTkLabel(
            airing_row,
            text="Airing Country",
            font=("SF Pro Text", 12, "bold"),
            text_color=COLORS['text'],
        )
        label.pack(side=tk.LEFT)
        
        combo = ctk.CTkComboBox(
            airing_row,
            width=220,
            values=self._get_airing_country_suggestions(),
            variable=self.ai_airing_country_var,
            command=lambda _: self._on_airing_country_changed(analysis_id, self.ai_airing_country_var.get()),
        )
        combo.pack(side=tk.LEFT, padx=(10, 0))
        combo.bind(
            "<FocusOut>",
            lambda event, widget=combo: self._on_airing_country_changed(analysis_id, widget.get()),
        )
        combo.bind(
            "<Return>",
            lambda event, widget=combo: self._on_airing_country_changed(analysis_id, widget.get()),
        )
        
        hint = ctk.CTkLabel(
            airing_row,
            text="Used to tailor simulated audience reactions.",
            font=("SF Pro Text", 11),
            text_color=COLORS['text_light'],
        )
        hint.pack(side=tk.LEFT, padx=(10, 0))
        return combo
    
    def _on_airing_country_changed(self, analysis_id: str, country_value: str):
        """Persist airing country selections for AI analysis."""
        normalized = (country_value or "").strip()
        self.ai_airing_country_var.set(normalized)
        if analysis_id and analysis_id != 'sample':
            self.storage.set_ai_airing_country(analysis_id, normalized)
    
    def _get_airing_country_suggestions(self) -> List[str]:
        """Provide commonly used airing markets while allowing free text."""
        return [
            "United Kingdom",
            "United States",
            "Canada",
            "Australia",
            "Ireland",
            "France",
            "Germany",
            "Spain",
            "Italy",
            "India",
            "Singapore",
            "United Arab Emirates",
        ]
    
    def _dedupe_highlights_for_display(self, highlights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Client-side guard against duplicate improvement rows."""
        deduped: List[Dict[str, Any]] = []
        seen_keys = set()
        for highlight in highlights:
            if not isinstance(highlight, dict):
                continue
            key = (highlight.get("aspect") or highlight.get("suggestion") or "").strip().lower()
            if key and key in seen_keys:
                continue
            if key:
                seen_keys.add(key)
            deduped.append(highlight)
        return deduped
    
    def _update_ai_breakdown_display(
        self,
        analysis_id: str,
        card_frame: ctk.CTkFrame,
        results: Dict,
    ):
        """Update the display after AI analysis completes"""
        # Clear loading state
        for widget in card_frame.winfo_children():
            widget.destroy()
        
        # Recreate header
        breakdown_header = ctk.CTkFrame(card_frame, fg_color="transparent")
        breakdown_header.pack(fill=tk.X, padx=20, pady=(20, 10))
        fallback_video_name = self._get_video_display_name()
        ad_display_name = resolve_ad_name(results or {}, fallback_video_name)
        confidence_value, low_confidence, _ = self._extract_ad_confidence(results)
        self._render_custom_stories_header(
            breakdown_header,
            "Creative Performance View",
            ad_display_name,
            confidence_value,
            low_confidence,
        )
        
        # Regenerate action
        regen_frame = ctk.CTkFrame(card_frame, fg_color="transparent")
        regen_frame.pack(fill=tk.X, padx=20, pady=(0, 10))
        regen_inflight = analysis_id in self._ai_regen_inflight
        regen_btn = ctk.CTkButton(
            regen_frame,
            text="Regenerating…" if regen_inflight else "Regenerate Analysis",
            font=("SF Pro Text", 12),
            width=180,
            height=34,
            fg_color=COLORS['blue'],
            hover_color="#0056CC",
            state="disabled" if regen_inflight else "normal",
            command=lambda: self._regenerate_ai_breakdown(analysis_id, card_frame),
        )
        regen_btn.pack(side=tk.RIGHT)
        
        self._render_airing_country_selector(card_frame, analysis_id)
        
        # Status badge
        status = results.get('analysis_status', 'UNKNOWN')
        if status == 'COMPLETE':
            status_color = COLORS['secondary']
            status_text = "✓ Analyzed"
        else:
            status_color = COLORS['primary']
            status_text = "❌ Error"
        
        # Right side container for status and download button
        right_container = ctk.CTkFrame(breakdown_header, fg_color="transparent")
        right_container.pack(side=tk.RIGHT)
        
        status_label = ctk.CTkLabel(
            right_container,
            text=status_text,
            font=("SF Pro Text", 12, "bold"),
            text_color=status_color
        )
        status_label.pack(side=tk.LEFT, padx=(0, 10))
        
        analysis_mode = results.get('analysis_mode', 'full')
        mode_label = ctk.CTkLabel(
            right_container,
            text=f"{analysis_mode.title()} mode",
            font=("SF Pro Text", 11),
            text_color=COLORS['text_light']
        )
        mode_label.pack(side=tk.LEFT, padx=(0, 10))
        
        # Download PDF button (only if analysis is complete)
        if status == 'COMPLETE':
            download_btn = ctk.CTkButton(
                right_container,
                text="📥 Download PDF",
                font=("SF Pro Text", 12),
                width=120,
                height=30,
                corner_radius=15,
                fg_color=COLORS['blue'],
                hover_color="#0056CC",
                command=lambda: self._download_ai_breakdown_pdf(results, card_frame)
            )
            download_btn.pack(side=tk.LEFT)
        
        # Display results (don't add download button here since it's already added above)
        self._display_ai_breakdown_results(card_frame, results, add_download_button=False)
    
    def _display_ai_breakdown_results(self, parent: ctk.CTkFrame, results: Dict, add_download_button: bool = True):
        """Display AI breakdown results in an organized, beautiful way
        
        Args:
            parent: Parent frame to display results in
            results: AI breakdown results dictionary
            add_download_button: Whether to add PDF download button (default True)
        """
        # Add PDF download button at the top if analysis is complete and button requested
        if add_download_button and results and results.get('analysis_status') == 'COMPLETE':
            header_frame = ctk.CTkFrame(parent, fg_color="transparent")
            header_frame.pack(fill=tk.X, padx=20, pady=(0, 10))
            
            download_btn = ctk.CTkButton(
                header_frame,
                text="📥 Download PDF",
                font=("SF Pro Text", 12),
                width=120,
                height=30,
                corner_radius=15,
                fg_color=COLORS['blue'],
                hover_color="#0056CC",
                command=lambda: self._download_ai_breakdown_pdf(results, parent)
            )
            download_btn.pack(side=tk.RIGHT)
        # Create container WITHOUT SCROLL - let content expand naturally
        content_frame = ctk.CTkFrame(
            parent,
            fg_color="transparent"
        )
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 20))
        
        # Check for errors
        if results.get('error'):
            error_label = ctk.CTkLabel(
                content_frame,
                text=f"⚠️ {results.get('error', 'Unknown error')}",
                font=("Arial", 13),
                text_color=COLORS['primary'],
                wraplength=450
            )
            error_label.pack(pady=20)
            return
        
        confidence_value, low_confidence, alternatives = self._extract_ad_confidence(results)
        if low_confidence and alternatives:
            alt_frame = ctk.CTkFrame(content_frame, fg_color=COLORS['card'], corner_radius=10)
            alt_frame.pack(fill=tk.X, pady=(0, 15))
            
            alt_title = ctk.CTkLabel(
                alt_frame,
                text="Possible interpretations to verify",
                font=("SF Pro Text", 12, "bold"),
                text_color=COLORS['primary']
            )
            alt_title.pack(anchor="w", padx=15, pady=(12, 4))
            
            for alt in alternatives[:3]:
                alt_label = ctk.CTkLabel(
                    alt_frame,
                    text=f"- {alt}",
                    font=("Arial", 12),
                    text_color=COLORS['text'],
                    anchor="w",
                    justify="left"
                )
                alt_label.pack(anchor="w", padx=20, pady=2)
        
        micro_summary = results.get('one_sentence_summary')
        if micro_summary:
            micro_frame = ctk.CTkFrame(content_frame, fg_color="#FFFFFF", corner_radius=10)
            micro_frame.pack(fill=tk.X, pady=(0, 15))
            ctk.CTkLabel(
                micro_frame,
                text="✨ Key Takeaway",
                font=("Arial", 12, "bold"),
                text_color=COLORS['text']
            ).pack(anchor="w", padx=15, pady=(12, 4))
            ctk.CTkLabel(
                micro_frame,
                text=micro_summary,
                font=("Arial", 12),
                text_color=COLORS['text'],
                wraplength=540,
                justify="left"
            ).pack(anchor="w", padx=15, pady=(0, 12))
        
        # 1. Video Breakdown Section
        breakdown = results.get('breakdown', {})
        cta_highlight = None
        if breakdown:
            breakdown_frame = ctk.CTkFrame(content_frame, fg_color=COLORS['bg'], corner_radius=10)
            breakdown_frame.pack(fill=tk.X, pady=(0, 15))
            
            breakdown_title = ctk.CTkLabel(
                breakdown_frame,
                text="📊 CONTENT BREAKDOWN",
                font=("Arial", 14, "bold"),
                text_color=COLORS['text']
            )
            breakdown_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            # What is being advertised (NEW)
            if breakdown.get('what_is_advertised'):
                what_frame = ctk.CTkFrame(breakdown_frame, fg_color="transparent")
                what_frame.pack(fill=tk.X, padx=15, pady=(5, 10))
                
                ctk.CTkLabel(
                    what_frame,
                    text="🎯 WHAT'S BEING ADVERTISED:",
                    font=("Arial", 13, "bold"),
                    text_color=COLORS['primary']
                ).pack(anchor="w")
                
                ctk.CTkLabel(
                    what_frame,
                    text=breakdown['what_is_advertised'],
                    font=("Arial", 12),
                    text_color=COLORS['text'],
                    wraplength=550
                ).pack(anchor="w", padx=(10, 0))
                
                # Additional product details
                if breakdown.get('brand_name'):
                    ctk.CTkLabel(
                        what_frame,
                        text=f"Brand: {breakdown['brand_name']}",
                        font=("Arial", 11),
                        text_color=COLORS['text_light']
                    ).pack(anchor="w", padx=(10, 0))
                    
                if breakdown.get('specific_product'):
                    ctk.CTkLabel(
                        what_frame,
                        text=f"Product: {breakdown['specific_product']}",
                        font=("Arial", 11),
                        text_color=COLORS['text_light']
                    ).pack(anchor="w", padx=(10, 0))
            
            # Content details
            details = [
                ("Type", breakdown.get('content_type', 'Unknown')),
                ("Duration", breakdown.get('duration_category', 'Unknown')),
                ("Target Audience", breakdown.get('target_audience', 'Unknown')),
                ("Production Quality", breakdown.get('production_quality', 'Unknown'))
            ]
            
            for label, value in details:
                detail_frame = ctk.CTkFrame(breakdown_frame, fg_color="transparent")
                detail_frame.pack(fill=tk.X, padx=15, pady=2)
                
                ctk.CTkLabel(
                    detail_frame,
                    text=f"{label}:",
                    font=("Arial", 12, "bold"),
                    text_color=COLORS['text_light'],
                    width=130,
                    anchor="w"
                ).pack(side=tk.LEFT)
                
                # Create a frame for the value to allow wrapping
                value_frame = ctk.CTkFrame(detail_frame, fg_color="transparent")
                value_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
                
                ctk.CTkLabel(
                    value_frame,
                    text=value,
                    font=("Arial", 12),
                    text_color=COLORS['text'],
                    wraplength=400,
                    anchor="w",
                    justify="left"
                ).pack(anchor="w")
            
            # Narrative structure
            if breakdown.get('narrative_structure'):
                narrative_label = ctk.CTkLabel(
                    breakdown_frame,
                    text=f"Story: {breakdown['narrative_structure']}",
                    font=("Arial", 11),
                    text_color=COLORS['text_light'],
                    wraplength=550,
                    justify="left"
                )
                narrative_label.pack(anchor="w", padx=15, pady=(5, 10))
            
            cta_clarity = breakdown.get('cta_clarity')
            cta_suggestion = breakdown.get('suggested_improved_cta')
            cta_highlight = None
            if cta_suggestion:
                suggestion_text = cta_suggestion
                if cta_clarity:
                    suggestion_text = f"{cta_clarity}\nSuggested CTA: {cta_suggestion}"
                cta_highlight = {
                    "aspect": "CTA Update",
                    "suggestion": suggestion_text,
                    "priority": "Medium",
                }
            if cta_clarity:
                cta_frame = ctk.CTkFrame(breakdown_frame, fg_color="#FFF5F5", corner_radius=8)
                cta_frame.pack(fill=tk.X, padx=15, pady=(0, 10))
                
                ctk.CTkLabel(
                    cta_frame,
                    text="CTA Quality",
                    font=("Arial", 12, "bold"),
                    text_color=COLORS['primary']
                ).pack(anchor="w", padx=10, pady=(8, 2))
                
                if cta_clarity:
                    ctk.CTkLabel(
                        cta_frame,
                        text=f"Clarity: {cta_clarity}",
                        font=("Arial", 11),
                        text_color=COLORS['text']
                    ).pack(anchor="w", padx=15)
        
        # 2. Estimated Outcome Section
        outcome = results.get('estimated_outcome', {})
        if outcome:
            outcome_frame = ctk.CTkFrame(content_frame, fg_color=COLORS['bg'], corner_radius=10)
            outcome_frame.pack(fill=tk.X, pady=(0, 15))
            
            outcome_title = ctk.CTkLabel(
                outcome_frame,
                text="🎯 ESTIMATED OUTCOME",
                font=("Arial", 14, "bold"),
                text_color=COLORS['text']
            )
            outcome_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            # Primary goal and effectiveness
            goal_frame = ctk.CTkFrame(outcome_frame, fg_color="transparent")
            goal_frame.pack(fill=tk.X, padx=15, pady=5)
            
            ctk.CTkLabel(
                goal_frame,
                text=f"Primary Goal: {outcome.get('primary_goal', 'Unknown')}",
                font=("Arial", 13, "bold"),
                text_color=COLORS['blue']
            ).pack(side=tk.LEFT)
            
            # Effectiveness score with tier label and benchmark
            score = outcome.get('effectiveness_score', 0)
            tier = get_tier(score)
            tier_color = get_tier_color(tier)
            tier_def = get_tier_definition(tier)
            
            score_frame = ctk.CTkFrame(outcome_frame, fg_color="transparent")
            score_frame.pack(fill=tk.X, padx=15, pady=(5, 5))
            
            # Score label with tier
            score_label_frame = ctk.CTkFrame(score_frame, fg_color="transparent")
            score_label_frame.pack(fill=tk.X)
            
            score_label = ctk.CTkLabel(
                score_label_frame,
                text=f"Effectiveness: {format_score_with_tier(score)}",
                font=("Arial", 12, "bold"),
                text_color=COLORS['text']
            )
            score_label.pack(side=tk.LEFT)
            
            # Progress bar with tier color
            progress = ctk.CTkProgressBar(
                score_label_frame,
                width=200,
                height=15,
                progress_color=tier_color
            )
            progress.pack(side=tk.LEFT, padx=(10, 0))
            progress.set(score / 100)
            
            # Tier definition (always visible)
            tier_def_frame = ctk.CTkFrame(outcome_frame, fg_color="#F5F5F5", corner_radius=8)
            tier_def_frame.pack(fill=tk.X, padx=15, pady=(5, 10))
            
            tier_title = ctk.CTkLabel(
                tier_def_frame,
                text=f"📊 {tier} Performance",
                font=("Arial", 11, "bold"),
                text_color=tier_color
            )
            tier_title.pack(anchor="w", padx=10, pady=(8, 4))
            
            tier_overall = ctk.CTkLabel(
                tier_def_frame,
                text=f"Overall: {tier_def['overall']}",
                font=("Arial", 10),
                text_color=COLORS['text'],
                wraplength=500,
                justify="left"
            )
            tier_overall.pack(anchor="w", padx=10, pady=2)
            
            # Metric estimates in a compact format
            metrics_frame = ctk.CTkFrame(tier_def_frame, fg_color="transparent")
            metrics_frame.pack(fill=tk.X, padx=10, pady=(2, 8))
            
            metrics_text = f"📈 Engagement: {tier_def['engagement']} | 💰 Conversion: {tier_def['conversion']} | 🧠 Memorability: {tier_def['memorability']}"
            metrics_label = ctk.CTkLabel(
                metrics_frame,
                text=metrics_text,
                font=("Arial", 9),
                text_color=COLORS['text_light'],
                wraplength=500,
                justify="left"
            )
            metrics_label.pack(anchor="w")
            
            # Tooltip functionality - create hover frame
            tooltip_frame = None
            def show_tooltip(event):
                nonlocal tooltip_frame
                if tooltip_frame:
                    tooltip_frame.destroy()
                
                # Create tooltip as a top-level window-like frame
                tooltip_frame = ctk.CTkFrame(score_label_frame.master, fg_color="#2C3E50", corner_radius=8)
                tooltip_frame.place(in_=score_label_frame, x=0, y=30, relx=0, rely=0)
                
                tooltip_title = ctk.CTkLabel(
                    tooltip_frame,
                    text=f"{tier} Tier ({score}%)",
                    font=("Arial", 12, "bold"),
                    text_color="white"
                )
                tooltip_title.pack(padx=12, pady=(8, 4))
                
                tooltip_overall = ctk.CTkLabel(
                    tooltip_frame,
                    text=f"Overall: {tier_def['overall']}",
                    font=("Arial", 10),
                    text_color="white",
                    wraplength=300,
                    justify="left"
                )
                tooltip_overall.pack(anchor="w", padx=12, pady=2)
                
                tooltip_engagement = ctk.CTkLabel(
                    tooltip_frame,
                    text=f"Engagement: {tier_def['engagement']}",
                    font=("Arial", 10),
                    text_color="white",
                    wraplength=300,
                    justify="left"
                )
                tooltip_engagement.pack(anchor="w", padx=12, pady=2)
                
                tooltip_conversion = ctk.CTkLabel(
                    tooltip_frame,
                    text=f"Conversion: {tier_def['conversion']}",
                    font=("Arial", 10),
                    text_color="white",
                    wraplength=300,
                    justify="left"
                )
                tooltip_conversion.pack(anchor="w", padx=12, pady=2)
                
                tooltip_memorability = ctk.CTkLabel(
                    tooltip_frame,
                    text=f"Memorability: {tier_def['memorability']}",
                    font=("Arial", 10),
                    text_color="white",
                    wraplength=300,
                    justify="left"
                )
                tooltip_memorability.pack(anchor="w", padx=12, pady=(2, 8))
            
            def hide_tooltip(event):
                nonlocal tooltip_frame
                if tooltip_frame:
                    tooltip_frame.destroy()
                    tooltip_frame = None
            
            score_label.bind("<Enter>", show_tooltip)
            score_label.bind("<Leave>", hide_tooltip)
            progress.bind("<Enter>", show_tooltip)
            progress.bind("<Leave>", hide_tooltip)
            
            # Reasoning
            if outcome.get('reasoning'):
                reasoning_label = ctk.CTkLabel(
                    outcome_frame,
                    text=outcome['reasoning'],
                    font=("Arial", 11),
                    text_color=COLORS['text_light'],
                    wraplength=500,
                    justify="left"
                )
                reasoning_label.pack(anchor="w", padx=15, pady=(0, 10))
            
            score_rationale = outcome.get('score_rationale') or []
            if score_rationale:
                rationale_frame = ctk.CTkFrame(outcome_frame, fg_color="transparent")
                rationale_frame.pack(fill=tk.X, padx=15, pady=(0, 10))
                
                ctk.CTkLabel(
                    rationale_frame,
                    text="Why this score:",
                    font=("Arial", 12, "bold"),
                    text_color=COLORS['text']
                ).pack(anchor="w")
                
                for reason in score_rationale[:3]:
                    ctk.CTkLabel(
                        rationale_frame,
                        text=f"- {reason}",
                        font=("Arial", 11),
                        text_color=COLORS['text'],
                        wraplength=500,
                        justify="left"
                    ).pack(anchor="w", padx=10, pady=2)
        
        # 3. Green Highlights (What's Working)
        green_highlights = results.get('green_highlights', [])
        if green_highlights:
            green_frame = ctk.CTkFrame(content_frame, fg_color="#E8F5E9", corner_radius=10)
            green_frame.pack(fill=tk.X, pady=(0, 15))
            
            green_title = ctk.CTkLabel(
                green_frame,
                text="✅ WHAT'S WORKING WELL",
                font=("Arial", 14, "bold"),
                text_color="#2E7D32"
            )
            green_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            for highlight in green_highlights[:5]:  # Show max 5
                highlight_frame = ctk.CTkFrame(green_frame, fg_color="transparent")
                highlight_frame.pack(fill=tk.X, padx=15, pady=3)
                
                # Impact indicator
                impact_color = {
                    'High': '#1B5E20',
                    'Medium': '#388E3C',
                    'Low': '#66BB6A'
                }.get(highlight.get('impact', 'Medium'), '#388E3C')
                
                impact_dot = ctk.CTkLabel(
                    highlight_frame,
                    text="●",
                    font=("Arial", 16),
                    text_color=impact_color
                )
                impact_dot.pack(side=tk.LEFT, padx=(0, 5))
                
                # Text
                text_frame = ctk.CTkFrame(highlight_frame, fg_color="transparent")
                text_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
                
                ctk.CTkLabel(
                    text_frame,
                    text=highlight.get('aspect', ''),
                    font=("Arial", 12, "bold"),
                    text_color="#2E7D32",
                    anchor="w",
                    justify="left"
                ).pack(anchor="w")
                
                if highlight.get('explanation'):
                    ctk.CTkLabel(
                        text_frame,
                        text=highlight['explanation'],
                        font=("Arial", 11),
                        text_color="#4CAF50",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w")
                evidence = highlight.get("evidence_text")
                if evidence:
                    ctk.CTkLabel(
                        text_frame,
                        text=f"Evidence: {evidence}",
                        font=("Arial", 10, "italic"),
                        text_color="#1B5E20",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w", pady=(0, 4))
        
        # 4. Yellow Highlights (Areas for Improvement)
        yellow_highlights = results.get('yellow_highlights', [])
        yellow_highlights = list(yellow_highlights) if isinstance(yellow_highlights, list) else []
        if cta_highlight:
            yellow_highlights.insert(0, cta_highlight)
        yellow_highlights = self._dedupe_highlights_for_display(yellow_highlights)
        if yellow_highlights:
            yellow_frame = ctk.CTkFrame(content_frame, fg_color="#FFF9C4", corner_radius=10)
            yellow_frame.pack(fill=tk.X, pady=(0, 15))
            
            yellow_title = ctk.CTkLabel(
                yellow_frame,
                text="⚠️ AREAS FOR IMPROVEMENT",
                font=("Arial", 14, "bold"),
                text_color="#F57C00"
            )
            yellow_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            for highlight in yellow_highlights[:5]:  # Show max 5
                highlight_frame = ctk.CTkFrame(yellow_frame, fg_color="transparent")
                highlight_frame.pack(fill=tk.X, padx=15, pady=3)
                
                # Priority indicator
                priority_color = {
                    'High': '#E65100',
                    'Medium': '#F57C00',
                    'Low': '#FFB74D'
                }.get(highlight.get('priority', 'Medium'), '#F57C00')
                
                priority_dot = ctk.CTkLabel(
                    highlight_frame,
                    text="▲",
                    font=("Arial", 12),
                    text_color=priority_color
                )
                priority_dot.pack(side=tk.LEFT, padx=(0, 5))
                
                # Text
                text_frame = ctk.CTkFrame(highlight_frame, fg_color="transparent")
                text_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
                
                ctk.CTkLabel(
                    text_frame,
                    text=highlight.get('aspect', ''),
                    font=("Arial", 12, "bold"),
                    text_color="#F57C00",
                    anchor="w",
                    justify="left"
                ).pack(anchor="w")
                
                if highlight.get('suggestion'):
                    ctk.CTkLabel(
                        text_frame,
                        text=f"→ {highlight['suggestion']}",
                        font=("Arial", 11),
                        text_color="#FF8F00",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w")
                evidence = highlight.get("evidence_text")
                if evidence:
                    ctk.CTkLabel(
                        text_frame,
                        text=f"Evidence: {evidence}",
                        font=("Arial", 10, "italic"),
                        text_color="#BF360C",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w", pady=(0, 4))
        
        # 4b. Soft Risks
        soft_risks = results.get('soft_risks', [])
        if soft_risks:
            risks_frame = ctk.CTkFrame(content_frame, fg_color="#F0F4F8", corner_radius=10)
            risks_frame.pack(fill=tk.X, pady=(0, 15))
            
            risks_title = ctk.CTkLabel(
                risks_frame,
                text="⚠️ SOFT RISKS & WATCHPOINTS",
                font=("Arial", 14, "bold"),
                text_color="#1E3A5F"
            )
            risks_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            for risk in soft_risks[:5]:
                risk_frame = ctk.CTkFrame(risks_frame, fg_color="transparent")
                risk_frame.pack(fill=tk.X, padx=15, pady=4)
                
                risk_text = ctk.CTkLabel(
                    risk_frame,
                    text=risk.get('risk', 'Potential issue'),
                    font=("Arial", 12, "bold"),
                    text_color="#1E3A5F",
                    wraplength=500,
                    justify="left"
                )
                risk_text.pack(anchor="w")
                
                impact = risk.get('impact')
                if impact:
                    ctk.CTkLabel(
                        risk_frame,
                        text=f"Impact: {impact}",
                        font=("Arial", 11),
                        text_color="#546E7A"
                    ).pack(anchor="w", padx=10)
                
                mitigation = risk.get('mitigation')
                if mitigation:
                    ctk.CTkLabel(
                        risk_frame,
                        text=f"Mitigation: {mitigation}",
                        font=("Arial", 11),
                        text_color="#37474F",
                        wraplength=500,
                        justify="left"
                    ).pack(anchor="w", padx=10, pady=(0, 5))
                evidence = risk.get("evidence_text")
                if evidence:
                    ctk.CTkLabel(
                        risk_frame,
                        text=f"Evidence: {evidence}",
                        font=("Arial", 10, "italic"),
                        text_color="#263238",
                        wraplength=500,
                        justify="left"
                    ).pack(anchor="w", padx=10, pady=(0, 5))
        
        # 5. Audience Reactions (Orange Section)
        analysis_mode = results.get('analysis_mode', 'full')
        audience_reactions = results.get('audience_reactions', [])
        if audience_reactions:
            audience_frame = ctk.CTkFrame(content_frame, fg_color="#FFE0B2", corner_radius=10)
            audience_frame.pack(fill=tk.X, pady=(0, 15))
            
            audience_title = ctk.CTkLabel(
                audience_frame,
                text="👥 SIMULATED AUDIENCE REACTIONS",
                font=("Arial", 14, "bold"),
                text_color="#E65100"
            )
            audience_title.pack(anchor="w", padx=15, pady=(10, 5))
            airing_country_label = (
                (results.get("audience_context") or {}).get("airing_country")
                or self.ai_airing_country_var.get()
            )
            if airing_country_label:
                ctk.CTkLabel(
                    audience_frame,
                    text=f"Primary airing market: {airing_country_label}",
                    font=("Arial", 11, "italic"),
                    text_color="#BF360C",
                ).pack(anchor="w", padx=15, pady=(0, 5))
            
            for reaction in audience_reactions:
                reaction_frame = ctk.CTkFrame(audience_frame, fg_color="#FFF3E0", corner_radius=8)
                reaction_frame.pack(fill=tk.X, padx=15, pady=5)
                
                persona = reaction.get('persona') or reaction.get('profile') or "Audience Persona"
                demo_parts = [
                    reaction.get('gender'),
                    reaction.get('age_range'),
                    reaction.get('race_ethnicity'),
                ]
                demo_text = " • ".join(
                    part for part in demo_parts if part and part not in ("Unknown", "Not specified")
                )
                location = reaction.get('location')
                
                header_row = ctk.CTkFrame(reaction_frame, fg_color="transparent")
                header_row.pack(fill=tk.X, padx=10, pady=(5, 0))
                ctk.CTkLabel(
                    header_row,
                    text=persona,
                    font=("Arial", 12, "bold"),
                    text_color="#D84315",
                    wraplength=360,
                    anchor="w"
                ).pack(side=tk.LEFT, padx=(0, 6))
                if location and location not in ("Not specified", "Unknown"):
                    ctk.CTkLabel(
                        header_row,
                        text=f"📍 {location}",
                        font=("Arial", 11),
                        text_color="#F57C00",
                        anchor="w"
                    ).pack(side=tk.LEFT)
                
                if demo_text:
                    ctk.CTkLabel(
                        reaction_frame,
                        text=demo_text,
                        font=("Arial", 10),
                        text_color=COLORS['text_light'],
                        anchor="w"
                    ).pack(anchor="w", padx=15)
                
                engagement = reaction.get('engagement_level', 'Unknown')
                engagement_color = {
                    'High': '#2E7D32',
                    'Medium': '#F57C00',
                    'Low': '#D32F2F'
                }.get(engagement, '#757575')
                
                ctk.CTkLabel(
                    reaction_frame,
                    text=f"Engagement: {engagement}",
                    font=("Arial", 10, "bold"),
                    text_color=engagement_color
                ).pack(anchor="w", padx=15, pady=(2, 0))
                
                if reaction.get('reaction'):
                    ctk.CTkLabel(
                        reaction_frame,
                        text=f'“{reaction["reaction"]}”',
                        font=("Arial", 11, "italic"),
                        text_color="#5D4037",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w", padx=15, pady=(2, 5))
                
                if reaction.get('likely_action'):
                    ctk.CTkLabel(
                        reaction_frame,
                        text=f"Likely Action: {reaction['likely_action']}",
                        font=("Arial", 10),
                        text_color="#795548",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w", padx=15, pady=(0, 4))

                if reaction.get('key_concern'):
                    ctk.CTkLabel(
                        reaction_frame,
                        text=f"Key Concern: {reaction['key_concern']}",
                        font=("Arial", 10),
                        text_color="#B53D00",
                        wraplength=480,
                        anchor="w",
                        justify="left"
                    ).pack(anchor="w", padx=15, pady=(0, 6))
        elif analysis_mode == 'quick':
            audience_note = ctk.CTkLabel(
                content_frame,
                text="👥 Audience reactions are available when you run a Full analysis.",
                font=("Arial", 11),
                text_color=COLORS['text_light'],
                justify="left",
                anchor="w"
            )
            audience_note.pack(anchor="w", padx=20, pady=(0, 15))
        
        # 6. Summary
        summary = results.get('summary')
        if summary:
            summary_frame = ctk.CTkFrame(content_frame, fg_color=COLORS['card'], corner_radius=10)
            summary_frame.pack(fill=tk.X, pady=(0, 10))
            
            summary_title = ctk.CTkLabel(
                summary_frame,
                text="📝 SUMMARY",
                font=("Arial", 14, "bold"),
                text_color=COLORS['text']
            )
            summary_title.pack(anchor="w", padx=15, pady=(10, 5))
            
            summary_text = ctk.CTkLabel(
                summary_frame,
                text=summary,
                font=("Arial", 12),
                text_color=COLORS['text'],
                wraplength=520,
                anchor="w",
                justify="left"
            )
            summary_text.pack(anchor="w", padx=15, pady=(0, 15))
        
    def _on_clearcast_updates(self, updates: Dict):
        """Handle Clearcast guideline updates"""
        if updates.get('has_updates'):
            # Show notification to admin users
            if hasattr(self, 'current_user') and self.current_user.get('username') == 'admin':
                summary = updates.get('summary', 'Clearcast guidelines have been updated')
                self._show_notification(
                    f"📋 Clearcast Update: {summary}", 
                    type="info", 
                    duration=8000
                )
            
            # Log the update
            logger.info(f"Clearcast guidelines updated: {updates.get('summary')}")
        
        self._refresh_clearcast_last_updated_label()
        
    def _get_engagement_description(self, score):
        """Get descriptive text for engagement score"""
        if score >= 0.8:
            return "Highly engaging! Viewers were very attentive."
        elif score >= 0.6:
            return "Good engagement. Viewers showed interest."
        elif score >= 0.4:
            return "Moderate engagement. Some moments captured attention."
        elif score >= 0.2:
            return "Low engagement. Consider more dynamic content."
        else:
            return "Very low engagement. Content may need improvement."
    
    def _render_custom_stories_header(
        self,
        parent: ctk.CTkFrame,
        subtitle: str,
        ad_name: str,
        confidence: Optional[float] = None,
        low_confidence: bool = False,
    ):
        """Render the shared Custom Stories header layout."""
        header_container = ctk.CTkFrame(parent, fg_color="transparent")
        header_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        title_label = ctk.CTkLabel(
            header_container,
            text="CUSTOM STORIES REPORT",
            font=("Arial Black", 16),
            text_color=COLORS['text']
        )
        title_label.pack(anchor="w")
        
        detail_parts = []
        if ad_name:
            detail_parts.append(ad_name)
        if confidence is not None:
            detail_parts.append(f"{confidence:.0f}% confidence")
        
        if detail_parts:
            ad_label = ctk.CTkLabel(
                header_container,
                text=" | ".join(detail_parts),
                font=("SF Pro Text", 12),
                text_color=COLORS['text_light']
            )
            ad_label.pack(anchor="w", pady=(2, 0))
        
        if low_confidence:
            warning_label = ctk.CTkLabel(
                header_container,
                text="⚠ Low confidence • verify manually",
                font=("SF Pro Text", 11, "bold"),
                text_color=COLORS['primary']
            )
            warning_label.pack(anchor="w", pady=(2, 0))
        
        if subtitle:
            subtitle_label = ctk.CTkLabel(
                header_container,
                text=subtitle,
                font=("SF Pro Text", 11),
                text_color=COLORS['text_light']
            )
            subtitle_label.pack(anchor="w", pady=(2, 0))
        
        return header_container
    
    def _render_clearcast_last_updated(self, header_container: ctk.CTkFrame):
        """Append the Clearcast rules freshness line under the shared header."""
        if not hasattr(self, "clearcast_last_updated_var"):
            return
        ctk.CTkLabel(
            header_container,
            textvariable=self.clearcast_last_updated_var,
            font=("SF Pro Text", 11),
            text_color=COLORS['text_light'],
        ).pack(anchor="w", pady=(2, 0))
    
    def _refresh_clearcast_last_updated_label(self):
        """Refresh the Clearcast freshness label from the updater."""
        if self.clearcast_updater:
            try:
                self.clearcast_last_updated_var.set(self.clearcast_updater.get_last_updated_text())
            except Exception as exc:
                logger.debug(f"Unable to refresh Clearcast timestamp: {exc}")
    
    def _get_video_display_name(self) -> str:
        """Resolve a friendly video name for ad labeling."""
        # Prefer analysis metadata if available
        analysis_id = getattr(self, 'current_analysis_id', None)
        if analysis_id:
            if analysis_id == 'sample':
                return "Sample Ad"
            try:
                analysis = self.storage.get_analysis(analysis_id)
                if analysis:
                    video_label = analysis.get('video_name') or analysis.get('title')
                    if video_label:
                        return Path(video_label).stem
            except Exception as e:
                logger.warning(f"Failed to resolve video name for analysis {analysis_id}: {e}")
        
        # Fallback to current video path if available
        video_path = getattr(self, 'current_video_path', None)
        if video_path:
            return Path(video_path).stem
        
        return ""
    
    def _format_filename_component(self, text: str) -> str:
        """Sanitize text so it can be embedded safely inside filenames."""
        if not text:
            return "Ad"
        safe = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
        return safe or "Ad"
    
    def _extract_ad_confidence(self, results: Optional[Dict]) -> Tuple[Optional[float], bool, List[str]]:
        """Extract identification confidence metadata from AI breakdown results."""
        confidence = None
        low_confidence = False
        alternatives: List[str] = []
        if isinstance(results, dict):
            breakdown = results.get('breakdown') or {}
            raw_confidence = breakdown.get('identification_confidence')
            if isinstance(raw_confidence, (int, float)):
                confidence = max(0.0, min(100.0, float(raw_confidence)))
                low_confidence = confidence < 70
            raw_alternatives = breakdown.get('possible_alternatives')
            if isinstance(raw_alternatives, list):
                alternatives = [str(alt).strip() for alt in raw_alternatives if str(alt).strip()]
        return confidence, low_confidence, alternatives
    
    def _download_clearcast_pdf(self, results: Dict, parent_frame: ctk.CTkFrame):
        """Download Clearcast compliance report as PDF"""
        try:
            # Get video metadata
            video_name = ""
            video_duration = 0.0
            thumbnail_base64 = None
            
            if hasattr(self, 'current_video_path') and self.current_video_path:
                video_name = Path(self.current_video_path).stem
                
                # Get video duration
                if MOVIEPY_AVAILABLE:
                    try:
                        clip = VideoFileClip(self.current_video_path)
                        video_duration = clip.duration
                        clip.close()
                    except Exception as e:
                        logger.warning(f"Could not get video duration: {e}")
            
            analysis_data = None
            if hasattr(self, 'storage') and self.storage:
                try:
                    if getattr(self, 'current_analysis_id', None):
                        analysis_data = self.storage.get_analysis(self.current_analysis_id)
                except Exception as e:
                    logger.warning(f"Could not load analysis data: {e}")
            if analysis_data and analysis_data.get('thumbnail_base64'):
                thumbnail_base64 = analysis_data['thumbnail_base64']
            
            fallback_video_name = video_name or self._get_video_display_name()
            if not video_name:
                video_name = fallback_video_name
            ad_name = resolve_ad_name(results or {}, fallback_video_name)
            safe_component = self._format_filename_component(ad_name)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_filename = f"CustomStories_Compliance_{safe_component}_{timestamp}.pdf"
            
            # Show save dialog
            file_path = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
                initialfile=default_filename,
                title="Save Clearcast Report PDF"
            )
            
            if not file_path:
                return  # User cancelled
            
            # Show loading notification
            self._show_notification("Generating PDF...", type="info", duration=2000)
            
            # Generate PDF in background thread
            def generate_pdf():
                try:
                    generator = ClearcastPDFGenerator()
                    success = generator.generate_pdf(
                        results=results,
                        video_name=video_name,
                        video_duration=video_duration,
                        thumbnail_base64=thumbnail_base64,
                        output_path=file_path
                    )
                    
                    if success:
                        self.root.after(0, lambda: self._show_notification(
                            f"✅ PDF saved: {Path(file_path).name}",
                            type="success",
                            duration=4000
                        ))
                    else:
                        self.root.after(0, lambda: self._show_notification(
                            "❌ Failed to generate PDF. Check logs for details.",
                            type="error",
                            duration=5000
                        ))
                except Exception as e:
                    logger.error(f"Error generating Clearcast PDF: {e}", exc_info=True)
                    error_msg = str(e)[:50]
                    self.root.after(0, lambda msg=error_msg: self._show_notification(
                        f"❌ Error: {msg}...",
                        type="error",
                        duration=5000
                    ))
            
            threading.Thread(target=generate_pdf, daemon=True).start()
            
        except Exception as e:
            logger.error(f"Error in _download_clearcast_pdf: {e}", exc_info=True)
            messagebox.showerror("Error", f"Failed to download PDF: {str(e)}")
    
    def _download_ai_breakdown_pdf(self, results: Dict, parent_frame: ctk.CTkFrame):
        """Download AI Breakdown report as PDF"""
        try:
            # Get video metadata
            video_name = ""
            video_duration = 0.0
            thumbnail_base64 = None
            
            if hasattr(self, 'current_video_path') and self.current_video_path:
                video_name = Path(self.current_video_path).stem
                
                # Get video duration
                if MOVIEPY_AVAILABLE:
                    try:
                        clip = VideoFileClip(self.current_video_path)
                        video_duration = clip.duration
                        clip.close()
                    except Exception as e:
                        logger.warning(f"Could not get video duration: {e}")
            
            analysis_data = None
            if hasattr(self, 'storage') and self.storage:
                try:
                    if getattr(self, 'current_analysis_id', None):
                        analysis_data = self.storage.get_analysis(self.current_analysis_id)
                except Exception as e:
                    logger.warning(f"Could not load analysis data: {e}")
            if analysis_data and analysis_data.get('thumbnail_base64'):
                thumbnail_base64 = analysis_data['thumbnail_base64']
            
            fallback_video_name = video_name or self._get_video_display_name()
            if not video_name:
                video_name = fallback_video_name
            ad_name = resolve_ad_name(results or {}, fallback_video_name)
            safe_component = self._format_filename_component(ad_name)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_filename = f"CustomStories_Report_{safe_component}_{timestamp}.pdf"
            
            # Show save dialog
            file_path = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
                initialfile=default_filename,
                title="Save AI Breakdown Report PDF"
            )
            
            if not file_path:
                return  # User cancelled
            
            # Show loading notification
            self._show_notification("Generating PDF...", type="info", duration=2000)
            
            # Generate PDF in background thread
            def generate_pdf():
                try:
                    generator = AIBreakdownPDFGenerator()
                    success = generator.generate_pdf(
                        results=results,
                        video_name=video_name,
                        video_duration=video_duration,
                        thumbnail_base64=thumbnail_base64,
                        output_path=file_path
                    )
                    
                    if success:
                        self.root.after(0, lambda: self._show_notification(
                            f"✅ PDF saved: {Path(file_path).name}",
                            type="success",
                            duration=4000
                        ))
                    else:
                        self.root.after(0, lambda: self._show_notification(
                            "❌ Failed to generate PDF. Check logs for details.",
                            type="error",
                            duration=5000
                        ))
                except Exception as e:
                    logger.error(f"Error generating AI Breakdown PDF: {e}", exc_info=True)
                    error_msg = str(e)[:50]
                    self.root.after(0, lambda msg=error_msg: self._show_notification(
                        f"❌ Error: {msg}...",
                        type="error",
                        duration=5000
                    ))
            
            threading.Thread(target=generate_pdf, daemon=True).start()
            
        except Exception as e:
            logger.error(f"Error in _download_ai_breakdown_pdf: {e}", exc_info=True)
            messagebox.showerror("Error", f"Failed to download PDF: {str(e)}")
        
    def run(self):
        """Run the application"""
        self.root.mainloop() 