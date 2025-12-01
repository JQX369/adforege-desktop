/**
 * AnalysisFlagCard - Shared component for displaying analysis flags/highlights
 * 
 * Used by both Clearcast compliance reports and AI breakdown analysis
 * for consistent UX patterns across the application.
 */

import React from 'react';

// Frame data structure (from both analyzers)
export interface AnalyzedFrame {
    index?: number;
    timestamp?: string;
    image: string;
}

// Unified flag/highlight structure
export interface AnalysisFlag {
    // Core fields (at least one should be present)
    issue?: string;
    aspect?: string;
    description?: string;
    risk?: string;  // For soft_risks
    
    // Explanation/suggestion
    explanation?: string;
    suggestion?: string;
    
    // Actions
    fix_guidance?: string;
    required_action?: string;
    suggested_action?: string;
    mitigation?: string;  // For soft_risks
    
    // Metadata
    timestamp?: string;
    severity?: string;
    priority?: string;
    impact?: string;
    category?: string;
    
    // Evidence and frame references
    evidence_text?: string;
    frame_indices?: number[];
    frame_timestamps?: string[];
    
    // Guidelines (compliance)
    guideline_code?: string;
    guideline_title?: string;
    guideline_reference?: string;
    
    // Status flags
    subjective?: boolean;
    fix_required?: boolean;
}

export type FlagSeverity = 'critical' | 'warning' | 'info' | 'success' | 'neutral';

interface AnalysisFlagCardProps {
    flag: AnalysisFlag;
    analyzedFrames?: AnalyzedFrame[];
    severity?: FlagSeverity;
    showFixTooltip?: boolean;
    showFrameThumbnails?: boolean;
    maxFrames?: number;
    className?: string;
}

/**
 * Extract title from flag data
 */
const getFlagTitle = (flag: AnalysisFlag): string => {
    return flag.description || flag.issue || flag.aspect || flag.risk || "Details";
};

/**
 * Get severity color classes
 */
const getSeverityColors = (severity: FlagSeverity) => {
    switch (severity) {
        case 'critical':
            return {
                badge: 'bg-red-500/20 text-red-400 border-red-500/30',
                actionLabel: 'text-red-400',
            };
        case 'warning':
            return {
                badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                actionLabel: 'text-yellow-500',
            };
        case 'success':
            return {
                badge: 'bg-green-500/20 text-green-400 border-green-500/30',
                actionLabel: 'text-green-400',
            };
        case 'info':
            return {
                badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                actionLabel: 'text-blue-400',
            };
        default:
            return {
                badge: 'bg-white/10 text-white/70 border-white/20',
                actionLabel: 'text-white/70',
            };
    }
};

