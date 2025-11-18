# FILE: app/gui.py
"""GUI module for the gesture authentication system."""

import logging
import time
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional
import cv2
from PIL import Image, ImageTk
import numpy as np
from app.auth import AuthenticationManager
from app.config import (
    WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_TITLE,
    BG_COLOR, FG_COLOR, BUTTON_BG, BUTTON_FG,
    SUCCESS_COLOR, ERROR_COLOR, WARNING_COLOR, INFO_COLOR,
    ACCENT_COLOR, FRAME_BG, BORDER_COLOR,
    CAMERA_INDEX, CAMERA_WIDTH, CAMERA_HEIGHT,
    TARGET_FPS, DISPLAY_WIDTH, DISPLAY_HEIGHT,
    MIN_PASSWORD_LENGTH
)
# New imports for emotion tracker and speech analyzer
from tkinter import filedialog, Canvas, Scrollbar, Frame
from app.recognizers.emotion_tracker import EmotionTracker, ViewerReactionProfile
from app.recognizers.speech_analyzer import SpeechAnalyzer
import threading
import os

logger = logging.getLogger(__name__)


class ModernButton(tk.Button):
    """Modern styled button with hover effects."""
    
    def __init__(self, parent, **kwargs):
        # Set default modern styling
        kwargs.setdefault('bg', BUTTON_BG)
        kwargs.setdefault('fg', BUTTON_FG)
        kwargs.setdefault('activebackground', '#404040')
        kwargs.setdefault('activeforeground', BUTTON_FG)
        kwargs.setdefault('relief', tk.FLAT)
        kwargs.setdefault('font', ('Segoe UI', 10))
        kwargs.setdefault('cursor', 'hand2')
        kwargs.setdefault('padx', 20)
        kwargs.setdefault('pady', 10)
        
        super().__init__(parent, **kwargs)
        
        # Bind hover effects
        self.bind('<Enter>', self._on_enter)
        self.bind('<Leave>', self._on_leave)
        
    def _on_enter(self, e):
        self['bg'] = '#404040'
        
    def _on_leave(self, e):
        self['bg'] = BUTTON_BG


