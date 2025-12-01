import React, { useState } from 'react';
import {
    Film,
    User,
    Download,
    Share2,
    Image as ImageIcon,
    Clock,
    MessageSquare,
    Mic,
    Music,
    Heart,
    ArrowRight,
    FileJson
} from 'lucide-react';
import type { Storyboard, StoryboardScene } from '@lib/services/api';
import { GlassCard } from '@shared/components/GlassCard';
import { PromptCopyPanel } from './components/PromptCopyPanel';

interface StoryboardDisplayProps {
    storyboard: Storyboard;
}

/**
 * Format duration in seconds to a readable string
 */
function formatDuration(seconds?: number): string {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
}

/**
 * Get shot type display badge color
 */
function getShotTypeBadgeColor(shotType?: string): string {
    if (!shotType) return 'bg-white/10 text-white/70';
    const type = shotType.toLowerCase();
    if (type.includes('close')) return 'bg-neon-pink/20 text-neon-pink';
    if (type.includes('wide') || type.includes('establishing')) return 'bg-neon-blue/20 text-neon-blue';
    if (type.includes('medium')) return 'bg-neon-purple/20 text-neon-purple';
    return 'bg-white/10 text-white/70';
}

/**
 * Export all prompts as JSON file
 */
function exportAllPrompts(storyboard: Storyboard) {
    const exportData = {
        title: storyboard.title,
        total_duration_seconds: storyboard.total_duration_seconds,
        narrative_summary: storyboard.narrative_summary,
        emotional_arc: storyboard.emotional_arc,
        key_message: storyboard.key_message,
        exported_at: new Date().toISOString(),
        scenes: storyboard.scenes.map(scene => ({
            scene_number: scene.scene_number,
            setting: scene.setting,
            duration_seconds: scene.duration_seconds,
            timecode: scene.start_timecode ? `${scene.start_timecode} - ${scene.end_timecode}` : null,
            shot_type: scene.shot_type,
            emotional_beat: scene.emotional_beat,
            dialogue: scene.dialogue,
            voiceover: scene.voiceover,
            sound_notes: scene.sound_notes,
            image_prompt: scene.image_prompt || { prompt: scene.visual_prompt },
            video_prompt: scene.video_prompt || null
        }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${storyboard.title.replace(/\s+/g, '_')}_prompts.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Scene Card Component with all production fields
 */
const SceneCard: React.FC<{ scene: StoryboardScene; storyboard: Storyboard; isLast: boolean }> = ({
    scene,
    storyboard,
    isLast
}) => {
    return (
        <div className="relative">
            <GlassCard className="overflow-hidden group">
                {/* Header with Duration */}
                <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-neon-pink font-bold">SCENE {scene.scene_number}</span>
                        {scene.duration_seconds && (
                            <span className="flex items-center gap-1 text-xs text-text-dim">
                                <Clock size={12} />
                                {formatDuration(scene.duration_seconds)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {scene.shot_type && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${getShotTypeBadgeColor(scene.shot_type)}`}>
                                {scene.shot_type}
                            </span>
                        )}
                        <span className="text-xs text-text-dim uppercase tracking-wider">{scene.setting}</span>
                    </div>
                </div>

                {/* Image */}
                <div className="aspect-video bg-black/50 relative overflow-hidden">
                    {scene.image_url ? (
                        <img
                            src={scene.image_url}
                            alt={`Scene ${scene.scene_number}`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-text-dim">
                            <ImageIcon size={32} />
                            <span className="text-sm">Generating visualization...</span>
                        </div>
                    )}

                    {/* Camera Angle Badge */}
                    {scene.camera_angle && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs font-medium text-white border border-white/10">
                            {scene.camera_angle}
                        </div>
                    )}

                    {/* Timecode Badge */}
                    {scene.start_timecode && (
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs font-mono text-white/80 border border-white/10">
                            {scene.start_timecode}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Action */}
                    <div>
                        <h5 className="text-xs font-bold text-text-dim uppercase mb-1">Action</h5>
                        <p className="text-white text-sm leading-relaxed">{scene.action}</p>
                    </div>

                    {/* Dialogue */}
                    {scene.dialogue && (
                        <div className="bg-neon-blue/5 border border-neon-blue/20 rounded-lg p-3">
                            <h5 className="text-xs font-bold text-neon-blue uppercase mb-1 flex items-center gap-1">
                                <MessageSquare size={12} />
                                Dialogue
                            </h5>
                            <p className="text-white text-sm italic">"{scene.dialogue}"</p>
                        </div>
                    )}

                    {/* Voiceover */}
                    {scene.voiceover && (
                        <div className="bg-neon-purple/5 border border-neon-purple/20 rounded-lg p-3">
                            <h5 className="text-xs font-bold text-neon-purple uppercase mb-1 flex items-center gap-1">
                                <Mic size={12} />
                                Voiceover
                            </h5>
                            <p className="text-white text-sm italic">"{scene.voiceover}"</p>
                        </div>
                    )}

                    {/* Sound Notes */}
                    {scene.sound_notes && (
                        <div className="flex items-start gap-2 text-sm">
                            <Music size={14} className="text-text-dim mt-0.5 flex-shrink-0" />
                            <span className="text-text-dim">{scene.sound_notes}</span>
                        </div>
                    )}

                    {/* Emotional Beat */}
                    {scene.emotional_beat && (
                        <div className="flex items-center gap-2 text-sm">
                            <Heart size={14} className="text-neon-pink" />
                            <span className="text-white/80">{scene.emotional_beat}</span>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h5 className="text-xs font-bold text-text-dim uppercase mb-1">Description</h5>
                        <p className="text-white/70 text-sm leading-relaxed">{scene.description}</p>
                    </div>

                    {/* Characters Tags */}
                    {scene.characters_present.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                            {scene.characters_present.map(charId => {
                                const char = storyboard.characters.find(c => c.id === charId);
                                return char ? (
                                    <span
                                        key={charId}
                                        className="px-2 py-0.5 rounded-full bg-neon-blue/10 text-neon-blue text-[10px] border border-neon-blue/20"
                                    >
                                        {char.name}
                                    </span>
                                ) : null;
                            })}

                            {/* Transition indicator */}
                            {!isLast && scene.transition_out && scene.transition_out !== 'cut' && (
                                <span className="ml-auto flex items-center gap-1 text-[10px] text-text-dim">
                                    <ArrowRight size={10} />
                                    {scene.transition_out}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Prompt Copy Panel */}
                    <PromptCopyPanel scene={scene} />
                </div>
            </GlassCard>

            {/* Transition Arrow Between Scenes */}
            {!isLast && scene.transition_out && scene.transition_out !== 'cut' && (
                <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-6 h-6 rounded-full bg-black/50 border border-white/10">
                    <ArrowRight size={12} className="text-text-dim" />
                </div>
            )}
        </div>
    );
};

export const StoryboardDisplay: React.FC<StoryboardDisplayProps> = ({ storyboard }) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Film className="text-neon-pink" size={32} />
                        {storyboard.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-text-dim">
                        <span>Created on {new Date(storyboard.created_at).toLocaleDateString()}</span>
                        {storyboard.total_duration_seconds && (
                            <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {formatDuration(storyboard.total_duration_seconds)}
                            </span>
                        )}
                        <span>{storyboard.scenes.length} scenes</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => exportAllPrompts(storyboard)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-blue/10 border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/20 transition-colors"
                    >
                        <FileJson size={18} />
                        Export Prompts
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                        <Download size={18} />
                        Export PDF
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                        <Share2 size={18} />
                        Share
                    </button>
                </div>
            </div>

            {/* Storyboard Metadata */}
            {(storyboard.narrative_summary || storyboard.emotional_arc || storyboard.key_message) && (
                <GlassCard className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {storyboard.narrative_summary && (
                            <div>
                                <h4 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">
                                    Narrative Summary
                                </h4>
                                <p className="text-white/90 text-sm leading-relaxed">
                                    {storyboard.narrative_summary}
                                </p>
                            </div>
                        )}
                        {storyboard.emotional_arc && (
                            <div>
                                <h4 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">
                                    Emotional Arc
                                </h4>
                                <p className="text-white/90 text-sm leading-relaxed flex items-center gap-2">
                                    <Heart size={14} className="text-neon-pink flex-shrink-0" />
                                    {storyboard.emotional_arc}
                                </p>
                            </div>
                        )}
                        {storyboard.key_message && (
                            <div>
                                <h4 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">
                                    Key Message
                                </h4>
                                <p className="text-white/90 text-sm leading-relaxed">
                                    {storyboard.key_message}
                                </p>
                            </div>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Characters Strip */}
            <GlassCard className="p-6 overflow-x-auto">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User size={20} className="text-neon-blue" />
                    Cast & Characters
                </h3>
                <div className="flex gap-6 min-w-max pb-2">
                    {storyboard.characters.map(char => (
                        <div key={char.id} className="w-48 group">
                            <div className="aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10 mb-3 relative">
                                {char.image_url ? (
                                    <img
                                        src={char.image_url}
                                        alt={char.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-dim">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>
                            <h4 className="font-bold text-white truncate">{char.name}</h4>
                            <p className="text-xs text-text-dim line-clamp-2">{char.description}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Scenes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {storyboard.scenes.map((scene, index) => (
                    <SceneCard
                        key={scene.id}
                        scene={scene}
                        storyboard={storyboard}
                        isLast={index === storyboard.scenes.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};
