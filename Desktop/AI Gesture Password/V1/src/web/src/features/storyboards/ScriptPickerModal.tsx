import React, { useState } from 'react';
import { X, FileText, Check, Sparkles } from 'lucide-react';
import type { AdScriptRun } from '@features/ad-script-lab/types';
import type { PolishedScript } from '@features/ad-script-lab/types';
import { GlassCard } from '@shared/components/GlassCard';

interface ScriptPickerModalProps {
    run: AdScriptRun;
    onSelect: (script: PolishedScript) => void;
    onCancel: () => void;
}

export const ScriptPickerModal: React.FC<ScriptPickerModalProps> = ({ 
    run, 
    onSelect, 
    onCancel 
}) => {
    const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

    // Collect all available scripts
    const scripts: PolishedScript[] = [];
    
    // Add polished scripts (up to 3)
    if (run.artifacts?.polished_3) {
        scripts.push(...run.artifacts.polished_3);
    }
    
    // Add final script if it exists and is different from the polished ones
    if (run.artifacts?.final_script) {
        const finalId = run.artifacts.final_script.id;
        if (!scripts.find(s => s.id === finalId)) {
            scripts.push(run.artifacts.final_script);
        }
    }

    const handleConfirm = () => {
        const script = scripts.find(s => s.id === selectedScriptId);
        if (script) {
            onSelect(script);
        }
    };

    // If only one script, auto-select it
    React.useEffect(() => {
        if (scripts.length === 1) {
            setSelectedScriptId(scripts[0].id);
        }
    }, [scripts.length]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onCancel}
            />
            
            {/* Modal */}
            <GlassCard className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileText className="text-neon-blue" size={24} />
                            Select a Script
                        </h2>
                        <p className="text-sm text-text-dim mt-1">
                            {run.brief.asset_name || 'Campaign'} has {scripts.length} script{scripts.length !== 1 ? 's' : ''} available
                        </p>
                    </div>
                    <button 
                        onClick={onCancel}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-text-dim" />
                    </button>
                </div>

                {/* Script List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {scripts.map((script, index) => {
                        const isFinal = run.artifacts?.final_script?.id === script.id;
                        const isSelected = selectedScriptId === script.id;
                        
                        return (
                            <button
                                key={script.id}
                                onClick={() => setSelectedScriptId(script.id)}
                                className={`w-full text-left p-5 rounded-xl border transition-all ${
                                    isSelected
                                        ? 'bg-neon-blue/10 border-neon-blue/50 ring-1 ring-neon-blue/30'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-mono text-text-dim">
                                                #{index + 1}
                                            </span>
                                            <h3 className="font-semibold text-white truncate">
                                                {script.title}
                                            </h3>
                                            {isFinal && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green text-xs border border-neon-green/20">
                                                    <Sparkles size={12} />
                                                    Final
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Hook preview */}
                                        <p className="text-sm text-text-dim line-clamp-2 mb-3">
                                            {script.opening || 'No opening available'}
                                        </p>
                                        
                                        {/* Meta info */}
                                        <div className="flex items-center gap-4 text-xs text-text-dim/70">
                                            <span>{script.estimated_duration_seconds}s</span>
                                            <span className="truncate">{script.visual_style}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Selection indicator */}
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                        isSelected 
                                            ? 'border-neon-blue bg-neon-blue' 
                                            : 'border-white/30'
                                    }`}>
                                        {isSelected && <Check size={14} className="text-white" />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-lg text-text-dim hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedScriptId}
                        className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-neon-blue/20 transition-all"
                    >
                        Use This Script
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};

