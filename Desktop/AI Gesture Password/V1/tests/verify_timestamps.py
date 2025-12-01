import cv2
import numpy as np
import os
import sys
from pathlib import Path

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from app.features.clearcast.clearcast_checker import ClearcastChecker

def create_dummy_video(filename, duration=5, fps=25):
    """Create a dummy video for testing"""
    height, width = 1080, 1920
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(filename, fourcc, fps, (width, height))
    
    frames = duration * fps
    for i in range(frames):
        # Create a frame with the frame number written on it
        img = np.zeros((height, width, 3), dtype=np.uint8)
        cv2.putText(img, f"Frame {i}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        out.write(img)
    
    out.release()
    return filename

def test_timestamp_extraction():
    video_path = "test_timestamp_video.mp4"
    try:
        create_dummy_video(video_path, duration=10, fps=25)
        
        checker = ClearcastChecker()
        # We expect 20 frames by default now
        frames = checker._extract_key_frames(video_path, num_frames=20)
        
        print(f"Extracted {len(frames)} frames")
        
        for i, (base64_data, timestamp) in enumerate(frames):
            print(f"Frame {i}: Timestamp {timestamp}")
            
            # Basic validation
            if not isinstance(base64_data, str):
                print(f"FAIL: Frame {i} base64 data is not a string")
            if not isinstance(timestamp, str):
                print(f"FAIL: Frame {i} timestamp is not a string")
            if ":" not in timestamp:
                print(f"FAIL: Frame {i} timestamp format incorrect: {timestamp}")
                
        # check specific timestamps
        # Frame 0 should be 00:00
        if frames[0][1] != "00:00":
             print(f"FAIL: First frame timestamp is {frames[0][1]}, expected 00:00")
             
        # Frame 19 (last one) should be near end. 
        # 10s video, 20 frames -> ~0.5s interval. 
        # Last frame index 19 maps to frame_pos = (19/19)*(250-1) = 249. 
        # 249/25 = 9.96s -> 00:09
        if frames[-1][1] != "00:09":
             print(f"FAIL: Last frame timestamp is {frames[-1][1]}, expected 00:09")
        else:
            print("SUCCESS: Last frame timestamp matches expected")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)

if __name__ == "__main__":
    test_timestamp_extraction()
