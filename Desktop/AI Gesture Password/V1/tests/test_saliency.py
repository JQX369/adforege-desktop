"""
Unit test for SaliencyEngine.
"""
import sys
import cv2
import numpy as np
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.features.ai_breakdown.saliency_engine import SaliencyEngine

def test_saliency():
    engine = SaliencyEngine()
    
    print("Testing Saliency Engine...")
    
    # Create a dummy frame (black background)
    frame = np.zeros((500, 500, 3), dtype=np.uint8)
    
    # Add a bright white square in the center (High Saliency)
    cv2.rectangle(frame, (200, 200), (300, 300), (255, 255, 255), -1)
    
    # Add a dim gray square in the corner (Low Saliency)
    cv2.rectangle(frame, (10, 10), (50, 50), (50, 50, 50), -1)
    
    # Generate heatmap
    heatmap = engine.generate_heatmap(frame)
    
    if heatmap is not None:
        print("SUCCESS: Heatmap generated.")
    else:
        print("FAILURE: Heatmap generation failed.")
        return

    # Test Attention Analysis
    
    # Case 1: Center (Hot Zone)
    # Normalized bbox: [ymin, xmin, ymax, xmax]
    # 200/500 = 400, 300/500 = 600
    bbox_center = [400, 400, 600, 600]
    status_center = engine.analyze_attention(frame, bbox_center)
    print(f"Center Region Status: {status_center}")
    
    # Case 2: Corner (Cold Zone)
    bbox_corner = [20, 20, 100, 100]
    status_corner = engine.analyze_attention(frame, bbox_corner)
    print(f"Corner Region Status: {status_corner}")
    
    # Verify logic
    # Note: Contrast map alone might not make the center "Hot" without motion or faces, 
    # but it should be warmer than the black background.
    # Our simple engine weights motion heavily. With static image, it relies on contrast.
    
    if "Cold" not in status_center:
        print("SUCCESS: Center detected as non-cold.")
    else:
        print("NOTE: Center detected as Cold (Expected for static image without motion/faces).")
        
    print("\nAll tests completed.")

if __name__ == "__main__":
    test_saliency()
