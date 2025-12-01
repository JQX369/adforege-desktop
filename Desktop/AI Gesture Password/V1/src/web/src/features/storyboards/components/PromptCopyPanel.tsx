import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Image, Video } from 'lucide-react';
import type { StoryboardScene, VisualPromptMetadata, VideoPromptMetadata } from '@lib/services/api';

interface PromptCopyPanelProps {
    scene: StoryboardScene;
}

type TabType = 'image' | 'video';
type ViewType = 'json' | 'text';

/**
 * Build full text prompt from image metadata
 */
function buildFullImagePrompt(meta: VisualPromptMetadata): string {
    const parts = [meta.subject];
    if (meta.style?.length) parts.push(meta.style.join(', '));
    if (meta.lighting) parts.push(meta.lighting);
    if (meta.composition) parts.push(meta.composition);
    if (meta.color_palette) parts.push(meta.color_palette);
    if (meta.camera) parts.push(meta.camera);
    if (meta.quality?.length) parts.push(meta.quality.join(', '));
    return parts.join('. ');
}

/**
 * Build full text prompt from video metadata
 */
function buildFullVideoPrompt(meta: VideoPromptMetadata, imageMeta?: VisualPromptMetadata): string {
    const parts = [meta.subject];
    if (meta.motion) parts.push(`Motion: ${meta.motion}`);
    if (meta.camera_movement) parts.push(`Camera: ${meta.camera_movement}`);
    if (imageMeta?.style?.length) parts.push(`Style: ${imageMeta.style.join(', ')}`);
    if (imageMeta?.lighting) parts.push(`Lighting: ${imageMeta.lighting}`);
    return parts.join('. ');
}

/**
 * Convert image prompt to JSON for copying
 */
function imagePromptToJson(meta: VisualPromptMetadata) {
    return {
        prompt: meta.subject,
        style: meta.style,
        lighting: meta.lighting,
        composition: meta.composition,
        color_palette: meta.color_palette,
        camera: meta.camera,
        quality_modifiers: meta.quality,
        negative_prompt: meta.negative,
        aspect_ratio: meta.aspect_ratio,
        full_prompt: buildFullImagePrompt(meta)
    };
}

/**
 * Convert video prompt to JSON for copying
 */
function videoPromptToJson(meta: VideoPromptMetadata, imageMeta?: VisualPromptMetadata) {
    return {
        prompt: meta.subject,
        motion: meta.motion,
        camera_movement: meta.camera_movement,
        duration: meta.duration_seconds,
        pacing: meta.pacing,
        transition: meta.transition_out,
        audio_sync: meta.audio_sync,
        style: imageMeta?.style || [],
        lighting: imageMeta?.lighting,
        full_prompt: buildFullVideoPrompt(meta, imageMeta)
    };
}

