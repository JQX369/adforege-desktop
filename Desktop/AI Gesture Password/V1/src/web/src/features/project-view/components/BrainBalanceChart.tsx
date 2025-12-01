import React from 'react';
import { Brain, Heart, Calculator } from 'lucide-react';
import { motion } from 'framer-motion';

interface BrainBalanceData {
    emotional_score: number;
    rational_score: number;
    dominant_mode: 'emotional' | 'rational' | 'balanced';
    emotional_drivers?: string[];
    rational_drivers?: string[];
    balance_assessment?: string;
}

interface BrainBalanceChartProps {
    data: BrainBalanceData;
}

export const BrainBalanceChart: React.FC<BrainBalanceChartProps> = ({ data }) => {
    const { emotional_score, rational_score, dominant_mode, emotional_drivers, rational_drivers, balance_assessment } = data;

    // Ensure scores sum to 100
    const total = emotional_score + rational_score;
    const normalizedEmotional = total > 0 ? (emotional_score / total) * 100 : 50;
    const normalizedRational = total > 0 ? (rational_score / total) * 100 : 50;

    const getDominantColor = () => {
        if (dominant_mode === 'emotional') return { bg: 'from-rose-500 to-pink-500', text: 'text-rose-400' };
        if (dominant_mode === 'rational') return { bg: 'from-blue-500 to-cyan-500', text: 'text-cyan-400' };
        return { bg: 'from-purple-500 to-violet-500', text: 'text-purple-400' };
    };

    const colors = getDominantColor();

    return (
        <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900/50 to-gray-950/50 border border-white/10">
            <div className="flex items-center justify-between mb-4">
                <h5 className="text-white font-medium flex items-center gap-2 text-sm">
                    <Brain className="text-purple-400" size={16} />
                    Brain Balance
                </h5>
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${colors.text} bg-white/5`}>
                    {dominant_mode}
                </span>
            </div>

            {/* Balance Bar */}
            <div className="relative h-8 rounded-full bg-white/5 overflow-hidden mb-4">
                {/* Emotional side (left/pink) */}
                <motion.div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-500/80 to-rose-400/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${normalizedEmotional}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
                {/* Rational side (right/blue) */}
                <motion.div 
                    className="absolute right-0 top-0 h-full bg-gradient-to-l from-cyan-500/80 to-cyan-400/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${normalizedRational}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
                
                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 transform -translate-x-1/2" />
                
                {/* Labels */}
                <div className="absolute inset-0 flex items-center justify-between px-3">
                    <div className="flex items-center gap-1.5">
                        <Heart size={14} className="text-white" />
                        <span className="text-white font-bold text-sm">{Math.round(normalizedEmotional)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-sm">{Math.round(normalizedRational)}%</span>
                        <Calculator size={14} className="text-white" />
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex justify-between text-[10px] text-text-dim mb-4">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-400" />
                    <span>Emotional Appeal</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" />
                    <span>Rational Appeal</span>
                </div>
            </div>

            {/* Drivers */}
            <div className="grid grid-cols-2 gap-3 text-[10px]">
                {/* Emotional Drivers */}
                <div>
                    <div className="text-rose-400 font-medium mb-1.5 flex items-center gap-1">
                        <Heart size={10} /> Emotional Drivers
                    </div>
                    {emotional_drivers && emotional_drivers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {emotional_drivers.slice(0, 4).map((driver, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                    {driver}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-text-dim italic">None identified</span>
                    )}
                </div>

                {/* Rational Drivers */}
                <div>
                    <div className="text-cyan-400 font-medium mb-1.5 flex items-center gap-1">
                        <Calculator size={10} /> Rational Drivers
                    </div>
                    {rational_drivers && rational_drivers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {rational_drivers.slice(0, 4).map((driver, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                    {driver}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-text-dim italic">None identified</span>
                    )}
                </div>
            </div>

            {/* Assessment */}
            {balance_assessment && (
                <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-white/60 text-[10px] italic">{balance_assessment}</p>
                </div>
            )}
        </div>
    );
};

export default BrainBalanceChart;

