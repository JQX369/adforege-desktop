import React from 'react';
import type { PolishedScript } from '../../types';
import { Trophy, Clock, Star, Edit2, Sparkles } from 'lucide-react';

interface ConceptNavigatorProps {
    scripts: PolishedScript[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onEdit?: (id: string) => void;
    winnerId?: string;
}

export const ConceptNavigator: React.FC<ConceptNavigatorProps> = ({ 
    scripts, 
    selectedId, 
    onSelect, 
    onEdit,
    winnerId 
}) => {
    return (
        <div className="flex flex-col h-full bg-[#0B0B0C] border-r border-white/5 w-80 flex-shrink-0">
            <div className="p-6 border-b border-white/5">
                <h2 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-1">CONCEPTS</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {scripts.map((script, idx) => {
                    const isSelected = selectedId === script.id;
                    const isWinner = winnerId === script.id;

                    return (
                        <button
                            key={script.id}
                            onClick={() => onSelect(script.id)}
                            className={`w-full text-left relative group rounded-xl transition-all duration-200 border p-4 ${
                                isSelected 
                                    ? 'bg-[#1A1A1F] border-white/10 shadow-lg ring-1 ring-white/5' 
                                    : 'bg-transparent border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-medium ${isSelected ? 'text-white/60' : 'text-white/40'}`}>
                                    Option {idx + 1}
                                </span>
                                {isWinner && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded text-yellow-400">
                                        <Trophy size={10} /> WINNER
                                    </span>
                                )}
                            </div>
                            
                            <h3 className={`text-sm font-medium mb-3 line-clamp-2 leading-snug ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                {script.title || "Untitled Script"}
                            </h3>
                            
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-text-dim">
                                    <Clock size={12} /> 
                                    {script.duration || script.estimated_duration_seconds || '30'}s
                                </span>
                                
                                {onEdit && isSelected && (
                                    <div 
                                        role="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(script.id);
                                        }}
                                        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <Edit2 size={12} />
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
