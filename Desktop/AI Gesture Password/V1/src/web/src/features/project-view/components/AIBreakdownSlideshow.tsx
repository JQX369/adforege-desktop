import React, { useState, useCallback } from 'react';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import { ArrowLeft, ArrowRight, Download, RotateCcw, Loader2, Target, Zap, Activity, Heart, Volume1, Film, Palette, Music, Shield, Star, CheckCircle, TrendingUp, ToggleLeft, ToggleRight, Network, Eye, Sparkles, Brain, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PersonaNetworkGraph } from './PersonaNetworkGraph';
import { EmotionalTimelineChart } from './EmotionalTimelineChart';
import { AdQAPanel } from './AdQAPanel';
import { BrainBalanceChart } from './BrainBalanceChart';
import { ToxicityScoreSlide } from './ToxicityScoreSlide';

// Metric definitions for info tooltips
const METRIC_DEFINITIONS: Record<string, { title: string; description: string; interpretation: string }> = {
    overall_impact: {
        title: 'Overall Impact',
        description: 'Combined measure of ad effectiveness across all dimensions. Represents the aggregate strength of creative execution, messaging clarity, and emotional resonance.',
        interpretation: '8+: Exceptional impact, likely to drive strong results. 6-7: Good foundation with room for optimization. <6: Significant improvements needed.'
    },
    pulse_score: {
        title: 'Pulse Score',
        description: 'Measures emotional resonance and viewer connection strength. How strongly the ad creates an emotional bond with the audience.',
        interpretation: 'High scores indicate the ad triggers genuine emotional responses that enhance memorability and brand affinity.'
    },
    echo_score: {
        title: 'Echo Score',
        description: 'Memorability and likelihood of recall. How well the ad\'s key messages and brand stick in the viewer\'s mind after watching.',
        interpretation: 'Strong echo scores predict better brand recall in purchase moments and word-of-mouth sharing.'
    },
    hook_power: {
        title: 'Hook Power',
        description: 'Effectiveness of the opening 3-5 seconds in capturing attention and preventing skip/scroll behavior.',
        interpretation: 'Critical for digital placements. A weak hook means losing viewers before they see your message.'
    },
    brand_integration: {
        title: 'Brand Integration',
        description: 'How naturally and prominently the brand is woven into the creative. Measures brand visibility without being intrusive.',
        interpretation: 'Balance is key: too subtle and viewers forget the brand; too heavy and it feels like a hard sell.'
    },
    emotional_resonance: {
        title: 'Emotional Resonance',
        description: 'The depth and authenticity of emotional connection the ad creates. Goes beyond surface-level appeal to lasting emotional impact.',
        interpretation: 'Ads with high emotional resonance drive purchase intent and brand loyalty more effectively.'
    },
    clarity_score: {
        title: 'Clarity Score',
        description: 'How clearly the main message, value proposition, and call-to-action are communicated. Measures message comprehension.',
        interpretation: 'Even great creative fails if viewers don\'t understand what you\'re selling or what to do next.'
    },
    distinctiveness: {
        title: 'Distinctiveness',
        description: 'How unique and differentiated the ad is from competitors and category norms. Measures creative standout.',
        interpretation: 'Distinctive ads cut through clutter and are more likely to be remembered and talked about.'
    },
};

