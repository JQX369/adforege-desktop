import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Share2, Clock, Target, Heart, Zap, TrendingUp } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from 'recharts';

interface Persona {
    persona: string;
    profile: string;
    gender: string;
    age_range: string;
    race_ethnicity: string;
    location: string;
    reaction: string;
    engagement_level: string;
    likely_action: string;
    key_concern: string;
    fit: 'HIGH' | 'MEDIUM' | 'LOW';
    resonance_elements: string[];
    engagement_drivers: string[];
    conversion_blockers: string[];
    social_share_likelihood: number;
    simulated_comment: string;
    watch_completion_estimate: number;
}

interface PersonaCompareModalProps {
    personas: Persona[];
    isOpen: boolean;
    onClose: () => void;
}

// Colors for each persona in comparison
const personaColors = [
    { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.2)' },
    { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)' },
    { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.2)' },
];

// Fit level to score
const fitToScore = (fit: string): number => {
    switch (fit) {
        case 'HIGH': return 100;
        case 'MEDIUM': return 60;
        case 'LOW': return 30;
        default: return 50;
    }
};

// Engagement level to score
const engagementToScore = (level: string): number => {
    switch (level?.toLowerCase()) {
        case 'high': return 90;
        case 'medium': return 60;
        case 'low': return 30;
        default: return 50;
    }
};

export const PersonaCompareModal: React.FC<PersonaCompareModalProps> = ({
    personas,
    isOpen,
    onClose,
}) => {
    if (!isOpen || !personas || !Array.isArray(personas) || personas.length < 2) return null;

    // Prepare radar chart data
    const radarData = [
        {
            dimension: 'Fit Score',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({ ...acc, [`persona${idx}`]: fitToScore(p.fit) }), {}),
        },
        {
            dimension: 'Engagement',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({ ...acc, [`persona${idx}`]: engagementToScore(p.engagement_level) }), {}),
        },
        {
            dimension: 'Share Likelihood',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({ ...acc, [`persona${idx}`]: p.social_share_likelihood * 10 }), {}),
        },
        {
            dimension: 'Watch Completion',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({ ...acc, [`persona${idx}`]: p.watch_completion_estimate }), {}),
        },
        {
            dimension: 'Resonance',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({ ...acc, [`persona${idx}`]: Math.min(100, p.resonance_elements.length * 15) }), {}),
        },
        {
            dimension: 'Conversion Potential',
            fullMark: 100,
            ...personas.reduce((acc, p, idx) => ({
                ...acc,
                [`persona${idx}`]: Math.max(0, 100 - p.conversion_blockers.length * 25)
            }), {}),
        },
    ];

    // Calculate summary stats
    const getAverageScore = (persona: Persona): number => {
        const scores = [
            fitToScore(persona.fit),
            engagementToScore(persona.engagement_level),
            persona.social_share_likelihood * 10,
            persona.watch_completion_estimate,
            Math.min(100, persona.resonance_elements.length * 15),
            Math.max(0, 100 - persona.conversion_blockers.length * 25),
        ];
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-white/10 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
                                <Users size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Persona Comparison</h2>
                                <p className="text-text-dim text-sm">Comparing {personas.length} audience segments</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <X size={20} className="text-white/70" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Radar Chart */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <Target size={18} className="text-cyan-400" />
                                    Multi-Dimensional Comparison
                                </h3>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                            <PolarAngleAxis
                                                dataKey="dimension"
                                                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                                            />
                                            <PolarRadiusAxis
                                                angle={30}
                                                domain={[0, 100]}
                                                tick={{ fill: '#71717a', fontSize: 10 }}
                                            />
                                            {personas.map((persona, idx) => (
                                                <Radar
                                                    key={persona.persona}
                                                    name={persona.persona}
                                                    dataKey={`persona${idx}`}
                                                    stroke={personaColors[idx].stroke}
                                                    fill={personaColors[idx].fill}
                                                    strokeWidth={2}
                                                />
                                            ))}
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#18181b',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px'
                                                }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '20px' }}
                                                formatter={(value) => <span className="text-white/80 text-xs">{value}</span>}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Summary Scores */}
                            <div className="space-y-4">
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <TrendingUp size={18} className="text-purple-400" />
                                    Overall Scores
                                </h3>

                                {personas.map((persona, idx) => (
                                    <motion.div
                                        key={persona.persona}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-white/5 rounded-xl p-4 border border-white/10"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: personaColors[idx].stroke }}
                                                />
                                                <div>
                                                    <p className="text-white font-medium">{persona.persona}</p>
                                                    <p className="text-text-dim text-xs">{persona.age_range} • {persona.location}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-white">{getAverageScore(persona)}%</p>
                                                <p className="text-[10px] text-text-dim uppercase">Avg Score</p>
                                            </div>
                                        </div>

                                        {/* Mini metrics */}
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <Heart size={12} className="text-pink-400 mx-auto mb-1" />
                                                <p className="text-xs text-white">{persona.fit}</p>
                                                <p className="text-[9px] text-text-dim">Fit</p>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <Zap size={12} className="text-yellow-400 mx-auto mb-1" />
                                                <p className="text-xs text-white">{persona.engagement_level}</p>
                                                <p className="text-[9px] text-text-dim">Engage</p>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <Share2 size={12} className="text-cyan-400 mx-auto mb-1" />
                                                <p className="text-xs text-white">{persona.social_share_likelihood}/10</p>
                                                <p className="text-[9px] text-text-dim">Share</p>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <Clock size={12} className="text-purple-400 mx-auto mb-1" />
                                                <p className="text-xs text-white">{persona.watch_completion_estimate}%</p>
                                                <p className="text-[9px] text-text-dim">Watch</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Detailed Comparison Table */}
                        <div className="mt-6 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-white font-semibold">Detailed Comparison</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left p-3 text-text-dim font-medium">Attribute</th>
                                            {personas.map((p, idx) => (
                                                <th key={p.persona} className="text-left p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: personaColors[idx].stroke }}
                                                        />
                                                        <span className="text-white font-medium">{p.persona}</span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-white/5">
                                            <td className="p-3 text-text-dim">Reaction</td>
                                            {personas.map(p => (
                                                <td key={p.persona} className="p-3 text-white/80 text-xs max-w-[200px]">
                                                    "{p.reaction.slice(0, 100)}..."
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="p-3 text-text-dim">Likely Action</td>
                                            {personas.map(p => (
                                                <td key={p.persona} className="p-3 text-white/80 text-xs">
                                                    {p.likely_action}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="p-3 text-text-dim">Key Concern</td>
                                            {personas.map(p => (
                                                <td key={p.persona} className="p-3 text-yellow-400/80 text-xs">
                                                    {p.key_concern || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="p-3 text-text-dim">Resonates With</td>
                                            {personas.map(p => (
                                                <td key={p.persona} className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {p.resonance_elements.map((el, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] capitalize">
                                                                {el.replace('_', ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td className="p-3 text-text-dim">Blocked By</td>
                                            {personas.map(p => (
                                                <td key={p.persona} className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {p.conversion_blockers.length > 0 ? p.conversion_blockers.map((el, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] capitalize">
                                                                {el.replace('_', ' ')}
                                                            </span>
                                                        )) : <span className="text-text-dim text-xs">None</span>}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PersonaCompareModal;





