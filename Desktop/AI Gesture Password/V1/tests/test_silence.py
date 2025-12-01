import unittest
import os
import shutil
import tempfile
import subprocess
import numpy as np
import cv2
import sys
from pathlib import Path
# Add src to path
src_path = str(Path(__file__).parent.parent / "src")
if src_path not in sys.path:
    sys.path.append(src_path)

from app.core.video_processor import ClearcastVideoProcessor

class TestSilenceEnforcement(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.processor = ClearcastVideoProcessor()
        self.input_video = os.path.join(self.temp_dir, "test_input.mp4")
        self._create_dummy_video_with_audio(self.input_video)
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def _create_dummy_video_with_audio(self, path):
        """Create a 2-second video with audio using FFmpeg"""
        if not self.processor.ffmpeg_path:
            return
            
        # Generate video with sine wave audio (1080p, 48kHz)
        cmd = [
            self.processor.ffmpeg_path,
            '-f', 'lavfi', '-i', 'testsrc=duration=2:size=1920x1080:rate=25',
            '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=2:sample_rate=48000',
            '-c:v', 'libx264', '-c:a', 'aac', '-ar', '48000',
            '-y', path
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    def _check_silence(self, video_path, start_time, duration):
        """Check if audio is silent in the given window"""
        if not self.processor.ffmpeg_path:
            return True
            
        # Extract audio segment to raw PCM
        out_audio = os.path.join(self.temp_dir, "segment.pcm")
        cmd = [
            self.processor.ffmpeg_path,
            '-ss', str(start_time),
            '-t', str(duration),
            '-i', video_path,
            '-f', 's16le', '-ac', '1', # Mono 16-bit
            '-y', out_audio
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Read PCM data
        if not os.path.exists(out_audio):
            return False
            
        data = np.fromfile(out_audio, dtype=np.int16)
        if len(data) == 0:
            return True # Empty is silent?
            
        # Check max amplitude
        max_amp = np.max(np.abs(data))
        # Silence might not be absolute 0 due to compression artifacts, but should be very low
        # -60dB is roughly 32 in 16-bit audio (32768 scale)
        return max_amp < 100 # Allow small noise floor

    def test_silence_enforcement(self):
        """Test that start and end are muted"""
        if not self.processor.ffmpeg_path:
            print("Skipping test_silence_enforcement: FFmpeg not found")
            return

        output_path = os.path.join(self.temp_dir, "output_silence.mp4")
        
        # UK standard has enforce_silence=True
        options = {
            'standard': 'UK_CLEARCAST',
            'add_padding': False,
            'normalize_audio': False # Disable normalization to debug silence issue
        }
        
        result = self.processor.process_video(self.input_video, output_path, options=options)
        if not result['success']:
            print(f"Processing failed: {result.get('error')}")
            
        self.assertTrue(result['success'])
        
        # Check start silence (first 0.2s)
        is_start_silent = self._check_silence(output_path, 0, 0.2)
        self.assertTrue(is_start_silent, "Start of video should be silent")
        
        # Check end silence (last 0.2s of 2s video)
        is_end_silent = self._check_silence(output_path, 1.8, 0.2)
        self.assertTrue(is_end_silent, "End of video should be silent")
        
        # Check middle is NOT silent
        is_middle_silent = self._check_silence(output_path, 1.0, 0.2)
        self.assertFalse(is_middle_silent, "Middle of video should contain audio")

    def test_silent_slate(self):
        """Test silent slate generation"""
        if not self.processor.ffmpeg_path:
            return

        output_path = os.path.join(self.temp_dir, "output_slate.mp4")
        
        options = {
            'standard': 'UK_CLEARCAST',
            'add_slate': True,
            'slate_info': {
                'silent_slate': True,
                'clock_number': 'TEST/001'
            }
        }
        
        result = self.processor.process_video(self.input_video, output_path, options=options)
        if not result['success']:
            print(f"Slate test failed: {result.get('error')}")
            
        self.assertTrue(result['success'])
        
        # Slate is 13s long. Check first 5s for silence.
        # The slate is added BEFORE the video.
        # We need to check the intermediate slate file or the final output.
        # The final output will have slate (13s) + video (2s).
        
        is_slate_silent = self._check_silence(output_path, 2.0, 5.0)
        self.assertTrue(is_slate_silent, "Slate should be silent")

if __name__ == '__main__':
    unittest.main()
