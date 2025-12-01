import React, { useState, useEffect } from 'react';
import { FileText, Upload, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '@lib/services/api';
import type { ScriptInput } from '@lib/services/api';
import type { AdScriptRun, PolishedScript } from '@features/ad-script-lab/types';
import { GlassCard } from '@shared/components/GlassCard';
import { ScriptPickerModal } from './ScriptPickerModal';

interface ScriptSelectorProps {
    onAnalyze: (input: ScriptInput, file?: File) => void;
    isAnalyzing: boolean;
}

export const ScriptSelector: React.FC<ScriptSelectorProps> = ({ onAnalyze, isAnalyzing }) => {
    const [mode, setMode] = useState<'upload' | 'lab'>('lab');
    const [file, setFile] = useState<File | null>(null);
    const [history, setHistory] = useState<AdScriptRun[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Script picker modal state
    const [showScriptPicker, setShowScriptPicker] = useState(false);
    const [selectedRun, setSelectedRun] = useState<AdScriptRun | null>(null);

    useEffect(() => {
        if (mode === 'lab') {
            loadHistory();
        }
    }, [mode]);

    const loadHistory = async () => {
        try {
            setLoadingHistory(true);
            const runs = await api.listAdScriptRuns(20);
            setHistory(runs.filter(r => r.status === 'completed'));
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleCampaignClick = (run: AdScriptRun) => {
        // Check if campaign has multiple scripts
        const hasMultipleScripts = (run.artifacts?.polished_3?.length || 0) > 1 || 
            (run.artifacts?.polished_3?.length === 1 && run.artifacts?.final_script);
        
        if (hasMultipleScripts) {
            // Show script picker modal
            setSelectedRun(run);
            setShowScriptPicker(true);
        } else {
            // Single script - just select the run
            setSelectedRunId(run.run_id);
        }
    };

    const handleScriptSelect = (script: PolishedScript) => {
        if (selectedRun) {
            onAnalyze({
                source: 'ad_script_lab',
                content: script.full_script,
                ad_script_run_id: selectedRun.run_id
            });
            setShowScriptPicker(false);
            setSelectedRun(null);
        }
    };

    const handleAnalyze = () => {
        if (mode === 'upload' && file) {
             onAnalyze({
                source: 'upload',
                file_name: file.name
             }, file);
        } else if (mode === 'lab' && selectedRunId) {
            const run = history.find(r => r.run_id === selectedRunId);
            if (run) {
                // Check if there are multiple scripts
                const hasMultipleScripts = (run.artifacts?.polished_3?.length || 0) > 1;
                
                if (hasMultipleScripts) {
                    // Show picker
                    setSelectedRun(run);
                    setShowScriptPicker(true);
                } else if (run.artifacts?.final_script) {
                    // Use final script directly
                    onAnalyze({
                        source: 'ad_script_lab',
                        content: run.artifacts.final_script.full_script,
                        ad_script_run_id: run.run_id
                    });
                }
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-white/10 pb-4">
                <button
                    onClick={() => setMode('lab')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        mode === 'lab' 
                            ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' 
                            : 'text-text-dim hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Clock size={18} />
                    Ad Script Lab History
                </button>
                <button
                    onClick={() => setMode('upload')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        mode === 'upload' 
                            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' 
                            : 'text-text-dim hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Upload size={18} />
                    Upload Script
                </button>
            </div>

            <GlassCard className="p-6 min-h-[400px]">
                {mode === 'lab' ? (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Select a generated script</h3>
                        {loadingHistory ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="animate-spin text-neon-blue" size={32} />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 text-text-dim">
                                No completed scripts found. Go to Ad Script Lab to generate one!
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                {history.map(run => {
                                    const scriptCount = (run.artifacts?.polished_3?.length || 0) + 
                                        (run.artifacts?.final_script && !run.artifacts?.polished_3?.find(s => s.id === run.artifacts?.final_script?.id) ? 1 : 0);
                                    
                                    return (
                                        <button
                                            key={run.run_id}
                                            onClick={() => handleCampaignClick(run)}
                                            className={`w-full text-left p-4 rounded-xl border transition-all ${
                                                selectedRunId === run.run_id
                                                    ? 'bg-neon-blue/10 border-neon-blue/50 ring-1 ring-neon-blue/30'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-white">{run.brief.asset_name || 'Untitled Campaign'}</div>
                                                    <div className="text-sm text-text-dim mt-1 line-clamp-2">
                                                        {run.brief.objective}
                                                    </div>
                                                    {scriptCount > 1 && (
                                                        <div className="text-xs text-neon-purple mt-2">
                                                            {scriptCount} scripts available
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-text-dim flex flex-col items-end gap-1">
                                                    <span>{new Date(run.created_at).toLocaleDateString()}</span>
                                                    <span className="bg-neon-green/10 text-neon-green px-2 py-0.5 rounded-full">
                                                        {run.brief.creative_mode}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 flex flex-col items-center justify-center h-[400px]">
                        <div className="w-full max-w-md">
                            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-neon-purple/50 hover:bg-white/5 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-12 h-12 text-text-dim mb-4" />
                                    <p className="mb-2 text-sm text-text-dim">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-text-dim/50">TXT or DOCX (MAX. 5MB)</p>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".txt,.docx"
                                    onChange={handleUpload}
                                />
                            </label>
                            {file && (
                                <div className="mt-4 p-3 bg-white/5 rounded-lg flex items-center gap-3 border border-white/10">
                                    <FileText className="text-neon-purple" size={20} />
                                    <span className="text-white flex-1 truncate">{file.name}</span>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); setFile(null); }}
                                        className="text-text-dim hover:text-white"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </GlassCard>

            <div className="flex justify-end">
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (mode === 'upload' && !file) || (mode === 'lab' && !selectedRunId)}
                    className="px-8 py-4 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl font-bold text-white hover:shadow-lg hover:shadow-neon-blue/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Analyzing Script...
                        </>
                    ) : (
                        <>
                            <CheckCircle />
                            Analyze & Extract
                        </>
                    )}
                </button>
            </div>

            {/* Script Picker Modal */}
            {showScriptPicker && selectedRun && (
                <ScriptPickerModal
                    run={selectedRun}
                    onSelect={handleScriptSelect}
                    onCancel={() => {
                        setShowScriptPicker(false);
                        setSelectedRun(null);
                    }}
                />
            )}
        </div>
    );
};