export const PromptCopyPanel: React.FC<PromptCopyPanelProps> = ({ scene }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('image');
    const [viewType, setViewType] = useState<ViewType>('json');
    const [copied, setCopied] = useState<string | null>(null);

    const hasImagePrompt = !!scene.image_prompt;
    const hasVideoPrompt = !!scene.video_prompt;

    // Build JSON objects
    const imageJson = hasImagePrompt
        ? imagePromptToJson(scene.image_prompt!)
        : { prompt: scene.visual_prompt, full_prompt: scene.visual_prompt };

    const videoJson = hasVideoPrompt
        ? videoPromptToJson(scene.video_prompt!, scene.image_prompt)
        : null;

    // Build text versions
    const imageText = hasImagePrompt
        ? buildFullImagePrompt(scene.image_prompt!)
        : scene.visual_prompt;

    const videoText = hasVideoPrompt
        ? buildFullVideoPrompt(scene.video_prompt!, scene.image_prompt)
        : null;

    const copyToClipboard = async (content: string, label: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(label);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const currentJson = activeTab === 'image' ? imageJson : videoJson;
    const currentText = activeTab === 'image' ? imageText : videoText;

    return (
        <div className="border-t border-white/10 mt-4 pt-4">
            {/* Toggle Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left group"
            >
                <span className="text-xs font-bold text-text-dim uppercase tracking-wider flex items-center gap-2 group-hover:text-white transition-colors">
                    <Copy size={14} />
                    Copy Prompts for AI Tools
                </span>
                {isExpanded ? (
                    <ChevronUp size={16} className="text-text-dim" />
                ) : (
                    <ChevronDown size={16} className="text-text-dim" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                    {/* Tab Selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('image')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                activeTab === 'image'
                                    ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                                    : 'bg-white/5 text-text-dim hover:bg-white/10 border border-transparent'
                            }`}
                        >
                            <Image size={14} />
                            Image Prompt
                        </button>
                        {hasVideoPrompt && (
                            <button
                                onClick={() => setActiveTab('video')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                    activeTab === 'video'
                                        ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                                        : 'bg-white/5 text-text-dim hover:bg-white/10 border border-transparent'
                                }`}
                            >
                                <Video size={14} />
                                Video Prompt
                            </button>
                        )}
                    </div>

                    {/* View Type Toggle */}
                    <div className="flex gap-1 bg-black/30 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setViewType('json')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                viewType === 'json'
                                    ? 'bg-white/10 text-white'
                                    : 'text-text-dim hover:text-white'
                            }`}
                        >
                            JSON
                        </button>
                        <button
                            onClick={() => setViewType('text')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                viewType === 'text'
                                    ? 'bg-white/10 text-white'
                                    : 'text-text-dim hover:text-white'
                            }`}
                        >
                            Text
                        </button>
                    </div>

                    {/* Prompt Display */}
                    <div className="bg-black/30 rounded-lg overflow-hidden">
                        <pre className="text-xs text-text-dim/90 whitespace-pre-wrap font-mono p-4 max-h-64 overflow-y-auto">
                            {viewType === 'json'
                                ? JSON.stringify(currentJson, null, 2)
                                : currentText}
                        </pre>
                    </div>

                    {/* Copy Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => copyToClipboard(
                                viewType === 'json'
                                    ? JSON.stringify(currentJson, null, 2)
                                    : currentText || '',
                                'content'
                            )}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                copied === 'content'
                                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        >
                            {copied === 'content' ? (
                                <>
                                    <Check size={14} />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy size={14} />
                                    Copy {viewType === 'json' ? 'JSON' : 'Text'}
                                </>
                            )}
                        </button>

                        {/* Quick copy just the main prompt text */}
                        {viewType === 'json' && (
                            <button
                                onClick={() => copyToClipboard(
                                    activeTab === 'image'
                                        ? imageJson.full_prompt
                                        : videoJson?.full_prompt || '',
                                    'full'
                                )}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    copied === 'full'
                                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                                        : 'bg-white/5 text-text-dim hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                {copied === 'full' ? (
                                    <>
                                        <Check size={14} />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        Copy Full Prompt
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Quick Reference */}
                    {hasImagePrompt && activeTab === 'image' && (
                        <div className="bg-black/20 rounded-lg p-3">
                            <h6 className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-2">
                                Quick Reference
                            </h6>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {scene.image_prompt!.style?.length > 0 && (
                                    <div className="flex gap-1">
                                        <span className="text-text-dim">Style:</span>
                                        <span className="text-white truncate">
                                            {scene.image_prompt!.style.slice(0, 2).join(', ')}
                                            {scene.image_prompt!.style.length > 2 && '...'}
                                        </span>
                                    </div>
                                )}
                                {scene.image_prompt!.aspect_ratio && (
                                    <div className="flex gap-1">
                                        <span className="text-text-dim">Aspect:</span>
                                        <span className="text-white">{scene.image_prompt!.aspect_ratio}</span>
                                    </div>
                                )}
                                {scene.image_prompt!.lighting && (
                                    <div className="flex gap-1 col-span-2">
                                        <span className="text-text-dim">Lighting:</span>
                                        <span className="text-white truncate">{scene.image_prompt!.lighting}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {hasVideoPrompt && activeTab === 'video' && (
                        <div className="bg-black/20 rounded-lg p-3">
                            <h6 className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-2">
                                Quick Reference
                            </h6>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {scene.video_prompt!.camera_movement && (
                                    <div className="flex gap-1">
                                        <span className="text-text-dim">Camera:</span>
                                        <span className="text-white">{scene.video_prompt!.camera_movement}</span>
                                    </div>
                                )}
                                {scene.video_prompt!.duration_seconds && (
                                    <div className="flex gap-1">
                                        <span className="text-text-dim">Duration:</span>
                                        <span className="text-white">{scene.video_prompt!.duration_seconds}s</span>
                                    </div>
                                )}
                                {scene.video_prompt!.pacing && (
                                    <div className="flex gap-1">
                                        <span className="text-text-dim">Pacing:</span>
                                        <span className="text-white">{scene.video_prompt!.pacing}</span>
                                    </div>
                                )}
                                {scene.video_prompt!.motion && (
                                    <div className="flex gap-1 col-span-2">
                                        <span className="text-text-dim">Motion:</span>
                                        <span className="text-white truncate">{scene.video_prompt!.motion}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PromptCopyPanel;
