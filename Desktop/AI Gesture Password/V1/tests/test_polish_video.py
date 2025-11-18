"""Test script for Clearcast video polishing feature"""

import os
import sys
from pathlib import Path

import pytest

pytest.importorskip("cv2")

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_PATH = ROOT_DIR / "src"
if SRC_PATH.exists():
    sys.path.insert(0, str(SRC_PATH))

from app.video_processor import ClearcastVideoProcessor
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_ffmpeg_detection():
    """Test if FFmpeg is detected"""
    print("\n=== Testing FFmpeg Detection ===")
    processor = ClearcastVideoProcessor()
    
    if processor.ffmpeg_path:
        print(f"✅ FFmpeg found at: {processor.ffmpeg_path}")
    else:
        print("❌ FFmpeg not found")
        print("\nTo install FFmpeg:")
        print("1. Download from: https://ffmpeg.org/download.html")
        print("2. Extract to C:\\ffmpeg")
        print("3. Add C:\\ffmpeg\\bin to your PATH")
        
    return processor.ffmpeg_path is not None

def test_video_analysis():
    """Test video analysis without processing"""
    print("\n=== Testing Video Analysis ===")
    
    # Find a test video
    test_videos = []
    for root, dirs, files in os.walk("video_analyses"):
        for file in files:
            if file.endswith(('.mp4', '.avi', '.mov')):
                test_videos.append(os.path.join(root, file))
    
    if not test_videos:
        print("❌ No test videos found in video_analyses folder")
        return False
        
    test_video = test_videos[0]
    print(f"Using test video: {test_video}")
    
    processor = ClearcastVideoProcessor()
    analysis = processor._analyze_video(test_video)
    
    print("\nVideo Analysis Results:")
    print(f"- Resolution: {analysis['video'].get('width')}x{analysis['video'].get('height')}")
    print(f"- FPS: {analysis['video'].get('fps')}")
    print(f"- Brightness: {analysis['video'].get('avg_brightness', 'N/A')}")
    print(f"- Contrast: {analysis['video'].get('avg_contrast', 'N/A')}")
    print(f"- Issues: {analysis.get('issues', [])}")
    
    return True

def test_clearcast_updater():
    """Test Clearcast updater"""
    print("\n=== Testing Clearcast Updater ===")
    
    try:
        from app.clearcast_updater import ClearcastUpdater
        from app.config import GOOGLE_API_KEY
        
        updater = ClearcastUpdater(GOOGLE_API_KEY)
        
        # Test update check
        print("Checking for Clearcast updates...")
        results = updater.check_for_updates()
        
        print(f"\nUpdate Check Results:")
        print(f"- Has updates: {results.get('has_updates', False)}")
        print(f"- Summary: {results.get('summary', 'No summary')}")
        
        if results.get('changes'):
            print(f"- Changes found: {len(results['changes'])}")
            for change in results['changes'][:3]:  # Show first 3
                print(f"  • {change.get('description', 'No description')}")
                
        return True
        
    except Exception as e:
        print(f"❌ Clearcast updater test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("CLEARCAST VIDEO POLISH FEATURE TEST")
    print("===================================")
    
    # Test 1: FFmpeg detection
    ffmpeg_ok = test_ffmpeg_detection()
    
    # Test 2: Video analysis
    if ffmpeg_ok or True:  # Test analysis even without FFmpeg
        analysis_ok = test_video_analysis()
    else:
        analysis_ok = False
        
    # Test 3: Clearcast updater
    updater_ok = test_clearcast_updater()
    
    # Summary
    print("\n=== TEST SUMMARY ===")
    print(f"FFmpeg Detection: {'✅ PASS' if ffmpeg_ok else '❌ FAIL'}")
    print(f"Video Analysis: {'✅ PASS' if analysis_ok else '❌ FAIL'}")
    print(f"Clearcast Updater: {'✅ PASS' if updater_ok else '❌ FAIL'}")
    
    if not ffmpeg_ok:
        print("\n⚠️ FFmpeg is required for full video processing functionality")
        print("The Polish feature will have limited capabilities without FFmpeg")

if __name__ == "__main__":
    main() 