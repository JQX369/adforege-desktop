# FILE: app/main.py
"""Video Emotion Analyzer - Main Application"""

import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('video_analyzer.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Main application entry point."""
    try:
        logger.info("Starting Video Emotion Analyzer")
        
        # Import and start the GUI
        from app.video_analyzer_gui import VideoAnalyzerGUI
        
        app = VideoAnalyzerGUI()
        app.run()
        
    except Exception as e:
        logger.error(f"Application error: {e}", exc_info=True)
        return 1
    finally:
        logger.info("Application shutdown")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 