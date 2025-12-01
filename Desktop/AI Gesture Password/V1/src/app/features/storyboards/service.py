import logging
import json
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import uuid

from app.core.gemini_utils import create_gemini_model, safe_get_response_text
from app.features.storyboards.models import (
    ScriptInput, AnalysisResult, Character, ClarificationQuestion,
    ClarificationOption, ClarificationResponse, Storyboard,
    StoryboardScene, StoryboardJob, StoryboardJobStatus,
    AssetRequest, AssetType, UploadedAsset,
    VisualPromptMetadata, VideoPromptMetadata
)
from app.features.storyboards.nano_banana_client import NanoBananaProClient

logger = logging.getLogger(__name__)

class StoryboardService:
    def __init__(self):
        self.nano_client = NanoBananaProClient()
        # In-memory storage for MVP
        self._analyses: Dict[str, AnalysisResult] = {}
        self._jobs: Dict[str, StoryboardJob] = {}

    async def analyze_script(self, script_input: ScriptInput) -> AnalysisResult:
        """
        Analyze script to extract characters and generate clarification questions.
        """
        logger.info(f"Analyzing script from source: {script_input.source}")
        
        # 1. Get script content
        content = script_input.content
        if not content and script_input.ad_script_run_id:
            # TODO: Fetch from Ad Script Lab service if needed
            # For now assume content is passed or we'd fetch it here
            pass

        if not content:
            raise ValueError("Script content is required")

        # 2. Use Gemini to analyze
        model = create_gemini_model("pro")
        if not model:
            raise RuntimeError("Failed to initialize Gemini model")

        prompt = f"""
        Analyze the following video script and extract:
        1. A brief summary (max 2 sentences).
        2. Main characters (name, description, visual_prompt).
        3. 3-5 clarification questions to help visualize the storyboard.
           Each question should have a 'context' (why we are asking) and 3 distinct options (A, B, C).
           These questions should focus on visual style, character details, or setting specificities not mentioned in the text.
        4. Required assets - Identify any brand assets, logos, products, or reference images that would be needed to create accurate visuals for this ad. Be specific about what's needed.

        IMPORTANT: For asset_requests, think about what visual assets the production team would need:
        - Company/brand logos (if the script mentions a brand or company)
        - Product images/photos (if specific products are featured)
        - Brand guidelines (colors, fonts, style)
        - Character reference photos (if real people/actors are involved)
        - Location reference images (if specific real locations are mentioned)

        Script:
        {content}

        Output JSON format:
        {{
            "summary": "...",
            "characters": [
                {{
                    "name": "...",
                    "description": "...",
                    "visual_prompt": "Detailed visual description for image generation..."
                }}
            ],
            "questions": [
                {{
                    "question": "...",
                    "context": "...",
                    "options": [
                        {{"id": "A", "text": "..."}},
                        {{"id": "B", "text": "..."}},
                        {{"id": "C", "text": "..."}}
                    ]
                }}
            ],
            "asset_requests": [
                {{
                    "asset_type": "logo|product|brand_guide|character_ref|location_ref|other",
                    "name": "Company Logo",
                    "description": "The main company logo to be displayed in the final frame and product shots",
                    "required": true
                }}
            ]
        }}
        """

        response = await model.generate_content_async(prompt)
        text = safe_get_response_text(response)
        
        if not text:
            raise RuntimeError("Empty response from AI")

        # Clean markdown
        text = text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {text}")
            raise RuntimeError(f"Invalid JSON from AI: {e}")

        # 3. Construct result
        characters = [
            Character(
                name=c["name"],
                description=c["description"],
                visual_prompt=c["visual_prompt"]
            ) for c in data.get("characters", [])
        ]

        questions = [
            ClarificationQuestion(
                question=q["question"],
                context=q["context"],
                options=[ClarificationOption(**o) for o in q["options"]]
            ) for q in data.get("questions", [])
        ]

        # Parse asset requests from AI
        asset_requests = []
        for ar in data.get("asset_requests", []):
            try:
                asset_type_str = ar.get("asset_type", "other").lower()
                # Map string to enum
                asset_type_map = {
                    "logo": AssetType.LOGO,
                    "product": AssetType.PRODUCT,
                    "brand_guide": AssetType.BRAND_GUIDE,
                    "character_ref": AssetType.CHARACTER_REF,
                    "location_ref": AssetType.LOCATION_REF,
                    "other": AssetType.OTHER
                }
                asset_type = asset_type_map.get(asset_type_str, AssetType.OTHER)
                
                asset_requests.append(AssetRequest(
                    asset_type=asset_type,
                    name=ar.get("name", "Unknown Asset"),
                    description=ar.get("description", ""),
                    required=ar.get("required", True)
                ))
            except Exception as e:
                logger.warning(f"Failed to parse asset request: {ar}, error: {e}")

        # ALWAYS ensure logo and product assets are requested
        # These are almost always needed for any commercial storyboard
        asset_requests = self._ensure_essential_assets(asset_requests)

        result = AnalysisResult(
            script_summary=data.get("summary", ""),
            detected_characters=characters,
            clarification_questions=questions,
            asset_requests=asset_requests,
            status="pending_clarification"
        )
        
        # Store result
        self._analyses[result.analysis_id] = result
        return result

    def _ensure_essential_assets(self, asset_requests: List[AssetRequest]) -> List[AssetRequest]:
        """
        Ensure that logo and product asset requests are always included.
        These are almost always needed for commercial storyboards.
        """
        # Check what asset types we already have
        existing_types = {ar.asset_type for ar in asset_requests}
        
        # Always add logo if not present
        if AssetType.LOGO not in existing_types:
            logger.info("Adding default logo asset request")
            asset_requests.insert(0, AssetRequest(
                asset_type=AssetType.LOGO,
                name="Brand/Company Logo",
                description="Your brand or company logo to be featured in the storyboard. This will be used in title cards, product shots, and end frames.",
                required=True
            ))
        
        # Always add product if not present
        if AssetType.PRODUCT not in existing_types:
            logger.info("Adding default product asset request")
            asset_requests.insert(1 if AssetType.LOGO in existing_types else 0, AssetRequest(
                asset_type=AssetType.PRODUCT,
                name="Product Image(s)",
                description="Photos or renders of the product being advertised. These will be used in hero shots and product close-ups.",
                required=True
            ))
        
        return asset_requests

    def get_analysis(self, analysis_id: str) -> Optional[AnalysisResult]:
        return self._analyses.get(analysis_id)

    async def start_storyboard_generation(self, response: ClarificationResponse) -> StoryboardJob:
        """
        Start the background job to generate the storyboard.
        """
        analysis = self.get_analysis(response.analysis_id)
        if not analysis:
            raise ValueError(f"Analysis {response.analysis_id} not found")

        # Create job
        job = StoryboardJob(
            analysis_id=response.analysis_id,
            status=StoryboardJobStatus.PENDING
        )
        self._jobs[job.job_id] = job

        # Start background processing with uploaded assets
        asyncio.create_task(
            self._process_storyboard_generation(
                job.job_id, 
                analysis, 
                response.answers,
                response.uploaded_assets
            )
        )
        
        return job

    def get_job(self, job_id: str) -> Optional[StoryboardJob]:
        return self._jobs.get(job_id)

    def _calculate_timecodes(self, scenes: List[StoryboardScene]) -> List[StoryboardScene]:
        """Calculate start/end timecodes based on duration_seconds."""
        running_time = 0.0
        for scene in scenes:
            duration = scene.duration_seconds or 4.0
            scene.start_timecode = self._format_timecode(running_time)
            running_time += duration
            scene.end_timecode = self._format_timecode(running_time)
        return scenes

    def _format_timecode(self, seconds: float) -> str:
        """Format seconds as MM:SS:FF (assuming 24fps)."""
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        frames = int((seconds % 1) * 24)
        return f"{mins:02d}:{secs:02d}:{frames:02d}"

    def list_jobs(self, limit: int = 20) -> List[StoryboardJob]:
        """List recent storyboard jobs."""
        # Sort by created_at desc
        jobs = list(self._jobs.values())
        jobs.sort(key=lambda x: x.created_at, reverse=True)
        return jobs[:limit]

    async def _process_storyboard_generation(
        self, 
        job_id: str, 
        analysis: AnalysisResult, 
        answers: Dict[str, str],
        uploaded_assets: List[UploadedAsset] = None
    ):
        job = self._jobs[job_id]
        job.status = StoryboardJobStatus.PROCESSING
        job.progress = 10
        uploaded_assets = uploaded_assets or []
        
        try:
            logger.info(f"Generating storyboard for job {job_id}")
            
            # 1. Refine Prompts with Answers
            answer_text = "\n".join([f"Q: {q_id} -> A: {ans}" for q_id, ans in answers.items()])
            
            # Build asset reference text for the AI
            asset_text = ""
            if uploaded_assets:
                asset_lines = []
                for ua in uploaded_assets:
                    # Find the original request to get context
                    req = next((ar for ar in analysis.asset_requests if ar.id == ua.asset_request_id), None)
                    if req:
                        asset_lines.append(f"- {req.name} ({req.asset_type.value}): {ua.file_url}")
                if asset_lines:
                    asset_text = "\n\nUploaded Brand Assets:\n" + "\n".join(asset_lines)
            
            # 2. Break down into scenes with enhanced prompts
            model = create_gemini_model("pro")

            # Serialize characters outside f-string to avoid brace escaping issues
            characters_json = json.dumps([c.model_dump(exclude={"id"}) for c in analysis.detected_characters])

            prompt = f"""
Based on the script and user preferences, create a 6-8 scene professional storyboard.

Script Summary: {analysis.script_summary}
User Preferences: {answer_text}
Brand Assets: {asset_text}
Characters: {characters_json}

For EACH scene, generate rich production-ready data including structured prompts for AI image and video generation.

Output JSON:
{{
    "title": "Storyboard Title",
    "total_duration_seconds": 30,
    "narrative_summary": "Brief story arc description",
    "emotional_arc": "curiosity -> engagement -> satisfaction",
    "key_message": "Core takeaway message",
    "scenes": [
        {{
            "scene_number": 1,
            "description": "What happens narratively",
            "action": "Specific on-screen action",
            "characters_present": ["Character Name"],
            "setting": "Location/environment",

            "duration_seconds": 4.0,
            "dialogue": "Any spoken lines or null",
            "voiceover": "Any VO text or null",
            "sound_notes": "Music cues, SFX notes",
            "shot_type": "wide|medium|close_up|establishing|two_shot|over_shoulder",
            "camera_angle": "Eye level|Low angle|High angle|Dutch",
            "transition_out": "cut|fade|dissolve|wipe",
            "emotional_beat": "The emotional purpose of this scene",

            "image_prompt": {{
                "subject": "Detailed description of exactly what we see - who, what, where, expression, pose, action. Be specific and vivid.",
                "style": ["cinematic", "photorealistic", "commercial photography", "advertising"],
                "lighting": "Specific lighting setup: direction, quality, mood (e.g., soft diffused natural light, dramatic rim lighting)",
                "composition": "Framing details: rule of thirds, depth, focal point, subject placement",
                "color_palette": "Color mood and tones (e.g., warm golden tones, cool blues, muted pastels)",
                "camera": "Lens and perspective (e.g., 35mm lens, wide angle, telephoto, eye level)",
                "quality": ["8K", "professional", "sharp focus", "high detail"],
                "negative": "blurry, low quality, watermark, text, distorted faces, amateur, oversaturated",
                "aspect_ratio": "16:9"
            }},

            "video_prompt": {{
                "subject": "Same scene but describing the motion and action for video generation",
                "motion": "All movement: character walks, object falls, wind blows hair, etc.",
                "camera_movement": "static|slow dolly in|pan left|tracking|crane up|handheld",
                "duration_seconds": 4.0,
                "pacing": "slow|medium|fast",
                "transition_out": "cut|fade|dissolve",
                "audio_sync": "Any timing notes for audio sync (e.g., beat drop at end)"
            }}
        }}
    ]
}}

PROMPT QUALITY GUIDELINES:
1. Image prompts should be specific enough to recreate consistently across different AI tools
2. Include character details inline in subject (don't rely on external references)
3. Video prompts focus on MOTION - what moves, how it moves, speed
4. Camera movements should feel motivated by the story
5. Be explicit about negative prompts for brand safety
6. Style keywords should match commercial advertising aesthetics
7. Each scene's image_prompt.subject should paint a complete visual picture
8. Lighting and composition should enhance the emotional beat
            """
            
            job.progress = 20
            resp = await model.generate_content_async(prompt)
            text = safe_get_response_text(resp)
            if not text:
                raise RuntimeError("Failed to generate scenes")
                
            text = text.replace("```json", "").replace("```", "").strip()
            data = json.loads(text)
            
            # Map character names back to IDs
            char_map = {c.name: c.id for c in analysis.detected_characters}

            scenes = []
            for s in data.get("scenes", []):
                present_ids = []
                for name in s.get("characters_present", []):
                    # Simple fuzzy match or exact match
                    matched_id = next((cid for cname, cid in char_map.items() if cname in name or name in cname), None)
                    if matched_id:
                        present_ids.append(matched_id)

                # Parse image_prompt metadata
                image_prompt_data = s.get("image_prompt")
                image_prompt_meta = None
                if image_prompt_data and isinstance(image_prompt_data, dict):
                    image_prompt_meta = VisualPromptMetadata(
                        subject=image_prompt_data.get("subject", ""),
                        style=image_prompt_data.get("style", []),
                        lighting=image_prompt_data.get("lighting"),
                        composition=image_prompt_data.get("composition"),
                        color_palette=image_prompt_data.get("color_palette"),
                        camera=image_prompt_data.get("camera"),
                        quality=image_prompt_data.get("quality", []),
                        negative=image_prompt_data.get("negative"),
                        aspect_ratio=image_prompt_data.get("aspect_ratio", "16:9")
                    )

                # Parse video_prompt metadata
                video_prompt_data = s.get("video_prompt")
                video_prompt_meta = None
                if video_prompt_data and isinstance(video_prompt_data, dict):
                    video_prompt_meta = VideoPromptMetadata(
                        subject=video_prompt_data.get("subject", ""),
                        motion=video_prompt_data.get("motion"),
                        camera_movement=video_prompt_data.get("camera_movement"),
                        duration_seconds=video_prompt_data.get("duration_seconds", 4.0),
                        pacing=video_prompt_data.get("pacing"),
                        transition_out=video_prompt_data.get("transition_out"),
                        audio_sync=video_prompt_data.get("audio_sync")
                    )

                # Build legacy visual_prompt from image_prompt.subject for backward compatibility
                legacy_visual_prompt = s.get("visual_prompt", "")
                if not legacy_visual_prompt and image_prompt_meta:
                    legacy_visual_prompt = image_prompt_meta.subject

                scenes.append(StoryboardScene(
                    scene_number=s["scene_number"],
                    description=s["description"],
                    action=s["action"],
                    characters_present=present_ids,
                    setting=s["setting"],
                    camera_angle=s.get("camera_angle"),
                    visual_prompt=legacy_visual_prompt,
                    # Production fields
                    duration_seconds=s.get("duration_seconds"),
                    dialogue=s.get("dialogue") if s.get("dialogue") != "null" else None,
                    voiceover=s.get("voiceover") if s.get("voiceover") != "null" else None,
                    sound_notes=s.get("sound_notes"),
                    shot_type=s.get("shot_type"),
                    transition_out=s.get("transition_out", "cut"),
                    emotional_beat=s.get("emotional_beat"),
                    # Enhanced prompts
                    image_prompt=image_prompt_meta,
                    video_prompt=video_prompt_meta
                ))

            job.progress = 40
            
            # 3. Generate Images (Parallel)
            # a. Generate Character Sheets (if we had a place to show them, for now just store urls)
            for char in analysis.detected_characters:
                char.image_url = await self.nano_client.generate_character_image(char.visual_prompt)
            
            job.progress = 60
            
            # b. Generate Scene Images
            total_scenes = len(scenes)
            for i, scene in enumerate(scenes):
                # Enrich prompt with character refs if supported
                char_refs = [
                    c.image_url for c in analysis.detected_characters 
                    if c.id in scene.characters_present and c.image_url
                ]
                
                scene.image_url = await self.nano_client.generate_scene_image(
                    scene.visual_prompt, 
                    character_refs=char_refs
                )
                
                # Update progress
                current_progress = 60 + int((i + 1) / total_scenes * 30)
                job.progress = min(95, current_progress)

            # 4. Calculate timecodes
            scenes = self._calculate_timecodes(scenes)

            # 5. Finalize
            total_duration = sum(s.duration_seconds or 4.0 for s in scenes)
            storyboard = Storyboard(
                title=data.get("title", "Generated Storyboard"),
                characters=analysis.detected_characters,
                scenes=scenes,
                total_duration_seconds=total_duration,
                narrative_summary=data.get("narrative_summary"),
                emotional_arc=data.get("emotional_arc"),
                key_message=data.get("key_message")
            )
            
            job.storyboard = storyboard
            job.status = StoryboardJobStatus.COMPLETED
            job.progress = 100
            
        except Exception as e:
            logger.exception("Storyboard generation failed")
            job.error = str(e)
            job.status = StoryboardJobStatus.FAILED
        finally:
            job.updated_at = datetime.utcnow()

# Singleton instance
storyboard_service = StoryboardService()