export const AnalysisFlagCard: React.FC<AnalysisFlagCardProps> = ({
    flag,
    analyzedFrames = [],
    severity = 'neutral',
    showFixTooltip = true,
    showFrameThumbnails = true,
    maxFrames = 4,
    className = '',
}) => {
    const title = getFlagTitle(flag);
    const colors = getSeverityColors(severity);
    
    // Get related frame thumbnails if available
    const frameIndices: number[] = flag.frame_indices || [];
    const relatedFrames = frameIndices
        .filter((idx: number) => idx >= 0 && idx < analyzedFrames.length)
        .slice(0, maxFrames);

    // String-only flag (legacy format)
    if (typeof flag === 'string') {
        return <p className={`text-white font-medium ${className}`}>{flag}</p>;
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium">{title}</p>
                        
                        {/* Subjective/May Clear badge */}
                        {flag.subjective && (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase tracking-wide">
                                May clear
                            </span>
                        )}
                        
                        {/* Priority badge for AI highlights */}
                        {flag.priority && (
                            <span className={`px-2 py-0.5 text-[10px] rounded-full ${colors.badge} uppercase tracking-wide`}>
                                {flag.priority}
                            </span>
                        )}
                        
                        {/* Category badge */}
                        {flag.category && (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white/50 uppercase tracking-wide">
                                {flag.category}
                            </span>
                        )}
                    </div>
                    
                    {/* Explanation */}
                    {flag.explanation && (
                        <p className="text-sm text-white/60 mt-1">{flag.explanation}</p>
                    )}
                    
                    {/* Suggestion (for AI highlights) */}
                    {flag.suggestion && (
                        <p className="text-sm text-white/60 mt-1">
                            <span className={`font-semibold ${colors.actionLabel}`}>Suggestion:</span> {flag.suggestion}
                        </p>
                    )}
                    
                    {/* Mitigation (for soft risks) */}
                    {flag.mitigation && (
                        <p className="text-sm text-white/60 mt-1">
                            <span className="font-semibold text-blue-400">Mitigation:</span> {flag.mitigation}
                        </p>
                    )}
                    
                    {/* Suggested action */}
                    {flag.suggested_action && (
                        <p className="text-sm text-white/60 mt-1">
                            <span className="font-semibold text-yellow-500">Suggestion:</span> {flag.suggested_action}
                        </p>
                    )}
                    
                    {/* Required action */}
                    {flag.required_action && (
                        <p className="text-sm text-white/60 mt-1">
                            <span className="font-semibold text-red-400">Required:</span> {flag.required_action}
                        </p>
                    )}
                    
                    {/* Evidence text */}
                    {flag.evidence_text && (
                        <p className="text-sm text-white/40 mt-2 italic border-l-2 border-white/10 pl-2">
                            {flag.evidence_text}
                        </p>
                    )}
                    
                    {/* Impact */}
                    {flag.impact && typeof flag.impact === 'string' && flag.impact.length > 10 && (
                        <p className="text-xs text-white/40 mt-1">
                            <span className="font-medium">Impact:</span> {flag.impact}
                        </p>
                    )}
                    
                    {/* Guideline reference */}
                    {flag.guideline_title && (
                        <p className="text-xs text-white/40 mt-1">
                            Ref: {flag.guideline_title} {flag.guideline_code ? `(${flag.guideline_code})` : ''}
                        </p>
                    )}
                    
                    {/* Timestamp */}
                    {flag.timestamp && (
                        <p className="text-xs text-white/40 mt-1">At {flag.timestamp}</p>
                    )}
                </div>
                
                {/* How to Fix tooltip */}
                {showFixTooltip && flag.fix_guidance && (
                    <div className="group relative shrink-0">
                        <button className="px-2 py-1 text-xs rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
                            How to Fix
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-lg bg-black/95 border border-white/20 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                            <p className="font-medium text-white mb-1">Fix Guidance</p>
                            <p className="leading-relaxed">{flag.fix_guidance}</p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Frame thumbnails */}
            {showFrameThumbnails && relatedFrames.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                    {relatedFrames.map((idx: number) => {
                        const frame = analyzedFrames[idx];
                        if (!frame) return null;
                        return (
                            <div 
                                key={idx} 
                                className="relative shrink-0 w-20 h-14 rounded overflow-hidden border border-white/10 group/thumb"
                            >
                                <img
                                    src={`data:image/jpeg;base64,${frame.image}`}
                                    alt={`Frame ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                    <span className="text-[10px] text-white">
                                        {frame.timestamp || `Frame ${idx + 1}`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {frameIndices.length > maxFrames && (
                        <div className="shrink-0 w-20 h-14 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-xs text-white/40">
                                +{frameIndices.length - maxFrames} more
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * FlagList - Helper component for rendering lists of flags
 */
interface FlagListProps {
    flags: AnalysisFlag[];
    analyzedFrames?: AnalyzedFrame[];
    severity?: FlagSeverity;
    showFixTooltip?: boolean;
    showFrameThumbnails?: boolean;
    emptyMessage?: string;
    className?: string;
}

export const FlagList: React.FC<FlagListProps> = ({
    flags,
    analyzedFrames = [],
    severity = 'neutral',
    showFixTooltip = true,
    showFrameThumbnails = true,
    emptyMessage = "No items to display.",
    className = '',
}) => {
    if (!flags || flags.length === 0) {
        return (
            <div className={`p-4 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm text-center italic ${className}`}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className={`bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10 ${className}`}>
            {flags.map((flag, idx) => (
                <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                    <AnalysisFlagCard
                        flag={flag}
                        analyzedFrames={analyzedFrames}
                        severity={severity}
                        showFixTooltip={showFixTooltip}
                        showFrameThumbnails={showFrameThumbnails}
                    />
                </div>
            ))}
        </div>
    );
};

export default AnalysisFlagCard;








