import React, { useState, useEffect } from 'react';
import type { AdScriptRun, PolishedScript } from '../../types';
import { ScriptEditor } from './ScriptEditor';
import { ConceptNavigator } from './ConceptNavigator';
import { AnalysisRail } from './AnalysisRail';
import { ScriptEditModal } from './ScriptEditModal';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { api } from '@lib/services/api';
import { useToast } from '@shared/components/Toast';

interface ResultWorkspaceProps {
    run: AdScriptRun;
    onBack?: () => void;
}

export const ResultWorkspace: React.FC<ResultWorkspaceProps> = ({ run, onBack }) => {
    const { showToast } = useToast();
    const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
    const [polishedScripts, setPolishedScripts] = useState<PolishedScript[]>([]);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
    const [isProcessingEdit, setIsProcessingEdit] = useState(false);

    // Initialize scripts from run data
    useEffect(() => {
        const scripts = run.artifacts?.polished_3 || [];
        const winner = run.artifacts?.final_script;
        
        // Merge winner into polished scripts if not already there (though it usually is)
        let allScripts = [...scripts];
        if (winner && !allScripts.find(s => s.id === winner.id)) {
            allScripts.unshift(winner);
        }
        
        setPolishedScripts(allScripts);

        if (winner) {
            setSelectedScriptId(winner.id);
        } else if (allScripts.length > 0) {
            setSelectedScriptId(allScripts[0].id);
        }
    }, [run]);

    const currentScript = polishedScripts.find(s => s.id === selectedScriptId);

    // -- Handlers --

    const handleScriptChange = (newContent: string) => {
        if (!selectedScriptId) return;
        
        // Optimistic local update
        setPolishedScripts(prev => prev.map(s => 
            s.id === selectedScriptId 
                ? { ...s, full_script: newContent } 
                : s
        ));
    };

    const handleAutoSave = async (content: string) => {
        if (!selectedScriptId) return;
        
        try {
            // Call API to persist
            await api.updateAdScript(run.run_id, selectedScriptId, content);
        } catch (error) {
            console.error('Auto-save failed', error);
            showToast('Failed to save changes', { type: 'error' });
        }
    };

    const openEditModal = (scriptId: string) => {
        setEditingScriptId(scriptId);
        setEditModalOpen(true);
    };

    const handleRefine = async (instructions: string) => {
        if (!editingScriptId) return;
        setIsProcessingEdit(true);

        try {
            const updatedScript = await api.refineAdScript(run.run_id, editingScriptId, instructions);
            
            // Update local state
            setPolishedScripts(prev => prev.map(s => s.id === updatedScript.id ? updatedScript : s));
            showToast('Script refined successfully', { type: 'success' });
            setEditModalOpen(false);
        } catch (error) {
            console.error('Refine failed', error);
            showToast('Failed to refine script', { type: 'error' });
        } finally {
            setIsProcessingEdit(false);
        }
    };

    const handleCutdown = async (duration: number) => {
        if (!editingScriptId) return;
        setIsProcessingEdit(true);

        try {
            const newScript = await api.cutdownAdScript(run.run_id, editingScriptId, duration);
            
            // Add new script to list and select it
            setPolishedScripts(prev => [...prev, newScript]);
            setSelectedScriptId(newScript.id);
            showToast(`Created ${duration}s cutdown`, { type: 'success' });
            setEditModalOpen(false);
        } catch (error) {
            console.error('Cutdown failed', error);
            showToast('Failed to create cutdown', { type: 'error' });
        } finally {
            setIsProcessingEdit(false);
        }
    };

    if (!currentScript) {
        return (
            <div className="flex items-center justify-center h-full text-white">
                <p>No scripts found in this run.</p>
            </div>
        );
    }

    // Helper to format initial content if full_script is missing
    const getInitialContent = (script: PolishedScript) => {
        if (script.full_script) return script.full_script;
        return `**OPENING**\n${script.opening}\n\n**DEVELOPMENT**\n${script.development}\n\n**CLIMAX**\n${script.climax}\n\n**RESOLUTION**\n${script.resolution}`;
    };

    return (
        <div className="fixed inset-0 left-64 flex flex-col bg-[#0B0B0C] text-white overflow-hidden font-sans z-20">
            {/* Header */}
            <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0 bg-[#111114]">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sparkles size={14} className="text-blue-400" />
                            Campaign: {run.brief?.asset_name || run.brief?.brand_name || "Untitled"}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors flex items-center gap-2">
                        <Download size={14} /> Export PDF
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors">
                        Send to Storyboard
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Navigator */}
                <ConceptNavigator
                    scripts={polishedScripts}
                    selectedId={selectedScriptId}
                    onSelect={setSelectedScriptId}
                    onEdit={openEditModal}
                    winnerId={run.artifacts?.final_script?.id}
                />

                {/* Center: Script Editor */}
                <main className="flex-1 overflow-y-auto bg-[#1A1A1F] relative shadow-inner scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="max-w-[800px] mx-auto my-8 min-h-[calc(100vh-8rem)] bg-[#111114] shadow-2xl border border-white/5">
                        <ScriptEditor 
                            key={currentScript.id} // Force remount on script switch to reset state
                            content={getInitialContent(currentScript)}
                            onChange={handleScriptChange}
                            onSave={handleAutoSave}
                        />
                    </div>
                </main>

                {/* Right: Inspector */}
                <AnalysisRail
                    script={currentScript}
                    rationale={run.artifacts?.final_script?.id === currentScript.id ? run.artifacts?.selection_rationale : undefined}
                    feedback={run.artifacts?.braintrust_feedback}
                    compliance={run.artifacts?.compliance_checks}
                />
            </div>

            {/* Modals */}
            <ScriptEditModal 
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onRefine={handleRefine}
                onCutdown={handleCutdown}
                currentDuration={currentScript.estimated_duration_seconds || 30}
                isProcessing={isProcessingEdit}
            />
        </div>
    );
};
