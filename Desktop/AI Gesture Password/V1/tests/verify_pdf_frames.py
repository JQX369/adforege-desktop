"""
Verification script for PDF frame screenshots.
"""
import os
import sys
import base64
import logging
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.features.reporting.pdf_generator import AIBreakdownPDFGenerator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_dummy_frame(color=(100, 100, 255)):
    """Create a dummy solid color JPEG frame base64 string."""
    try:
        import cv2
        import numpy as np
        
        # Create a 1280x720 image
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        img[:] = color
        
        # Add some text to identify it
        cv2.putText(img, "TEST FRAME", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 3, (255, 255, 255), 5)
        
        _, buffer = cv2.imencode('.jpg', img)
        return base64.b64encode(buffer).decode('utf-8')
    except ImportError:
        logger.warning("OpenCV not found, using empty string")
        return ""

def test_pdf_generation():
    """Test generating a PDF with frame citations."""
    output_path = "test_frame_output.pdf"
    
    # Create dummy frames
    frame1 = create_dummy_frame((255, 0, 0))  # Blue
    frame2 = create_dummy_frame((0, 255, 0))  # Green
    frames = [frame1, frame2]
    
    # Mock results
    results = {
        "analyzed_at": "2023-10-27T10:00:00",
        "frames": frames,
        "breakdown": {
            "what_is_advertised": "Test Product",
            "brand_name": "Test Brand",
            "specific_product": "Super Widget",
            "identification_confidence": 95,
            "possible_alternatives": [],
            "key_elements": ["Logo", "Product Shot"],
            "key_messages": ["Buy now"],
            "narrative_structure": "Intro -> Demo -> CTA",
            "target_audience": "Testers",
            "production_quality": "High",
            "content_type": "Ad",
            "duration_category": "Short"
        },
        "estimated_outcome": {
            "effectiveness_score": 85,
            "primary_goal": "Sales",
            "reasoning": "Good ad",
            "score_rationale": ["Clear message"],
            "expected_metrics": {"engagement": "High"}
        },
        "green_highlights": [
            {
                "aspect": "Clear Branding",
                "explanation": "Logo is visible.",
                "evidence_text": "The logo appears clearly in the top right corner [Frame 1].",
                "impact": "High"
            }
        ],
        "yellow_highlights": [
            {
                "aspect": "Audio Level",
                "suggestion": "Increase volume.",
                "evidence_text": "Audio is quiet during the demo [Frame 2].",
                "priority": "Medium"
            }
        ],
        "soft_risks": [
            {
                "risk": "Fast Text",
                "impact": "Medium",
                "mitigation": "Slow down.",
                "evidence_text": "Disclaimer scrolls too fast [Frame 1]."
            }
        ],
        "audience_reactions": []
    }
    
    generator = AIBreakdownPDFGenerator()
    success = generator.generate_pdf(
        results,
        video_name="Test Video",
        video_duration=15.0,
        output_path=output_path
    )
    
    if success:
        print(f"SUCCESS: PDF generated at {output_path}")
        print("Please verify manually that screenshots appear next to the highlights.")
    else:
        print("FAILURE: PDF generation failed.")

if __name__ == "__main__":
    test_pdf_generation()
