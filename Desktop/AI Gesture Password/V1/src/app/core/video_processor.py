"""Video processor for converting videos to Clearcast-ready format"""

import os
import logging
import subprocess
import json
from pathlib import Path
from typing import Dict, Optional, Tuple, List
import numpy as np
import cv2
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None
import tempfile
import shutil

logger = logging.getLogger(__name__)

class ClearcastVideoProcessor:
    """Process videos to meet Clearcast and other broadcast technical standards"""
    
    # Broadcast standards profiles
    BROADCAST_STANDARDS = {
        'UK_CLEARCAST': {
            'name': 'UK Broadcast (Clearcast)',
            'audio': {
                'target_lufs': -23.0,  # EBU R128
                'max_peak': -1.0,      # dBTP
                'lra_target': 15.0,
                'silence_padding': 0.24, # ~6 frames at 25fps
                'enforce_silence': True,
            },
            'video': {
                'resolution': (1920, 1080),
                'fps': 25,
                'color_space': 'bt709',
                'safe_title_margin': 0.9,
                'safe_action_margin': 0.93,
            },
            'format': {
                'container': 'mov',
                'video_codec': 'prores_ks', # ProRes 422 HQ
                'video_profile': '3',       # 3 = HQ
                'audio_codec': 'pcm_s24le', # Uncompressed 24-bit
                'pixel_format': 'yuv422p10le',
                'video_bitrate': None,      # ProRes doesn't use bitrate
            }
        },
        'US_BROADCAST': {
            'name': 'US Broadcast (FCC/ATSC)',
            'audio': {
                'target_lufs': -24.0,  # ATSC A/85
                'max_peak': -2.0,
                'lra_target': 15.0,
                'silence_padding': 0.24,
                'enforce_silence': True,
            },
            'video': {
                'resolution': (1920, 1080),
                'fps': 29.97,
                'color_space': 'bt709',
                'safe_title_margin': 0.9,
            },
            'format': {
                'container': 'mp4',
                'video_codec': 'libx264',
                'video_profile': 'high',
                'audio_codec': 'aac',
                'pixel_format': 'yuv420p',
                'video_bitrate': '50M',
                'audio_bitrate': '320k',
            }
        },
        'WEB_BRIGHT': {
            'name': 'Web High Quality (Bright)',
            'audio': {
                'target_lufs': -16.0,  # Standard Web/Mobile
                'max_peak': -1.0,
                'lra_target': 15.0,
                'silence_padding': 0.0,
                'enforce_silence': False,
            },
            'video': {
                'resolution': (1920, 1080),
                'fps': None, # Keep original
                'color_space': 'bt709',
                'safe_title_margin': 1.0,
            },
            'format': {
                'container': 'mp4',
                'video_codec': 'libx264',
                'video_profile': 'high',
                'audio_codec': 'aac',
                'pixel_format': 'yuv420p',
                'video_bitrate': '15M', # High quality web
                'audio_bitrate': '320k',
            }
        }
    }
    
    def __init__(self):
        """Initialize the video processor"""
        self.ffmpeg_path = self._find_ffmpeg()
        if not self.ffmpeg_path:
            logger.warning("FFmpeg not found. Some features will be limited.")
    
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable"""
        # Try common locations
        possible_paths = [
            'ffmpeg',  # System PATH
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ]
        
        for path in possible_paths:
            try:
                result = subprocess.run([path, '-version'], 
                                     capture_output=True, 
                                     text=True,
                                     timeout=5)
                if result.returncode == 0:
                    logger.info(f"Found FFmpeg at: {path}")
                    return path
            except:
                continue
        
        return None
    
    def process_video(self, input_path: str, output_path: str, 
                     progress_callback=None, options=None) -> Dict[str, any]:
        """Process video to meet specific broadcast standards"""
        results = {
            'success': False,
            'output_path': output_path,
            'secondary_output_path': None,
            'fixes_applied': [],
            'warnings': [],
            'error': None
        }
        
        # Default options if none provided
        if options is None:
            options = {}
            
        # Get standard (default to UK Clearcast for backward compatibility)
        standard_key = options.get('standard', 'UK_CLEARCAST')
        standard = self.BROADCAST_STANDARDS.get(standard_key, self.BROADCAST_STANDARDS['UK_CLEARCAST'])
        
        # Merge standard defaults into options
        processing_options = {
            'normalize_audio': True,
            'remove_noise': False,
            'enhance_voice': False,
            'broadcast_safe': True,
            'auto_levels': True,
            'denoise': False,
            'scale_hd': True,
            'convert_fps': True,
            'deinterlace': True,
            'add_padding': False,
            'add_slate': False,
            'slate_info': {},
            'export_bright': False
        }
        processing_options.update(options)
        
        try:
            # Create temp directory for intermediate files
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_dir = Path(temp_dir)
                
                # Step 1: Analyze video
                logger.info(f"Analyzing video for {standard['name']}...")
                if progress_callback:
                    progress_callback(0.1, "Analyzing video...")
                    
                analysis = self._analyze_video(input_path)
                
                # Step 2: Apply video corrections (Moved before slate)
                logger.info("Applying video corrections...")
                if progress_callback:
                    progress_callback(0.2, "Correcting video quality...")
                    
                video_fixed_path = temp_dir / "video_fixed.mp4"
                video_fixes = self._fix_video_quality(input_path, str(video_fixed_path), analysis, processing_options, standard)
                results['fixes_applied'].extend(video_fixes)
                
                # Step 3: Add slate if requested (UK only usually)
                current_input = str(video_fixed_path)
                if processing_options.get('add_slate', False):
                    logger.info("Creating slate...")
                    if progress_callback:
                        progress_callback(0.4, "Creating slate...")
                    
                    slate_path = temp_dir / "slate_video.mp4"
                    slate_info = processing_options.get('slate_info', {})
                    self._create_slate_video(str(slate_path), slate_info, analysis, standard)
                    
                    # Combine slate with corrected video
                    with_slate_path = temp_dir / "with_slate.mp4"
                    self._combine_slate_and_video(str(slate_path), str(video_fixed_path), str(with_slate_path))
                    current_input = str(with_slate_path)
                    results['fixes_applied'].append("Added clock slate with countdown")
                
                # Step 4: Apply audio corrections
                logger.info("Applying audio corrections...")
                if progress_callback:
                    progress_callback(0.5, "Normalizing audio...")
                    
                audio_fixed_path = temp_dir / "audio_fixed.mp4"
                audio_fixes = self._fix_audio_quality(current_input, str(audio_fixed_path), analysis, processing_options, standard)
                results['fixes_applied'].extend(audio_fixes)
                
                # Step 5: Final format conversion (Primary Output)
                logger.info(f"Converting to {standard['name']} format...")
                if progress_callback:
                    progress_callback(0.7, "Converting to broadcast format...")
                    
                # Check if we need padding
                if processing_options.get('add_padding', False):
                    final_output_temp = temp_dir / "final_no_padding.mov" # Use .mov for temp to support PCM if needed
                else:
                    final_output_temp = output_path
                
                format_fixes = self._convert_to_broadcast_format(str(audio_fixed_path), str(final_output_temp), processing_options, standard)
                results['fixes_applied'].extend(format_fixes)
                
                # Step 6: Add padding if requested
                if processing_options.get('add_padding', False):
                    logger.info("Adding black padding...")
                    if progress_callback:
                        progress_callback(0.8, "Adding padding...")
                    
                    # Use appropriate extension based on standard
                    ext = standard['format']['container']
                    padded_path = temp_dir / f"padded_final.{ext}"
                    
                    self._add_padding(str(final_output_temp), str(padded_path), standard)
                    # Move padded to final output
                    if os.path.exists(output_path):
                        os.remove(output_path)
                    shutil.move(str(padded_path), output_path)
                    results['fixes_applied'].append(f"Added black padding ({standard['audio']['silence_padding']}s)")
                
                # Step 7: Export Bright Format (Secondary Output)
                if processing_options.get('export_bright', False):
                    logger.info("Creating Bright format copy...")
                    if progress_callback:
                        progress_callback(0.9, "Creating Web/Bright copy...")
                        
                    bright_standard = self.BROADCAST_STANDARDS['WEB_BRIGHT']
                    bright_filename = Path(output_path).stem + "_bright.mp4"
                    bright_output_path = str(Path(output_path).parent / bright_filename)
                    
                    bright_audio_fixed = temp_dir / "bright_audio_fixed.mp4"
                    self._fix_audio_quality(str(video_fixed_path), str(bright_audio_fixed), analysis, processing_options, bright_standard)
                    
                    self._convert_to_broadcast_format(str(bright_audio_fixed), bright_output_path, processing_options, bright_standard)
                    results['secondary_output_path'] = bright_output_path
                    results['fixes_applied'].append("Created Bright/Web copy")

                # Step 8: Validate output
                logger.info("Validating output...")
                if progress_callback:
                    progress_callback(0.95, "Validating output...")
                    
                validation = self._validate_output(output_path, standard)
                results['warnings'] = validation.get('warnings', [])
                
                results['success'] = True
                logger.info(f"Video processing complete: {output_path}")
                
                if progress_callback:
                    progress_callback(1.0, "Complete!")
                    
        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            results['error'] = str(e)
            import traceback
            logger.error(traceback.format_exc())
            
        return results
    
    def _analyze_video(self, video_path: str) -> Dict:
        """Analyze video for technical issues"""
        analysis = {
            'video': {},
            'audio': {},
            'issues': []
        }
        
        try:
            # Use OpenCV for video analysis
            cap = cv2.VideoCapture(video_path)
            
            # Video properties
            analysis['video']['fps'] = cap.get(cv2.CAP_PROP_FPS)
            analysis['video']['width'] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            analysis['video']['height'] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            analysis['video']['frame_count'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Sample frames for quality analysis
            sample_frames = []
            total_frames = analysis['video']['frame_count']
            sample_interval = max(1, total_frames // 10)  # Sample 10 frames
            
            for i in range(0, total_frames, sample_interval):
                cap.set(cv2.CAP_PROP_POS_FRAMES, i)
                ret, frame = cap.read()
                if ret:
                    sample_frames.append(frame)
            
            cap.release()
            
            # Analyze brightness/contrast
            if sample_frames:
                brightness_values = []
                contrast_values = []
                
                for frame in sample_frames:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    brightness_values.append(np.mean(gray))
                    contrast_values.append(np.std(gray))
                
                analysis['video']['avg_brightness'] = np.mean(brightness_values)
                analysis['video']['avg_contrast'] = np.mean(contrast_values)
                
                # Check for issues
                if analysis['video']['avg_brightness'] < 50:
                    analysis['issues'].append('Video too dark')
                elif analysis['video']['avg_brightness'] > 200:
                    analysis['issues'].append('Video too bright')
                    
                if analysis['video']['avg_contrast'] < 30:
                    analysis['issues'].append('Low contrast')
            
            # Audio analysis using FFmpeg probe
            if self.ffmpeg_path:
                audio_info = self._probe_audio(video_path)
                analysis['audio'] = audio_info
                
        except Exception as e:
            logger.error(f"Video analysis error: {e}")
            
        return analysis
    
    def _probe_audio(self, video_path: str) -> Dict:
        """Probe audio using FFmpeg"""
        audio_info = {}
        
        try:
            cmd = [
                self.ffmpeg_path, '-i', video_path,
                '-af', 'loudnorm=print_format=json',
                '-f', 'null', '-'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Parse loudness info from stderr
            lines = result.stderr.split('\n')
            for i, line in enumerate(lines):
                if '"input_i"' in line:
                    # Found JSON output
                    json_start = i - 1
                    json_lines = []
                    while i < len(lines) and '}' not in lines[i]:
                        json_lines.append(lines[i])
                        i += 1
                    json_lines.append(lines[i])
                    
                    json_str = '\n'.join(json_lines)
                    loudness_data = json.loads(json_str)
                    
                    audio_info['integrated_lufs'] = float(loudness_data.get('input_i', -99))
                    audio_info['true_peak'] = float(loudness_data.get('input_tp', 0))
                    audio_info['lra'] = float(loudness_data.get('input_lra', 0))
                    break
                    
        except Exception as e:
            logger.error(f"Audio probe error: {e}")
            
        return audio_info
    
    def _fix_video_quality(self, input_path: str, output_path: str, 
                          analysis: Dict, options: Dict, standard: Dict) -> list:
        """Apply video quality fixes"""
        fixes_applied = []
        
        if not self.ffmpeg_path:
            # Fallback to OpenCV
            return self._fix_video_opencv(input_path, output_path, analysis, options)
        
        # Build FFmpeg filter chain
        filters = []
        
        # Color correction (if enabled)
        if options.get('auto_levels', True) and 'avg_brightness' in analysis['video']:
            brightness = analysis['video']['avg_brightness']
            if brightness < 50:
                filters.append('eq=brightness=0.2:contrast=1.1')
                fixes_applied.append("Increased brightness")
            elif brightness > 200:
                filters.append('eq=brightness=-0.1:contrast=1.05')
                fixes_applied.append("Reduced brightness")
        
        # Add broadcast safe filter (if enabled)
        if options.get('broadcast_safe', True):
            filters.append('limiter=min=16:max=235')  # Broadcast safe levels
            fixes_applied.append("Applied broadcast safe colors")
        
        # Deinterlace if needed (if enabled)
        if options.get('deinterlace', True):
            filters.append('yadif=mode=1')
            fixes_applied.append("Deinterlaced video")
        
        # Denoise if enabled
        if options.get('denoise', False):
            filters.append('hqdn3d=4:3:6:4.5')
            fixes_applied.append("Applied noise reduction")
        
        # Scale to HD if needed (if enabled)
        if options.get('scale_hd', True):
            current_res = (analysis['video']['width'], analysis['video']['height'])
            target_res = standard['video']['resolution']
            
            if current_res != target_res:
                filters.append(f"scale={target_res[0]}:{target_res[1]}:flags=lanczos")
                fixes_applied.append(f"Scaled to {target_res[0]}x{target_res[1]}")
        
        # Build command
        filter_str = ','.join(filters) if filters else None
        
        cmd = [self.ffmpeg_path, '-i', input_path, '-y']
        
        if filter_str:
            cmd.extend(['-vf', filter_str])
        
        # Intermediate encoding (high quality)
        cmd.extend([
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '18',  # High quality
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', # Ensure audio is preserved/converted
            '-ar', '48000',
            '-color_primaries', standard['video']['color_space'],
            '-color_trc', standard['video']['color_space'],
            '-colorspace', standard['video']['color_space'],
            output_path
        ])
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg video fix error: {e.stderr}")
            raise
            
        return fixes_applied
    
    def _fix_video_opencv(self, input_path: str, output_path: str, 
                         analysis: Dict, options: Dict) -> list:
        """Fallback video fixing using OpenCV"""
        fixes_applied = []
        
        try:
            clip = VideoFileClip(input_path)
            
            def process_frame(frame):
                # Apply corrections
                if analysis['video'].get('avg_brightness', 128) < 50:
                    # Increase brightness
                    frame = cv2.convertScaleAbs(frame, alpha=1.2, beta=20)
                    
                # Ensure broadcast safe
                frame = np.clip(frame, 16, 235)
                
                return frame
            
            # Process video
            processed = clip.fl_image(process_frame)
            
            # Write output
            processed.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True
            )
            
            fixes_applied.append("Applied basic video corrections")
            
        except Exception as e:
            logger.error(f"OpenCV video fix error: {e}")
            raise
            
        return fixes_applied
    
    def _fix_audio_quality(self, input_path: str, output_path: str, 
                          analysis: Dict, options: Dict, standard: Dict) -> list:
        """Apply audio normalization to standard"""
        fixes_applied = []
        
        if not self.ffmpeg_path:
            # Without FFmpeg, just copy the file
            shutil.copy2(input_path, output_path)
            return ["Audio processing skipped (FFmpeg not available)"]
        
        # Build audio filter chain
        audio_filters = []
        
        # Normalize audio if enabled
        if options.get('normalize_audio', True):
            current_lufs = analysis['audio'].get('integrated_lufs', -99)
            target_lufs = standard['audio']['target_lufs']
            max_peak = standard['audio']['max_peak']
            lra = standard['audio']['lra_target']
            
            audio_filters.append(f"loudnorm=I={target_lufs}:TP={max_peak}:LRA={lra}")
            fixes_applied.append(f"Normalized audio from {current_lufs:.1f} to {target_lufs} LUFS")

        # Enforce silence at head/tail if required
        if standard['audio'].get('enforce_silence', False):
            silence_duration = standard['audio'].get('silence_padding', 0)
            if silence_duration > 0:
                # Mute first X seconds
                audio_filters.append(f"volume=enable='between(t,0,{silence_duration})':volume=0")
                # Mute last X seconds (we need duration)
                duration = analysis['video'].get('frame_count', 0) / analysis['video'].get('fps', 25)
                if duration > 0:
                    start_mute = duration - silence_duration
                    audio_filters.append(f"volume=enable='between(t,{start_mute},{duration})':volume=0")
                fixes_applied.append(f"Muted first/last {silence_duration}s")
        
        if audio_filters:
            filter_str = ','.join(audio_filters)
            cmd = [
                self.ffmpeg_path, '-i', input_path, '-y',
                '-af', filter_str,
                '-c:v', 'copy',  # Copy video stream
                '-c:a', 'aac',   # Intermediate audio
                '-b:a', '320k',
                output_path
            ]
        else:
            # No audio processing needed, just copy
            shutil.copy2(input_path, output_path)
            return ["No audio processing applied"]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"Audio processing error: {e.stderr}")
            raise
            
        return fixes_applied
    
    def _convert_to_broadcast_format(self, input_path: str, output_path: str, options: Dict, standard: Dict) -> list:
        """Convert to final broadcast format"""
        fixes_applied = []
        
        if not self.ffmpeg_path:
            # Just copy the file
            shutil.copy2(input_path, output_path)
            return ["Format conversion skipped (FFmpeg not available)"]
        
        fmt = standard['format']
        
        cmd = [
            self.ffmpeg_path, '-i', input_path, '-y',
            # Video settings
            '-c:v', fmt['video_codec']
        ]
        
        # Add codec-specific settings
        if fmt.get('video_profile'):
            if fmt['video_codec'] == 'prores_ks':
                cmd.extend(['-profile:v', fmt['video_profile']])
            else:
                cmd.extend(['-profile:v', fmt['video_profile']])
            
        if fmt.get('video_bitrate'):
            cmd.extend(['-b:v', fmt['video_bitrate']])
            
        # Frame rate conversion if enabled
        if options.get('convert_fps', True) and standard['video']['fps']:
            cmd.extend(['-r', str(standard['video']['fps'])])
            fixes_applied.append(f"Converted to {standard['video']['fps']}fps")
            
        # Pixel format
        if fmt.get('pixel_format'):
            cmd.extend(['-pix_fmt', fmt['pixel_format']])
        
        # Audio settings
        cmd.extend([
            '-c:a', fmt['audio_codec'],
            '-ar', '48000',  # 48kHz sample rate
        ])
        
        if fmt.get('audio_bitrate'):
            cmd.extend(['-b:a', fmt['audio_bitrate']])
        
        # Container settings
        cmd.extend(['-f', fmt['container']])
        
        if fmt['container'] == 'mp4':
            cmd.extend(['-movflags', '+faststart'])
            
        cmd.append(output_path)
        
        fixes_applied.append(f"Converted to {standard['name']} format")
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            fixes_applied.append("Final format conversion complete")
        except subprocess.CalledProcessError as e:
            logger.error(f"Format conversion error: {e.stderr}")
            raise
            
        return fixes_applied
    
    def _validate_output(self, output_path: str, standard: Dict) -> Dict:
        """Validate the output meets standards"""
        validation = {
            'valid': True,
            'warnings': []
        }
        
        try:
            # Check file exists and size
            if not os.path.exists(output_path):
                validation['valid'] = False
                validation['warnings'].append("Output file not created")
                return validation
                
            file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            if file_size_mb > 2000: # Warn if > 2GB
                validation['warnings'].append(f"File size large: {file_size_mb:.1f}MB")
            
            # Check video properties
            cap = cv2.VideoCapture(output_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            
            target_fps = standard['video']['fps']
            if target_fps and abs(fps - target_fps) > 0.1:
                validation['warnings'].append(f"FPS is {fps:.1f}, expected {target_fps}")
                
            target_res = standard['video']['resolution']
            if (width, height) != target_res:
                validation['warnings'].append(f"Resolution is {width}x{height}, expected {target_res[0]}x{target_res[1]}")
                
        except Exception as e:
            logger.error(f"Validation error: {e}")
            validation['warnings'].append(f"Validation error: {str(e)}")
            
        return validation
    
    def _create_slate_video(self, output_path: str, slate_info: Dict, analysis: Dict, standard: Dict):
        """Create a slate video with countdown"""
        if not self.ffmpeg_path:
            logger.warning("FFmpeg not available, skipping slate creation")
            return
            
        # Video properties
        width = standard['video']['resolution'][0]
        height = standard['video']['resolution'][1]
        fps = standard['video']['fps'] or 25
        duration = 13  # 10 sec countdown + 3 sec black
        
        # Get duration from analysis or slate info
        video_duration = analysis.get('video', {}).get('frame_count', 0) / analysis.get('video', {}).get('fps', 25)
        if video_duration > 0:
            slate_info['duration'] = f"{int(video_duration):03d}"
        
        # Create slate using FFmpeg with drawtext filter
        filter_complex = []
        
        # Background (dark gray)
        filter_complex.append(f"color=c=#1a1a1a:s={width}x{height}:d=13[bg]")
        
        # Add text elements (showing for first 10 seconds)
        y_pos = 200
        text_elements = [
            f"drawtext=text='{slate_info.get('clock_number', 'ABC/PROD001/030')}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y={y_pos}:enable='lt(t,10)'",
            f"drawtext=text='Client\\: {slate_info.get('client_name', 'Client')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+100}:enable='lt(t,10)'",
            f"drawtext=text='Agency\\: {slate_info.get('agency_name', 'Agency')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+150}:enable='lt(t,10)'",
            f"drawtext=text='Product\\: {slate_info.get('product_name', 'Product')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+200}:enable='lt(t,10)'",
            f"drawtext=text='Title\\: {slate_info.get('title', 'Advertisement')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+250}:enable='lt(t,10)'",
            f"drawtext=text='Duration\\: {slate_info.get('duration', '030')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+300}:enable='lt(t,10)'",
            f"drawtext=text='Ratio\\: {slate_info.get('ratio', 'HD')}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y={y_pos+350}:enable='lt(t,10)'"
        ]
        
        # Add countdown (10 to 3)
        # We can use a simple loop or just a few drawtext commands
        for i in range(10, 2, -1):
            text_elements.append(f"drawtext=text='{i}':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,{10-i},{10-i+1})'")
            
        # Combine all text filters
        text_filter_str = ','.join(text_elements)
        filter_complex.append(f"[bg]{text_filter_str}[v]")
        
        # Audio tone (1kHz at -18dBFS) for first 10 seconds
        # If silent_slate is True, use silence instead
        if slate_info.get('silent_slate', False):
            audio_source = f"anullsrc=r=48000:cl=stereo:d=10"
        else:
            audio_source = f"sine=frequency=1000:duration=10:sample_rate=48000,volume=-18dB"
            
        filter_complex.append(f"{audio_source}[tone]")
        filter_complex.append(f"anullsrc=r=48000:cl=stereo:d=3[silence]")
        filter_complex.append(f"[tone][silence]concat=n=2:v=0:a=1[a]")
        
        filter_str = ';'.join(filter_complex)
        
        cmd = [
            self.ffmpeg_path,
            '-filter_complex', filter_str,
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-r', str(fps),
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-ar', '48000',
            '-ac', '2',
            '-t', str(duration),
            '-y',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Created slate video: {output_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create slate: {e.stderr}")
            raise

    def _combine_slate_and_video(self, slate_path: str, video_path: str, output_path: str):
        """Combine slate and main video"""
        if not self.ffmpeg_path:
            logger.warning("FFmpeg not available, skipping combine")
            return
            
        cmd = [
            self.ffmpeg_path,
            '-i', slate_path,
            '-i', video_path,
            '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]',
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'libx264', # Re-encode to ensure compatibility
            '-preset', 'fast',
            '-c:a', 'aac',
            '-y',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Combined slate with video: {output_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to combine videos: {e.stderr}")
            raise

    def _add_padding(self, input_path: str, output_path: str, standard: Dict):
        """Add black and silence padding at start and end"""
        if not self.ffmpeg_path:
            logger.warning("FFmpeg not available, skipping padding")
            shutil.copy2(input_path, output_path)
            return
            
        # Get video properties
        probe_cmd = [
            self.ffmpeg_path, '-i', input_path,
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,r_frame_rate',
            '-of', 'json'
        ]
        
        try:
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            import json
            probe_data = json.loads(result.stdout)
            stream = probe_data['streams'][0]
            width = stream['width']
            height = stream['height']
            fps_parts = stream['r_frame_rate'].split('/')
            fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else 25
        except:
            # Default values if probe fails
            width, height, fps = 1920, 1080, 25
            
        padding_duration = standard['audio'].get('silence_padding', 0)
        if padding_duration <= 0:
            shutil.copy2(input_path, output_path)
            return
        
        # Create black video with silence
        cmd = [
            self.ffmpeg_path,
            # Black at start
            '-f', 'lavfi',
            '-i', f'color=black:s={width}x{height}:d={padding_duration}:r={fps}',
            '-f', 'lavfi',
            '-i', f'anullsrc=r=48000:cl=stereo:d={padding_duration}',
            # Original video
            '-i', input_path,
            # Black at end  
            '-f', 'lavfi',
            '-i', f'color=black:s={width}x{height}:d={padding_duration}:r={fps}',
            '-f', 'lavfi',
            '-i', f'anullsrc=r=48000:cl=stereo:d={padding_duration}',
            # Concatenate all
            '-filter_complex',
            '[0:v][1:a][2:v][2:a][3:v][4:a]concat=n=3:v=1:a=1[outv][outa]',
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', standard['format']['video_codec'],
            '-c:a', standard['format']['audio_codec'],
            '-ar', '48000',
            '-y',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Added padding to video: {output_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to add padding: {e.stderr}")
            raise








