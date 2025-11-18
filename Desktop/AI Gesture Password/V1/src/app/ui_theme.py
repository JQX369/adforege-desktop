"""Centralized UI theme tokens and helpers for a modern, cohesive look"""

from typing import Tuple, Optional, Callable
import customtkinter as ctk


class Theme:
    """Theme tokens and convenience widget factories."""

    # Color palette (aligned with iOS-like modern palette used in the app)
    COLORS = {
        'bg': '#F5F5F7',       # Clean light gray background
        'card': '#FFFFFF',
        'primary': '#FF3B30',  # iOS Red
        'secondary': '#34C759',# iOS Green
        'text': '#1C1C1E',
        'text_light': '#8E8E93',
        'border': '#E5E5EA',
        'dark': '#1C1C1E',
        'yellow': '#FFCC00',   # iOS Yellow
        'blue': '#007AFF'      # iOS Blue
    }

    # Spacing scale (px)
    SPACE = {
        'xs': 6,
        'sm': 10,
        'md': 16,
        'lg': 20,
        'xl': 28,
    }

    # Radii
    RADII = {
        'sm': 8,
        'md': 12,
        'lg': 16,
        'pill': 24,
    }

    # Typography (family should match availability on system)
    FONTS = {
        'h1': ("SF Pro Display", 28, "bold"),
        'h2': ("SF Pro Display", 20, "bold"),
        'body': ("SF Pro Text", 14),
        'body_bold': ("SF Pro Text", 14, "bold"),
        'caption': ("Arial", 11),
    }

    def apply_global(self, appearance: str = "light", color_theme: str = "blue"):
        """Apply global CTk appearance and color theme."""
        ctk.set_appearance_mode(appearance)
        ctk.set_default_color_theme(color_theme)

    # Button factories
    def primary_button(self, parent, text: str, command: Optional[Callable] = None,
                       width: int = 280, height: int = 48):
        return ctk.CTkButton(
            parent,
            text=text,
            font=self.FONTS['body_bold'],
            width=width,
            height=height,
            corner_radius=self.RADII['pill'],
            fg_color=self.COLORS['blue'],
            hover_color="#0051D5",
            text_color="white",
            command=command,
        )

    def secondary_button(self, parent, text: str, command: Optional[Callable] = None,
                         width: int = 200, height: int = 40):
        return ctk.CTkButton(
            parent,
            text=text,
            font=self.FONTS['body'],
            width=width,
            height=height,
            corner_radius=self.RADII['pill'],
            fg_color=self.COLORS['secondary'],
            hover_color="#248A3D",
            text_color="white",
            command=command,
        )

    def outline_button(self, parent, text: str, command: Optional[Callable] = None,
                        width: int = 160, height: int = 40):
        return ctk.CTkButton(
            parent,
            text=text,
            font=self.FONTS['body'],
            width=width,
            height=height,
            corner_radius=self.RADII['pill'],
            fg_color="transparent",
            border_width=2,
            border_color=self.COLORS['blue'],
            text_color=self.COLORS['blue'],
            hover_color=self.COLORS['bg'],
            command=command,
        )

    # Containers
    def header(self, parent, title: str):
        """Create a standard page header with a bottom border and title."""
        header = ctk.CTkFrame(parent, height=60, fg_color=self.COLORS['card'], corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)

        # Bottom border
        border = ctk.CTkFrame(header, height=1, fg_color=self.COLORS['border'])
        border.pack(side="bottom", fill="x")

        title_label = ctk.CTkLabel(
            header,
            text=title,
            font=self.FONTS['h2'],
            text_color=self.COLORS['text']
        )
        title_label.pack(side="left", padx=self.SPACE['lg'])
        return header, title_label

    def card(self, parent, *, corner_radius: Optional[int] = None):
        """Create a standardized card container."""
        return ctk.CTkFrame(
            parent,
            fg_color=self.COLORS['card'],
            corner_radius=corner_radius if corner_radius is not None else self.RADII['lg'],
            border_width=1,
            border_color=self.COLORS['border']
        )



