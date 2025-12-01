import React, { useState } from 'react';
import type { PolishedScript, BraintrustCritique, ComplianceCheck, ComplianceResult, ScriptScores } from '../../types';
import { Activity, Shield, Film, AlertTriangle, CheckCircle, Users, Video, Mic, AlertCircle, Zap, Heart, MessageCircle, Sparkles, Target, TrendingUp, Brain } from 'lucide-react';

interface AnalysisRailProps {
    script: PolishedScript;
    rationale?: string;
    feedback?: BraintrustCritique[];     // Legacy: from run.artifacts
    compliance?: ComplianceCheck[];       // Legacy: from run.artifacts
}

type Tab = 'analysis' | 'compliance' | 'production';

export const AnalysisRail: React.FC<AnalysisRailProps> = ({ script, rationale, feedback, compliance }) => {
    const [activeTab, setActiveTab] = useState<Tab>('analysis');

    // Get scores - prefer per-script scores over legacy overall_score
    const scores = script.scores;
    const overallScore = scores?.overall ?? script.overall_score ?? 0;

    // Get braintrust feedback - prefer per-script feedback over legacy
    const braintrustFeedback = script.braintrust_feedback?.length
        ? script.braintrust_feedback
        : feedback;

    // Get compliance result - prefer per-script result (with solutions) over legacy
    const complianceResult = script.compliance_result;

    // Score metrics with icons and labels
    const scoreMetrics = scores ? [
        { key: 'overall_impact', label: 'Impact', icon: Target, value: scores.overall_impact },
        { key: 'hook_power', label: 'Hook', icon: Zap, value: scores.hook_power },
        { key: 'emotional_resonance', label: 'Emotion', icon: Heart, value: scores.emotional_resonance },
        { key: 'clarity_score', label: 'Clarity', icon: MessageCircle, value: scores.clarity_score },
        { key: 'distinctiveness', label: 'Unique', icon: Sparkles, value: scores.distinctiveness },
        { key: 'brand_integration', label: 'Brand', icon: Target, value: scores.brand_integration },
        { key: 'pulse_score', label: 'Pulse', icon: TrendingUp, value: scores.pulse_score },
        { key: 'echo_score', label: 'Echo', icon: Brain, value: scores.echo_score },
    ] : [];

    // Helper for score circle
    const ScoreCircle = ({ score }: { score: number }) => {
        const radius = 20;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (score / 10) * circumference;
        
        return (
            <div className="relative h-12 w-12 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        className="text-white/10"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="24"
                        cy="24"
                    />
                    {/* Progress Circle */}
                    <circle
                        className="text-neon-blue transition-all duration-1000 ease-out"
                        strokeWidth="3"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="24"
                        cy="24"
                    />
                </svg>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0B0C] border-l border-white/5 w-80 flex-shrink-0">
            {/* Tabs Header */}
            <div className="flex items-center px-2 pt-2 border-b border-white/5">
                {(['analysis', 'compliance', 'production'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 pb-3 text-xs font-medium capitalize transition-colors relative ${
                            activeTab === tab ? 'text-white' : 'text-white/40 hover:text-white/60'
                        }`}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue mx-4 rounded-t-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {activeTab === 'analysis' && (
                    <>
                        {/* Overall Score Card */}
                        <div className="bg-[#1A1A1F] rounded-xl p-5 border border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider">OVERALL SCORE</span>
                                    <div className="text-3xl font-bold text-white mt-1">
                                        {overallScore.toFixed(1)}<span className="text-lg text-white/20 font-normal">/10</span>
                                    </div>
                                </div>
                                <ScoreCircle score={overallScore} />
                            </div>

                            {/* Detailed Metrics Grid */}
                            {scoreMetrics.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
                                    {scoreMetrics.map((metric) => (
                                        <div key={metric.key} className="text-center">
                                            <metric.icon size={12} className="mx-auto mb-1 text-neon-blue/60" />
                                            <div className="text-xs font-medium text-white">{metric.value?.toFixed(1) ?? '-'}</div>
                                            <div className="text-[10px] text-white/40">{metric.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Braintrust Feedback */}
                        {braintrustFeedback && braintrustFeedback.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                    <Users size={12} /> Braintrust Feedback
                                </h3>
                                <div className="space-y-3">
                                    {braintrustFeedback.map((fb, idx) => (
                                        <div key={idx} className="bg-[#1A1A1F] p-4 rounded-xl border border-white/5 relative overflow-hidden group">
                                            <div className={`absolute top-0 left-0 w-1 h-full ${fb.would_approve ? 'bg-green-500/50' : 'bg-yellow-500/50'}`} />
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${fb.would_approve ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <span className="text-xs font-bold text-white">{fb.critic_persona}</span>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                    fb.would_approve ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {fb.overall_rating.toFixed(1)}/10
                                                </span>
                                            </div>
                                            {fb.critique ? (
                                                <p className="text-sm text-white/70 leading-relaxed italic mb-2">
                                                    "{fb.critique}"
                                                </p>
                                            ) : fb.strengths?.length > 0 ? (
                                                <div className="space-y-1 mb-2">
                                                    {fb.strengths.slice(0, 2).map((s, i) => (
                                                        <p key={i} className="text-xs text-green-400/80">+ {s}</p>
                                                    ))}
                                                    {fb.weaknesses?.slice(0, 1).map((w, i) => (
                                                        <p key={i} className="text-xs text-yellow-400/80">- {w}</p>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rationale (if script is winner) */}
                        {rationale && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Selection Rationale</h3>
                                <p className="text-sm text-white/60 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                    {rationale}
                                </p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'compliance' && (
                    <div className="space-y-4">
                        {/* Per-script compliance result with solutions */}
                        {complianceResult ? (
                            <div className="space-y-4">
                                {/* Status Header */}
                                <div className={`p-4 rounded-lg border ${
                                    complianceResult.all_clear
                                        ? 'bg-green-500/5 border-green-500/20'
                                        : 'bg-yellow-500/5 border-yellow-500/20'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-400" />
                                            <span className="text-sm font-medium text-white">
                                                Compliance Cleared
                                            </span>
                                        </div>
                                        <span className="text-[10px] px-2 py-1 rounded-full uppercase font-medium bg-green-500/20 text-green-400">
                                            {complianceResult.market?.toUpperCase() || 'UK'}
                                        </span>
                                    </div>

                                    {/* Categories Checked */}
                                    {complianceResult.categories_checked?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {complianceResult.categories_checked.map((cat, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/60">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Solutions Applied */}
                                {complianceResult.solutions_applied?.length > 0 ? (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-white/40 uppercase flex items-center gap-2">
                                            <CheckCircle size={12} className="text-green-400" />
                                            Solutions Applied ({complianceResult.solutions_applied.length})
                                        </h4>
                                        {complianceResult.solutions_applied.map((solution, i) => (
                                            <div key={i} className="bg-[#1A1A1F] p-3 rounded-lg border border-green-500/10">
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-white/80 capitalize">{solution.category}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                                solution.confidence === 'high'
                                                                    ? 'bg-green-500/20 text-green-400'
                                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                            }`}>{solution.confidence} confidence</span>
                                                        </div>
                                                        <p className="text-xs text-white/50 mb-1 line-through">{solution.original_issue}</p>
                                                        <p className="text-xs text-green-400/90">
                                                            <span className="font-medium">✓ Fixed:</span> {solution.fix_applied}
                                                        </p>
                                                        {solution.location && (
                                                            <p className="text-[10px] text-white/40 mt-1">Location: {solution.location}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-green-500/5 p-4 rounded-lg border border-green-500/10 text-center">
                                        <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
                                        <p className="text-sm text-green-400 font-medium">No Issues Found</p>
                                        <p className="text-xs text-white/50 mt-1">Script passed all compliance checks</p>
                                    </div>
                                )}

                                {/* Notes */}
                                {complianceResult.notes && (
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                        <h4 className="text-xs font-semibold text-white/40 uppercase mb-2">Compliance Notes</h4>
                                        <p className="text-xs text-white/60">{complianceResult.notes}</p>
                                    </div>
                                )}
                            </div>
                        ) : compliance && compliance.length > 0 ? (
                            /* Legacy fallback - show old compliance checks */
                            <>
                                {compliance.map((check, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <div className={`p-4 rounded-lg border ${
                                            check.passed ? 'bg-green-500/5 border-green-500/20' :
                                            check.risk_level === 'high' ? 'bg-red-500/5 border-red-500/20' :
                                            'bg-yellow-500/5 border-yellow-500/20'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {check.passed ? (
                                                        <CheckCircle size={16} className="text-green-400" />
                                                    ) : (
                                                        <AlertTriangle size={16} className={check.risk_level === 'high' ? 'text-red-400' : 'text-yellow-400'} />
                                                    )}
                                                    <span className="text-sm font-medium text-white">
                                                        Script {idx + 1}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-medium ${
                                                    check.risk_level === 'low' ? 'bg-green-500/20 text-green-400' :
                                                    check.risk_level === 'high' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {check.risk_level} risk
                                                </span>
                                            </div>

                                            {check.categories_checked?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {check.categories_checked.map((cat, i) => (
                                                        <span key={i} className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/60">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {check.clearcast_notes && (
                                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                                <p className="text-xs text-white/60 whitespace-pre-line">{check.clearcast_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="text-center py-8 text-white/40">
                                <Shield size={32} className="mx-auto mb-3 opacity-50" />
                                <p className="text-sm">No compliance checks run.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'production' && (
                    <div className="space-y-6">
                        {script.visual_style && (
                            <div>
                                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Video size={12} className="text-blue-400" /> Visual Style
                                </h3>
                                <p className="text-sm text-white/70 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                    {script.visual_style}
                                </p>
                            </div>
                        )}

                        {script.audio_notes && (
                            <div>
                                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Mic size={12} className="text-purple-400" /> Audio Notes
                                </h3>
                                <p className="text-sm text-white/70 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                    {script.audio_notes}
                                </p>
                            </div>
                        )}

                        {script.production_considerations && (
                            <div>
                                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Film size={12} className="text-orange-400" /> Production Notes
                                </h3>
                                <p className="text-sm text-white/70 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                    {script.production_considerations}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
