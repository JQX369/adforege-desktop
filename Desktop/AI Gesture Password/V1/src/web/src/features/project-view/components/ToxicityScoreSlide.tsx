import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle, 
    CheckCircle, 
    XCircle, 
    Brain, 
    Zap, 
    Shield,
    ChevronDown,
    ChevronRight,
    Volume2,
    Eye,
    Scale,
    Sparkles,
    Info
} from 'lucide-react';

interface PillarBreakdown {
    score: number;
    weight: number;
    flags: string[];
    ai_analysis?: {
        model: string;
        manipulation_score: number;
        subtle_patterns: string[];
        fear_appeals: string[];
    };
}

interface ToxicityData {
    toxic_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    breakdown: {
        physiological: PillarBreakdown;
        psychological: PillarBreakdown;
        regulatory: PillarBreakdown;
    };
    dark_patterns_detected: string[];
    recommendation: string;
    metadata: {
        weights: {
            physiological: number;
            psychological: number;
            regulatory: number;
        };
        duration_seconds: number;
        claims_count: number;
        ai_enabled: boolean;
    };
}

interface ToxicityScoreSlideProps {
    toxicity: ToxicityData | null | undefined;
}

// Color configurations for risk levels
const RISK_COLORS = {
    LOW: {
        gradient: 'from-emerald-500 to-green-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: CheckCircle,
    },
    MEDIUM: {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: AlertTriangle,
    },
    HIGH: {
        gradient: 'from-red-500 to-rose-600',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: XCircle,
    },
};

// Pillar icons and colors
const PILLAR_CONFIG = {
    physiological: {
        label: 'Physiological',
        icon: Zap,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        description: 'Sensory assault metrics (cuts, loudness, flashing)',
    },
    psychological: {
        label: 'Psychological',
        icon: Brain,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        description: 'Dark patterns and manipulative language',
    },
    regulatory: {
        label: 'Regulatory',
        icon: Scale,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/20',
        description: 'Compliance violations and missing disclaimers',
    },
};

