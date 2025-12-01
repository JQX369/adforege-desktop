"""Universal prompt formatter - outputs structured JSON for any AI tool."""

import json
from typing import Optional, Dict, Any, List
from .models import VisualPromptMetadata, VideoPromptMetadata, StoryboardScene, Storyboard


class PromptFormatter:
    """Format prompts as universal JSON following best practices."""

    @staticmethod
    def to_image_json(meta: VisualPromptMetadata) -> Dict[str, Any]:
        """Convert to universal JSON format for image generation."""
        return {
            "prompt": meta.subject,
            "style": meta.style,
            "lighting": meta.lighting,
            "composition": meta.composition,
            "color_palette": meta.color_palette,
            "camera": meta.camera,
            "quality_modifiers": meta.quality,
            "negative_prompt": meta.negative,
            "aspect_ratio": meta.aspect_ratio,
            "full_prompt": PromptFormatter._build_full_image_prompt(meta)
        }

    @staticmethod
    def to_video_json(
        meta: VideoPromptMetadata,
        image_meta: Optional[VisualPromptMetadata] = None
    ) -> Dict[str, Any]:
        """Convert to universal JSON format for video generation."""
        return {
            "prompt": meta.subject,
            "motion": meta.motion,
            "camera_movement": meta.camera_movement,
            "duration": meta.duration_seconds,
            "pacing": meta.pacing,
            "transition": meta.transition_out,
            "audio_sync": meta.audio_sync,
            "style": image_meta.style if image_meta else [],
            "lighting": image_meta.lighting if image_meta else None,
            "full_prompt": PromptFormatter._build_full_video_prompt(meta, image_meta)
        }

    @staticmethod
    def _build_full_image_prompt(meta: VisualPromptMetadata) -> str:
        """Build combined text prompt from components."""
        parts = [meta.subject]
        if meta.style:
            parts.append(", ".join(meta.style))
        if meta.lighting:
            parts.append(meta.lighting)
        if meta.composition:
            parts.append(meta.composition)
        if meta.color_palette:
            parts.append(meta.color_palette)
        if meta.camera:
            parts.append(meta.camera)
        if meta.quality:
            parts.append(", ".join(meta.quality))
        return ". ".join(parts)

    @staticmethod
    def _build_full_video_prompt(
        meta: VideoPromptMetadata,
        image_meta: Optional[VisualPromptMetadata]
    ) -> str:
        """Build combined video prompt text."""
        parts = [meta.subject]
        if meta.motion:
            parts.append(f"Motion: {meta.motion}")
        if meta.camera_movement:
            parts.append(f"Camera: {meta.camera_movement}")
        if image_meta and image_meta.style:
            parts.append(f"Style: {', '.join(image_meta.style)}")
        if image_meta and image_meta.lighting:
            parts.append(f"Lighting: {image_meta.lighting}")
        return ". ".join(parts)

    @staticmethod
    def scene_to_json(scene: StoryboardScene) -> Dict[str, Any]:
        """Convert a scene's prompts to JSON format."""
        result = {
            "scene_number": scene.scene_number,
            "setting": scene.setting,
            "duration_seconds": scene.duration_seconds,
            "timecode": f"{scene.start_timecode} - {scene.end_timecode}" if scene.start_timecode else None
        }

        if scene.image_prompt:
            result["image_prompt"] = PromptFormatter.to_image_json(scene.image_prompt)
        else:
            # Fallback to legacy visual_prompt
            result["image_prompt"] = {
                "prompt": scene.visual_prompt,
                "full_prompt": scene.visual_prompt
            }

        if scene.video_prompt:
            result["video_prompt"] = PromptFormatter.to_video_json(
                scene.video_prompt,
                scene.image_prompt
            )

        return result

    @staticmethod
    def storyboard_to_json(storyboard: Storyboard) -> Dict[str, Any]:
        """Export entire storyboard prompts as JSON."""
        return {
            "title": storyboard.title,
            "total_duration_seconds": storyboard.total_duration_seconds,
            "narrative_summary": storyboard.narrative_summary,
            "emotional_arc": storyboard.emotional_arc,
            "key_message": storyboard.key_message,
            "scenes": [
                PromptFormatter.scene_to_json(scene)
                for scene in storyboard.scenes
            ]
        }

    @staticmethod
    def export_all_prompts_markdown(storyboard: Storyboard) -> str:
        """Export all prompts as a markdown document for easy copying."""
        lines = [
            f"# {storyboard.title} - AI Generation Prompts",
            "",
            f"**Total Duration:** {storyboard.total_duration_seconds or 'N/A'}s",
            f"**Narrative:** {storyboard.narrative_summary or 'N/A'}",
            f"**Emotional Arc:** {storyboard.emotional_arc or 'N/A'}",
            f"**Key Message:** {storyboard.key_message or 'N/A'}",
            "",
            "---",
            ""
        ]

        for scene in storyboard.scenes:
            lines.append(f"## Scene {scene.scene_number}: {scene.setting}")
            lines.append("")

            if scene.start_timecode:
                lines.append(f"**Timecode:** {scene.start_timecode} - {scene.end_timecode}")

            if scene.duration_seconds:
                lines.append(f"**Duration:** {scene.duration_seconds}s")

            if scene.shot_type:
                lines.append(f"**Shot Type:** {scene.shot_type}")

            if scene.emotional_beat:
                lines.append(f"**Emotional Beat:** {scene.emotional_beat}")

            lines.append("")
            lines.append(f"**Action:** {scene.action}")
            lines.append("")

            if scene.dialogue:
                lines.append(f"**Dialogue:** \"{scene.dialogue}\"")
                lines.append("")

            if scene.voiceover:
                lines.append(f"**Voiceover:** \"{scene.voiceover}\"")
                lines.append("")

            if scene.sound_notes:
                lines.append(f"**Audio:** {scene.sound_notes}")
                lines.append("")

            # Image prompt
            lines.append("### Image Prompt (JSON)")
            lines.append("```json")
            if scene.image_prompt:
                img_json = PromptFormatter.to_image_json(scene.image_prompt)
                lines.append(json.dumps(img_json, indent=2))
            else:
                lines.append(json.dumps({"prompt": scene.visual_prompt}, indent=2))
            lines.append("```")
            lines.append("")

            # Video prompt
            if scene.video_prompt:
                lines.append("### Video Prompt (JSON)")
                lines.append("```json")
                vid_json = PromptFormatter.to_video_json(scene.video_prompt, scene.image_prompt)
                lines.append(json.dumps(vid_json, indent=2))
                lines.append("```")
                lines.append("")

            lines.append("---")
            lines.append("")

        return "\n".join(lines)
