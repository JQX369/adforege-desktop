import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Zap, Heart, ArrowRight, Users, ToggleLeft, ToggleRight } from 'lucide-react';

// Emotion colors matching the Python schema
const EMOTION_COLORS: Record<string, string> = {
    joy: '#FFD700',
    surprise: '#FF69B4',
    trust: '#4169E1',
    anticipation: '#FFA500',
    sadness: '#4682B4',
    fear: '#8B008B',
    anger: '#DC143C',
    disgust: '#556B2F',
    neutral: '#808080',
    excitement: '#FF4500',
    nostalgia: '#DEB887',
    tension: '#800000',
    relief: '#90EE90',
    pride: '#9370DB',
    empathy: '#DB7093',
};

// Trigger icons
const TRIGGER_ICONS: Record<string, string> = {
    visual: '👁️',
    audio: '🔊',
    dialogue: '💬',
    music: '🎵',
    pacing: '⚡',
    reveal: '✨',
};

interface EmotionReading {
    t_s: number;
    dominant_emotion: string;
    secondary_emotion?: string | null;
    intensity: number;
    valence: number;
    arousal: number;
    trigger: string;
}

interface EmotionalTransition {
    from_emotion: string;
    to_emotion: string;
    transition_time_s: number;
    transition_type: string;
    effectiveness: number;
}

interface EmotionalMetrics {
    arc_shape: string;
    peak_moment_s: number;
    peak_emotion: string;
    trough_moment_s: number;
    trough_emotion: string;
    emotional_range: number;
    final_viewer_state: string;
    average_intensity: number;
    positive_ratio: number;
}

interface EmotionalTimelineData {
    readings: EmotionReading[];
    emotional_transitions: EmotionalTransition[];
    emotional_metrics: EmotionalMetrics;
}

interface ReactionDataPoint {
    timestamp: number;
    engagement: number;
}

interface EmotionalTimelineChartProps {
    data: EmotionalTimelineData;
    duration: number;
    currentTime?: number;
    onSeek?: (time: number) => void;
    height?: number;
    reactionData?: ReactionDataPoint[];
}

const ArcShapeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    peak_early: { label: 'Peak Early', icon: <TrendingDown className="w-4 h-4" /> },
    peak_middle: { label: 'Classic Arc', icon: <Activity className="w-4 h-4" /> },
    peak_late: { label: 'Building Finale', icon: <TrendingUp className="w-4 h-4" /> },
    flat: { label: 'Consistent', icon: <Activity className="w-4 h-4 opacity-50" /> },
    roller_coaster: { label: 'Dynamic', icon: <Zap className="w-4 h-4" /> },
};