// Score gauge component
const ScoreGauge: React.FC<{ score: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }> = ({ score, riskLevel }) => {
    const config = RISK_COLORS[riskLevel];
    const Icon = config.icon;
    
    // Calculate gauge rotation (0-100 maps to -90 to 90 degrees)
    const rotation = (score / 100) * 180 - 90;
    
    return (
        <div className="relative w-48 h-24 mx-auto">
            {/* Gauge background arc */}
            <svg viewBox="0 0 200 100" className="w-full h-full">
                {/* Background arc */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />
                {/* Colored segments */}
                <path
                    d="M 20 100 A 80 80 0 0 1 73 32"
                    fill="none"
                    stroke="rgba(16, 185, 129, 0.5)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />
                <path
                    d="M 73 32 A 80 80 0 0 1 127 32"
                    fill="none"
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeWidth="16"
                />
                <path
                    d="M 127 32 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.5)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />
                {/* Needle */}
                <g transform={`rotate(${rotation} 100 100)`}>
                    <line
                        x1="100"
                        y1="100"
                        x2="100"
                        y2="35"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx="100" cy="100" r="8" fill="white" />
                </g>
            </svg>
            
            {/* Score display */}
            <div className="absolute inset-x-0 bottom-0 text-center">
                <div className={`text-4xl font-bold bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
                    {score}
                </div>
                <div className={`text-xs uppercase tracking-wider ${config.text} flex items-center justify-center gap-1`}>
                    <Icon size={12} />
                    {riskLevel} RISK
                </div>
            </div>
        </div>
    );
};

// Pillar card component
const PillarCard: React.FC<{
    pillarKey: 'physiological' | 'psychological' | 'regulatory';
    data: PillarBreakdown;
}> = ({ pillarKey, data }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const config = PILLAR_CONFIG[pillarKey];
    const Icon = config.icon;
    
    // Determine score risk level for this pillar
    const getPillarRisk = (score: number) => {
        if (score <= 30) return 'LOW';
        if (score <= 60) return 'MEDIUM';
        return 'HIGH';
    };
    
    const risk = getPillarRisk(data.score);
    const riskConfig = RISK_COLORS[risk];
    
    return (
        <div className={`rounded-xl ${config.bgColor} border ${config.borderColor} overflow-hidden`}>
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon size={20} className={config.color} />
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{config.label}</span>
                            <span className="text-xs text-text-dim">({Math.round(data.weight * 100)}% weight)</span>
                        </div>
                        <p className="text-xs text-text-dim">{config.description}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Score badge */}
                    <div className={`px-3 py-1 rounded-full ${riskConfig.bg} ${riskConfig.text} font-bold text-sm`}>
                        {data.score}/100
                    </div>
                    {isExpanded ? (
                        <ChevronDown size={16} className="text-text-dim" />
                    ) : (
                        <ChevronRight size={16} className="text-text-dim" />
                    )}
                </div>
            </button>
            
            {/* Expanded content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3">
                            {/* Flags */}
                            {data.flags.length > 0 ? (
                                <div className="space-y-2">
                                    {data.flags.map((flag, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-2 p-2 bg-white/5 rounded-lg text-sm"
                                        >
                                            <AlertTriangle size={14} className={riskConfig.text + " shrink-0 mt-0.5"} />
                                            <span className="text-white/80">{flag}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg text-sm">
                                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                    <span className="text-emerald-300">No issues detected in this category</span>
                                </div>
                            )}
                            
                            {/* AI Analysis for psychological pillar */}
                            {pillarKey === 'psychological' && data.ai_analysis && (
                                <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-purple-400" />
                                        <span className="text-xs uppercase tracking-wider text-purple-400">
                                            AI Analysis
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/60 space-y-1">
                                        <p>Manipulation Score: {Math.round(data.ai_analysis.manipulation_score * 100)}%</p>
                                        {data.ai_analysis.fear_appeals.length > 0 && (
                                            <p>Fear Appeals: {data.ai_analysis.fear_appeals.join(', ')}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Dark patterns section
const DarkPatternsSection: React.FC<{ patterns: string[] }> = ({ patterns }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (patterns.length === 0) return null;
    
    return (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                        <Eye size={20} className="text-red-400" />
                    </div>
                    <div className="text-left">
                        <span className="text-white font-semibold">Dark Patterns Detected</span>
                        <p className="text-xs text-text-dim">{patterns.length} manipulative phrase(s) found</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-sm">
                        {patterns.length}
                    </span>
                    {isExpanded ? (
                        <ChevronDown size={16} className="text-text-dim" />
                    ) : (
                        <ChevronRight size={16} className="text-text-dim" />
                    )}
                </div>
            </button>
            
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4">
                            <div className="flex flex-wrap gap-2">
                                {patterns.map((pattern, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300"
                                    >
                                        "{pattern}"
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const ToxicityScoreSlide: React.FC<ToxicityScoreSlideProps> = ({ toxicity }) => {
    if (!toxicity) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="w-16 h-16 text-text-dim opacity-30 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Toxicity Score Not Available</h3>
                <p className="text-text-dim text-sm max-w-md">
                    Toxicity analysis was not performed for this ad. This may be due to missing video data or an analysis error.
                </p>
            </div>
        );
    }
    
    const riskConfig = RISK_COLORS[toxicity.risk_level];
    const RiskIcon = riskConfig.icon;
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative"
        >
            {/* Subtle Green Themed Container */}
            <div className="bg-gradient-to-br from-emerald-950/30 via-gray-950/50 to-emerald-950/20 rounded-2xl border border-emerald-500/10 p-6 space-y-6">
                {/* Subtle green glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center gap-3 relative">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20">
                        <Shield size={24} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            Toxicity Score
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskConfig.bg} ${riskConfig.text}`}>
                                {toxicity.risk_level}
                            </span>
                        </h3>
                        <p className="text-emerald-200/50 text-sm">
                            Evaluates potential harm across physiological, psychological, and regulatory dimensions
                        </p>
                    </div>
                </div>
            
                {/* Main Score Section */}
                <div className={`p-6 rounded-2xl ${riskConfig.bg} border ${riskConfig.border} relative`}>
                    <div className="flex items-center justify-between">
                        {/* Gauge */}
                        <div className="flex-1">
                            <ScoreGauge score={toxicity.toxic_score} riskLevel={toxicity.risk_level} />
                        </div>
                        
                        {/* Recommendation */}
                        <div className="flex-1 pl-6 border-l border-white/10">
                            <div className="flex items-start gap-2 mb-2">
                                <Info size={16} className={riskConfig.text + " shrink-0 mt-0.5"} />
                                <span className="text-xs uppercase tracking-wider text-text-dim">Recommendation</span>
                            </div>
                            <p className={`text-sm ${riskConfig.text}`}>{toxicity.recommendation}</p>
                        </div>
                    </div>
                </div>
                
                {/* Pillar Breakdown */}
                <div className="space-y-3 relative">
                    <h4 className="text-sm font-semibold text-emerald-100/80 uppercase tracking-wider flex items-center gap-2">
                        <Scale size={14} className="text-emerald-400/60" />
                        Score Breakdown by Pillar
                    </h4>
                    
                    <PillarCard pillarKey="physiological" data={toxicity.breakdown.physiological} />
                    <PillarCard pillarKey="psychological" data={toxicity.breakdown.psychological} />
                    <PillarCard pillarKey="regulatory" data={toxicity.breakdown.regulatory} />
                </div>
                
                {/* Dark Patterns */}
                <DarkPatternsSection patterns={toxicity.dark_patterns_detected} />
            
                {/* Metadata footer */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-emerald-200/40 uppercase tracking-wider pt-4 border-t border-emerald-500/10">
                    <span>Duration: {Math.round(toxicity.metadata.duration_seconds)}s</span>
                    <span className="text-emerald-500/30">•</span>
                    <span>Claims: {toxicity.metadata.claims_count}</span>
                    <span className="text-emerald-500/30">•</span>
                    <span>AI: {toxicity.metadata.ai_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default ToxicityScoreSlide;

