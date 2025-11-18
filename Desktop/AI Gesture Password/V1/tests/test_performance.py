"""
Test script to verify performance improvements
Run with: python test_performance.py
"""

import logging
import sys
import time
import os
from pathlib import Path

# Performance settings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TensorFlow logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def cleanup_temp_files():
    """Remove any temporary audio files"""
    temp_files = list(Path('.').glob('*_temp_audio.mp3'))
    for f in temp_files:
        try:
            f.unlink()
            logger.info(f"Deleted temp file: {f}")
        except:
            pass

def test_performance():
    """Test the video analyzer performance improvements"""
    try:
        logger.info("=" * 60)
        logger.info("VIDEO ANALYZER PERFORMANCE TEST")
        logger.info("=" * 60)
        
        # Clean up before starting
        cleanup_temp_files()
        
        logger.info("\nExpected Improvements:")
        logger.info("✅ Pre-warmed models (no initial lag)")
        logger.info("✅ Pre-initialized webcam (faster start)")
        logger.info("✅ Time-based processing (no frame drops)")
        logger.info("✅ Optimized video capture (minimal buffering)")
        logger.info("✅ Single loading screen → countdown → play")
        
        logger.info("\nStarting Video Analyzer...")
        
        # Import after logging is set up
        from app.video_analyzer_gui import VideoAnalyzerGUI
        
        # Start timing
        start_time = time.time()
        
        # Create and run the GUI
        app = VideoAnalyzerGUI()
        
        init_time = time.time() - start_time
        logger.info(f"\nInitialization complete in {init_time:.2f} seconds")
        
        logger.info("\nPERFORMANCE CHECKLIST:")
        logger.info("1. Models should pre-warm on startup (check logs)")
        logger.info("2. Webcam should pre-initialize (check logs)")
        logger.info("3. Click Play → should see countdown in <1 second")
        logger.info("4. Video should play smoothly without jumps")
        logger.info("5. Frame drops should be minimal (<10%)")
        logger.info("6. No notification spam")
        
        # Run the app
        app.run()
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("\nCleaning up...")
        cleanup_temp_files()
        logger.info("Test complete")

if __name__ == "__main__":
    test_performance() 