export const EmotionalTimelineChart: React.FC<EmotionalTimelineChartProps> = ({
    data,
    duration,
    currentTime = 0,
    onSeek,
    height = 320, // Increased for better vertical spread
    reactionData,
}) => {
    const [hoveredReading, setHoveredReading] = useState<EmotionReading | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [showReactions, setShowReactions] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(900);

    // Responsive width tracking
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const hasReactionData = reactionData && reactionData.length > 0;

    const { readings, emotional_transitions, emotional_metrics } = data;

    // Calculate chart dimensions - responsive width
    const svgWidth = containerWidth;
    const chartPadding = { top: 35, bottom: 40, left: 20, right: 20 };
    const chartHeight = height - chartPadding.top - chartPadding.bottom;
    const chartContentWidth = svgWidth - chartPadding.left - chartPadding.right;

    // Convert readings to chart points (all pixel-based now)
    const chartPoints = useMemo(() => {
        if (!readings || readings.length === 0) return [];
        
        return readings.map((reading, index) => {
            // Convert time to x position in pixels
            const xPercent = duration > 0 ? (reading.t_s / duration) : (index / readings.length);
            const x = chartPadding.left + xPercent * chartContentWidth;
            const y = (1 - reading.intensity) * chartHeight + chartPadding.top;
            return {
                ...reading,
                x,
                y,
                xPercent: xPercent * 100, // Keep percentage for circle cx
                color: EMOTION_COLORS[reading.dominant_emotion] || EMOTION_COLORS.neutral,
            };
        });
    }, [readings, duration, chartHeight, chartContentWidth]);

    // Generate SVG path for the emotion intensity line
    const linePath = useMemo(() => {
        if (chartPoints.length < 2) return '';
        
        // Create smooth curve through points using pixel coordinates
        const points = chartPoints.map(p => `${p.x},${p.y}`);
        return `M ${points.join(' L ')}`;
    }, [chartPoints]);

    // Generate area fill path
    const areaPath = useMemo(() => {
        if (chartPoints.length < 2) return '';
        
        const bottomY = chartHeight + chartPadding.top;
        const startX = chartPoints[0].x;
        const endX = chartPoints[chartPoints.length - 1].x;
        
        return `${linePath} L ${endX},${bottomY} L ${startX},${bottomY} Z`;
    }, [linePath, chartPoints, chartHeight]);

    // Current time indicator position (in pixels)
    const currentTimeX = useMemo(() => {
        const xPercent = duration > 0 ? (currentTime / duration) : 0;
        return chartPadding.left + xPercent * chartContentWidth;
    }, [currentTime, duration, chartContentWidth]);

    // Generate reaction overlay path
    const reactionPath = useMemo(() => {
        if (!reactionData || reactionData.length < 2) return '';
        
        const points = reactionData.map(d => {
            const xPercent = duration > 0 ? (d.timestamp / duration) : 0;
            const x = chartPadding.left + xPercent * chartContentWidth;
            // Scale engagement (0-100) to chart height
            const y = (1 - d.engagement / 100) * chartHeight + chartPadding.top;
            return `${x},${y}`;
        });
        return `M ${points.join(' L ')}`;
    }, [reactionData, duration, chartHeight, chartContentWidth]);

    // Handle click on chart
    const handleChartClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!onSeek || duration <= 0) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const xPercent = (e.clientX - rect.left) / rect.width;
        const time = xPercent * duration;
        onSeek(Math.max(0, Math.min(duration, time)));
    }, [onSeek, duration]);

    // Handle mouse move for tooltip
    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        
        // Find closest reading using percentage
        const closest = chartPoints.reduce((prev, curr) => {
            return Math.abs(curr.xPercent - xPercent) < Math.abs(prev.xPercent - xPercent) ? curr : prev;
        }, chartPoints[0]);
        
        if (closest && Math.abs(closest.xPercent - xPercent) < 5) {
            setHoveredReading(closest);
            setTooltipPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        } else {
            setHoveredReading(null);
        }
    }, [chartPoints]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!readings || readings.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <Activity className="w-8 h-8 text-text-dim mx-auto mb-2" />
                <p className="text-text-dim">No emotional timeline data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Arc Shape */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-text-dim text-xs mb-1">
                        {ArcShapeLabels[emotional_metrics?.arc_shape]?.icon || <Activity className="w-4 h-4" />}
                        <span>Arc Shape</span>
                    </div>
                    <div className="text-white font-medium">
                        {ArcShapeLabels[emotional_metrics?.arc_shape]?.label || emotional_metrics?.arc_shape || 'Unknown'}
                    </div>
                </div>

                {/* Peak Emotion */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-text-dim text-xs mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span>Peak</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: EMOTION_COLORS[emotional_metrics?.peak_emotion] || '#808080' }}
                        />
                        <span className="text-white font-medium capitalize">
                            {emotional_metrics?.peak_emotion || 'neutral'}
                        </span>
                        <span className="text-text-dim text-sm">
                            @ {formatTime(emotional_metrics?.peak_moment_s || 0)}
                        </span>
                    </div>
                </div>

                {/* Emotional Range */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-text-dim text-xs mb-1">
                        <Zap className="w-4 h-4" />
                        <span>Emotional Range</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                style={{ width: `${(emotional_metrics?.emotional_range || 0) * 100}%` }}
                            />
                        </div>
                        <span className="text-white font-medium">
                            {Math.round((emotional_metrics?.emotional_range || 0) * 100)}%
                        </span>
                    </div>
                </div>

                {/* Positive Ratio */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-text-dim text-xs mb-1">
                        <Heart className="w-4 h-4" />
                        <span>Positive Ratio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                                style={{ width: `${(emotional_metrics?.positive_ratio || 0) * 100}%` }}
                            />
                        </div>
                        <span className="text-white font-medium">
                            {Math.round((emotional_metrics?.positive_ratio || 0) * 100)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Timeline Chart */}
            <div ref={containerRef} className="bg-white/5 border border-white/10 rounded-xl p-4 relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-text-dim flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Emotional Intensity Timeline
                        {onSeek && (
                            <span className="text-[10px] text-cyan-400/70 ml-2">(click to seek video)</span>
                        )}
                    </div>
                    {/* Reaction Overlay Toggle */}
                    {hasReactionData && (
                        <button
                            onClick={() => setShowReactions(!showReactions)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                showReactions
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-white/5 text-text-dim border border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {showReactions ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            <Users size={12} />
                            Reactions
                        </button>
                    )}
                </div>
                
                <svg
                    viewBox={`0 0 ${svgWidth} ${height}`}
                    preserveAspectRatio="xMidYMid meet"
                    width="100%"
                    height={height}
                    className={onSeek ? "cursor-pointer" : "cursor-crosshair"}
                    onClick={handleChartClick}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredReading(null)}
                >
                    {/* Gradient definitions */}
                    <defs>
                        <linearGradient id="emotionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(147, 112, 219, 0.5)" />
                            <stop offset="100%" stopColor="rgba(147, 112, 219, 0)" />
                        </linearGradient>
                        <linearGradient id="reactionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(52, 211, 153, 0.3)" />
                            <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                        <line
                            key={level}
                            x1={chartPadding.left}
                            y1={chartPadding.top + (1 - level) * chartHeight}
                            x2={svgWidth - chartPadding.right}
                            y2={chartPadding.top + (1 - level) * chartHeight}
                            stroke="rgba(255,255,255,0.1)"
                            strokeDasharray="4,4"
                        />
                    ))}

                    {/* Area fill */}
                    <path
                        d={areaPath}
                        fill="url(#emotionGradient)"
                    />

                    {/* Main line - thicker for better visibility */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#9370DB"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Reaction overlay line */}
                    {showReactions && reactionPath && (
                        <path
                            d={reactionPath}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="2"
                            strokeOpacity="0.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="4,2"
                        />
                    )}

                    {/* Data points - larger for better visibility with glow effect */}
                    {chartPoints.map((point, index) => {
                        const isHovered = hoveredReading?.t_s === point.t_s;
                        return (
                            <g key={index} style={{ cursor: onSeek ? 'pointer' : 'default' }}>
                                {/* Glow effect on hover */}
                                {isHovered && (
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={20}
                                        fill={point.color}
                                        opacity={0.3}
                                        className="animate-pulse"
                                    />
                                )}
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={isHovered ? 12 : 8}
                                    fill={point.color}
                                    stroke={isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
                                    strokeWidth={isHovered ? "3" : "2.5"}
                                    style={{
                                        transition: 'all 0.3s ease-out',
                                        filter: isHovered ? `drop-shadow(0 0 8px ${point.color})` : 'none',
                                    }}
                                />
                                {/* Trigger indicator */}
                                <text
                                    x={point.x}
                                    y={point.y + 26}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="rgba(255,255,255,0.7)"
                                >
                                    {TRIGGER_ICONS[point.trigger] || ''}
                                </text>
                            </g>
                        );
                    })}

                    {/* Transition markers */}
                    {emotional_transitions?.map((trans, index) => {
                        const xPercent = duration > 0 ? (trans.transition_time_s / duration) : 0;
                        const x = chartPadding.left + xPercent * chartContentWidth;
                        return (
                            <g key={`trans-${index}`}>
                                <line
                                    x1={x}
                                    y1={chartPadding.top - 5}
                                    x2={x}
                                    y2={chartPadding.top + chartHeight + 5}
                                    stroke="rgba(255,255,255,0.3)"
                                    strokeDasharray="2,2"
                                />
                                <circle
                                    cx={x}
                                    cy={chartPadding.top - 8}
                                    r="4"
                                    fill={trans.transition_type === 'sudden' ? '#FF4500' : '#90EE90'}
                                />
                            </g>
                        );
                    })}

                    {/* Current time indicator */}
                    {currentTimeX > chartPadding.left && (
                        <line
                            x1={currentTimeX}
                            y1={chartPadding.top - 5}
                            x2={currentTimeX}
                            y2={chartPadding.top + chartHeight + 5}
                            stroke="#00BFFF"
                            strokeWidth="2"
                        />
                    )}

                    {/* Time axis labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                        <text
                            key={pct}
                            x={chartPadding.left + pct * chartContentWidth}
                            y={height - 5}
                            textAnchor="middle"
                            fontSize="10"
                            fill="rgba(255,255,255,0.5)"
                        >
                            {formatTime(pct * duration)}
                        </text>
                    ))}
                </svg>

                {/* Legend */}
                {showReactions && hasReactionData && (
                    <div className="flex items-center gap-4 mt-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-0.5 rounded bg-purple-400" />
                            <span className="text-text-dim">AI Emotion Estimate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-0.5 rounded bg-emerald-400" style={{ borderStyle: 'dashed' }} />
                            <span className="text-text-dim">Audience Reactions</span>
                        </div>
                    </div>
                )}

                {/* Tooltip */}
                {hoveredReading && (
                    <div 
                        className="absolute z-10 bg-background-end/95 backdrop-blur border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none"
                        style={{ 
                            left: tooltipPosition.x + 10, 
                            top: tooltipPosition.y - 100,
                            transform: tooltipPosition.x > 200 ? 'translateX(-100%)' : 'none'
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: EMOTION_COLORS[hoveredReading.dominant_emotion] }}
                            />
                            <span className="text-white font-medium capitalize">
                                {hoveredReading.dominant_emotion}
                            </span>
                            {hoveredReading.secondary_emotion && (
                                <span className="text-text-dim text-sm">
                                    + {hoveredReading.secondary_emotion}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-text-dim space-y-1">
                            <div>Time: {formatTime(hoveredReading.t_s)}</div>
                            <div>Intensity: {Math.round(hoveredReading.intensity * 100)}%</div>
                            <div>Trigger: {TRIGGER_ICONS[hoveredReading.trigger]} {hoveredReading.trigger}</div>
                        </div>
                        {onSeek && (
                            <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-cyan-400">
                                Click to jump to this moment
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Emotional Transitions */}
            {emotional_transitions && emotional_transitions.length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm text-text-dim flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Emotional Transitions ({emotional_transitions.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {emotional_transitions.map((trans, index) => (
                            <button
                                key={index}
                                onClick={() => onSeek?.(trans.transition_time_s)}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                            >
                                <span 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: EMOTION_COLORS[trans.from_emotion] }}
                                />
                                <span className="text-text-dim text-xs capitalize">{trans.from_emotion}</span>
                                <ArrowRight className="w-3 h-3 text-text-dim" />
                                <span 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: EMOTION_COLORS[trans.to_emotion] }}
                                />
                                <span className="text-white text-xs capitalize">{trans.to_emotion}</span>
                                <span className="text-text-dim text-xs ml-1">
                                    @ {formatTime(trans.transition_time_s)}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    trans.transition_type === 'sudden' ? 'bg-red-500/20 text-red-400' :
                                    trans.transition_type === 'contrast' ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    {trans.transition_type}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Emotion Legend */}
            <div className="flex flex-wrap gap-2 justify-center">
                {Object.entries(EMOTION_COLORS).slice(0, 10).map(([emotion, color]) => (
                    <div key={emotion} className="flex items-center gap-1.5 text-xs text-text-dim">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="capitalize">{emotion}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmotionalTimelineChart;