class GestureAuthGUI:
    """Main GUI for the gesture authentication system."""
    
    def __init__(self):
        """Initialize the GUI."""
        self.root = tk.Tk()
        self.root.title(WINDOW_TITLE)
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.root.configure(bg=BG_COLOR)
        self.root.resizable(True, True)
        
        # Set window icon (if available)
        try:
            self.root.iconbitmap(default='app/assets/icon.ico')
        except:
            pass
        
        # Initialize components
        self.auth_manager = AuthenticationManager()
        self.emotion_tracker = EmotionTracker()
        self.speech_analyzer = SpeechAnalyzer()
        self.camera = None
        self.is_running = False
        self.fps_counter = 0
        self.fps_start_time = time.time()
        self.current_fps = 0
        
        # Setup GUI elements
        self._setup_styles()
        self._create_header()
        self._setup_ui()
        self._setup_camera()
        
        # Bind close event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Start video loop
        self.is_running = True
        self.update_video()
    
    def _setup_styles(self):
        """Configure ttk styles for dark theme."""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Configure dark theme colors
        style.configure('TLabel', background=BG_COLOR, foreground=FG_COLOR, font=('Segoe UI', 10))
        style.configure('Title.TLabel', font=('Segoe UI', 24, 'bold'), foreground=ACCENT_COLOR)
        style.configure('Subtitle.TLabel', font=('Segoe UI', 11), foreground='#999999')
        style.configure('TFrame', background=BG_COLOR, relief=tk.FLAT)
        style.configure('Card.TFrame', background=FRAME_BG, relief=tk.FLAT)
        
        # Notebook styling
        style.configure('TNotebook', background=BG_COLOR, borderwidth=0)
        style.configure('TNotebook.Tab', 
                       background=BG_COLOR, 
                       foreground=FG_COLOR,
                       padding=[20, 12],
                       font=('Segoe UI', 10))
        style.map('TNotebook.Tab',
                  background=[('selected', FRAME_BG)],
                  foreground=[('selected', ACCENT_COLOR)])
        
        # Entry styling
        style.configure('TEntry', 
                       fieldbackground=FRAME_BG, 
                       borderwidth=1,
                       relief=tk.FLAT,
                       foreground=FG_COLOR)
        
        # Combobox styling
        style.configure('TCombobox', 
                       fieldbackground=FRAME_BG,
                       borderwidth=1,
                       relief=tk.FLAT,
                       foreground=FG_COLOR)
        
        # Progress bar styling
        style.configure('TProgressbar', 
                       background=ACCENT_COLOR,
                       troughcolor=FRAME_BG,
                       borderwidth=0,
                       lightcolor=ACCENT_COLOR,
                       darkcolor=ACCENT_COLOR)
    
    def _create_header(self):
        """Create application header."""
        header_frame = tk.Frame(self.root, bg=BG_COLOR, height=80)
        header_frame.pack(fill=tk.X, padx=20, pady=(20, 0))
        header_frame.pack_propagate(False)
        
        # Title
        title_label = ttk.Label(header_frame, text="AI Authentication & Analysis System", 
                               style='Title.TLabel')
        title_label.pack(anchor=tk.W)
        
        # Subtitle
        subtitle_label = ttk.Label(header_frame, 
                                  text="Secure authentication with gesture recognition • Emotion tracking • Speech analysis",
                                  style='Subtitle.TLabel')
        subtitle_label.pack(anchor=tk.W, pady=(5, 0))
        
        # Separator
        separator = tk.Frame(self.root, bg=BORDER_COLOR, height=1)
        separator.pack(fill=tk.X, padx=20, pady=(20, 0))
    
    def _setup_ui(self):
        """Setup the user interface."""
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Left side - Video feed
        video_container = ttk.Frame(main_frame, style='Card.TFrame')
        video_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Video frame with rounded corners effect
        video_frame = tk.Frame(video_container, bg=FRAME_BG)
        video_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # Video label
        self.video_label = tk.Label(video_frame, bg='black', text="Initializing camera...", 
                                   fg='#666666', font=('Segoe UI', 12))
        self.video_label.pack(fill=tk.BOTH, expand=True)
        
        # Right side - Controls
        control_container = ttk.Frame(main_frame, width=380)
        control_container.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(20, 0))
        control_container.pack_propagate(False)
        
        # Notebook for tabs with custom styling
        self.notebook = ttk.Notebook(control_container)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Create tabs
        self._create_auth_tab()
        self._create_emotion_tab()
        self._create_speech_tab()
        
        # Status bar at bottom
        self._create_status_bar()
    
    def _setup_camera(self):
        """Initialize camera capture."""
        self.camera = cv2.VideoCapture(CAMERA_INDEX)
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
        self.camera.set(cv2.CAP_PROP_FPS, TARGET_FPS)
        
        if not self.camera.isOpened():
            logger.error("Failed to open camera")
            messagebox.showerror("Camera Error", "Failed to open camera!")
    
    def update_video(self):
        """Update video feed."""
        if not self.is_running:
            return
        
        # Check if we're playing a video for emotion analysis
        if hasattr(self, 'video_playing') and self.video_playing and hasattr(self, 'emotion_tracker'):
            # Update main display with video frame
            video_frame = self.emotion_tracker.get_video_frame()
            if video_frame is not None:
                # Resize for main display
                video_frame = cv2.resize(video_frame, (DISPLAY_WIDTH, DISPLAY_HEIGHT))
                
                # Convert to RGB and then to PIL Image
                frame_rgb = cv2.cvtColor(video_frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(frame_rgb)
                imgtk = ImageTk.PhotoImage(image=img)
                
                # Update main video label
                self.video_label.imgtk = imgtk
                self.video_label.configure(image=imgtk)
            
            # Update webcam display if exists
            if hasattr(self, 'webcam_label'):
                webcam_frame = self.emotion_tracker.get_webcam_frame()
                if webcam_frame is not None:
                    # Resize webcam for smaller display
                    webcam_frame = cv2.resize(webcam_frame, (200, 150))
                    
                    # Convert to RGB and then to PIL Image
                    frame_rgb = cv2.cvtColor(webcam_frame, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(frame_rgb)
                    imgtk = ImageTk.PhotoImage(image=img)
                    
                    # Update webcam label
                    self.webcam_label.imgtk = imgtk
                    self.webcam_label.configure(image=imgtk)
        else:
            # Normal webcam display for authentication
            ret, frame = self.camera.read()
            if ret:
                # Process frame for authentication
                if self.auth_manager.is_recording:
                    detected_token, liveness_passed, token_added = self.auth_manager.process_frame(frame)
                    
                    # Update token displays
                    if token_added:
                        self.update_token_display()
                
                # Draw overlay
                frame = self.auth_manager.draw_overlay(frame)
                
                # Resize for display
                frame = cv2.resize(frame, (DISPLAY_WIDTH, DISPLAY_HEIGHT))
                
                # Convert to RGB and then to PIL Image
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(frame_rgb)
                imgtk = ImageTk.PhotoImage(image=img)
                
                # Update label
                self.video_label.imgtk = imgtk
                self.video_label.configure(image=imgtk)
                
                # Update FPS
                self.update_fps()
        
        # Schedule next update
        self.root.after(int(1000 / TARGET_FPS), self.update_video)
    
    def update_fps(self):
        """Update FPS counter."""
        self.fps_counter += 1
        current_time = time.time()
        
        if current_time - self.fps_start_time >= 1.0:
            self.current_fps = self.fps_counter
            self.fps_counter = 0
            self.fps_start_time = current_time
            
            # Update FPS in status bar
            if hasattr(self, 'fps_label'):
                self.fps_label.config(text=f"FPS: {self.current_fps}")
    
    def update_token_display(self):
        """Update the token display in both tabs."""
        tokens = self.auth_manager.captured_tokens
        
        # Update enroll tab
        self.tokens_text.config(state=tk.NORMAL)
        self.tokens_text.delete(1.0, tk.END)
        for i, token in enumerate(tokens, 1):
            self.tokens_text.insert(tk.END, f"{i}. {token}\n")
        self.tokens_text.config(state=tk.DISABLED)
        
        # Update verify tab
        self.verify_tokens_text.config(state=tk.NORMAL)
        self.verify_tokens_text.delete(1.0, tk.END)
        for i, token in enumerate(tokens, 1):
            self.verify_tokens_text.insert(tk.END, f"{i}. {token}\n")
        self.verify_tokens_text.config(state=tk.DISABLED)
    
    def on_closing(self):
        """Handle window closing."""
        self.is_running = False
        
        # Stop any ongoing video playback
        if hasattr(self, 'video_playing') and self.video_playing:
            self.emotion_tracker.stop_analysis()
        
        # Cleanup emotion tracker
        self.emotion_tracker.cleanup()
        
        if self.camera:
            self.camera.release()
        
        self.auth_manager.close()
        cv2.destroyAllWindows()
        self.root.destroy()
    
    def run(self):
        """Start the GUI main loop."""
        logger.info("Starting Gesture Authentication GUI")
        self.root.mainloop()
    
    def _create_auth_tab(self):
        """Create authentication tab."""
        self.auth_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.auth_frame, text="🔐 Authentication")
        
        # Create sub-notebook for enroll/verify
        self.auth_notebook = ttk.Notebook(self.auth_frame)
        self.auth_notebook.pack(fill=tk.BOTH, expand=True)
        
        # Enroll tab
        self.enroll_frame = ttk.Frame(self.auth_notebook)
        self.auth_notebook.add(self.enroll_frame, text="Enroll")
        self._setup_enroll_tab()
        
        # Unlock tab
        self.unlock_frame = ttk.Frame(self.auth_notebook)
        self.auth_notebook.add(self.unlock_frame, text="Verify")
        self._setup_unlock_tab()
        
        # Token reference at bottom
        self._setup_token_reference(self.auth_frame)
    
    def _create_emotion_tab(self):
        """Create emotion tracker tab."""
        self.emotion_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.emotion_frame, text="🎭 Emotions")
        self._setup_emotion_tab()
    
    def _create_speech_tab(self):
        """Create speech analysis tab."""
        self.speech_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.speech_frame, text="🎤 Speech")
        self._setup_speech_tab()
    
    def _create_status_bar(self):
        """Create status bar at bottom."""
        status_frame = tk.Frame(self.root, bg=FRAME_BG, height=30)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        status_frame.pack_propagate(False)
        
        # FPS counter
        self.fps_label = ttk.Label(status_frame, text="FPS: 0", 
                                  font=('Segoe UI', 9), foreground='#999999')
        self.fps_label.pack(side=tk.RIGHT, padx=20)
        
        # Status text
        self.status_label = ttk.Label(status_frame, text="Ready", 
                                     font=('Segoe UI', 9), foreground='#999999')
        self.status_label.pack(side=tk.LEFT, padx=20)
    
    def _setup_enroll_tab(self):
        """Setup the enrollment tab."""
        # Main container with padding
        container = ttk.Frame(self.enroll_frame, style='Card.TFrame')
        container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Username entry
        username_frame = ttk.Frame(container, style='Card.TFrame')
        username_frame.pack(fill=tk.X, pady=(0, 20))
        
        ttk.Label(username_frame, text="Username:", font=('Segoe UI', 11, 'bold')).pack(anchor=tk.W)
        self.username_entry = ttk.Entry(username_frame, font=('Segoe UI', 12))
        self.username_entry.pack(fill=tk.X, pady=(5, 0))
        
        # Start/Stop recording buttons
        button_frame = ttk.Frame(container, style='Card.TFrame')
        button_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.start_record_btn = ModernButton(
            button_frame, text="🔴 Start Recording",
            command=self.start_enrollment,
            bg=ACCENT_COLOR
        )
        self.start_record_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.stop_record_btn = ModernButton(
            button_frame, text="⏹ Stop Recording",
            command=self.stop_enrollment,
            state=tk.DISABLED
        )
        self.stop_record_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        # Save button
        self.save_profile_btn = ModernButton(
            container, text="💾 Save Profile",
            command=self.save_profile,
            state=tk.DISABLED,
            bg=SUCCESS_COLOR
        )
        self.save_profile_btn.pack(pady=(0, 20))
        
        # Captured tokens display
        tokens_frame = ttk.Frame(container, style='Card.TFrame')
        tokens_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(tokens_frame, text="Captured Tokens:", font=('Segoe UI', 11, 'bold')).pack(anchor=tk.W)
        
        # Frame for text and scrollbar
        text_scroll_frame = ttk.Frame(tokens_frame)
        text_scroll_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))

        self.tokens_text = tk.Text(
            text_scroll_frame, height=6, width=30,
            bg=FRAME_BG, fg=FG_COLOR, font=('Consolas', 10),
            relief=tk.FLAT, state=tk.DISABLED, wrap=tk.WORD
        )
        self.tokens_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = ttk.Scrollbar(text_scroll_frame, command=self.tokens_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tokens_text['yscrollcommand'] = scrollbar.set
        
        # Status label
        self.enroll_status = ttk.Label(
            container, text="", foreground=WARNING_COLOR
        )
        self.enroll_status.pack(pady=(10, 0))
    
    def _setup_unlock_tab(self):
        """Setup the unlock/verification tab."""
        # Main container
        container = ttk.Frame(self.unlock_frame, style='Card.TFrame')
        container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # User selection
        user_frame = ttk.Frame(container, style='Card.TFrame')
        user_frame.pack(fill=tk.X, pady=(0, 20))
        
        ttk.Label(user_frame, text="Select User:", font=('Segoe UI', 11, 'bold')).pack(anchor=tk.W)
        self.user_combo = ttk.Combobox(
            user_frame, state='readonly', font=('Segoe UI', 12)
        )
        self.user_combo.pack(fill=tk.X, pady=(5, 0))
        self.refresh_users()
        
        # Start verification button
        self.start_verify_btn = ModernButton(
            container, text="🔓 Start Verification",
            command=self.start_verification,
            bg=INFO_COLOR, font=('Segoe UI', 12, 'bold')
        )
        self.start_verify_btn.pack(pady=20)
        
        # Captured tokens display
        verify_tokens_frame = ttk.Frame(container, style='Card.TFrame')
        verify_tokens_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 20))
        
        ttk.Label(verify_tokens_frame, text="Captured Tokens:", font=('Segoe UI', 11, 'bold')).pack(anchor=tk.W)
        
        # Frame for text and scrollbar
        verify_text_scroll_frame = ttk.Frame(verify_tokens_frame)
        verify_text_scroll_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        self.verify_tokens_text = tk.Text(
            verify_text_scroll_frame, height=6, width=30,
            bg=FRAME_BG, fg=FG_COLOR, font=('Consolas', 10),
            relief=tk.FLAT, state=tk.DISABLED, wrap=tk.WORD
        )
        self.verify_tokens_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(verify_text_scroll_frame, command=self.verify_tokens_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.verify_tokens_text['yscrollcommand'] = scrollbar.set
        
        # Result label
        self.verify_result = tk.Label(
            container, text="", font=('Segoe UI', 24, 'bold'),
            bg=BG_COLOR
        )
        self.verify_result.pack(pady=20)
    
    def _setup_emotion_tab(self):
        """Setup the emotion tracker tab."""
        # Create a container that can switch between video and results
        self.emotion_main_container = ttk.Frame(self.emotion_frame)
        self.emotion_main_container.pack(fill=tk.BOTH, expand=True)
        
        # Control frame for buttons and info
        control_frame = ttk.Frame(self.emotion_main_container, style='Card.TFrame')
        control_frame.pack(fill=tk.X, padx=10, pady=(10, 5))
        
        # Top section - Upload and control buttons
        top_frame = ttk.Frame(control_frame, style='Card.TFrame')
        top_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Upload button on the left
        self.upload_video_btn = ModernButton(
            top_frame, text="📁 Upload Video",
            command=self.upload_video_for_emotion,
            bg=INFO_COLOR
        )
        self.upload_video_btn.pack(side=tk.LEFT)
        
        # Control buttons frame on the right to ensure they're always visible
        controls_frame = ttk.Frame(top_frame, style='Card.TFrame')
        controls_frame.pack(side=tk.RIGHT)
        
        self.play_pause_btn = ModernButton(
            controls_frame, text="▶ Play",
            command=self.toggle_video_playback,
            state=tk.DISABLED,
            bg=SUCCESS_COLOR
        )
        self.play_pause_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.stop_analysis_btn = ModernButton(
            controls_frame, text="⏹ Stop & Analyze",
            command=self.stop_emotion_analysis,
            state=tk.DISABLED,
            bg=WARNING_COLOR
        )
        self.stop_analysis_btn.pack(side=tk.LEFT)
        
        # Video info label in the middle with max width
        self.video_info_label = ttk.Label(
            top_frame, text="No video loaded", 
            width=30  # Fixed width to prevent overflow
        )
        self.video_info_label.pack(side=tk.LEFT, padx=(10, 10), fill=tk.X, expand=True)
        
        # Progress label
        self.emotion_progress = ttk.Label(
            control_frame, text="", foreground=INFO_COLOR
        )
        self.emotion_progress.pack(pady=5)
        
        # Info frame for progress and current emotion
        info_frame = ttk.Frame(self.emotion_main_container, style='Card.TFrame')
        info_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Current emotion display
        current_frame = ttk.LabelFrame(info_frame, text="Current Emotion", padding=10)
        current_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        self.current_emotion_label = tk.Label(
            current_frame, text="Not detecting", 
            font=('Segoe UI', 16, 'bold'), bg=BG_COLOR, fg=FG_COLOR
        )
        self.current_emotion_label.pack()
        
        # Results area - takes up main space
        results_container = ttk.LabelFrame(self.emotion_main_container, text="Analysis Results", padding=5)
        results_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        # Canvas for scrollable results
        self.emotion_canvas = Canvas(
            results_container, bg=FRAME_BG, highlightthickness=0
        )
        scrollbar = Scrollbar(results_container, orient="vertical", command=self.emotion_canvas.yview)
        self.emotion_scrollable_frame = Frame(self.emotion_canvas, bg=FRAME_BG)
        
        self.emotion_scrollable_frame.bind(
            "<Configure>",
            lambda e: self.emotion_canvas.configure(scrollregion=self.emotion_canvas.bbox("all"))
        )
        
        self.emotion_canvas.create_window((0, 0), window=self.emotion_scrollable_frame, anchor="nw")
        self.emotion_canvas.configure(yscrollcommand=scrollbar.set)
        
        self.emotion_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Storage for analysis results
        self.emotion_results = {}
        self.current_video_path = None
        self.video_playing = False
        
        # Webcam display frame (initially hidden)
        self.webcam_frame = ttk.LabelFrame(info_frame, text="Your Reaction", padding=5)
        self.webcam_label = tk.Label(self.webcam_frame, bg='black')
        self.webcam_label.pack()
    
    def _setup_speech_tab(self):
        """Setup the speech analysis tab."""
        # Main container
        container = ttk.Frame(self.speech_frame, style='Card.TFrame')
        container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Recording controls
        record_frame = ttk.Frame(container, style='Card.TFrame')
        record_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.start_speech_btn = ModernButton(
            record_frame, text="🔴 Start Recording",
            command=self.start_speech_recording,
            bg=ERROR_COLOR
        )
        self.start_speech_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.stop_speech_btn = ModernButton(
            record_frame, text="⏹ Stop & Analyze",
            command=self.stop_speech_recording,
            state=tk.DISABLED,
            bg=WARNING_COLOR
        )
        self.stop_speech_btn.pack(side=tk.LEFT)
        
        # Recording status
        self.speech_status = ttk.Label(
            container, text="Ready to record", foreground=INFO_COLOR
        )
        self.speech_status.pack(pady=10)
        
        # Session info frame
        session_frame = ttk.LabelFrame(container, text="Current Session", padding=10)
        session_frame.pack(fill=tk.X, pady=10)
        
        # Frame for text and scrollbar
        session_text_frame = ttk.Frame(session_frame)
        session_text_frame.pack(fill=tk.X, expand=True)

        self.session_info = tk.Text(
            session_text_frame, height=4, width=40,
            bg=FRAME_BG, fg=FG_COLOR, font=('Consolas', 10),
            relief=tk.FLAT, state=tk.DISABLED, wrap=tk.WORD
        )
        self.session_info.pack(side=tk.LEFT, fill=tk.X, expand=True)

        scrollbar = ttk.Scrollbar(session_text_frame, command=self.session_info.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.session_info['yscrollcommand'] = scrollbar.set
        
        # Clips frame with scrollbar
        clips_frame = ttk.LabelFrame(container, text="Speech Clips", padding=10)
        clips_frame.pack(fill=tk.BOTH, expand=True)
        
        # Canvas for scrollable clips
        self.speech_canvas = Canvas(
            clips_frame, bg=FRAME_BG, highlightthickness=0
        )
        scrollbar = Scrollbar(clips_frame, orient="vertical", command=self.speech_canvas.yview)
        self.speech_scrollable_frame = Frame(self.speech_canvas, bg=FRAME_BG)
        
        self.speech_scrollable_frame.bind(
            "<Configure>",
            lambda e: self.speech_canvas.configure(scrollregion=self.speech_canvas.bbox("all"))
        )
        
        self.speech_canvas.create_window((0, 0), window=self.speech_scrollable_frame, anchor="nw")
        self.speech_canvas.configure(yscrollcommand=scrollbar.set)
        
        self.speech_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Storage for speech analysis
        self.speech_results = []
        self.current_session = None
    
    def _setup_token_reference(self, parent):
        """Setup token reference display."""
        ref_frame = ttk.LabelFrame(parent, text="Available Tokens", padding=10)
        ref_frame.pack(fill=tk.X, pady=(10, 0), padx=20)
        
        # Create two columns
        cols_frame = ttk.Frame(ref_frame)
        cols_frame.pack()
        
        # Hand gestures column
        hand_frame = ttk.Frame(cols_frame)
        hand_frame.pack(side=tk.LEFT, padx=20)
        ttk.Label(hand_frame, text="✋ Hand Gestures", 
                 font=('Segoe UI', 10, 'bold'), foreground=ACCENT_COLOR).pack()
        for g in ["THUMBS_UP", "VICTORY", "OPEN_PALM", "OK_SIGN", "FIST"]:
            ttk.Label(hand_frame, text=f"• {g}", font=('Segoe UI', 9)).pack(anchor=tk.W)
        
        # Face expressions column
        face_frame = ttk.Frame(cols_frame)
        face_frame.pack(side=tk.LEFT, padx=20)
        ttk.Label(face_frame, text="😊 Face Expressions", 
                 font=('Segoe UI', 10, 'bold'), foreground=ACCENT_COLOR).pack()
        for e in ["SMILE", "NEUTRAL", "RAISE_EYEBROWS"]:
            ttk.Label(face_frame, text=f"• {e}", font=('Segoe UI', 9)).pack(anchor=tk.W)
    
    # Authentication methods
    def start_enrollment(self):
        """Start enrollment process."""
        username = self.username_entry.get().strip()
        if not username:
            messagebox.showwarning("Invalid Input", "Please enter a username!")
            return
        
        # Clear previous tokens
        self.auth_manager.start_recording()
        self.update_token_display()
        
        # Update UI
        self.start_record_btn.config(state=tk.DISABLED)
        self.stop_record_btn.config(state=tk.NORMAL)
        self.username_entry.config(state=tk.DISABLED)
        self.enroll_status.config(text="Recording... Make gestures/expressions", foreground=INFO_COLOR)
        
        logger.info(f"Started enrollment for user: {username}")
    
    def stop_enrollment(self):
        """Stop enrollment recording."""
        self.auth_manager.stop_recording()
        
        # Update UI
        self.start_record_btn.config(state=tk.NORMAL)
        self.stop_record_btn.config(state=tk.DISABLED)
        self.username_entry.config(state=tk.NORMAL)
        
        if len(self.auth_manager.captured_tokens) >= MIN_PASSWORD_LENGTH:
            self.save_profile_btn.config(state=tk.NORMAL)
            self.enroll_status.config(text=f"Captured {len(self.auth_manager.captured_tokens)} tokens. Ready to save!", 
                                    foreground=SUCCESS_COLOR)
        else:
            self.enroll_status.config(text=f"Need at least {MIN_PASSWORD_LENGTH} tokens!", 
                                    foreground=ERROR_COLOR)
    
    def save_profile(self):
        """Save user profile."""
        username = self.username_entry.get().strip()
        if not username:
            return
        
        success = self.auth_manager.save_profile(username)
        if success:
            messagebox.showinfo("Success", f"Profile saved for {username}!")
            self.username_entry.delete(0, tk.END)
            self.save_profile_btn.config(state=tk.DISABLED)
            self.enroll_status.config(text="Profile saved successfully!", foreground=SUCCESS_COLOR)
            self.refresh_users()
            self.update_token_display()
        else:
            messagebox.showerror("Error", "Failed to save profile!")
    
    def refresh_users(self):
        """Refresh the user list in verification tab."""
        users = self.auth_manager.storage.get_usernames()
        self.user_combo['values'] = users
        if users and not self.user_combo.get():
            self.user_combo.current(0)
    
    def start_verification(self):
        """Start verification process."""
        selected_user = self.user_combo.get()
        if not selected_user:
            messagebox.showwarning("No User", "Please select a user!")
            return
        
        # Load user profile
        if not self.auth_manager.load_profile(selected_user):
            messagebox.showerror("Error", "Failed to load user profile!")
            return
        
        # Start recording
        self.auth_manager.start_recording()
        self.update_token_display()
        
        # Update UI
        self.start_verify_btn.config(state=tk.DISABLED)
        self.verify_result.config(text="Verifying...", fg=WARNING_COLOR)
        
        # Start verification check
        self.check_verification()
    
    def check_verification(self):
        """Check if verification is complete."""
        if not self.auth_manager.is_recording:
            return
        
        if self.auth_manager.verify_password():
            # Success
            self.auth_manager.stop_recording()
            self.verify_result.config(text="✅ VERIFIED", fg=SUCCESS_COLOR)
            self.start_verify_btn.config(state=tk.NORMAL)
            messagebox.showinfo("Success", "Authentication successful!")
        elif len(self.auth_manager.captured_tokens) >= len(self.auth_manager.current_password):
            # Failed
            self.auth_manager.stop_recording()
            self.verify_result.config(text="❌ FAILED", fg=ERROR_COLOR)
            self.start_verify_btn.config(state=tk.NORMAL)
            messagebox.showerror("Failed", "Authentication failed!")
        else:
            # Continue checking
            self.root.after(100, self.check_verification)
    
    # Emotion analysis methods
    def upload_video_for_emotion(self):
        """Upload video for emotion analysis."""
        file_path = filedialog.askopenfilename(
            title="Select Video",
            filetypes=[("Video files", "*.mp4 *.avi *.mov *.mkv")]
        )
        
        if file_path:
            self.current_video_path = file_path
            # Truncate filename if too long
            filename = os.path.basename(file_path)
            if len(filename) > 25:
                filename = filename[:22] + "..."
            self.video_info_label.config(text=f"Loaded: {filename}")
            self.play_pause_btn.config(state=tk.NORMAL)
            self.emotion_progress.config(text="Video loaded. Click Play to start analysis.")
            
            # Reset previous results
            self.emotion_results = {}
            for widget in self.emotion_scrollable_frame.winfo_children():
                widget.destroy()
            
            # Reset video label and hide results
            self.video_label.configure(image='', text="Ready to play video", 
                                     fg='#666666', font=('Segoe UI', 12))
            self.webcam_frame.pack_forget()
    
    def toggle_video_playback(self):
        """Toggle video playback and analysis."""
        if not self.current_video_path:
            return
        
        if not self.video_playing:
            # Start playback and analysis
            self.video_playing = True
            self.play_pause_btn.config(text="⏸ Pause")
            self.stop_analysis_btn.config(state=tk.NORMAL)
            self.emotion_progress.config(text="Analyzing emotions...")
            
            # Show webcam in sidebar
            self.webcam_frame.pack(side=tk.RIGHT, padx=10, pady=5)
            
            # Hide results area during playback
            for widget in self.emotion_scrollable_frame.winfo_children():
                widget.destroy()
            
            # Start emotion tracking with transcription
            self.emotion_tracker.start_analysis(
                self.current_video_path,
                self.on_emotion_update,
                self.on_analysis_complete,
                enable_transcription=True  # Enable transcription feature
            )
        else:
            # Pause playback
            self.video_playing = False
            self.play_pause_btn.config(text="▶ Play")
            self.emotion_tracker.pause_analysis()
    
    def stop_emotion_analysis(self):
        """Stop emotion analysis and show results."""
        self.video_playing = False
        self.play_pause_btn.config(text="▶ Play", state=tk.NORMAL)
        self.stop_analysis_btn.config(state=tk.DISABLED)
        
        # Hide webcam frame
        self.webcam_frame.pack_forget()
        
        self.emotion_tracker.stop_analysis()
        self.emotion_progress.config(text="Analysis complete!")
        
        # The results will be shown in on_analysis_complete callback
    
    def on_emotion_update(self, emotion_data):
        """Handle emotion update during analysis."""
        if emotion_data and 'emotion' in emotion_data:
            self.current_emotion_label.config(text=emotion_data['emotion'])
    
    def on_analysis_complete(self, results):
        """Handle completion of emotion analysis."""
        self.emotion_results = results
        
        # Hide webcam frame
        self.webcam_frame.pack_forget()
        
        # Clear video display and show a completion message
        self.video_label.configure(image=None, text="Analysis Complete - See Results Below", 
                                 fg=SUCCESS_COLOR, font=('Segoe UI', 16, 'bold'))
        self.video_label.image = None
        
        self.display_emotion_results()
    
    def display_emotion_results(self):
        """Display emotion analysis results with transcription."""
        # Clear previous results
        for widget in self.emotion_scrollable_frame.winfo_children():
            widget.destroy()
        
        if not self.emotion_results:
            return
        
        # Create a main results container with better spacing
        main_results = ttk.Frame(self.emotion_scrollable_frame)
        main_results.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Summary section with larger font
        summary_frame = ttk.LabelFrame(main_results, text="📊 Summary", padding=15)
        summary_frame.pack(fill=tk.X, padx=5, pady=5)
        
        summary_text = f"Total Duration: {self.emotion_results.get('duration', 0):.1f}s\n"
        summary_text += f"Emotions Detected: {len(self.emotion_results.get('timeline', []))}\n"
        
        if 'emotion_summary' in self.emotion_results:
            summary_text += "\nEmotion Distribution:\n"
            for emotion, percentage in self.emotion_results['emotion_summary'].items():
                summary_text += f"  {emotion}: {percentage:.1f}%\n"
        
        ttk.Label(summary_frame, text=summary_text, font=('Consolas', 12)).pack(anchor=tk.W)
        
        # Transcription section with trigger words
        if 'transcription' in self.emotion_results:
            trans_frame = ttk.LabelFrame(main_results, text="📝 Transcription & Content Improvement Suggestions", padding=15)
            trans_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
            
            # Add instruction label
            instruction_label = ttk.Label(trans_frame, 
                text="💡 Hover over highlighted words to see content rewording suggestions",
                font=('Segoe UI', 9, 'italic'), foreground=INFO_COLOR)
            instruction_label.pack(anchor=tk.W, pady=(0, 5))
            
            # Frame for text and scrollbar
            trans_text_frame = ttk.Frame(trans_frame)
            trans_text_frame.pack(fill=tk.BOTH, expand=True)
            
            # Create text widget for transcription
            trans_text = tk.Text(trans_text_frame, height=15, wrap=tk.WORD, 
                               bg=FRAME_BG, fg=FG_COLOR, font=('Segoe UI', 11))
            trans_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

            scrollbar = ttk.Scrollbar(trans_text_frame, command=trans_text.yview)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            trans_text['yscrollcommand'] = scrollbar.set
            
            # Insert transcription with highlighted trigger words
            transcription = self.emotion_results['transcription']
            if 'trigger_words' in self.emotion_results:
                # Add transcription with highlights
                self._insert_highlighted_text(trans_text, transcription, 
                                            self.emotion_results['trigger_words'])
            else:
                trans_text.insert(tk.END, transcription)
            
            trans_text.config(state=tk.DISABLED)
        
        # Timeline section
        timeline_frame = ttk.LabelFrame(main_results, text="⏰ Emotion Timeline", padding=10)
        timeline_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Create timeline visualization
        for event in self.emotion_results.get('timeline', [])[:20]:  # Show first 20 events
            event_frame = tk.Frame(timeline_frame, bg=FRAME_BG, relief=tk.RIDGE, bd=1)
            event_frame.pack(fill=tk.X, pady=2)
            
            time_label = ttk.Label(event_frame, text=f"{event['timestamp']:.1f}s", 
                                 font=('Consolas', 9), width=8)
            time_label.pack(side=tk.LEFT, padx=5)
            
            emotion_label = ttk.Label(event_frame, text=event['emotion'], 
                                    font=('Segoe UI', 10, 'bold'))
            emotion_label.pack(side=tk.LEFT, padx=5)
            
            if 'confidence' in event:
                conf_label = ttk.Label(event_frame, text=f"({event['confidence']:.0%})", 
                                     font=('Segoe UI', 9), foreground='#999999')
                conf_label.pack(side=tk.LEFT)
    
    def _insert_highlighted_text(self, text_widget, content, trigger_words):
        """Insert text with highlighted trigger words and tooltips."""
        # Configure tags for highlighting
        text_widget.tag_configure("trigger", background="#4a4a00", foreground="#ffff00")
        text_widget.tag_configure("hover", background="#666600", foreground="#ffffff")
        
        # Process content word by word
        words = content.split()
        for i, word in enumerate(words):
            clean_word = word.lower().strip('.,!?;:"')
            
            if any(trigger in clean_word for trigger in trigger_words.keys()):
                # This is a trigger word
                start_pos = text_widget.index("insert")
                text_widget.insert(tk.END, word)
                end_pos = text_widget.index("insert")
                
                # Add tag for highlighting
                text_widget.tag_add("trigger", start_pos, end_pos)
                
                # Find the matching trigger info
                for trigger, info in trigger_words.items():
                    if trigger in clean_word:
                        # Create tooltip binding
                        tag_name = f"trigger_{i}"
                        text_widget.tag_add(tag_name, start_pos, end_pos)
                        
                        # Bind hover events
                        text_widget.tag_bind(tag_name, "<Enter>", 
                            lambda e, info=info: self._show_trigger_tooltip(e, info))
                        text_widget.tag_bind(tag_name, "<Leave>", 
                            lambda e: self._hide_trigger_tooltip())
                        
                        # Change cursor on hover
                        text_widget.tag_bind(tag_name, "<Enter>", 
                            lambda e: text_widget.config(cursor="hand2"), add="+")
                        text_widget.tag_bind(tag_name, "<Leave>", 
                            lambda e: text_widget.config(cursor=""), add="+")
                        break
            else:
                text_widget.insert(tk.END, word)
            
            # Add space after word
            if i < len(words) - 1:
                text_widget.insert(tk.END, " ")
        
        # Create tooltip window
        self.tooltip = None
    
    def _show_trigger_tooltip(self, event, info):
        """Show tooltip with recommendations for trigger word."""
        x, y, _, _ = event.widget.bbox("insert")
        x += event.widget.winfo_rootx()
        y += event.widget.winfo_rooty() + 25
        
        # Create tooltip window
        self.tooltip = tk.Toplevel(self.root)
        self.tooltip.wm_overrideredirect(True)
        self.tooltip.wm_geometry(f"+{x}+{y}")
        
        # Tooltip content
        tooltip_frame = tk.Frame(self.tooltip, bg="#333333", relief=tk.SOLID, bd=1)
        tooltip_frame.pack()
        
        # Emotion association
        emotion_label = tk.Label(tooltip_frame, text=f"Triggers: {info['emotion']} emotion", 
                               bg="#333333", fg="#ffffff", font=('Segoe UI', 10, 'bold'))
        emotion_label.pack(anchor=tk.W, padx=5, pady=(5, 0))
        
        # Recommendations
        rec_label = tk.Label(tooltip_frame, text="Content Rewording Suggestions:", 
                           bg="#333333", fg="#aaaaaa", font=('Segoe UI', 9))
        rec_label.pack(anchor=tk.W, padx=5, pady=(5, 0))
        
        for rec in info.get('recommendations', []):
            rec_text = tk.Label(tooltip_frame, text=f"• {rec}", 
                              bg="#333333", fg="#ffffff", font=('Segoe UI', 9),
                              wraplength=250, justify=tk.LEFT)
            rec_text.pack(anchor=tk.W, padx=15, pady=2)
    
    def _hide_trigger_tooltip(self):
        """Hide the trigger word tooltip."""
        if self.tooltip:
            self.tooltip.destroy()
            self.tooltip = None
    
    # Speech analysis methods
    def start_speech_recording(self):
        """Start speech recording and analysis."""
        self.start_speech_btn.config(state=tk.DISABLED)
        self.stop_speech_btn.config(state=tk.NORMAL)
        self.speech_status.config(text="Recording... Speak clearly", foreground=ERROR_COLOR)
        
        # Clear previous session info
        self.session_info.config(state=tk.NORMAL)
        self.session_info.delete(1.0, tk.END)
        self.session_info.insert(tk.END, "Recording in progress...\n")
        self.session_info.config(state=tk.DISABLED)
        
        # Start speech analyzer
        self.speech_analyzer.start_recording(self.on_speech_clip_ready)
    
    def stop_speech_recording(self):
        """Stop speech recording."""
        self.start_speech_btn.config(state=tk.NORMAL)
        self.stop_speech_btn.config(state=tk.DISABLED)
        self.speech_status.config(text="Processing...", foreground=WARNING_COLOR)
        
        # Stop recording
        session_data = self.speech_analyzer.stop_recording()
        
        if session_data:
            self.current_session = session_data
            self.display_session_summary()
            self.speech_status.config(text="Analysis complete!", foreground=SUCCESS_COLOR)
        else:
            self.speech_status.config(text="No speech detected", foreground=ERROR_COLOR)
    
    def on_speech_clip_ready(self, clip_data):
        """Handle when a speech clip is analyzed."""
        if not clip_data:
            return
        
        # Add to results
        self.speech_results.append(clip_data)
        
        # Create clip display
        self.add_speech_clip_display(clip_data)
        
        # Update session info
        self.update_session_info()
    
    def add_speech_clip_display(self, clip_data):
        """Add a speech clip to the display."""
        clip_frame = tk.Frame(self.speech_scrollable_frame, bg=FRAME_BG, relief=tk.RIDGE, bd=1)
        clip_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Timestamp
        time_label = ttk.Label(clip_frame, text=f"[{clip_data['timestamp']}]", 
                             font=('Consolas', 9), foreground='#999999')
        time_label.pack(anchor=tk.W, padx=5, pady=(5, 0))
        
        # Transcription
        if 'transcription' in clip_data:
            trans_label = ttk.Label(clip_frame, text=f'"{clip_data["transcription"]}"', 
                                  font=('Segoe UI', 10), wraplength=300)
            trans_label.pack(anchor=tk.W, padx=5, pady=(2, 0))
        
        # Sentiment
        if 'sentiment' in clip_data:
            sent_text = f"Sentiment: {clip_data['sentiment']['label']} "
            sent_text += f"({clip_data['sentiment']['score']:.0%})"
            sent_label = ttk.Label(clip_frame, text=sent_text, 
                                 font=('Segoe UI', 9), foreground=INFO_COLOR)
            sent_label.pack(anchor=tk.W, padx=5, pady=(2, 5))
    
    def update_session_info(self):
        """Update session information display."""
        if not self.speech_results:
            return
        
        self.session_info.config(state=tk.NORMAL)
        self.session_info.delete(1.0, tk.END)
        
        info_text = f"Clips recorded: {len(self.speech_results)}\n"
        
        # Calculate sentiment distribution
        sentiments = [clip['sentiment']['label'] for clip in self.speech_results 
                     if 'sentiment' in clip]
        if sentiments:
            from collections import Counter
            sent_counts = Counter(sentiments)
            info_text += "Sentiments: "
            info_text += ", ".join(f"{s}: {c}" for s, c in sent_counts.items())
        
        self.session_info.insert(tk.END, info_text)
        self.session_info.config(state=tk.DISABLED)
    
    def display_session_summary(self):
        """Display summary of the speech session."""
        if not self.current_session:
            return
        
        # Update session info with final summary
        self.session_info.config(state=tk.NORMAL)
        self.session_info.delete(1.0, tk.END)
        
        summary = f"Session Duration: {self.current_session.get('duration', 0):.1f}s\n"
        summary += f"Total Clips: {len(self.current_session.get('clips', []))}\n"
        
        if 'summary' in self.current_session:
            summary += f"\nOverall: {self.current_session['summary']}"
        
        self.session_info.insert(tk.END, summary)
        self.session_info.config(state=tk.DISABLED) 