// Stat Detail Modal Component
const StatDetailModal: React.FC<{
    stat: { label: string; score: number; key: string; desc?: string } | null;
    onClose: () => void;
}> = ({ stat, onClose }) => {
    if (!stat) return null;

    const definition = METRIC_DEFINITIONS[stat.key];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{stat.label}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-white/70" />
                    </button>
                </div>

                {/* Score Display */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="text-5xl font-bold text-white">{stat.score.toFixed(1)}</div>
                    <div className="text-lg text-text-dim">/ 10</div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        stat.score >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
                        stat.score >= 6 ? 'bg-blue-500/20 text-blue-400' :
                        stat.score >= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                        {stat.score >= 8 ? 'Excellent' : stat.score >= 6 ? 'Good' : stat.score >= 4 ? 'Average' : 'Needs Work'}
                    </div>
                </div>

                {/* What This Measures */}
                {definition && (
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-cyan-400 mb-2">What This Measures</h4>
                            <p className="text-white/80 text-sm leading-relaxed">{definition.description}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-purple-400 mb-2">How to Interpret</h4>
                            <p className="text-white/80 text-sm leading-relaxed">{definition.interpretation}</p>
                        </div>
                    </div>
                )}

                {/* AI Reasoning */}
                {stat.desc && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-medium text-amber-400 mb-2">AI Analysis for This Ad</h4>
                        <p className="text-white/80 text-sm leading-relaxed">{stat.desc}</p>
                    </div>
                )}

                {!stat.desc && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-text-dim text-sm italic">No specific reasoning provided for this metric.</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};


interface AnalysisResult {
    id: string;
    video_name: string;
    created_at: string;
    avg_engagement: number;
    emotion_summary: Record<string, number>;
    emotion_timeline: Array<{ timestamp: number;[key: string]: number }>;
    clearcast_check?: any;
    ai_breakdown?: any;
    audience_engagement?: number;
    ai_effectiveness?: number;
    score_source?: string;
    reaction_count?: number;
}

interface AIBreakdownSlideshowProps {
    result: AnalysisResult;
    onRunAnalysis: () => void;
    isRunning: boolean;
    analysisId: string;
    onSeekVideo?: (time: number) => void;
    currentVideoTime?: number;
}

export const AIBreakdownSlideshow: React.FC<AIBreakdownSlideshowProps> = ({ result, onRunAnalysis, isRunning, analysisId, onSeekVideo, currentVideoTime = 0 }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedStat, setSelectedStat] = useState<{ label: string; score: number; key: string; desc?: string } | null>(null);

    // Check for error state in ai_breakdown
    const hasError = result.ai_breakdown?.error || result.ai_breakdown?.analysis_status === 'ERROR';
    const breakdown = result.ai_breakdown || {};

    // Extract data safely - these need to be available for hooks below
    const effectivenessDrivers = breakdown.effectiveness_drivers || { strengths: [], weaknesses: [] };
    const greenHighlightsRaw = breakdown.green_highlights || [];
    const yellowHighlightsRaw = breakdown.yellow_highlights || [];
    const frames = breakdown.frames || [];
    const audienceReactions = Array.isArray(breakdown.audience_reactions) ? breakdown.audience_reactions : [];
    const adElements = breakdown.ad_elements || {
        hook: { description: "Opening hook", strength: 7 },
        message: { description: "Core message", strength: 7 },
        cta: { description: "Call to action", strength: 6 },
        music: { description: "Audio/music", strength: 6 },
        visuals: { description: "Visual style", strength: 7 },
        product_shot: { description: "Product visibility", strength: 6 },
        emotion: { description: "Emotional appeal", strength: 6 },
        humor: { description: "Humor element", strength: 3 },
    };

    // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN
    // Use effectiveness_drivers as primary source for SWOT, with fallback to green/yellow highlights
    const greenHighlights = React.useMemo(() => {
        const driverStrengths = (effectivenessDrivers.strengths || []).map((s: any) => ({
            aspect: s.factor || 'Strength',
            explanation: s.evidence || '',
            evidence_text: s.evidence || '',
            priority: s.impact || 'Medium'
        }));
        return driverStrengths.length > 0 ? driverStrengths : greenHighlightsRaw;
    }, [effectivenessDrivers.strengths, greenHighlightsRaw]);

    const yellowHighlights = React.useMemo(() => {
        const driverWeaknesses = (effectivenessDrivers.weaknesses || []).map((w: any) => ({
            aspect: w.factor || 'Improvement Area',
            suggestion: w.evidence || '',
            fix_guidance: w.suggested_fix || '',
            evidence_text: w.evidence || '',
            priority: 'Medium'
        }));
        return driverWeaknesses.length > 0 ? driverWeaknesses : yellowHighlightsRaw;
    }, [effectivenessDrivers.weaknesses, yellowHighlightsRaw]);

    // Handlers for persona matrix
    const handlePersonaSelect = useCallback(() => {
        // Could be used for additional interactions
    }, []);

    // Generate AI engagement estimate based on impact scores and ad structure
    const aiEngagementData = React.useMemo(() => {
        const impactScores = breakdown?.impact_scores;
        const adElementsData = breakdown?.ad_elements || {};
        const memorableElements = breakdown?.memorable_elements || {};

        const baseScore = impactScores
            ? ((impactScores.overall_impact || 7) + (impactScores.pulse_score || 7) + (impactScores.echo_score || 7)) / 3 * 10
            : 70;

        const peakTimestamps: { time: number; intensity: number }[] = [];
        if (memorableElements.emotional_peaks) {
            memorableElements.emotional_peaks.forEach((peak: string) => {
                const timeMatch = peak.match(/(\d+):(\d+)/);
                if (timeMatch) {
                    const minutes = parseInt(timeMatch[1]);
                    const seconds = parseInt(timeMatch[2]);
                    const time = minutes * 60 + seconds;
                    peakTimestamps.push({ time, intensity: 15 });
                }
            });
        }

        const hookStrength = (adElementsData.hook?.strength || 7) / 10;
        const ctaStrength = (adElementsData.cta?.strength || 6) / 10;

        const numPoints = 30;
        const data: { timestamp: number; aiEngagement: number; audienceEngagement?: number }[] = [];

        for (let i = 0; i < numPoints; i++) {
            const t = i;
            let engagement = baseScore;

            if (t < 5) {
                const hookBoost = 10 + (hookStrength * 15);
                engagement = baseScore + hookBoost;
                if (t > 2) engagement -= (t - 2) * 2;
            } else if (t < 25) {
                engagement = baseScore - 5;
                peakTimestamps.forEach(peak => {
                    const dist = Math.abs(t - peak.time);
                    if (dist < 5) {
                        const peakEffect = peak.intensity * Math.exp(-(dist * dist) / 4);
                        engagement += peakEffect;
                    }
                });
                engagement += (Math.sin(t * 0.5) * 3);
            } else {
                const ctaLift = 5 + (ctaStrength * 15);
                engagement = baseScore + ctaLift + (t - 25);
            }

            engagement = Math.min(100, Math.max(0, engagement));

            if (i > 0) {
                const prev = data[i - 1].aiEngagement;
                engagement = prev * 0.6 + engagement * 0.4;
            }

            data.push({
                timestamp: t,
                aiEngagement: Math.round(engagement)
            });
        }

        return data;
    }, [breakdown]);

    // Prepare audience reaction data from emotion_timeline
    const audienceEngagementData = React.useMemo(() => {
        if (!result.emotion_timeline || result.emotion_timeline.length === 0) {
            return [];
        }
        return result.emotion_timeline.map(point => ({
            timestamp: point.timestamp,
            audienceEngagement: Math.min(100, Math.max(0, Object.entries(point)
                .filter(([key]) => key !== 'timestamp' && key !== 'neutral')
                .reduce((sum, [_, val]) => sum + (typeof val === 'number' ? val : 0), 0) * 100))
        })).sort((a, b) => a.timestamp - b.timestamp);
    }, [result.emotion_timeline]);

    // Merge AI and audience data for the chart
    const chartData = React.useMemo(() => {
        const merged = aiEngagementData.map(point => ({
            timestamp: point.timestamp,
            aiEngagement: point.aiEngagement,
            audienceEngagement: undefined as number | undefined
        }));

        if (audienceEngagementData.length > 0) {
            audienceEngagementData.forEach(audiencePoint => {
                const closestIdx = merged.findIndex(p => Math.abs(p.timestamp - audiencePoint.timestamp) < 1);
                if (closestIdx >= 0) {
                    merged[closestIdx].audienceEngagement = audiencePoint.audienceEngagement;
                } else {
                    merged.push({
                        timestamp: audiencePoint.timestamp,
                        aiEngagement: undefined as any,
                        audienceEngagement: audiencePoint.audienceEngagement
                    });
                }
            });
            merged.sort((a, b) => a.timestamp - b.timestamp);
        }

        return merged;
    }, [aiEngagementData, audienceEngagementData]);

    const hasAudienceData = audienceEngagementData.length > 0;

    // NOW we can do the early return - all hooks have been called
    if (!result.ai_breakdown || hasError) {
        const errorMessage = result.ai_breakdown?.error || 'Analysis failed';
        const isErrorState = hasError && result.ai_breakdown;

        return (
            <GlassCard className="text-center py-12">
                <div className={`mb-4 ${isErrorState ? 'text-red-400' : 'text-neon-purple'}`}>
                    {isErrorState ? (
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : (
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    {isErrorState ? 'AI Analysis Failed' : 'No AI Analysis Yet'}
                </h3>
                <p className="text-text-dim mb-6 max-w-md mx-auto">
                    {isErrorState
                        ? `The analysis encountered an error: ${errorMessage}`
                        : 'Run AI analysis to get comprehensive video breakdown'}
                </p>
                <button
                    onClick={onRunAnalysis}
                    disabled={isRunning}
                    className={`px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2 disabled:opacity-50 transition-colors ${
                        isErrorState
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                            : 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20'
                    }`}
                >
                    {isRunning ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            {isErrorState ? 'Retrying...' : 'Analyzing...'}
                        </>
                    ) : (
                        <>
                            {isErrorState && <RotateCcw size={20} />}
                            {isErrorState ? 'Retry Analysis' : 'Run AI Analysis'}
                        </>
                    )}
                </button>
            </GlassCard>
        );
    }

    // Additional variables needed for slides (after early return, breakdown is guaranteed)
    const pdfUrl = api.downloadAiBreakdownPdf(analysisId);
    const details = breakdown.breakdown || {};
    const outcome = breakdown.estimated_outcome || {};

    // Helper to extract frame indices
    const getRelatedFrameIndices = (text?: string): number[] => {
        if (!text) return [];
        const matches = text.match(/\[Frame\s+(\d+)\]/g);
        if (!matches) return [];
        return matches.map(m => parseInt(m.match(/\d+/)?.[0] || '0') - 1).filter(i => i >= 0 && i < frames.length);
    };

    const slides = [
        // Slide 1: Overview
        {
            title: "Overview",
            content: (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8 h-full flex flex-col justify-center"
                >
                    {/* Hero Stats - 8 Impact Scores */}
                    {breakdown.impact_scores && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                            {[
                                {
                                    key: 'overall_impact',
                                    label: 'Overall Impact',
                                    score: breakdown.impact_scores.overall_impact || 0,
                                    desc: breakdown.impact_scores.reasoning?.overall_impact,
                                    colors: { start: '#00f5ff', mid: '#00d4ff', end: '#0099ff' }, // Bright Cyan
                                    icon: Activity
                                },
                                {
                                    key: 'pulse_score',
                                    label: 'Pulse Score',
                                    score: breakdown.impact_scores.pulse_score || 0,
                                    desc: breakdown.impact_scores.reasoning?.pulse_score,
                                    colors: { start: '#ff00ff', mid: '#ff44aa', end: '#ff6699' }, // Bright Magenta/Pink
                                    icon: Heart
                                },
                                {
                                    key: 'echo_score',
                                    label: 'Echo Score',
                                    score: breakdown.impact_scores.echo_score || 0,
                                    desc: breakdown.impact_scores.reasoning?.echo_score,
                                    colors: { start: '#00ff88', mid: '#00ffaa', end: '#00ffcc' }, // Bright Emerald
                                    icon: Volume1
                                },
                                {
                                    key: 'hook_power',
                                    label: 'Hook Power',
                                    score: breakdown.impact_scores.hook_power || 0,
                                    desc: breakdown.impact_scores.reasoning?.hook_power,
                                    colors: { start: '#ffcc00', mid: '#ffaa00', end: '#ff8800' }, // Gold/Orange
                                    icon: Zap
                                },
                                {
                                    key: 'brand_integration',
                                    label: 'Brand Integration',
                                    score: breakdown.impact_scores.brand_integration || 0,
                                    desc: breakdown.impact_scores.reasoning?.brand_integration,
                                    colors: { start: '#6366f1', mid: '#818cf8', end: '#a5b4fc' }, // Indigo
                                    icon: Target
                                },
                                {
                                    key: 'emotional_resonance',
                                    label: 'Emotional Resonance',
                                    score: breakdown.impact_scores.emotional_resonance || 0,
                                    desc: breakdown.impact_scores.reasoning?.emotional_resonance,
                                    colors: { start: '#f43f5e', mid: '#fb7185', end: '#fda4af' }, // Rose
                                    icon: Heart
                                },
                                {
                                    key: 'clarity_score',
                                    label: 'Clarity Score',
                                    score: breakdown.impact_scores.clarity_score || 0,
                                    desc: breakdown.impact_scores.reasoning?.clarity_score,
                                    colors: { start: '#8b5cf6', mid: '#a78bfa', end: '#c4b5fd' }, // Violet
                                    icon: Eye
                                },
                                {
                                    key: 'distinctiveness',
                                    label: 'Distinctiveness',
                                    score: breakdown.impact_scores.distinctiveness || 0,
                                    desc: breakdown.impact_scores.reasoning?.distinctiveness,
                                    colors: { start: '#f59e0b', mid: '#fbbf24', end: '#fcd34d' }, // Amber
                                    icon: Sparkles
                                }
                            ].map((stat, idx) => {
                                // Calculate the correct stroke dasharray for a circle
                                // Smaller radius for compact cards
                                const radius = 38;
                                const circumference = 2 * Math.PI * radius;
                                const fillPercent = (stat.score / 10);
                                const strokeDasharray = `${fillPercent * circumference} ${circumference}`;

                                // Calculate ranking pill (heuristic based on score)
                                const getRankPill = (score: number) => {
                                    if (score >= 9) return { text: 'Top 5%', color: 'text-emerald-400 bg-emerald-400/10' };
                                    if (score >= 8) return { text: 'Top 10%', color: 'text-cyan-400 bg-cyan-400/10' };
                                    if (score >= 7) return { text: 'Top 20%', color: 'text-blue-400 bg-blue-400/10' };
                                    if (score >= 6) return { text: 'Top 35%', color: 'text-violet-400 bg-violet-400/10' };
                                    if (score >= 5) return { text: 'Top 50%', color: 'text-yellow-400 bg-yellow-400/10' };
                                    return { text: 'Below Avg', color: 'text-orange-400 bg-orange-400/10' };
                                };
                                const rankPill = getRankPill(stat.score);

                                return (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: idx * 0.05, type: "spring", stiffness: 100 }}
                                        className="flex flex-col items-center text-center group p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer relative"
                                        onClick={() => setSelectedStat({ label: stat.label, score: stat.score, key: stat.key, desc: stat.desc })}
                                    >
                                        {/* Info Icon */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Info size={14} className="text-white/50" />
                                        </div>
                                        <div className="relative w-24 h-24 mb-2">
                                            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 overflow-visible">
                                                {/* Glow Effect on Hover */}
                                                <circle
                                                    cx="50" cy="50" r={radius + 2}
                                                    className="fill-none opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                                                    strokeWidth="10"
                                                    stroke={stat.colors.start}
                                                    filter="url(#glow)"
                                                    style={{ strokeDasharray, strokeLinecap: 'round' }}
                                                />

                                                {/* Background Track - Grey/White Alpha */}
                                                <circle
                                                    cx="50" cy="50" r={radius}
                                                    className="fill-none"
                                                    stroke="rgba(255, 255, 255, 0.1)"
                                                    strokeWidth="6"
                                                    strokeLinecap="round"
                                                />

                                                {/* Progress Circle with Gradient */}
                                                <motion.circle
                                                    cx="50" cy="50" r={radius}
                                                    className="fill-none"
                                                    strokeWidth="6"
                                                    strokeLinecap="round"
                                                    initial={{ strokeDasharray: `0 ${circumference}` }}
                                                    animate={{ strokeDasharray }}
                                                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 + (idx * 0.05) }}
                                                    stroke={`url(#gauge-gradient-${idx})`}
                                                />

                                                <defs>
                                                    <linearGradient id={`gauge-gradient-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor={stat.colors.start} />
                                                        <stop offset="50%" stopColor={stat.colors.mid} />
                                                        <stop offset="100%" stopColor={stat.colors.end} />
                                                    </linearGradient>
                                                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                                    </filter>
                                                </defs>
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-bold text-white tracking-tight">{stat.score}</span>
                                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">/ 10</span>
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-1">
                                            <stat.icon size={14} className="text-white/80" />
                                            {stat.label}
                                        </h4>
                                        {/* Ranking Pill */}
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${rankPill.color}`}>
                                            {rankPill.text}
                                        </span>
                                        {/* Click hint */}
                                        <span className="text-[8px] text-white/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Click for details
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* Executive Summary */}
                    {breakdown.one_sentence_summary && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 rounded-2xl p-8 border border-white/10 backdrop-blur-sm max-w-4xl mx-auto w-full"
                        >
                            <h3 className="text-2xl text-white font-light leading-relaxed text-center italic">
                                "{breakdown.one_sentence_summary}"
                            </h3>

                            {/* Outcome Badge */}
                            {outcome.effectiveness_score !== undefined && (
                                <div className="mt-6 flex justify-center">
                                    <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/40 border border-white/10 shadow-lg">
                                        <span className="text-xs text-text-dim uppercase tracking-widest font-semibold">Effectiveness</span>
                                        <div className="w-px h-4 bg-white/20" />
                                        <span className={`text-xl font-bold ${outcome.effectiveness_score >= 80 ? 'text-green-400' :
                                            outcome.effectiveness_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {outcome.effectiveness_score}%
                                        </span>
                                        {outcome.benchmarks && (
                                            <span className="text-xs text-white/40 ml-1 border-l border-white/10 pl-3">
                                                Top Tier Benchmark: <span className="text-white/70">{outcome.benchmarks.top_tier}%</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            )
        },
        // Slide 2: Creative Analysis (Enhanced with Hero Analysis)
        {
            title: "Creative Analysis",
            content: (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                >
                    {/* Top Row: Hook + Creative Tactics + Audio */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Hook Analysis */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="text-white font-medium flex items-center gap-2 text-sm">
                                    <Zap className="text-yellow-400" size={16} />
                                    The Hook
                                </h5>
                                {breakdown.hero_analysis?.creative_tactics?.hook_type && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 uppercase font-bold">
                                        {breakdown.hero_analysis.creative_tactics.hook_type}
                                    </span>
                                )}
                            </div>
                            <p className="text-white/70 text-xs leading-relaxed">
                                {breakdown.memorable_elements?.hook || 'Opening hook not analyzed'}
                            </p>
                            {/* Hook frames */}
                            {frames.length > 0 && (
                                <div className="flex gap-1.5 mt-3 overflow-hidden h-10">
                                    {[0, 1, 2].filter(i => i < frames.length).map(idx => (
                                        <img key={idx} src={`data:image/jpeg;base64,${frames[idx]}`} className="h-full w-auto rounded border border-white/10 object-cover" />
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* Creative Tactics */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Sparkles className="text-purple-400" size={16} />
                                Creative Tactics
                            </h5>
                            <div className="space-y-2 text-xs">
                                {breakdown.hero_analysis?.creative_tactics?.brand_reveal_style && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Brand Reveal</span>
                                        <span className="text-white capitalize">{breakdown.hero_analysis.creative_tactics.brand_reveal_style.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {breakdown.hero_analysis?.creative_tactics?.persuasion_techniques && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {breakdown.hero_analysis.creative_tactics.persuasion_techniques.slice(0, 3).map((tech: string, idx: number) => (
                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] capitalize">
                                                {tech.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {!breakdown.hero_analysis?.creative_tactics && (
                                    <p className="text-text-dim italic">Creative tactics not analyzed</p>
                                )}
                            </div>
                        </motion.div>

                        {/* Audio Profile */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Music className="text-emerald-400" size={16} />
                                Audio Profile
                            </h5>
                            <div className="space-y-2 text-xs">
                                {breakdown.audio_fingerprint?.music?.present !== false && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-text-dim">Music</span>
                                            <span className="text-white capitalize">
                                                {breakdown.audio_fingerprint?.music?.genre || breakdown.hero_analysis?.audio_profile?.music_mood || 'Present'}
                                            </span>
                                        </div>
                                        {breakdown.audio_fingerprint?.music?.energy_curve && (
                                            <div className="flex justify-between">
                                                <span className="text-text-dim">Energy</span>
                                                <span className="text-white capitalize">{breakdown.audio_fingerprint.music.energy_curve.replace('_', ' ')}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                {breakdown.audio_fingerprint?.voiceover?.present && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Voiceover</span>
                                        <span className="text-white capitalize">
                                            {breakdown.audio_fingerprint.voiceover.tone || 'Present'}
                                        </span>
                                    </div>
                                )}
                                {!breakdown.audio_fingerprint && !breakdown.hero_analysis?.audio_profile && (
                                    <p className="text-text-dim italic">Audio not analyzed</p>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Middle Row: Cinematography + Brand Presence + Visual Patterns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Cinematography */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Film className="text-cyan-400" size={16} />
                                Cinematography
                            </h5>
                            <div className="space-y-2 text-xs">
                                {breakdown.hero_analysis?.cinematography?.production_quality && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Quality</span>
                                        <span className={`capitalize font-medium ${
                                            breakdown.hero_analysis.cinematography.production_quality === 'premium' ? 'text-emerald-400' :
                                            breakdown.hero_analysis.cinematography.production_quality === 'standard' ? 'text-blue-400' :
                                            'text-yellow-400'
                                        }`}>
                                            {breakdown.hero_analysis.cinematography.production_quality}
                                        </span>
                                    </div>
                                )}
                                {breakdown.hero_analysis?.cinematography?.lighting_style && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Lighting</span>
                                        <span className="text-white">{breakdown.hero_analysis.cinematography.lighting_style.slice(0, 30)}</span>
                                    </div>
                                )}
                                {breakdown.hero_analysis?.cinematography?.colour_palette && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {breakdown.hero_analysis.cinematography.colour_palette.slice(0, 4).map((color: string, idx: number) => (
                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">
                                                {color}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {breakdown.creative_profile && !breakdown.hero_analysis?.cinematography && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-text-dim">Tone</span>
                                            <span className="text-white capitalize">{breakdown.creative_profile.colour_mood || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-dim">Pace</span>
                                            <span className="text-white capitalize">{breakdown.creative_profile.editing_pace || 'N/A'}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>

                        {/* Brand Presence */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Target className="text-blue-400" size={16} />
                                Brand Presence
                            </h5>
                            <div className="space-y-2 text-xs">
                                {breakdown.brand_asset_timeline ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-text-dim">First Appearance</span>
                                            <span className="text-white">{breakdown.brand_asset_timeline.first_appearance_s?.toFixed(1) || 0}s</span>
                                        </div>
                                        {breakdown.brand_asset_timeline.first_appearance_type && (
                                            <div className="flex justify-between">
                                                <span className="text-text-dim">Reveal Type</span>
                                                <span className="text-white capitalize">{breakdown.brand_asset_timeline.first_appearance_type.replace('_', ' ')}</span>
                                            </div>
                                        )}
                                        {breakdown.brand_asset_timeline.brand_frequency_score !== undefined && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-text-dim">Frequency</span>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-400 rounded-full" 
                                                            style={{ width: `${(breakdown.brand_asset_timeline.brand_frequency_score / 10) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white text-[10px]">{breakdown.brand_asset_timeline.brand_frequency_score}/10</span>
                                                </div>
                                            </div>
                                        )}
                                        {breakdown.brand_asset_timeline.tagline_used && (
                                            <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                                                <span className="text-blue-300 text-[10px] italic">"{breakdown.brand_asset_timeline.tagline_used}"</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-text-dim italic">Brand timeline not analyzed</p>
                                )}
                            </div>
                        </motion.div>

                        {/* Visual Patterns */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Eye className="text-violet-400" size={16} />
                                Visual Patterns
                            </h5>
                            <div className="space-y-2 text-xs">
                                {breakdown.hero_analysis?.visual_patterns?.logo_usage && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Logo Usage</span>
                                        <span className="text-white capitalize">{breakdown.hero_analysis.visual_patterns.logo_usage.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {breakdown.hero_analysis?.visual_patterns?.hero_product_framing && (
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Product Framing</span>
                                        <span className="text-white capitalize">{breakdown.hero_analysis.visual_patterns.hero_product_framing.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {breakdown.hero_analysis?.visual_patterns?.recurring_motifs && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {breakdown.hero_analysis.visual_patterns.recurring_motifs.slice(0, 3).map((motif: string, idx: number) => (
                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px]">
                                                {motif}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {!breakdown.hero_analysis?.visual_patterns && breakdown.memorable_elements?.distinctive_assets && (
                                    <div className="flex flex-wrap gap-1">
                                        {breakdown.memorable_elements.distinctive_assets.slice(0, 4).map((asset: string, idx: number) => (
                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px]">
                                                {asset}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Bottom Row: Product Focus + Key Frames */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product Info */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Target className="text-cyan-400" size={16} />
                                Product Focus
                            </h5>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-[10px] text-text-dim uppercase tracking-wider">Advertised</span>
                                    <p className="text-white text-sm font-medium">{details.what_is_advertised || 'Unknown Product'}</p>
                                </div>
                                <div className="flex gap-6">
                                    <div>
                                        <span className="text-[10px] text-text-dim uppercase tracking-wider">Brand</span>
                                        <p className="text-white text-sm">{details.brand_name || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-text-dim uppercase tracking-wider">Category</span>
                                        <p className="text-white text-sm">{details.product_category || 'General'}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Key Frames Preview */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 text-sm mb-3">
                                <Film className="text-pink-400" size={16} />
                                Key Moments
                            </h5>
                            {frames.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {[0, Math.floor(frames.length * 0.25), Math.floor(frames.length * 0.5), Math.floor(frames.length * 0.75), frames.length - 1]
                                        .filter((v, i, a) => a.indexOf(v) === i && v < frames.length)
                                        .map(idx => (
                                            <div key={idx} className="relative shrink-0">
                                                <img 
                                                    src={`data:image/jpeg;base64,${frames[idx]}`} 
                                                    className="h-14 w-auto rounded border border-white/10 object-cover" 
                                                />
                                                <span className="absolute bottom-0 left-0 text-[8px] bg-black/70 px-1 rounded-tr text-white/60">
                                                    {Math.round((idx / frames.length) * 100)}%
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="text-text-dim text-xs italic">No frames extracted</p>
                            )}
                        </motion.div>
                    </div>

                    {/* Brain Balance Row */}
                    {breakdown.brain_balance && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.9 }}
                        >
                            <BrainBalanceChart data={breakdown.brain_balance} />
                        </motion.div>
                    )}
                </motion.div>
            )
        },
        // Slide 3: Speech & Technical Analysis
        {
            title: "Speech & Technical",
            content: (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Speech Analysis */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="p-5 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border border-teal-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 mb-4">
                                <Volume1 className="text-teal-400" size={18} />
                                Speech Analysis
                            </h5>
                            <div className="space-y-3">
                                {breakdown.speech_analysis?.words_per_minute !== undefined && breakdown.speech_analysis?.words_per_minute > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Words Per Minute</span>
                                        <span className={`font-medium ${
                                            breakdown.speech_analysis.words_per_minute > 180
                                                ? 'text-amber-400'
                                                : breakdown.speech_analysis.words_per_minute < 100
                                                    ? 'text-blue-400'
                                                    : 'text-green-400'
                                        }`}>
                                            {breakdown.speech_analysis.words_per_minute} WPM
                                            {breakdown.speech_analysis.words_per_minute > 180 && (
                                                <span className="text-[10px] ml-1 text-amber-400/70">(fast)</span>
                                            )}
                                        </span>
                                    </div>
                                )}
                                {breakdown.speech_analysis?.clarity_score !== undefined && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Clarity Score</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full"
                                                    style={{ width: `${breakdown.speech_analysis.clarity_score * 10}%` }}
                                                />
                                            </div>
                                            <span className="text-white font-medium text-sm">
                                                {breakdown.speech_analysis.clarity_score}/10
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {breakdown.speech_analysis?.accent_clarity && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Accent Clarity</span>
                                        <span className={`text-sm capitalize px-2 py-0.5 rounded ${
                                            breakdown.speech_analysis.accent_clarity === 'clear'
                                                ? 'bg-green-500/20 text-green-400'
                                                : breakdown.speech_analysis.accent_clarity === 'moderate'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-orange-500/20 text-orange-400'
                                        }`}>
                                            {breakdown.speech_analysis.accent_clarity}
                                        </span>
                                    </div>
                                )}
                                {breakdown.speech_analysis?.silence_ratio !== undefined && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Silence Ratio</span>
                                        <span className="text-white/80 text-sm">
                                            {Math.round(breakdown.speech_analysis.silence_ratio * 100)}%
                                        </span>
                                    </div>
                                )}
                                {breakdown.speech_analysis?.vocal_variety?.pitch_range && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Pitch Range</span>
                                        <span className="text-white/80 text-sm capitalize">
                                            {breakdown.speech_analysis.vocal_variety.pitch_range}
                                        </span>
                                    </div>
                                )}
                                {!breakdown.speech_analysis && (
                                    <p className="text-white/40 text-sm italic">Speech analysis not available</p>
                                )}
                            </div>
                        </motion.div>

                        {/* Temporal Flow / Pacing */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 mb-4">
                                <Film className="text-purple-400" size={18} />
                                Pacing Analysis
                            </h5>
                            <div className="space-y-3">
                                {breakdown.temporal_flow?.scene_count !== undefined && breakdown.temporal_flow?.scene_count > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Scene Count</span>
                                        <span className="text-white font-medium">
                                            {breakdown.temporal_flow.scene_count} scenes
                                        </span>
                                    </div>
                                )}
                                {breakdown.temporal_flow?.average_scene_duration_seconds !== undefined && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Avg Scene Duration</span>
                                        <span className="text-white/80 text-sm">
                                            {breakdown.temporal_flow.average_scene_duration_seconds.toFixed(1)}s
                                        </span>
                                    </div>
                                )}
                                {breakdown.temporal_flow?.cut_frequency && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Cut Frequency</span>
                                        <span className={`text-sm capitalize px-2 py-0.5 rounded ${
                                            breakdown.temporal_flow.cut_frequency === 'rapid'
                                                ? 'bg-red-500/20 text-red-400'
                                                : breakdown.temporal_flow.cut_frequency === 'fast'
                                                    ? 'bg-orange-500/20 text-orange-400'
                                                    : breakdown.temporal_flow.cut_frequency === 'moderate'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-green-500/20 text-green-400'
                                        }`}>
                                            {breakdown.temporal_flow.cut_frequency}
                                        </span>
                                    </div>
                                )}
                                {breakdown.temporal_flow?.fatigue_risk_score !== undefined && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/60 text-sm">Fatigue Risk</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        breakdown.temporal_flow.fatigue_risk_score > 7
                                                            ? 'bg-red-500'
                                                            : breakdown.temporal_flow.fatigue_risk_score > 4
                                                                ? 'bg-amber-500'
                                                                : 'bg-green-500'
                                                    }`}
                                                    style={{ width: `${breakdown.temporal_flow.fatigue_risk_score * 10}%` }}
                                                />
                                            </div>
                                            <span className={`font-medium text-sm ${
                                                breakdown.temporal_flow.fatigue_risk_score > 7
                                                    ? 'text-red-400'
                                                    : breakdown.temporal_flow.fatigue_risk_score > 4
                                                        ? 'text-amber-400'
                                                        : 'text-green-400'
                                            }`}>
                                                {breakdown.temporal_flow.fatigue_risk_score}/10
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {!breakdown.temporal_flow && (
                                    <p className="text-white/40 text-sm italic">Pacing analysis not available</p>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Color Analysis */}
                    {breakdown.color_analysis?.dominant_colors?.length > 0 && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-5 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-500/20"
                        >
                            <h5 className="text-white font-medium flex items-center gap-2 mb-4">
                                <Palette className="text-pink-400" size={18} />
                                Color Palette
                            </h5>
                            <div className="flex gap-3 flex-wrap mb-4">
                                {breakdown.color_analysis.dominant_colors.slice(0, 6).map((color: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-white/5">
                                        <div
                                            className="w-8 h-8 rounded-lg border border-white/20 shadow-lg"
                                            style={{ backgroundColor: color.color || '#888' }}
                                        />
                                        <div className="text-xs">
                                            <div className="text-white/90 font-medium capitalize">{color.name || 'Unknown'}</div>
                                            <div className="text-white/50">{color.percentage || 0}%</div>
                                            {color.emotion && (
                                                <div className="text-white/40 text-[10px]">{color.emotion}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs">
                                {breakdown.color_analysis.emotional_temperature && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/50">Temperature:</span>
                                        <span className={`capitalize font-medium ${
                                            breakdown.color_analysis.emotional_temperature === 'warm'
                                                ? 'text-orange-400'
                                                : breakdown.color_analysis.emotional_temperature === 'cool'
                                                    ? 'text-blue-400'
                                                    : 'text-white/70'
                                        }`}>
                                            {breakdown.color_analysis.emotional_temperature}
                                        </span>
                                    </div>
                                )}
                                {breakdown.color_analysis.color_harmony && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/50">Harmony:</span>
                                        <span className="text-white/70 capitalize">{breakdown.color_analysis.color_harmony}</span>
                                    </div>
                                )}
                                {breakdown.color_analysis.brand_color_consistency !== undefined && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/50">Brand Consistency:</span>
                                        <span className="text-white/70">{breakdown.color_analysis.brand_color_consistency}/10</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Claims Analysis */}
                    {breakdown.claims_analysis?.claims?.length > 0 && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h5 className="text-white font-medium flex items-center gap-2">
                                    <Shield className="text-amber-400" size={18} />
                                    Claims Analysis
                                </h5>
                                <span className="text-xs text-white/50">
                                    {breakdown.claims_analysis.substantiated_claims_count || 0}/{breakdown.claims_analysis.total_claims_count || breakdown.claims_analysis.claims.length} substantiated
                                </span>
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                                {breakdown.claims_analysis.claims.slice(0, 5).map((claim: any, idx: number) => (
                                    <div key={idx} className="border-l-2 border-white/10 pl-3 py-1">
                                        <p className="text-white/90 text-sm">{claim.claim_text}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {claim.claim_type && (
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 capitalize">
                                                    {claim.claim_type}
                                                </span>
                                            )}
                                            {claim.regulatory_risk && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                    claim.regulatory_risk === 'high' ? 'bg-red-500/20 text-red-400' :
                                                    claim.regulatory_risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {claim.regulatory_risk} risk
                                                </span>
                                            )}
                                            {claim.evidence_provided?.type && (
                                                <span className="text-[10px] text-white/40">
                                                    Evidence: {claim.evidence_provided.type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {breakdown.claims_analysis.substantiation_ratio !== undefined && (
                                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3">
                                    <span className="text-xs text-white/50">Substantiation Rate:</span>
                                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${
                                                breakdown.claims_analysis.substantiation_ratio >= 0.7 ? 'bg-green-500' :
                                                breakdown.claims_analysis.substantiation_ratio >= 0.4 ? 'bg-amber-500' :
                                                'bg-red-500'
                                            }`}
                                            style={{ width: `${breakdown.claims_analysis.substantiation_ratio * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-white/70 font-medium">
                                        {Math.round(breakdown.claims_analysis.substantiation_ratio * 100)}%
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            )
        },
        // Slide 4: SWOT Analysis + Optimization Opportunities
        {
            title: "SWOT Analysis",
            content: (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <h4 className="text-xl font-semibold text-green-400 flex items-center gap-2">
                                <CheckCircle size={24} />
                                Key Strengths
                            </h4>
                            <div className="space-y-4">
                                {greenHighlights.map((item: any, idx: number) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 hover:bg-green-500/10 transition-colors"
                                    >
                                        <p className="text-white font-medium mb-1">{item.aspect}</p>
                                        <p className="text-sm text-text-dim mb-3">{item.explanation}</p>
                                        {item.evidence_text && (
                                            <div className="pl-3 border-l-2 border-green-500/30">
                                                <p className="text-xs text-white/60 italic">"{item.evidence_text}"</p>
                                            </div>
                                        )}
                                        {/* Render Frames if available */}
                                        {getRelatedFrameIndices(item.evidence_text).length > 0 && (
                                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 custom-scrollbar">
                                                {getRelatedFrameIndices(item.evidence_text).map(idx => (
                                                    <div key={idx} className="relative shrink-0 w-24 h-16 rounded overflow-hidden border border-white/10">
                                                        <img
                                                            src={`data:image/jpeg;base64,${frames[idx]}`}
                                                            alt={`Frame ${idx + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-xl font-semibold text-yellow-400 flex items-center gap-2">
                                <TrendingUp size={24} />
                                Improvements & Risks
                            </h4>
                            <div className="space-y-4">
                                {yellowHighlights.map((item: any, idx: number) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 hover:bg-yellow-500/10 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-white font-medium">{item.aspect}</p>
                                            {item.priority && (
                                                <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
                                                    {item.priority} Priority
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-text-dim mb-3">{item.suggestion}</p>
                                        {item.fix_guidance && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <p className="text-xs font-medium text-yellow-500/80 mb-1">RECOMMENDED ACTION</p>
                                                <p className="text-xs text-white/70">{item.fix_guidance}</p>
                                            </div>
                                        )}
                                        {/* Render Frames if available */}
                                        {getRelatedFrameIndices(item.evidence_text).length > 0 && (
                                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 custom-scrollbar">
                                                {getRelatedFrameIndices(item.evidence_text).map(idx => (
                                                    <div key={idx} className="relative shrink-0 w-24 h-16 rounded overflow-hidden border border-white/10">
                                                        <img
                                                            src={`data:image/jpeg;base64,${frames[idx]}`}
                                                            alt={`Frame ${idx + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}

                                {(() => {
                                    // Filter out slate-related risks - slate inclusion is not a real risk
                                    const filteredRisks = (breakdown.soft_risks || []).filter((item: any) =>
                                        !item.risk?.toLowerCase().includes('slate')
                                    );
                                    return filteredRisks.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <p className="text-xs text-red-400 font-bold uppercase mb-2 flex items-center gap-1">
                                                <Shield size={12} /> Risks Detected
                                            </p>
                                            {filteredRisks.map((item: any, idx: number) => (
                                                <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 mb-2">
                                                    <div className="flex justify-between">
                                                        <p className="text-white/90 text-sm font-medium">{item.risk}</p>
                                                        <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{item.impact} Impact</span>
                                                    </div>
                                                    <p className="text-xs text-white/60 mt-1">{item.mitigation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Optimization Opportunities Section */}
                    {breakdown.ab_test_suggestions && breakdown.ab_test_suggestions.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Zap size={20} className="text-orange-400" />
                                Optimization Opportunities
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {breakdown.ab_test_suggestions.map((test: any, idx: number) => (
                                    <motion.div 
                                        key={idx} 
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors"
                                    >
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-medium text-white">{test.element}</span>
                                            <span className="text-[10px] uppercase text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded">A/B Test</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-text-dim">
                                            <span>vs.</span>
                                            <span className="text-white italic">{test.alternative}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
        },
        // Slide 4: Emotional Timeline - Enhanced granular emotion tracking
        {
            title: "Emotional Timeline",
            content: (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                                <Brain size={24} className="text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Emotional Journey Analysis</h3>
                                <p className="text-text-dim text-sm">Granular emotional tracking with 15 emotions, triggers, and transitions</p>
                            </div>
                        </div>
                    </div>
                    {/* Main Content */}
                    <div className="bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 p-4">
                        {breakdown.emotional_timeline && (
                            breakdown.emotional_timeline.readings?.length > 0 ||
                            breakdown.emotional_timeline.emotional_metrics
                        ) ? (
                            <EmotionalTimelineChart
                                data={breakdown.emotional_timeline}
                                duration={breakdown.duration_seconds || breakdown.video_metadata?.duration_seconds || 30}
                                height={320}
                                onSeek={onSeekVideo}
                                currentTime={currentVideoTime}
                            />
                        ) : (
                            <div className="text-center py-12">
                                <Brain className="w-12 h-12 text-text-dim mx-auto mb-4 opacity-50" />
                                <p className="text-text-dim">No emotional timeline data available</p>
                                <p className="text-text-dim/60 text-sm mt-1">Re-run AI analysis to generate emotional timeline</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Additional Info Cards */}
                    {breakdown.emotional_timeline?.emotional_metrics && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Final Viewer State */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Final Viewer State</div>
                                <div className="text-xl font-bold text-white capitalize">
                                    {breakdown.emotional_timeline.emotional_metrics.final_viewer_state || 'neutral'}
                                </div>
                                <div className="text-sm text-text-dim mt-1">
                                    How viewers feel at the end of the ad
                                </div>
                            </div>
                            
                            {/* Average Intensity */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Average Intensity</div>
                                <div className="text-xl font-bold text-white">
                                    {Math.round((breakdown.emotional_timeline.emotional_metrics.average_intensity || 0) * 100)}%
                                </div>
                                <div className="text-sm text-text-dim mt-1">
                                    Overall emotional engagement level
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            )
        },
        // Slide 5: Persona Matrix - Interactive Network Graph
        {
            title: "Persona Matrix",
            content: (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                                <Network size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Audience Persona Matrix</h3>
                                <p className="text-text-dim text-sm">Interactive map of how different audiences connect with your ad</p>
                            </div>
                        </div>
                    </div>
                    {/* Main Content */}
                    <div
                        className="bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 p-4"
                        style={{ minHeight: '500px' }}
                    >
                        <PersonaNetworkGraph
                            personas={audienceReactions || []}
                            adElements={adElements || {}}
                            adThumbnail={frames[0] ? `data:image/jpeg;base64,${frames[0]}` : undefined}
                            onPersonaSelect={handlePersonaSelect}
                        />
                    </div>
                </motion.div>
            )
        },
        // Slide 6: Ad Q&A with GPT-5.1
        {
            title: "Ad Q&A",
            content: (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                >
                    <AdQAPanel analysisId={analysisId} />
                </motion.div>
            )
        },
        // Slide 7: Toxicity Score
        {
            title: "Toxicity Score",
            content: (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                >
                    <ToxicityScoreSlide toxicity={breakdown.toxicity} />
                </motion.div>
            )
        }
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Nav and Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">AI Video Breakdown</h3>
                    <p className="text-text-dim">Comprehensive analysis powered by AI</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onRunAnalysis}
                        disabled={isRunning}
                        className="px-4 py-2 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20 hover:shadow-lg hover:shadow-neon-purple/10 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Rerunning...
                            </>
                        ) : (
                            <>
                                <RotateCcw size={18} />
                                Rerun Analysis
                            </>
                        )}
                    </button>
                    <a
                        href={pdfUrl}
                        download
                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 hover:shadow-lg hover:shadow-white/5 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export PDF
                    </a>
                </div>
            </div>

            {/* Slideshow Controls */}
            <div className="relative flex items-center justify-between bg-white/5 rounded-full p-2 border border-white/10 mb-8">
                <button
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className="p-3 rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-6">
                    <div className="text-sm font-medium text-white/90 whitespace-nowrap">
                        <span className="text-neon-purple mr-2">{currentSlide + 1}.</span>
                        {slides[currentSlide].title}
                    </div>

                    <div className="flex items-center gap-3">
                        {slides.map((_, idx) => (
                            <div
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-1.5 rounded-full transition-all cursor-pointer duration-300 ${currentSlide === idx ? 'w-12 bg-gradient-to-r from-neon-purple to-neon-blue' : 'w-2 bg-white/20 hover:bg-white/40'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                <button
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                    className="p-3 rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <ArrowRight size={20} />
                </button>
            </div>

            {/* Slide Content with Animation */}
            <div className="min-h-[600px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        {slides[currentSlide].content}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Stat Detail Modal */}
            <AnimatePresence>
                {selectedStat && (
                    <StatDetailModal
                        stat={selectedStat}
                        onClose={() => setSelectedStat(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
