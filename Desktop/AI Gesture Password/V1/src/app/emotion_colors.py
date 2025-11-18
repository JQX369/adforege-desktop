"""Centralized emotion color definitions for consistent UI"""

# Standard emotion colors (iOS-inspired palette)
EMOTION_COLORS_HEX = {
    'happy': '#34C759',      # iOS Green
    'sad': '#5856D6',        # iOS Indigo  
    'angry': '#FF3B30',      # iOS Red
    'surprise': '#FF9500',   # iOS Orange
    'fear': '#AF52DE',       # iOS Purple
    'disgust': '#5AC8FA',    # iOS Light Blue
    'neutral': '#8E8E93',    # iOS Gray
    'bored': '#C7C7CC',      # iOS Light Gray
    'stressed': '#FF6482',   # iOS Pink
    'confused': '#5856D6'    # iOS Indigo
}

# RGB tuples for OpenCV (BGR format)
EMOTION_COLORS_BGR = {
    'happy': (89, 199, 52),      # Green (reversed from RGB)
    'sad': (214, 86, 88),        # Indigo
    'angry': (48, 59, 255),      # Red
    'surprise': (0, 149, 255),   # Orange
    'fear': (222, 82, 175),      # Purple
    'disgust': (250, 200, 90),   # Light Blue
    'neutral': (147, 142, 142),  # Gray
    'bored': (204, 199, 199),    # Light Gray
    'stressed': (130, 100, 255), # Pink
    'confused': (214, 86, 88)    # Indigo
}

# For enhanced transcript widget with backgrounds
EMOTION_COLORS_WIDGET = {
    'happy': {
        'bg': '#E8F5E9',     # Light green background
        'fg': '#2E7D32',     # Dark green text
        'hover': '#C8E6C9',  # Medium green hover
        'main': '#34C759'    # Main emotion color
    },
    'sad': {
        'bg': '#E3F2FD',     # Light indigo background
        'fg': '#1565C0',     # Dark blue text
        'hover': '#BBDEFB',  # Medium blue hover
        'main': '#5856D6'    # Main emotion color
    },
    'angry': {
        'bg': '#FFEBEE',     # Light red background
        'fg': '#C62828',     # Dark red text
        'hover': '#FFCDD2',  # Medium red hover
        'main': '#FF3B30'    # Main emotion color
    },
    'surprise': {
        'bg': '#FFF3E0',     # Light orange background
        'fg': '#E65100',     # Dark orange text
        'hover': '#FFE0B2',  # Medium orange hover
        'main': '#FF9500'    # Main emotion color
    },
    'fear': {
        'bg': '#F3E5F5',     # Light purple background
        'fg': '#6A1B9A',     # Dark purple text
        'hover': '#E1BEE7',  # Medium purple hover
        'main': '#AF52DE'    # Main emotion color
    },
    'disgust': {
        'bg': '#E0F2F1',     # Light teal background
        'fg': '#00695C',     # Dark teal text
        'hover': '#B2DFDB',  # Medium teal hover
        'main': '#5AC8FA'    # Main emotion color
    },
    'neutral': {
        'bg': '#F5F5F5',     # Light gray background
        'fg': '#616161',     # Dark gray text
        'hover': '#EEEEEE',  # Medium gray hover
        'main': '#8E8E93'    # Main emotion color
    },
    'bored': {
        'bg': '#ECEFF1',     # Light blue-gray background
        'fg': '#546E7A',     # Dark blue-gray text
        'hover': '#CFD8DC',  # Medium blue-gray hover
        'main': '#C7C7CC'    # Main emotion color
    },
    'stressed': {
        'bg': '#FBE9E7',     # Light pink background
        'fg': '#D84315',     # Dark orange text
        'hover': '#FFCCBC',  # Medium pink hover
        'main': '#FF6482'    # Main emotion color
    },
    'confused': {
        'bg': '#EDE7F6',     # Light purple background
        'fg': '#512DA8',     # Dark purple text
        'hover': '#D1C4E9',  # Medium purple hover
        'main': '#5856D6'    # Main emotion color
    },
    'mixed': {
        'bg': '#FFF9C4',     # Light yellow background
        'fg': '#F57F17',     # Dark yellow text
        'hover': '#FFF59D',  # Medium yellow hover
        'main': '#FFC107'    # Main emotion color
    }
}

def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_bgr(rgb: tuple) -> tuple:
    """Convert RGB to BGR for OpenCV"""
    return (rgb[2], rgb[1], rgb[0]) 