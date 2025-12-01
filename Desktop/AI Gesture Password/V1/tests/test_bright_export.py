import unittest
import os
import shutil
import tempfile
from pathlib import Path
import cv2
import numpy as np
from app.core.video_processor import ClearcastVideoProcessor

class TestBrightExport(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.processor = ClearcastVideoProcessor()
        
        # Create a dummy video file for testing
        self.input_video = os.path.join(self.temp_dir, "test_input.mp4")
        self._create_dummy_video(self.input_video)
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def _create_dummy_video(self, path):
        """Create a simple 2-second video"""
        width, height = 1280, 720
        fps = 30
        duration = 2
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(path, fourcc, fps, (width, height))
        
        for i in range(duration * fps):
            frame = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
            # Add some text
            cv2.putText(frame, f"Frame {i}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            out.write(frame)
            
        out.release()
        
    def test_bright_export(self):
        """Test that Bright export creates a secondary file"""
        output_path = os.path.join(self.temp_dir, "output_broadcast.mp4")
        
        options = {
            'standard': 'UK_CLEARCAST',
            'export_bright': True,
            'add_slate': False,
            'add_padding': False
        }
        
        # Skip if ffmpeg not found (mocking would be better but this is an integration test)
        if not self.processor.ffmpeg_path:
            print("Skipping test_bright_export: FFmpeg not found")
            return

        result = self.processor.process_video(self.input_video, output_path, options=options)
        
        self.assertTrue(result['success'])
        self.assertTrue(os.path.exists(output_path), "Primary output should exist")
        
        bright_path = result.get('secondary_output_path')
        self.assertIsNotNone(bright_path, "Secondary output path should be returned")
        self.assertTrue(os.path.exists(bright_path), "Bright output file should exist")
        self.assertIn("_bright", bright_path, "Bright filename should contain suffix")
        
    def test_standards_config(self):
        """Test that standards are correctly defined"""
        standards = self.processor.BROADCAST_STANDARDS
        
        self.assertIn('UK_CLEARCAST', standards)
        self.assertIn('US_BROADCAST', standards)
        self.assertIn('WEB_BRIGHT', standards)
        
        uk = standards['UK_CLEARCAST']
        self.assertEqual(uk['video']['fps'], 25)
        self.assertEqual(uk['audio']['target_lufs'], -23.0)
        
        us = standards['US_BROADCAST']
        self.assertEqual(us['video']['fps'], 29.97)
        self.assertEqual(us['audio']['target_lufs'], -24.0)
        
        web = standards['WEB_BRIGHT']
        self.assertEqual(web['audio']['target_lufs'], -16.0)

if __name__ == '__main__':
    unittest.main()
