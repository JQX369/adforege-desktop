"""
Unit tests for Clearcast Audit Fixes
"""
import unittest
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.core.metadata_verifier import MetadataVerifier
from app.core.legal_geometry import LegalGeometryVerifier
from app.features.clearcast.clearcast_audio import ClearcastAudioAnalyzer

class TestAuditFixes(unittest.TestCase):
    
    def setUp(self):
        self.meta_verifier = MetadataVerifier()
        self.legal_verifier = LegalGeometryVerifier()
        self.audio_analyzer = ClearcastAudioAnalyzer()
        
    def test_legal_geometry_update(self):
        # Verify recognition time is now 3.0s
        self.assertEqual(self.legal_verifier.rules.recognition_delay_long, 3.0)
        
        # Test duration calculation
        # 10 words: (10 * 0.2) + 3.0 = 5.0s required
        passed, metrics, msg = self.legal_verifier.verify_duration(10, 4.0)
        self.assertFalse(passed)
        self.assertEqual(metrics["required"], 5.0)
        
        passed, metrics, msg = self.legal_verifier.verify_duration(10, 5.0)
        self.assertTrue(passed)

        # 9 words should require only 3.8 seconds (short recognition delay)
        passed, metrics, msg = self.legal_verifier.verify_duration(9, 3.7)
        self.assertFalse(passed)
        self.assertEqual(round(metrics["required"], 1), 3.8)
        
        passed, metrics, msg = self.legal_verifier.verify_duration(9, 3.8)
        self.assertTrue(passed)

    def test_clock_syntax(self):
        # Valid
        valid, msg = self.meta_verifier.verify_clock_syntax("ABC/PROD001/030")
        self.assertTrue(valid)
        
        # Invalid
        invalid_cases = [
            "ABC-PROD001-030", # Wrong separator
            "AB/PROD/030",     # Short agency
            "ABC/PROD/30",     # Short duration
            "ABCD/PROD/030"    # Long agency
        ]
        for case in invalid_cases:
            valid, msg = self.meta_verifier.verify_clock_syntax(case)
            self.assertFalse(valid, f"Should fail: {case}")

    def test_duration_match(self):
        # Match
        valid, msg = self.meta_verifier.verify_duration_match("ABC/PROD/030", 30.0)
        self.assertTrue(valid)
        
        # Mismatch
        valid, msg = self.meta_verifier.verify_duration_match("ABC/PROD/030", 20.0)
        self.assertFalse(valid)
        
        # Tolerance
        valid, msg = self.meta_verifier.verify_duration_match("ABC/PROD/030", 30.08)
        self.assertTrue(valid)

    def test_slated_master_detection(self):
        # 30s clock, 43s file -> Slated (10s slate + 3s black)
        is_slated = self.meta_verifier.is_slated_master(43.0, 30)
        self.assertTrue(is_slated)
        
        # 30s clock, 30s file -> Not slated
        is_slated = self.meta_verifier.is_slated_master(30.0, 30)
        self.assertFalse(is_slated)

if __name__ == '__main__':
    unittest.main()
