"""Public Reaction GUI for anonymous viewer reactions"""

import tkinter as tk
import customtkinter as ctk
from tkinter import messagebox
import cv2
from PIL import Image, ImageTk
import threading
import time
import numpy as np
from typing import Dict, Optional
import logging

from app.config import COLORS
from app.enhanced_emotion_tracker import EnhancedEmotionTracker
from app.public_reaction import PublicReactionManager
from app.video_storage import VideoStorage

logger = logging.getLogger(__name__)

class PublicReactionGUI:
    """GUI for public users to react to ads"""
    
    def __init__(self, link_id: str):
        self.link_id = link_id
        self.public_manager = PublicReactionManager()
        self.video_storage = VideoStorage()
        
        # Get link info
        self.link_info = self.public_manager.get_link_info(link_id)
        if not self.link_info or not self.link_info.get("active"):
            messagebox.showerror("Error", "This link is invalid or has expired")
            return
        
        self.analysis_id = self.link_info["analysis_id"]
        self.video_path = self.video_storage.get_video_path(self.analysis_id)
        
        # Initialize GUI
        self.root = ctk.CTk()
        try:
            from app.ui_theme import Theme
            self.theme = Theme()
            self.theme.apply_global("light", "blue")
        except Exception:
            self.theme = None
        self.root.title("Ad Reaction Study")
        self.root.geometry("900x700")
        
        # User data
        self.age = None
        self.gender = None
        self.webcam_permission = False
        self.emotion_data = []
        self.is_recording = False
        
        # Video properties
        self.cap = None
        self.total_frames = 0
        self.current_frame = 0
        
        # Create pages
        self._create_welcome_page()
    
    def _clear_window(self):
        """Clear all widgets from window"""
        for widget in self.root.winfo_children():
            widget.destroy()
    
    def run(self):
        """Run the public reaction GUI"""
        self.root.mainloop()
    
    def _create_welcome_page(self):
        """Create the welcome/consent page"""
        self._clear_window()
        
        # Main container with padding
        container = ctk.CTkFrame(self.root, fg_color=COLORS['bg'])
        container.pack(fill=tk.BOTH, expand=True, padx=40, pady=40)
        
        # Title
        title = ctk.CTkLabel(
            container,
            text="Welcome to Our Ad Study",
            font=("SF Pro Display", 32, "bold"),
            text_color=COLORS['text']
        )
        title.pack(pady=(0, 20))
        
        # Privacy notice card
        privacy_card = (self.theme.card(container) if self.theme else ctk.CTkFrame(container, fg_color=COLORS['card'], corner_radius=12))
        privacy_card.pack(fill=tk.BOTH, expand=True, pady=20)
        
        # Privacy icon and title
        privacy_header = ctk.CTkFrame(privacy_card, fg_color="transparent")
        privacy_header.pack(fill=tk.X, padx=30, pady=(30, 20))
        
        privacy_icon = ctk.CTkLabel(
            privacy_header,
            text="🔒",
            font=("SF Pro Display", 24)
        )
        privacy_icon.pack(side=tk.LEFT, padx=(0, 10))
        
        privacy_title = ctk.CTkLabel(
            privacy_header,
            text="Your Privacy is Protected",
            font=("SF Pro Display", 20, "bold"),
            text_color=COLORS['text']
        )
        privacy_title.pack(side=tk.LEFT)
        
        # Privacy text
        privacy_text = ctk.CTkLabel(
            privacy_card,
            text="• No images or videos of you will be saved\n" +
                 "• We only collect emotion data to improve our ads\n" +
                 "• Your participation is completely anonymous\n" +
                 "• The webcam is only used for real-time emotion detection",
            font=("SF Pro Text", 14),
            text_color=COLORS['text_light'],
            justify=tk.LEFT
        )
        privacy_text.pack(padx=30, pady=(0, 30))
        
        # Demographics form
        demo_frame = (self.theme.card(container) if self.theme else ctk.CTkFrame(container, fg_color=COLORS['card'], corner_radius=12))
        demo_frame.pack(fill=tk.X, pady=20)
        
        demo_title = ctk.CTkLabel(
            demo_frame,
            text="Tell us about yourself",
            font=("SF Pro Display", 18, "bold"),
            text_color=COLORS['text']
        )
        demo_title.pack(pady=(20, 15))
        
        # Age input
        age_frame = ctk.CTkFrame(demo_frame, fg_color="transparent")
        age_frame.pack(pady=10)
        
        age_label = ctk.CTkLabel(
            age_frame,
            text="Age:",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        age_label.pack(side=tk.LEFT, padx=(30, 10))
        
        self.age_entry = ctk.CTkEntry(
            age_frame,
            width=100,
            placeholder_text="e.g., 25",
            font=("SF Pro Text", 14)
        )
        self.age_entry.pack(side=tk.LEFT)
        
        # Gender selection
        gender_frame = ctk.CTkFrame(demo_frame, fg_color="transparent")
        gender_frame.pack(pady=10)
        
        gender_label = ctk.CTkLabel(
            gender_frame,
            text="Gender:",
            font=("SF Pro Text", 14),
            text_color=COLORS['text']
        )
        gender_label.pack(side=tk.LEFT, padx=(30, 10))
        
        self.gender_var = tk.StringVar(value="")
        genders = ["Male", "Female", "Non-binary", "Prefer not to say"]
        
        self.gender_dropdown = ctk.CTkOptionMenu(
            gender_frame,
            values=genders,
            variable=self.gender_var,
            width=200,
            font=("SF Pro Text", 14)
        )
        self.gender_dropdown.pack(side=tk.LEFT)
        
        # Small privacy text
        small_privacy = ctk.CTkLabel(
            demo_frame,
            text="No image data will be saved - just used to detect emotions",
            font=("SF Pro Text", 10),
            text_color=COLORS['text_light']
        )
        small_privacy.pack(pady=(10, 20))
        
        # Continue button
        continue_btn = (self.theme.primary_button(container, text="Accept & Continue", command=self._validate_and_continue, width=250, height=50)
            if self.theme else ctk.CTkButton(container, text="Accept & Continue", font=("SF Pro Text", 16, "bold"), width=250, height=50, corner_radius=25, fg_color=COLORS['blue'], hover_color="#0051D5", command=self._validate_and_continue))
        continue_btn.pack(pady=20)
        
    def _validate_and_continue(self):
        """Validate user input and proceed to webcam permission"""
        # Validate age
        try:
            age = int(self.age_entry.get())
            if age < 1 or age > 120:
                raise ValueError
            self.age = age
        except ValueError:
            messagebox.showerror("Invalid Input", "Please enter a valid age between 1 and 120")
            return
        
        # Validate gender
        if not self.gender_var.get():
            messagebox.showerror("Missing Information", "Please select your gender")
            return
        
        self.gender = self.gender_var.get()
        
        # Proceed to webcam permission
        self._show_webcam_permission()
    
    def _show_webcam_permission(self):
        """Show webcam permission page"""
        self._clear_window()
        
        container = ctk.CTkFrame(self.root, fg_color=COLORS['bg'])
        container.pack(fill=tk.BOTH, expand=True)
        
        # Center frame
        center_frame = (self.theme.card(container) if self.theme else ctk.CTkFrame(container, fg_color=COLORS['card'], corner_radius=20))
        center_frame.configure(width=500, height=400)
        center_frame.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        center_frame.pack_propagate(False)
        
        # Webcam icon
        webcam_icon = ctk.CTkLabel(
            center_frame,
            text="📹",
            font=("SF Pro Display", 64)
        )
        webcam_icon.pack(pady=(50, 20))
        
        # Title
        title = ctk.CTkLabel(
            center_frame,
            text="Camera Permission Required",
            font=("SF Pro Display", 24, "bold"),
            text_color=COLORS['text']
        )
        title.pack(pady=(0, 20))
        
        # Description
        desc = ctk.CTkLabel(
            center_frame,
            text="We need access to your camera to detect\nyour emotional reactions to the ad.\n\nNo photos or videos will be saved.",
            font=("SF Pro Text", 14),
            text_color=COLORS['text_light'],
            justify=tk.CENTER
        )
        desc.pack(pady=20)
        
        # Buttons
        button_frame = ctk.CTkFrame(center_frame, fg_color="transparent")
        button_frame.pack(pady=30)
        
        allow_btn = (self.theme.primary_button(button_frame, text="Allow Camera", command=self._check_webcam_permission, width=180, height=44)
            if self.theme else ctk.CTkButton(button_frame, text="Allow Camera", font=("SF Pro Text", 16, "bold"), width=180, height=44, corner_radius=22, fg_color=COLORS['blue'], hover_color="#0051D5", command=self._check_webcam_permission))
        allow_btn.pack(side=tk.LEFT, padx=10)
        
        cancel_btn = (self.theme.outline_button(button_frame, text="Cancel", command=self.root.destroy, width=120, height=44)
            if self.theme else ctk.CTkButton(button_frame, text="Cancel", font=("SF Pro Text", 16), width=120, height=44, corner_radius=22, fg_color="transparent", hover_color=COLORS['bg'], border_width=2, border_color=COLORS['border'], text_color=COLORS['text'], command=self.root.destroy))
        cancel_btn.pack(side=tk.LEFT, padx=10)
    
    def _check_webcam_permission(self):
        """Check if webcam is available and proceed"""
        # Test webcam
        test_cap = cv2.VideoCapture(0)
        if test_cap.isOpened():
            test_cap.release()
            self.webcam_permission = True
            self._show_ready_page()
        else:
            messagebox.showerror(
                "Camera Error", 
                "Could not access your camera.\nPlease check your camera permissions and try again."
            )
    
    def _show_ready_page(self):
        """Show ready to start page"""
        self._clear_window()
        
        container = ctk.CTkFrame(self.root, fg_color=COLORS['bg'])
        container.pack(fill=tk.BOTH, expand=True)
        
        # Main content
        content = ctk.CTkFrame(container, fg_color="transparent")
        content.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        
        # Ready icon
        ready_icon = ctk.CTkLabel(
            content,
            text="✅",
            font=("SF Pro Display", 64)
        )
        ready_icon.pack(pady=(0, 20))
        
        # Title
        title = ctk.CTkLabel(
            content,
            text="You're All Set!",
            font=("SF Pro Display", 32, "bold"),
            text_color=COLORS['text']
        )
        title.pack(pady=(0, 20))
        
        # Instructions
        instructions = ctk.CTkLabel(
            content,
            text="When you click 'Start', the ad will begin playing.\n\n" +
                 "• Watch the ad naturally\n" +
                 "• Your reactions will be recorded automatically\n" +
                 "• The ad will play once from start to finish",
            font=("SF Pro Text", 16),
            text_color=COLORS['text_light'],
            justify=tk.LEFT
        )
        instructions.pack(pady=30)
        
        # Start button
        start_btn = (self.theme.secondary_button(content, text="Start Watching", command=self._start_reaction, width=200, height=56)
            if self.theme else ctk.CTkButton(content, text="Start Watching", font=("SF Pro Text", 18, "bold"), width=200, height=56, corner_radius=28, fg_color=COLORS['green'], hover_color="#00A651", command=self._start_reaction))
        start_btn.pack(pady=20)
    
    def _start_reaction(self):
        """Start the reaction recording"""
        self._clear_window()
        
        # Create video display
        self.video_frame = ctk.CTkFrame(self.root, fg_color="#000000")
        self.video_frame.pack(fill=tk.BOTH, expand=True)
        
        self.video_label = tk.Label(self.video_frame, bg="#000000")
        self.video_label.pack(fill=tk.BOTH, expand=True)
        
        # Small webcam preview in corner
        self.webcam_preview = tk.Label(
            self.video_frame,
            bg="#000000",
            width=160,
            height=120
        )
        self.webcam_preview.place(relx=0.98, rely=0.02, anchor="ne")
        
        # Initialize emotion tracker
        self.emotion_tracker = EnhancedEmotionTracker(disable_gemini=True)
        
        # Start video playback
        self.cap = cv2.VideoCapture(self.video_path)
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        
        self.is_recording = True
        
        # Start threads
        self.video_thread = threading.Thread(target=self._play_video, daemon=True)
        self.webcam_thread = threading.Thread(target=self._process_webcam, daemon=True)
        
        self.video_thread.start()
        self.webcam_thread.start()
    
    def _play_video(self):
        """Play the video"""
        frame_delay = 1.0 / self.fps if self.fps > 0 else 0.033
        
        while self.is_recording and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break
            
            # Update video display
            self._update_video_display(frame)
            
            self.current_frame += 1
            time.sleep(frame_delay)
        
        # Video ended
        self.is_recording = False
        self.root.after(100, self._show_completion_page)
    
    def _process_webcam(self):
        """Process webcam for emotion detection"""
        webcam_cap = cv2.VideoCapture(0)
        
        while self.is_recording:
            ret, frame = webcam_cap.read()
            if ret:
                # Get emotions (no Gemini calls)
                emotions = self.emotion_tracker.get_frame_emotions(frame)
                
                if emotions:
                    # Store emotion data with timestamp
                    emotion_entry = {
                        "timestamp": self.current_frame / self.fps if self.fps > 0 else 0,
                        "frame": self.current_frame,
                        "emotions": emotions
                    }
                    self.emotion_data.append(emotion_entry)
                
                # Update webcam preview
                self._update_webcam_preview(frame)
            
            time.sleep(0.1)  # 10 FPS for emotion detection
        
        webcam_cap.release()
    
    def _update_video_display(self, frame):
        """Update video display"""
        # Resize frame to fit window
        height, width = frame.shape[:2]
        window_width = self.video_label.winfo_width()
        window_height = self.video_label.winfo_height()
        
        if window_width > 1 and window_height > 1:
            # Calculate scale to fit
            scale = min(window_width / width, window_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            frame = cv2.resize(frame, (new_width, new_height))
        
        # Convert to PhotoImage
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame_rgb)
        photo = ImageTk.PhotoImage(image=img)
        
        self.video_label.configure(image=photo)
        self.video_label.image = photo
    
    def _update_webcam_preview(self, frame):
        """Update small webcam preview"""
        # Resize to small preview
        frame_small = cv2.resize(frame, (160, 120))
        
        # Convert to PhotoImage
        frame_rgb = cv2.cvtColor(frame_small, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame_rgb)
        photo = ImageTk.PhotoImage(image=img)
        
        self.webcam_preview.configure(image=photo)
        self.webcam_preview.image = photo
    
    def _show_completion_page(self):
        """Show completion page and save reaction"""
        self._clear_window()
        
        # Save reaction data
        try:
            reaction_id = self.public_manager.save_public_reaction(
                self.link_id,
                self.age,
                self.gender,
                self.emotion_data
            )
            success = True
        except Exception as e:
            logger.error(f"Failed to save public reaction: {e}")
            success = False
        
        # Show completion UI
        container = ctk.CTkFrame(self.root, fg_color=COLORS['bg'])
        container.pack(fill=tk.BOTH, expand=True)
        
        content = ctk.CTkFrame(container, fg_color="transparent")
        content.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        
        # Success icon
        icon = ctk.CTkLabel(
            content,
            text="🎉" if success else "⚠️",
            font=("SF Pro Display", 64)
        )
        icon.pack(pady=(0, 20))
        
        # Title
        title = ctk.CTkLabel(
            content,
            text="Thank You!" if success else "Something went wrong",
            font=("SF Pro Display", 32, "bold"),
            text_color=COLORS['text']
        )
        title.pack(pady=(0, 20))
        
        # Message
        message = ctk.CTkLabel(
            content,
            text="Your reaction has been recorded.\nThank you for participating in our study!" if success else
                 "We couldn't save your reaction.\nPlease try again later.",
            font=("SF Pro Text", 16),
            text_color=COLORS['text_light'],
            justify=tk.CENTER
        )
        message.pack(pady=20)
        
        # Close button
        close_btn = (self.theme.primary_button(content, text="Close", command=self.root.destroy, width=150, height=44)
            if self.theme else ctk.CTkButton(content, text="Close", font=("SF Pro Text", 16, "bold"), width=150, height=44, corner_radius=22, fg_color=COLORS['blue'], hover_color="#0051D5", command=self.root.destroy))
        close_btn.pack(pady=30)
