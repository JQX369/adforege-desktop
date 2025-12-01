"""
Unit test for LegalGeometryVerifier.
"""
import sys
from pathlib import Path

import pytest

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.core.legal_geometry import LegalGeometryVerifier

def test_geometry():
    verifier = LegalGeometryVerifier()
    
    print("Testing Text Height Verification...")
    # Test Case 1: Text too small (10 lines)
    # 10 / 1080 = 0.0092 (0.9%)
    bbox_small = [100, 100, 109, 500] # height 9 units (0.9%)
    passed, metrics, msg = verifier.verify_text_height(bbox_small, 1080)
    print(f"Small Text: Passed={passed}, Val={metrics['height_percent']:.4f}, Msg={msg}")
    assert not passed
    
    # Test Case 2: Text good (40 lines)
    # 40 / 1080 = 0.037 (3.7%)
    bbox_good = [100, 100, 137, 500] # height 37 units (3.7%)
    passed, metrics, msg = verifier.verify_text_height(bbox_good, 1080)
    print(f"Good Text: Passed={passed}, Val={metrics['height_percent']:.4f}, Msg={msg}")
    assert passed

    # Test Case 3: Exactly 30 lines should pass
    units_per_line = 1000 / 1080
    thirty_line_height = units_per_line * 30
    bbox_exact = [200.0, 100.0, 200.0 + thirty_line_height, 500.0]
    passed, metrics, msg = verifier.verify_text_height(bbox_exact, 1080)
    print(f"Exact 30 lines: Passed={passed}, Val={metrics['height_percent']:.4f}, Msg={msg}")
    assert passed

    # Test Case 4: 29 lines should fail
    twenty_nine_height = units_per_line * 29
    bbox_twenty_nine = [300.0, 100.0, 300.0 + twenty_nine_height, 500.0]
    passed, metrics, msg = verifier.verify_text_height(bbox_twenty_nine, 1080)
    print(f"29 lines: Passed={passed}, Val={metrics['height_percent']:.4f}, Msg={msg}")
    assert not passed

    print("\nTesting Duration Verification...")
    # 9 words -> (9 * 0.2) + 2.0 = 3.8s required. Actual 3.7s should fail.
    passed, metrics, msg = verifier.verify_duration(9, 3.7)
    print(f"9 words short: Passed={passed}, Req={metrics['required']}, Msg={msg}")
    assert not passed
    assert metrics["required"] == pytest.approx(3.8)
    
    # 9 words -> 3.8s should pass.
    passed, metrics, msg = verifier.verify_duration(9, 3.8)
    print(f"9 words exact: Passed={passed}, Req={metrics['required']}, Msg={msg}")
    assert passed
    
    # 10 words -> (10 * 0.2) + 3.0 = 5.0s required. Actual 4.9s should fail.
    passed, metrics, msg = verifier.verify_duration(10, 4.9)
    print(f"10 words short: Passed={passed}, Req={metrics['required']}, Msg={msg}")
    assert not passed
    assert metrics["required"] == pytest.approx(5.0)
    
    # 10 words -> 5.0s should pass.
    passed, metrics, msg = verifier.verify_duration(10, 5.0)
    print(f"10 words exact: Passed={passed}, Req={metrics['required']}, Msg={msg}")
    assert passed


def test_compliance_metadata_fields():
    verifier = LegalGeometryVerifier()
    units_per_line = 1000 / 1080
    bbox = [0.0, 0.0, units_per_line * 28, 500.0]
    text_item = {
        "text": "T&Cs apply",
        "bbox": bbox,
        "duration_seconds": 3.5,
    }

    result = verifier.check_compliance(text_item)
    height_check = result["height_check"]
    assert height_check["required_lines"] == 30
    assert height_check["hd_lines"] == pytest.approx(28.0, rel=1e-3)
    assert "actual_pixels" in height_check
    assert "required_pixels" in height_check

    duration_check = result["duration_check"]
    assert duration_check["delay_threshold"] == 10
    assert duration_check["recognition_delay_type"] == "short"
    assert duration_check["recognition_delay"] == pytest.approx(2.0)
    
    print("\nAll tests passed!")

if __name__ == "__main__":
    test_geometry()
