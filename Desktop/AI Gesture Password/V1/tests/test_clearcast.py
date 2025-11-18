"""Test script for Clearcast compliance checker"""

import logging
from app.clearcast_checker import ClearcastChecker
import json

# Configure logging
logging.basicConfig(level=logging.INFO)

def test_clearcast_checker():
    """Test the Clearcast checker with a sample video"""
    print("Testing Clearcast Compliance Checker...")
    print("-" * 50)
    
    try:
        # Initialize checker
        checker = ClearcastChecker()
        print("✓ Clearcast checker initialized")
        
        # Check if PDF was loaded
        if checker.pdf_content:
            print("✓ Clearcast guidelines loaded")
        else:
            print("✗ Failed to load Clearcast guidelines")
            
        # Test with a sample video (if exists)
        import os
        test_videos = [
            "test_video.mp4",
            "sample_video.mp4",
            "demo_video.mp4"
        ]
        
        test_video_path = None
        for video in test_videos:
            if os.path.exists(video):
                test_video_path = video
                break
                
        if test_video_path:
            print(f"\nTesting with video: {test_video_path}")
            print("This may take a moment...")
            
            # Check compliance
            results = checker.check_video_compliance(test_video_path)
            
            # Display results
            print("\n" + "="*50)
            print("CLEARCAST COMPLIANCE RESULTS")
            print("="*50)
            
            print(f"\nCompliance Status: {results.get('compliance_status', 'UNKNOWN')}")
            print(f"Overall Risk: {results.get('overall_risk', 'UNKNOWN')}")
            
            print(f"\nSummary: {results.get('summary', 'No summary')}")
            
            # Red flags
            red_flags = results.get('red_flags', [])
            if red_flags:
                print(f"\n🚫 RED FLAGS ({len(red_flags)}):")
                for i, flag in enumerate(red_flags, 1):
                    print(f"{i}. {flag.get('issue', 'Unknown issue')}")
                    if flag.get('required_action'):
                        print(f"   Action: {flag['required_action']}")
                        
            # Yellow flags
            yellow_flags = results.get('yellow_flags', [])
            if yellow_flags:
                print(f"\n⚠️  YELLOW FLAGS ({len(yellow_flags)}):")
                for i, flag in enumerate(yellow_flags, 1):
                    print(f"{i}. {flag.get('issue', 'Unknown issue')}")
                    if flag.get('suggested_action'):
                        print(f"   Suggestion: {flag['suggested_action']}")
                        
            # Compliant elements
            compliant = results.get('compliant_elements', [])
            if compliant:
                print(f"\n✅ COMPLIANT ELEMENTS ({len(compliant)}):")
                for i, element in enumerate(compliant, 1):
                    print(f"{i}. {element}")
                    
            # Save full results
            with open('clearcast_test_results.json', 'w') as f:
                json.dump(results, f, indent=2)
            print("\nFull results saved to: clearcast_test_results.json")
            
        else:
            print("\nNo test video found. Please add a test video to the project directory.")
            print("Supported formats: MP4, AVI, MOV, MKV")
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        
    print("\n" + "-"*50)
    print("Test complete!")
    
if __name__ == "__main__":
    test_clearcast_checker() 