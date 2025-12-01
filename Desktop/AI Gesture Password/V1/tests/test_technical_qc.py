"""
Unit tests for Technical QC Module
"""
import unittest
import os
import sys
import tempfile
import shutil
import subprocess
import numpy as np
import cv2
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.core.technical_qc import TechnicalVerifier
from app.features.clearcast.clearcast_audio import ClearcastAudioAnalyzer

class TestTechnicalQC(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.verifier = TechnicalVerifier()
        self.audio_analyzer = ClearcastAudioAnalyzer()
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def create_dummy_video(self, filename, width=1920, height=1080, fps=25, duration=2, 
                          audio=True, silence_start=False, safe_violation=False, flashing=False):
        path = os.path.join(self.temp_dir, filename)
        
        # Create video using OpenCV
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(path, fourcc, fps, (width, height))
        
        frames = int(duration * fps)
        for i in range(frames):
            # Base frame
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            
            # Safe violation: Draw white rectangle in corner
            if safe_violation and i > 10:
                cv2.rectangle(frame, (0, 0), (100, 100), (255, 255, 255), -1)
                
            # Flashing: Toggle black/white every frame
            if flashing:
                if i % 2 == 0:
                    frame[:] = 255
                else:
                    frame[:] = 0
                    
            out.write(frame)
        out.release()
        
        # Add audio if requested
        if audio:
            # Generate audio
            audio_path = os.path.join(self.temp_dir, "temp_audio.wav")
            
            # If silence_start, we want silence for 0.5s then tone
            # If not, tone immediately
            
            filter_str = "sine=f=1000:d=2"
            if silence_start:
                # 0.5s silence, then 1.5s tone
                filter_str = "anullsrc=d=0.5[s];sine=f=1000:d=1.5[t];[s][t]concat=n=2:v=0:a=1"
                
            cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', filter_str,
                audio_path
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            
            # Merge
            final_path = os.path.join(self.temp_dir, f"final_{filename}")
            cmd = [
                'ffmpeg', '-y',
                '-i', path,
                '-i', audio_path,
                '-c:v', 'copy',
                '-c:a', 'aac',
                final_path
            ]
            try:
                subprocess.run(cmd, check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                print(f"Failed to add audio: {e.stderr}")
                return path
                
            if not os.path.exists(final_path) or os.path.getsize(final_path) == 0:
                print(f"Failed to create video with audio at {final_path}")
                return path
                
            return final_path
            
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            print(f"Failed to create video at {path}")
            
        return path

    def test_format_verification(self):
        # Test correct format
        video_path = self.create_dummy_video("correct.mp4", width=1920, height=1080, fps=25)
        print(f"Created video: {video_path}, Size: {os.path.getsize(video_path)}")
        
        res = self.verifier.verify_format(video_path)
        print(f"Format Result: {res}")
        
        if not res["passed"]:
            self.fail(f"Format verification failed: {res['issues']}")
        
        # Note: codec might fail if opencv uses mp4v, but resolution/fps should pass
        self.assertEqual(res["metadata"]["width"], 1920)
        self.assertEqual(res["metadata"]["height"], 1080)
        self.assertAlmostEqual(res["metadata"]["fps"], 25.0, delta=0.1)
        
        # Test incorrect format
        bad_path = self.create_dummy_video("bad.mp4", width=1280, height=720, fps=30)
        res = self.verifier.verify_format(bad_path)
        self.assertFalse(res["passed"])
        self.assertTrue(any("Resolution" in i for i in res["issues"]))
        self.assertTrue(any("Frame rate" in i for i in res["issues"]))

    def test_safe_area(self):
        # Test violation
        video_path = self.create_dummy_video("unsafe.mp4", safe_violation=True)
        res = self.verifier.check_safe_areas(video_path)
        self.assertFalse(res["passed"])
        self.assertTrue(len(res["violations"]) > 0)
        
        # Test clean
        clean_path = self.create_dummy_video("clean.mp4", safe_violation=False)
        res = self.verifier.check_safe_areas(clean_path)
        self.assertTrue(res["passed"])

    def test_pse_risk(self):
        # Test flashing
        flash_path = self.create_dummy_video("flash.mp4", flashing=True)
        res = self.verifier.check_pse_risk(flash_path)
        self.assertFalse(res["passed"])
        self.assertGreater(len(res["flash_events"]), 0)
        
        # Test static
        static_path = self.create_dummy_video("static.mp4", flashing=False)
        res = self.verifier.check_pse_risk(static_path)
        self.assertTrue(res["passed"])

    def test_silence_check(self):
        # Test with silence at start
        silent_path = self.create_dummy_video("silent_start.mp4", audio=True, silence_start=True)
        res = self.audio_analyzer.check_silence_head_tail(silent_path, duration_sec=0.2)
        self.assertTrue(res["head_silence"])
        
        # Test with noise at start
        noisy_path = self.create_dummy_video("noisy_start.mp4", audio=True, silence_start=False)
        res = self.audio_analyzer.check_silence_head_tail(noisy_path, duration_sec=0.2)
        self.assertFalse(res["head_silence"])

if __name__ == '__main__':
    unittest.main()
