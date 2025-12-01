import React, { useState } from 'react';
import { GlassCard } from '@shared/components/GlassCard';
import { Sparkles, Scissors, Loader2, X } from 'lucide-react';

interface ScriptEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefine: (instructions: string) => Promise<void>;
    onCutdown: (duration: number) => Promise<void>;
    currentDuration?: number;
    isProcessing: boolean;
}

type Tab = 'refine' | 'cutdown';

export const ScriptEditModal: React.FC<ScriptEditModalProps> = ({ 
    isOpen, 
    onClose, 
    onRefine, 
    onCutdown, 
    currentDuration = 30,
    isProcessing 
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('refine');
    const [instructions, setInstructions] = useState('');
    
    if (!isOpen) return null;

    const handleRefineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (instructions.trim()) {
            onRefine(instructions);
        }
    };

    const cutdownOptions = [60, 30, 15, 6].filter(d => d < currentDuration);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg p-0 overflow-hidden shadow-2xl border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        {activeTab === 'refine' ? <Sparkles className="text-neon-purple" size={18} /> : <Scissors className="text-neon-blue" size={18} />}
                        {activeTab === 'refine' ? 'AI Refinement' : 'Smart Cutdown'}
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('refine')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'refine' ? 'text-white bg-white/5' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                        }`}
                    >
                        Refine with AI
                    </button>
                    <button
                        onClick={() => setActiveTab('cutdown')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'cutdown' ? 'text-white bg-white/5' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                        }`}
                    >
                        Create Cutdown
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[240px]">
                    {isProcessing ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <Loader2 size={32} className="text-neon-purple animate-spin" />
                            <p className="text-sm text-white/60">
                                {activeTab === 'refine' ? 'Refining script...' : 'Generating cutdown...'}
                            </p>
                        </div>
                    ) : activeTab === 'refine' ? (
                        <form onSubmit={handleRefineSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-white/60">How should the AI change this script?</label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="e.g., Make the dialogue punchier, focus more on the price point, add a twist ending..."
                                    className="w-full h-32 bg-black/20 border border-white/10 rounded-lg p-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-purple/50 resize-none"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={!instructions.trim()}
                                    className="px-4 py-2 bg-neon-purple hover:bg-neon-purple/90 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Sparkles size={16} />
                                    Generate Refinement
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-white/60">Select a target duration. The AI will intelligently condense the narrative while preserving key brand messages.</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {cutdownOptions.length > 0 ? cutdownOptions.map(duration => (
                                    <button
                                        key={duration}
                                        onClick={() => onCutdown(duration)}
                                        className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-blue/50 transition-all text-left group"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-lg font-bold text-white">{duration}s</span>
                                            <Scissors size={16} className="text-white/20 group-hover:text-neon-blue transition-colors" />
                                        </div>
                                        <span className="text-xs text-white/40">Target Duration</span>
                                    </button>
                                )) : (
                                    <div className="col-span-2 text-center py-8 text-white/40 bg-white/5 rounded-lg border border-dashed border-white/10">
                                        Script is already short ({currentDuration}s)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};




