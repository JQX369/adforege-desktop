"""Test script to verify Clearcast checker fixes"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_PATH = ROOT_DIR / "src"
if SRC_PATH.exists():
    sys.path.insert(0, str(SRC_PATH))

from app.clearcast_checker import ClearcastChecker
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_clearcast():
    """Test the Clearcast checker"""
    try:
        # Initialize checker
        logger.info("Initializing Clearcast checker...")
        checker = ClearcastChecker()
        
        # Test with a sample video
        video_path = input("Enter path to a video file to test (or press Enter to skip): ").strip()
        
        if not video_path:
            logger.info("Test skipped - no video provided")
            return
        
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return
        
        # Run compliance check
        logger.info(f"Checking video compliance: {video_path}")
        results = checker.check_video_compliance(video_path)
        
        # Display results
        print("\n" + "="*50)
        print("CLEARCAST COMPLIANCE CHECK RESULTS")
        print("="*50)
        
        print(f"\nStatus: {results.get('compliance_status', 'UNKNOWN')}")
        print(f"Risk Level: {results.get('overall_risk', 'UNKNOWN')}")
        
        if results.get('error'):
            print(f"\nError: {results['error']}")
        
        print(f"\nSummary: {results.get('summary', 'No summary available')}")
        
        if results.get('red_flags'):
            print("\n🚫 RED FLAGS:")
            for flag in results['red_flags']:
                print(f"  - {flag.get('issue', 'Unknown issue')}")
        
        if results.get('yellow_flags'):
            print("\n⚠️ YELLOW FLAGS:")
            for flag in results['yellow_flags']:
                print(f"  - {flag.get('issue', 'Unknown issue')}")
        
        print("\n" + "="*50)
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_clearcast() 