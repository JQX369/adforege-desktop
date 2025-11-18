"""Enhanced Transcript Widget with interactive hover features"""

import tkinter as tk
from tkinter import ttk
import customtkinter as ctk
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class EnhancedTranscriptWidget(ctk.CTkFrame):
    """Interactive transcript widget with hover effects and emotion mapping"""
    
    def __init__(self, parent, colors: Dict, **kwargs):
        super().__init__(parent, **kwargs)
        self.colors = colors
        self.chunks = []
        self.current_hover_chunk = None
        
        # Create main container
        self.configure(fg_color="transparent")
        
        # Create scrollable canvas
        self.canvas = tk.Canvas(
            self,
            bg="#FFFFFF",
            highlightthickness=0,
            borderwidth=0
        )
        self.scrollbar = ctk.CTkScrollbar(self, command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        # Create frame inside canvas
        try:
            from app.ui_theme import Theme
            self._theme = Theme()
            bg_color = self._theme.COLORS['card']
            self._header_text_color = self._theme.COLORS['text']
        except Exception:
            self._theme = None
            bg_color = "#FFFFFF"
            self._header_text_color = "#2C3E50"

        self.inner_frame = ctk.CTkFrame(self.canvas, fg_color=bg_color)
        self.canvas_window = self.canvas.create_window(
            0, 0, window=self.inner_frame, anchor="nw"
        )
        
        # Layout
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Bind events
        self.inner_frame.bind("<Configure>", self._on_frame_configure)
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        
        # Tooltip for hover
        self.tooltip = None
        
        # Import centralized emotion colors
        from app.emotion_colors import EMOTION_COLORS_WIDGET
        self.emotion_colors = EMOTION_COLORS_WIDGET
    
    def display_chunks(self, chunks: List[Dict]):
        """Display transcript chunks with emotion mapping"""
        self.chunks = chunks
        self._clear_display()
        
        # Header
        header = ctk.CTkLabel(
            self.inner_frame,
            text="📝 INTERACTIVE TRANSCRIPT - Hover over text for details",
            font=("Arial", 16, "bold"),
            text_color=self._header_text_color
        )
        header.pack(pady=(10, 20), padx=20)
        
        # Display each chunk
        for i, chunk in enumerate(chunks):
            self._create_chunk_widget(chunk, i)
    
    def _create_chunk_widget(self, chunk: Dict, index: int):
        """Create a widget for a transcript chunk"""
        # Main container for chunk
        chunk_frame = ctk.CTkFrame(
            self.inner_frame,
            fg_color="transparent",
            corner_radius=8
        )
        chunk_frame.pack(fill=tk.X, padx=20, pady=5)
        
        # Time range label
        time_label = ctk.CTkLabel(
            chunk_frame,
            text=f"[{self._format_time(chunk.get('start_time', 0))} - {self._format_time(chunk.get('end_time', 0))}]",
            font=("Arial", 11),
            text_color="#7F8C8D"
        )
        time_label.pack(anchor="w", pady=(5, 2))
        
        # Text container with emotion background
        overall_emotion = chunk.get('overall_emotion', 'neutral')
        emotion_style = self.emotion_colors.get(overall_emotion, self.emotion_colors['neutral'])
        
        text_container = tk.Frame(
            chunk_frame,
            bg=emotion_style['bg'],
            relief=tk.FLAT,
            borderwidth=2,
            highlightthickness=0
        )
        text_container.pack(fill=tk.X, pady=2)
        
        # Create text widget for chunk
        text_widget = tk.Text(
            text_container,
            wrap=tk.WORD,
            height=2,
            font=("Arial", 13),
            bg=emotion_style['bg'],
            fg=emotion_style['fg'],
            relief=tk.FLAT,
            borderwidth=5,
            highlightthickness=0,
            cursor="hand2"
        )
        text_widget.pack(fill=tk.BOTH, expand=True)
        
        # Insert text with emotion triggers highlighted
        chunk_text = chunk.get('text', '')
        text_widget.insert("1.0", chunk_text)
        
        # Highlight emotion triggers
        triggers = chunk.get('emotion_triggers', [])
        for trigger in triggers:
            phrase = trigger.get('phrase', '')
            if phrase and phrase in chunk_text:
                # Find and highlight the phrase
                start_idx = chunk_text.find(phrase)
                if start_idx >= 0:
                    start_pos = f"1.0 + {start_idx} chars"
                    end_pos = f"1.0 + {start_idx + len(phrase)} chars"
                    
                    # Create unique tag for this trigger
                    tag_name = f"trigger_{index}_{triggers.index(trigger)}"
                    text_widget.tag_add(tag_name, start_pos, end_pos)
                    
                    # Apply styling
                    trigger_emotion = trigger.get('emotion', overall_emotion)
                    trigger_style = self.emotion_colors.get(trigger_emotion, self.emotion_colors['neutral'])
                    text_widget.tag_config(
                        tag_name,
                        background=trigger_style['hover'],
                        foreground=trigger_style['fg'],
                        font=("Arial", 13, "bold")
                    )
        
        # Make text read-only
        text_widget.configure(state="disabled")
        
        # Bind hover events
        def on_enter(event):
            text_container.configure(bg=emotion_style['hover'])
            text_widget.configure(bg=emotion_style['hover'])
            self._show_chunk_tooltip(chunk, event)
        
        def on_leave(event):
            text_container.configure(bg=emotion_style['bg'])
            text_widget.configure(bg=emotion_style['bg'])
            self._hide_tooltip()
        
        text_widget.bind("<Enter>", on_enter)
        text_widget.bind("<Leave>", on_leave)
        text_widget.bind("<Motion>", lambda e: self._update_tooltip_position(e))
        
        # Engagement indicator
        engagement = chunk.get('engagement_level', 'Medium')
        engagement_colors = {
            'High': '#2ECC71',
            'Medium': '#F39C12',
            'Low': '#E74C3C'
        }
        
        engagement_frame = ctk.CTkFrame(chunk_frame, fg_color="transparent")
        engagement_frame.pack(anchor="w", pady=(2, 5))
        
        engagement_dot = ctk.CTkLabel(
            engagement_frame,
            text="●",
            font=("Arial", 10),
            text_color=engagement_colors.get(engagement, '#95A5A6')
        )
        engagement_dot.pack(side=tk.LEFT)
        
        engagement_label = ctk.CTkLabel(
            engagement_frame,
            text=f"Engagement: {engagement}",
            font=("Arial", 10),
            text_color="#7F8C8D"
        )
        engagement_label.pack(side=tk.LEFT, padx=5)
        
        # Viewer emotions if available
        if 'actual_viewer_emotions' in chunk:
            viewer_emotions = chunk['actual_viewer_emotions']
            emotions_text = " | ".join([f"{e}: {c}" for e, c in viewer_emotions.items()])
            viewer_label = ctk.CTkLabel(
                engagement_frame,
                text=f"Viewer reactions: {emotions_text}",
                font=("Arial", 10),
                text_color="#34495E"
            )
            viewer_label.pack(side=tk.LEFT, padx=(20, 0))
    
    def _show_chunk_tooltip(self, chunk: Dict, event):
        """Show tooltip with chunk details"""
        self._hide_tooltip()
        
        # Create tooltip window
        self.tooltip = tk.Toplevel(self)
        self.tooltip.wm_overrideredirect(True)
        self.tooltip.wm_geometry(f"+{event.x_root + 10}+{event.y_root + 10}")
        
        # Tooltip frame
        tooltip_frame = ctk.CTkFrame(
            self.tooltip,
            fg_color="#2C3E50",
            corner_radius=8,
            border_width=1,
            border_color="#34495E"
        )
        tooltip_frame.pack()
        
        # Content
        content_frame = ctk.CTkFrame(tooltip_frame, fg_color="transparent")
        content_frame.pack(padx=15, pady=10)
        
        # Overall emotion
        emotion_label = ctk.CTkLabel(
            content_frame,
            text=f"Overall Emotion: {chunk.get('overall_emotion', 'neutral').upper()}",
            font=("Arial", 12, "bold"),
            text_color="white"
        )
        emotion_label.pack(anchor="w")
        
        # Emotion triggers
        triggers = chunk.get('emotion_triggers', [])
        if triggers:
            triggers_label = ctk.CTkLabel(
                content_frame,
                text="Emotion Triggers:",
                font=("Arial", 11, "bold"),
                text_color="#ECF0F1"
            )
            triggers_label.pack(anchor="w", pady=(10, 5))
            
            for trigger in triggers[:3]:  # Show max 3 triggers
                trigger_text = f"• \"{trigger.get('phrase', '')}\" → {trigger.get('emotion', '')}"
                if trigger.get('reason'):
                    trigger_text += f"\n  {trigger['reason']}"
                
                trigger_label = ctk.CTkLabel(
                    content_frame,
                    text=trigger_text,
                    font=("Arial", 10),
                    text_color="#BDC3C7",
                    justify="left"
                )
                trigger_label.pack(anchor="w", padx=(10, 0))
    
    def _hide_tooltip(self):
        """Hide the tooltip"""
        if self.tooltip:
            self.tooltip.destroy()
            self.tooltip = None
    
    def _update_tooltip_position(self, event):
        """Update tooltip position as mouse moves"""
        if self.tooltip:
            self.tooltip.wm_geometry(f"+{event.x_root + 10}+{event.y_root + 10}")
    
    def _clear_display(self):
        """Clear the current display"""
        for widget in self.inner_frame.winfo_children():
            widget.destroy()
    
    def _format_time(self, seconds: float) -> str:
        """Format seconds to MM:SS"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
    
    def _on_frame_configure(self, event):
        """Update scroll region when frame size changes"""
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
    
    def _on_canvas_configure(self, event):
        """Update inner frame width when canvas size changes"""
        canvas_width = event.width
        self.canvas.itemconfig(self.canvas_window, width=canvas_width) 