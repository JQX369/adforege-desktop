"""Video processor for converting videos to Clearcast-ready format"""

import os
import logging
import subprocess
import json
from pathlib import Path
from typing import Dict, Optional, Tuple
import numpy as np
import cv2
from moviepy.editor import VideoFileClip
import tempfile
import shutil

logger = logging.getLogger(__name__)

class ClearcastVideoProcessor:
    """Process videos to meet Clearcast technical standards"""
    
    # Broadcast standards
    BROADCAST_STANDARDS = {
        'audio': {
            'target_lufs': -23.0,  # EBU R128 standard
            'max_peak': -1.0,      # dBFS
            'lra_target': 15.0,    # Loudness range
        },
        'video': {
            'resolution': (1920, 1080),  # Full HD
            'fps': 25,  # PAL standard
            'color_space': 'bt709',
            'bit_depth': 8,
            'safe_title_margin': 0.9,  # 90% safe area
            'safe_action_margin': 0.93, # 93% safe area
        },
        'format': {
            'container': 'mp4',
            'video_codec': 'h264',
            'audio_codec': 'aac',
            'video_bitrate': '50M',  # 50 Mbps
            'audio_bitrate': '320k',
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
        """Process video to meet Clearcast standards"""
        results = {
            'success': False,
            'output_path': output_path,
            'fixes_applied': [],
            'warnings': [],
            'error': None
        }
        
        # Default options if none provided
        if options is None:
            options = {
                'normalize_audio': True,
                'remove_noise': False,
                'enhance_voice': False,
                'broadcast_safe': True,
                'auto_levels': True,
                'denoise': False,
                'scale_hd': True,
                'convert_fps': True,
                'deinterlace': True,
                'quality': 'standard',
                'add_padding': False,
                'add_slate': False,
                'slate_info': {}
            }
        
        try:
            # Create temp directory for intermediate files
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_dir = Path(temp_dir)
                
                # Step 1: Analyze video
                logger.info("Analyzing video...")
                if progress_callback:
                    progress_callback(0.1, "Analyzing video...")
                    
                analysis = self._analyze_video(input_path)
                
                # Step 2: Add slate if requested
                current_input = input_path
                if options.get('add_slate', False):
                    logger.info("Creating slate...")
                    if progress_callback:
                        progress_callback(0.2, "Creating slate...")
                    
                    slate_path = temp_dir / "slate_video.mp4"
                    slate_info = options.get('slate_info', {})
                    self._create_slate_video(str(slate_path), slate_info, analysis)
                    
                    # Combine slate with original video
                    with_slate_path = temp_dir / "with_slate.mp4"
                    self._combine_slate_and_video(str(slate_path), input_path, str(with_slate_path))
                    current_input = str(with_slate_path)
                    results['fixes_applied'].append("Added clock slate with countdown")
                
                # Step 3: Apply video corrections
                logger.info("Applying video corrections...")
                if progress_callback:
                    progress_callback(0.3, "Correcting video quality...")
                    
                video_fixed_path = temp_dir / "video_fixed.mp4"
                video_fixes = self._fix_video_quality(current_input, str(video_fixed_path), analysis, options)
                results['fixes_applied'].extend(video_fixes)
                
                # Step 3: Apply audio corrections
                logger.info("Applying audio corrections...")
                if progress_callback:
                    progress_callback(0.5, "Normalizing audio...")
                    
                audio_fixed_path = temp_dir / "audio_fixed.mp4"
                audio_fixes = self._fix_audio_quality(str(video_fixed_path), str(audio_fixed_path), analysis, options)
                results['fixes_applied'].extend(audio_fixes)
                
                # Step 4: Final format conversion
                logger.info("Converting to broadcast format...")
                if progress_callback:
                    progress_callback(0.7, "Converting to broadcast format...")
                    
                # Check if we need padding
                if options.get('add_padding', False):
                    final_output = output_path
                else:
                    final_output = temp_dir / "final_no_padding.mp4"
                
                format_fixes = self._convert_to_broadcast_format(str(audio_fixed_path), str(final_output), options)
                results['fixes_applied'].extend(format_fixes)
                
                # Step 5: Add padding if requested
                if options.get('add_padding', False):
                    logger.info("Adding black padding...")
                    if progress_callback:
                        progress_callback(0.85, "Adding padding...")
                    
                    padded_path = temp_dir / "padded_final.mp4"
                    self._add_padding(str(final_output), str(padded_path))
                    # Move padded to final output
                    shutil.move(str(padded_path), output_path)
                    results['fixes_applied'].append("Added black padding at start/end (5 frames/0.2 sec)")
                else:
                    # Move to final output
                    shutil.move(str(final_output), output_path)
                
                # Step 6: Validate output
                logger.info("Validating output...")
                if progress_callback:
                    progress_callback(0.9, "Validating output...")
                    
                validation = self._validate_output(output_path)
                results['warnings'] = validation.get('warnings', [])
                
                results['success'] = True
                logger.info(f"Video processing complete: {output_path}")
                
                if progress_callback:
                    progress_callback(1.0, "Complete!")
                    
        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            results['error'] = str(e)
            
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
                          analysis: Dict, options: Dict) -> list:
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
            target_res = self.BROADCAST_STANDARDS['video']['resolution']
            
            if current_res != target_res:
                filters.append(f'scale={target_res[0]}:{target_res[1]}:flags=lanczos')
                fixes_applied.append(f"Scaled to {target_res[0]}x{target_res[1]}")
        
        # Build command
        filter_str = ','.join(filters) if filters else None
        
        cmd = [self.ffmpeg_path, '-i', input_path, '-y']
        
        if filter_str:
            cmd.extend(['-vf', filter_str])
        
        # Video encoding settings
        cmd.extend([
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '18',  # High quality
            '-pix_fmt', 'yuv420p',
            '-color_primaries', 'bt709',
            '-color_trc', 'bt709',
            '-colorspace', 'bt709',
            '-movflags', '+faststart',
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
                          analysis: Dict, options: Dict) -> list:
        """Apply audio normalization to EBU R128 standard"""
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
            target_lufs = self.BROADCAST_STANDARDS['audio']['target_lufs']
            audio_filters.append(f'loudnorm=I={target_lufs}:TP=-1.5:LRA=11')
            fixes_applied.append(f"Normalized audio from {current_lufs:.1f} to {target_lufs} LUFS")
        
        # Remove noise if enabled
        if options.get('remove_noise', False):
            audio_filters.append('afftdn=nr=10:nf=-25')
            fixes_applied.append("Applied noise reduction")
        
        # Enhance voice if enabled
        if options.get('enhance_voice', False):
            audio_filters.append('highpass=f=80,lowpass=f=8000,compand=attacks=0.3:decays=0.8:points=-70/-70|-24/-8|0/-6|20/-6')
            fixes_applied.append("Enhanced dialogue clarity")
        
        # Build command
        if audio_filters:
            filter_str = ','.join(audio_filters)
            cmd = [
                self.ffmpeg_path, '-i', input_path, '-y',
                '-af', filter_str,
                '-c:v', 'copy',  # Copy video stream
                '-c:a', 'aac',
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
    
    def _convert_to_broadcast_format(self, input_path: str, output_path: str, options: Dict) -> list:
        """Convert to final broadcast format"""
        fixes_applied = []
        
        if not self.ffmpeg_path:
            # Just copy the file
            shutil.copy2(input_path, output_path)
            return ["Format conversion skipped (FFmpeg not available)"]
        
        standards = self.BROADCAST_STANDARDS
        quality = options.get('quality', 'standard')
        
        # Quality presets
        quality_settings = {
            'high': {
                'codec': 'prores',
                'profile': '-profile:v 2',  # ProRes 422
                'bitrate': None,  # ProRes doesn't use bitrate
            },
            'standard': {
                'codec': 'libx264',
                'profile': '-preset slow -crf 18',
                'bitrate': '50M',
            },
            'web': {
                'codec': 'libx264', 
                'profile': '-preset medium -crf 23',
                'bitrate': '10M',
            }
        }
        
        settings = quality_settings[quality]
        
        cmd = [
            self.ffmpeg_path, '-i', input_path, '-y',
            # Video settings
            '-c:v', settings['codec']
        ]
        
        # Add codec-specific settings
        if settings['profile']:
            cmd.extend(settings['profile'].split())
            
        if settings['bitrate']:
            cmd.extend(['-b:v', settings['bitrate']])
            
        # Frame rate conversion if enabled
        if options.get('convert_fps', True):
            cmd.extend(['-r', str(standards['video']['fps'])])
            fixes_applied.append(f"Converted to {standards['video']['fps']}fps")
            
        # Pixel format
        cmd.extend(['-pix_fmt', 'yuv420p' if quality != 'high' else 'yuv422p10le'])
        
        # Audio settings
        cmd.extend([
            '-c:a', standards['format']['audio_codec'],
            '-b:a', standards['format']['audio_bitrate'],
            '-ar', '48000',  # 48kHz sample rate
        ])
        
        # Container settings
        if quality == 'high':
            cmd.extend(['-f', 'mov'])  # ProRes uses MOV container
        else:
            cmd.extend([
                '-f', standards['format']['container'],
                '-movflags', '+faststart',  # Web optimization
            ])
            
        cmd.append(output_path)
        
        fixes_applied.append(f"Converted to {quality} quality")
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            fixes_applied.append("Converted to broadcast format")
        except subprocess.CalledProcessError as e:
            logger.error(f"Format conversion error: {e.stderr}")
            raise
            
        return fixes_applied
    
    def _validate_output(self, output_path: str) -> Dict:
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
            if file_size_mb > 500:
                validation['warnings'].append(f"File size large: {file_size_mb:.1f}MB")
            
            # Check video properties
            cap = cv2.VideoCapture(output_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            
            if abs(fps - 25) > 0.1:
                validation['warnings'].append(f"FPS is {fps:.1f}, expected 25")
                
            if (width, height) != (1920, 1080):
                validation['warnings'].append(f"Resolution is {width}x{height}, expected 1920x1080")
                
        except Exception as e:
            logger.error(f"Validation error: {e}")
            validation['warnings'].append(f"Validation error: {str(e)}")
            
        return validation
    
    def _create_slate_video(self, output_path: str, slate_info: Dict, analysis: Dict):
        """Create a slate video with countdown"""
        if not self.ffmpeg_path:
            logger.warning("FFmpeg not available, skipping slate creation")
            return
            
        # Video properties
        width = 1920
        height = 1080
        fps = 25
        duration = 13  # 10 sec countdown + 3 sec black
        
        # Get duration from analysis or slate info
        video_duration = analysis.get('video', {}).get('frame_count', 0) / analysis.get('video', {}).get('fps', 25)
        if video_duration > 0:
            slate_info['duration'] = f"{int(video_duration):03d}"
        
        # Create slate using FFmpeg with drawtext filter
        filter_complex = []
        
        # Background (dark gray)
        filter_complex.append("color=c=#1a1a1a:s=1920x1080:d=13[bg]")
        
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
        countdown = "drawtext=text='%{expr\\:if(lt(t\\,10)\\,10-floor(t)\\,\\\"\\\")}':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=h-200:enable='lt(t,10)'"
        
        # Combine all filters
        filter_str = "[bg]" + ",".join(text_elements) + "," + countdown
        
        # Generate 1kHz tone at -18dBFS for first 10 seconds
        cmd = [
            self.ffmpeg_path,
            '-f', 'lavfi',
            '-i', f'sine=frequency=1000:duration=10:sample_rate=48000',
            '-f', 'lavfi', 
            '-i', f'anullsrc=r=48000:cl=stereo:d=3',  # 3 seconds of silence
            '-filter_complex', f'{filter_str}[v];[0:a][1:a]concat=n=2:v=0:a=1[a]',
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-r', str(fps),
            '-pix_fmt', 'yuv420p',
            '-af', 'volume=-18dB',  # Set tone to -18dBFS
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
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-y',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Combined slate with video: {output_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to combine videos: {e.stderr}")
            raise
    
    def _add_padding(self, input_path: str, output_path: str):
        """Add black and silence padding at start and end (UK broadcast standard: ~5 frames)"""
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
            
        # UK broadcast standard: typically 5 frames (0.2 seconds at 25fps)
        padding_duration = 0.2
        
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
            '-c:v', 'libx264',
            '-c:a', 'aac',
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