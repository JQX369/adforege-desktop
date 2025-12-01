import React, { useState } from 'react';
import { GlassCard } from '@shared/components/GlassCard';
import { useToast } from '@shared/components/Toast';
import { api } from '@lib/services/api';
import { 
    Sparkles, 
    Brain, 
    Target, 
    Send, 
    Loader2, 
    CheckCircle, 
    AlertCircle,
    FileText,
    Users,
    MessageSquare,
    Clock,
    DollarSign,
    ChevronDown,
    ChevronUp,
    Award,
    Shield,
    Lightbulb,
    Star,
    Globe,
    Settings,
    Upload,
    X,
    MapPin,
    Palette,
    File
} from 'lucide-react';
import type { 
    AdScriptRun, 
    BriefFormState, 
    CreativeMode,
    BudgetRange,
    PolishedScript,
    ScriptScores,
    BraintrustCritique,
    ComplianceCheck,
    Market,
    VisualStyle,
    BriefingDoc
} from './types';
import { DEFAULT_BRIEF_FORM, formToRequest, CREATIVE_MODE_INFO, BUDGET_RANGE_OPTIONS, MARKET_OPTIONS, VISUAL_STYLE_OPTIONS } from './types';
import { NeuralBrain } from './NeuralBrain';
import { PageContainer } from '@shared/components/PageContainer';

// =============================================================================
// Sub-components
// =============================================================================

const HistoryDrawer: React.FC<{
    history: AdScriptRun[];
    onSelect: (run: AdScriptRun) => void;
    onDelete: (runId: string) => void;
    currentRunId?: string;
}> = ({ history, onSelect, onDelete, currentRunId }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 transform flex flex-col items-center pointer-events-none`}>
            <div className={`w-full max-w-7xl mx-auto pointer-events-auto transition-transform duration-300 ${
                isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'
            }`}>
                {/* Handle/Tab */}
                <button 
                    className="w-full h-12 bg-slate-900/90 backdrop-blur-xl border-t border-x border-white/10 rounded-t-xl flex items-center justify-center cursor-pointer hover:bg-slate-800/90 transition-colors shadow-lg shadow-black/50"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2 text-text-dim font-medium">
                        <Clock size={16} />
                        <span>History ({history.length})</span>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                </button>

                {/* Content */}
                <div className="h-72 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-6 overflow-y-auto shadow-2xl">
                    {history.length === 0 ? (
                        <div className="text-center text-text-dim py-8">
                            No history found. Generate your first script!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {history.map(run => (
                                <div
                                    key={run.run_id}
                                    className={`relative p-4 rounded-xl text-left transition-all border group ${
                                        currentRunId === run.run_id
                                            ? 'bg-neon-blue/10 border-neon-blue/50 ring-1 ring-neon-blue/30'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <button
                                        onClick={() => {
                                            onSelect(run);
                                        }}
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-white truncate pr-2 flex-1">{run.brief.asset_name}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${
                                                run.status === 'completed' ? 'bg-neon-green/20 text-neon-green' :
                                                run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {run.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-text-dim group-hover:text-text-dim/80">
                                            <div className="flex items-center gap-2">
                                                <span>{new Date(run.created_at).toLocaleDateString()}</span>
                                                <span>{new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <span className="capitalize bg-white/5 px-2 py-0.5 rounded text-[10px]">
                                                {run.brief.creative_mode.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Are you sure you want to delete this campaign?')) {
                                                onDelete(run.run_id);
                                            }
                                        }}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/50 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        title="Delete campaign"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18"></path>
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CreativeModeSelector: React.FC<{
    value: CreativeMode;
    onChange: (mode: CreativeMode) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const modes: CreativeMode[] = ['light_think', 'standard_think', 'deep_think'];
    
    return (
        <div className="flex gap-2">
            {modes.map((mode) => {
                const info = CREATIVE_MODE_INFO[mode];
                const isActive = value === mode;
                
                return (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        disabled={disabled}
                        className={`flex-1 px-4 py-3 rounded-xl border transition-all duration-200 ${
                            isActive
                                ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border-neon-blue/50 text-white'
                                : 'bg-white/5 border-white/10 text-text-dim hover:bg-white/10 hover:text-white'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="text-2xl mb-1">{info.icon}</div>
                        <div className="font-medium">{info.label}</div>
                        <div className="text-xs text-text-dim mt-1 hidden sm:block">
                            {info.description.split('.')[0]}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const FormInput: React.FC<{
    label: string;
    name: keyof BriefFormState;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    placeholder?: string;
    required?: boolean;
    multiline?: boolean;
    type?: string;
    icon?: React.ReactNode;
    hint?: string;
}> = ({ label, name, value, onChange, placeholder, required, multiline, type = 'text', icon, hint }) => {
    const baseInputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
        placeholder-text-dim focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 
        transition-all duration-200`;
    
    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                {icon}
                {label}
                {required && <span className="text-neon-pink">*</span>}
            </label>
            {multiline ? (
                <textarea
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    rows={3}
                    className={`${baseInputClass} resize-none`}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={baseInputClass}
                />
            )}
            {hint && <p className="text-xs text-text-dim">{hint}</p>}
        </div>
    );
};

// Briefing Document Upload Component
const BriefingUpload: React.FC<{
    files: BriefingDoc[];
    onFilesChange: (files: BriefingDoc[]) => void;
    isUploading: boolean;
}> = ({ files, onFilesChange, isUploading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const acceptedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp'
    ];

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => acceptedTypes.includes(file.type)
        );
        
        if (droppedFiles.length > 0) {
            const newDocs: BriefingDoc[] = droppedFiles.map(file => ({
                file,
                name: file.name,
                size: file.size,
                type: file.type
            }));
            onFilesChange([...files, ...newDocs]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            const newDocs: BriefingDoc[] = selectedFiles.map(file => ({
                file,
                name: file.name,
                size: file.size,
                type: file.type
            }));
            onFilesChange([...files, ...newDocs]);
        }
    };

    const removeFile = (index: number) => {
        onFilesChange(files.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return '🖼️';
        if (type.includes('pdf')) return '📄';
        if (type.includes('word') || type.includes('document')) return '📝';
        return '📎';
    };

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                <Upload size={14} />
                Briefing Documents
            </label>
            
            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                    isDragging 
                        ? 'border-neon-blue bg-neon-blue/10' 
                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                
                <Upload size={24} className={`mx-auto mb-2 ${isDragging ? 'text-neon-blue' : 'text-text-dim'}`} />
                <p className="text-sm text-text-dim">
                    {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-text-dim/60 mt-1">
                    PDF, Word, Text, or Images
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2 mt-3">
                    {files.map((doc, index) => (
                        <div 
                            key={index}
                            className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 group"
                        >
                            <span className="text-lg">{getFileIcon(doc.type)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{doc.name}</p>
                                <p className="text-xs text-text-dim">{formatFileSize(doc.size)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                className="p-1 rounded hover:bg-white/10 text-text-dim hover:text-red-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isUploading && (
                <div className="flex items-center gap-2 text-sm text-neon-blue">
                    <Loader2 size={14} className="animate-spin" />
                    Processing documents...
                </div>
            )}

            <p className="text-xs text-text-dim">
                Upload creative briefs, brand guidelines, or reference materials
            </p>
        </div>
    );
};

const ScoreDisplay: React.FC<{ scores: ScriptScores }> = ({ scores }) => {
    const scoreItems = [
        { label: 'TV Native', value: scores.tv_native, color: 'neon-blue' },
        { label: 'Clarity', value: scores.clarity, color: 'neon-green' },
        { label: 'Emotional Impact', value: scores.emotional_impact, color: 'neon-pink' },
        { label: 'Brand Fit', value: scores.brand_fit, color: 'neon-purple' },
        { label: 'Memorability', value: scores.memorability, color: 'yellow-400' },
        { label: 'Originality', value: scores.originality, color: 'orange-400' },
    ];
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white flex items-center gap-2">
                    <Star size={18} className="text-yellow-400" />
                    Overall Score
                </h4>
                <span className="text-3xl font-bold text-white">
                    {scores.overall.toFixed(1)}<span className="text-lg text-text-dim">/10</span>
                </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {scoreItems.map(({ label, value }) => (
                    <div key={label} className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-text-dim mb-1">{label}</div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full"
                                    style={{ width: `${value * 10}%` }}
                                />
                            </div>
                            <span className="text-sm font-medium text-white">{value.toFixed(1)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScriptCard: React.FC<{ 
    script: PolishedScript; 
    isWinner?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
}> = ({ script, isWinner, expanded, onToggle }) => {
    return (
        <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${
            isWinner 
                ? 'border-neon-green/50 bg-neon-green/5' 
                : 'border-white/10 bg-white/5'
        }`}>
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5"
            >
                <div className="flex items-center gap-3">
                    {isWinner && (
                        <Award size={20} className="text-neon-green" />
                    )}
                    <span className="font-medium text-white">{script.title}</span>
                </div>
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                    <div>
                        <h5 className="text-sm font-medium text-text-dim mb-2">Full Script</h5>
                        <pre className="text-sm text-white whitespace-pre-wrap bg-black/30 rounded-lg p-4 overflow-x-auto">
                            {script.full_script || `Opening: ${script.opening}\n\nDevelopment: ${script.development}\n\nClimax: ${script.climax}\n\nResolution: ${script.resolution}`}
                        </pre>
                    </div>
                    
                    {script.visual_style && (
                        <div>
                            <h5 className="text-sm font-medium text-text-dim mb-1">Visual Style</h5>
                            <p className="text-sm text-white/80">{script.visual_style}</p>
                        </div>
                    )}
                    
                    {script.audio_notes && (
                        <div>
                            <h5 className="text-sm font-medium text-text-dim mb-1">Audio Notes</h5>
                            <p className="text-sm text-white/80">{script.audio_notes}</p>
                        </div>
                    )}
                    
                    {script.production_considerations && (
                        <div>
                            <h5 className="text-sm font-medium text-text-dim mb-1">Production Notes</h5>
                            <p className="text-sm text-white/80">{script.production_considerations}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const BraintrustFeedback: React.FC<{ feedback: BraintrustCritique[] }> = ({ feedback }) => {
    return (
        <div className="space-y-4">
            {feedback.map((critique, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-white">{critique.critic_persona}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${critique.would_approve ? 'text-neon-green' : 'text-yellow-400'}`}>
                                {critique.would_approve ? '✓ Would approve' : '⚠ Needs work'}
                            </span>
                            <span className="text-white font-bold">{critique.overall_rating}/10</span>
                        </div>
                    </div>
                    
                    {critique.strengths.length > 0 && (
                        <div className="mb-2">
                            <span className="text-xs text-neon-green font-medium">Strengths:</span>
                            <ul className="text-sm text-white/80 mt-1 space-y-1">
                                {critique.strengths.map((s, j) => (
                                    <li key={j}>• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {critique.weaknesses.length > 0 && (
                        <div className="mb-2">
                            <span className="text-xs text-yellow-400 font-medium">Areas to Improve:</span>
                            <ul className="text-sm text-white/80 mt-1 space-y-1">
                                {critique.weaknesses.map((w, j) => (
                                    <li key={j}>• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {critique.suggestions.length > 0 && (
                        <div>
                            <span className="text-xs text-neon-blue font-medium">Suggestions:</span>
                            <ul className="text-sm text-white/80 mt-1 space-y-1">
                                {critique.suggestions.map((s, j) => (
                                    <li key={j}>• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const ComplianceStatus: React.FC<{ checks: ComplianceCheck[] }> = ({ checks }) => {
    const allPassed = checks.every(c => c.passed);
    const highRisk = checks.some(c => c.risk_level === 'high');
    
    return (
        <div className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
                allPassed ? 'bg-neon-green/10' : highRisk ? 'bg-red-500/10' : 'bg-yellow-400/10'
            }`}>
                <Shield size={20} className={allPassed ? 'text-neon-green' : highRisk ? 'text-red-400' : 'text-yellow-400'} />
                <span className={`font-medium ${allPassed ? 'text-neon-green' : highRisk ? 'text-red-400' : 'text-yellow-400'}`}>
                    {allPassed ? 'All compliance checks passed' : highRisk ? 'Compliance issues detected' : 'Minor compliance notes'}
                </span>
            </div>
            
            {checks.map((check, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-text-dim">Script {i + 1}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                            check.passed ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {check.passed ? 'Passed' : 'Issues'} ({check.risk_level} risk)
                        </span>
                    </div>
                    
                    {check.issues.length > 0 && (
                        <ul className="text-sm text-white/80 space-y-1 mb-2">
                            {check.issues.map((issue, j) => (
                                <li key={j} className="flex items-start gap-2">
                                    <AlertCircle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <span>{issue.description}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    
                    {check.clearcast_notes && (
                        <p className="text-xs text-text-dim italic">{check.clearcast_notes}</p>
                    )}
                </div>
            ))}
        </div>
    );
};

import { ResultWorkspace } from './components/workspace/ResultWorkspace';

// =============================================================================
// Main Component
// =============================================================================

export const AdScriptLab: React.FC = () => {
    const { showToast } = useToast();
    const [form, setForm] = useState<BriefFormState>(DEFAULT_BRIEF_FORM);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStage, setCurrentStage] = useState('');
    const [result, setResult] = useState<AdScriptRun | null>(null);
    const [expandedScript, setExpandedScript] = useState<string | null>(null);
    const [isSystemReady, setIsSystemReady] = useState<boolean | null>(null);
    const [history, setHistory] = useState<AdScriptRun[]>([]);
    const [briefingDocs, setBriefingDocs] = useState<BriefingDoc[]>([]);
    const [isUploadingDocs, setIsUploadingDocs] = useState(false);
    const [briefingContext, setBriefingContext] = useState<string>('');

    const fetchHistory = React.useCallback(async () => {
        try {
            const runs = await api.listAdScriptRuns(50);
            setHistory(runs);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    }, []);

    const handleDelete = async (runId: string) => {
        try {
            await api.deleteAdScriptRun(runId);
            showToast('Campaign deleted', { type: 'success' });
            // Remove from local state immediately for better UX
            setHistory(prev => prev.filter(run => run.run_id !== runId));
            if (result?.run_id === runId) {
                handleReset();
            }
            // Refresh history to sync with backend
            fetchHistory();
        } catch (error: any) {
            console.error('Failed to delete campaign:', error);
            const errorMessage = error?.message || error?.response?.data?.detail || 'Failed to delete campaign';
            
            // If run not found (404), it might have been lost on server restart
            // Still remove it from the frontend since it's effectively gone
            if (error?.response?.status === 404 || errorMessage.includes('not found')) {
                setHistory(prev => prev.filter(run => run.run_id !== runId));
                if (result?.run_id === runId) {
                    handleReset();
                }
                showToast('Campaign removed (was already deleted)', { type: 'success' });
            } else {
                showToast(errorMessage, { type: 'error' });
            }
        }
    };

    React.useEffect(() => {
        const checkHealth = async () => {
            try {
                const health = await api.getAdScriptHealth();
                // API returns "healthy" or "degraded", not "ok"
                setIsSystemReady(health.status === 'healthy' || health.status === 'degraded');
            } catch (error) {
                console.error('Health check failed:', error);
                setIsSystemReady(false);
            }
        };
        checkHealth();
        fetchHistory();
    }, [fetchHistory]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value) || 0 : value
        }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Only objective is truly required - AI can fill in the rest
        // Website URL is highly recommended but not strictly required
        if (!form.objective) {
            showToast('Please provide a campaign objective', { type: 'error' });
            return;
        }
        
        // Warn if no website URL provided (but don't block)
        if (!form.website_url && !form.target_audience && !form.single_minded_proposition) {
            const proceed = window.confirm(
                'No website URL or audience details provided. The AI will make assumptions about your brand. Continue?'
            );
            if (!proceed) return;
        }
        
        setIsGenerating(true);
        setCurrentStage('Starting...');
        setResult(null);
        
        try {
            // Process briefing documents if any
            let extractedContext = briefingContext;
            if (briefingDocs.length > 0 && !extractedContext) {
                setCurrentStage('Processing briefing documents...');
                try {
                    extractedContext = await api.processBriefingDocs(briefingDocs.map(d => d.file));
                    setBriefingContext(extractedContext);
                } catch (docError) {
                    console.warn('Failed to process briefing docs:', docError);
                    // Continue without the extracted context
                }
            }
            
            const request = formToRequest(form, extractedContext);
            
            // Poll for progress updates could be added here
            // For now, we just wait for the full result
            const run = await api.generateAdScript(request);
            
            setResult(run);
            setCurrentStage('');
            
            if (run.status === 'completed') {
                showToast('Script generation complete!', { type: 'success' });
                // Auto-expand the winning script
                if (run.artifacts?.final_script) {
                    setExpandedScript(run.artifacts.final_script.id);
                }
                fetchHistory();
            } else if (run.status === 'failed') {
                showToast(`Generation failed: ${run.error || 'Unknown error'}`, { type: 'error' });
            }
            
        } catch (error: any) {
            console.error('Ad script generation error:', error);
            showToast(
                error.response?.data?.detail || error.message || 'Failed to generate script',
                { type: 'error' }
            );
            setCurrentStage('');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleReset = () => {
        setForm(DEFAULT_BRIEF_FORM);
        setResult(null);
        setExpandedScript(null);
        setBriefingDocs([]);
        setBriefingContext('');
    };

    const handleBack = () => {
        setResult(null);
        // Form state is preserved
    };

    // Writer's Room Mode
    if (result && result.status === 'completed' && !isGenerating) {
        return <ResultWorkspace run={result} onBack={handleBack} />;
    }
    
    return (
        <PageContainer>
            <div className="w-full space-y-6">
                {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Sparkles className="text-neon-purple" size={32} />
                        Ad Script Lab
                    </h1>
                    <p className="text-text-dim mt-2">
                        Generate UK TV ad scripts using AI-powered multi-agent collaboration
                    </p>
                </div>
                {isSystemReady !== null && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                        isSystemReady 
                            ? 'bg-neon-green/10 text-neon-green border-neon-green/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${isSystemReady ? 'bg-neon-green' : 'bg-red-500'}`} />
                        {isSystemReady ? 'System Ready' : 'System Offline'}
                    </div>
                )}
            </div>
            
            {/* Generation Mode - Full width brain with progress */}
            {isGenerating && (
                <div className="space-y-6">
                    {/* Full Width Neural Brain */}
                    <div className="relative h-[400px] rounded-2xl overflow-hidden border border-glass-border bg-glass-surface/20 backdrop-blur-sm">
                        <NeuralBrain 
                            isActive={true} 
                            mode={form.creative_mode}
                            className="w-full h-full"
                        />
                        
                        {/* Progress Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-8 py-6 text-center">
                                <Loader2 size={40} className="text-neon-purple animate-spin mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-white mb-2">
                                    Creating Your Script
                                </h3>
                                <p className="text-text-dim">
                                    {currentStage || 'Initializing creative agents...'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Cancel Button */}
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-6 py-3 rounded-xl border border-white/20 text-text-dim hover:text-white hover:bg-white/5 transition-all duration-200"
                        >
                            Cancel Generation
                        </button>
                    </div>
                </div>
            )}

            {/* Main Layout - Form Left, Brain Right (only when not generating) */}
            {!isGenerating && !result && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Brief Form - Takes 5 columns */}
                <div className="lg:col-span-5">
                    <GlassCard className="p-5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <FileText size={20} />
                            Campaign Brief
                        </h2>
                        
                        {/* Website URL - Primary Input */}
                        <div className="space-y-2">
                            <FormInput
                                label="Website URL"
                                name="website_url"
                                value={form.website_url}
                                onChange={handleInputChange}
                                placeholder="e.g., https://yourbrand.com"
                                icon={<Globe size={14} />}
                                hint="We'll automatically extract brand info from your website"
                            />
                        </div>

                        {/* Briefing Document Upload */}
                        <BriefingUpload
                            files={briefingDocs}
                            onFilesChange={setBriefingDocs}
                            isUploading={isUploadingDocs}
                        />

                        {/* Market Selector */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                                <MapPin size={14} />
                                Market / Region
                            </label>
                            <select
                                value={form.market}
                                onChange={(e) => setForm(prev => ({ 
                                    ...prev, 
                                    market: e.target.value as Market 
                                }))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                                    focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 
                                    transition-all duration-200 appearance-none cursor-pointer"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394A3B8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                            >
                                {MARKET_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                                        {option.label} ({option.compliance})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-text-dim">
                                Compliance rules will be adjusted based on your market
                            </p>
                        </div>

                        {/* Creative Mode */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                                <Brain size={16} />
                                Creative Depth
                            </label>
                            <CreativeModeSelector
                                value={form.creative_mode}
                                onChange={(mode) => setForm(prev => ({ ...prev, creative_mode: mode }))}
                                disabled={isGenerating}
                            />
                        </div>
                        
                        {/* Core Brief Fields */}
                        <div className="space-y-4">
                            <FormInput
                                label="Campaign Objective"
                                name="objective"
                                value={form.objective}
                                onChange={handleInputChange}
                                placeholder="e.g., Drive 20% increase in brand consideration among 25-44s"
                                required
                                multiline
                                icon={<Target size={14} />}
                            />

                            {/* Length and Budget in a row */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormInput
                                    label="Length (seconds)"
                                    name="length_seconds"
                                    value={form.length_seconds}
                                    onChange={handleInputChange}
                                    type="number"
                                    icon={<Clock size={14} />}
                                />
                                
                                {/* Budget Range Dropdown */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                                        <DollarSign size={14} />
                                        Budget Range
                                    </label>
                                    <select
                                        value={form.budget_range}
                                        onChange={(e) => setForm(prev => ({ 
                                            ...prev, 
                                            budget_range: e.target.value as BudgetRange 
                                        }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                                            focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 
                                            transition-all duration-200 appearance-none cursor-pointer"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394A3B8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                                    >
                                        {BUDGET_RANGE_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Advanced Options - Collapsible */}
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-medium text-text-dim hover:text-white flex items-center gap-2">
                                <Settings size={16} className="group-open:rotate-90 transition-transform" />
                                Advanced Options
                            </summary>
                            
                            <div className="mt-4 space-y-4 pl-4 border-l border-white/10">
                                <p className="text-xs text-text-dim/70 mb-2">
                                    These fields are optional. The AI will infer from your website, documents, or objective if not provided.
                                </p>
                                
                                <FormInput
                                    label="Campaign Name"
                                    name="asset_name"
                                    value={form.asset_name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Summer Campaign 2024 (auto-generated if empty)"
                                    icon={<FileText size={14} />}
                                />

                                <FormInput
                                    label="Target Audience"
                                    name="target_audience"
                                    value={form.target_audience}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Health-conscious millennials, urban, ABC1"
                                    multiline
                                    icon={<Users size={14} />}
                                    hint="AI will infer from website, docs, or objective"
                                />
                                
                                <FormInput
                                    label="Single-Minded Proposition (SMP)"
                                    name="single_minded_proposition"
                                    value={form.single_minded_proposition}
                                    onChange={handleInputChange}
                                    placeholder="e.g., The only energy drink that fuels your workout AND your conscience"
                                    multiline
                                    icon={<Lightbulb size={14} />}
                                    hint="AI will craft one based on your objective"
                                />
                                
                                <FormInput
                                    label="Tone of Voice"
                                    name="tone_of_voice"
                                    value={form.tone_of_voice}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Warm, witty, aspirational"
                                    icon={<MessageSquare size={14} />}
                                    hint="AI will infer from website or brand context"
                                />

                                {/* Visual Style Dropdown */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-text-dim">
                                        <Palette size={14} />
                                        Visual Style
                                    </label>
                                    <select
                                        value={form.visual_style}
                                        onChange={(e) => setForm(prev => ({ 
                                            ...prev, 
                                            visual_style: e.target.value as VisualStyle 
                                        }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                                            focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 
                                            transition-all duration-200 appearance-none cursor-pointer"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394A3B8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                                    >
                                        {VISUAL_STYLE_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-text-dim">
                                        Preferred visual treatment for the ad
                                    </p>
                                </div>
                                
                                <FormInput
                                    label="Mandatories"
                                    name="mandatories"
                                    value={form.mandatories}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Include product shot, mention sustainability credentials"
                                    hint="Comma-separated list of requirements"
                                    multiline
                                />
                            </div>
                        </details>
                        
                        {/* Submit Button */}
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={isGenerating}
                                className={`flex-1 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                                    isGenerating
                                        ? 'bg-white/10 text-text-dim cursor-not-allowed'
                                        : 'bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:shadow-lg hover:shadow-neon-purple/20 active:scale-[0.98]'
                                }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        {currentStage || 'Generating...'}
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        Generate Script
                                    </>
                                )}
                            </button>
                            
                            {result && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="px-6 py-4 rounded-xl border border-white/20 text-text-dim hover:text-white hover:bg-white/5 transition-all duration-200"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </form>
                    </GlassCard>
                </div>
                
                {/* Right Column: Neural Brain Visualization - Takes 7 columns */}
                <div className="lg:col-span-7 relative h-[500px] lg:sticky lg:top-6 flex-shrink-0">
                    <div className="absolute inset-0 rounded-2xl overflow-hidden border border-glass-border bg-glass-surface/20 backdrop-blur-sm" style={{ height: '500px' }}>
                        <NeuralBrain 
                            isActive={isGenerating} 
                            mode={form.creative_mode}
                            className="w-full h-full"
                        />
                    </div>
                    
                    {/* Overlay text when idle */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <Brain size={48} className="text-neon-purple/30 mx-auto mb-4" />
                            <p className="text-text-dim/50 text-lg">
                                Fill in your brief and watch<br />the creative neurons fire
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            )}
            
            {/* Results Section - Full Width Below (only when we have results) */}
            {result && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <GlassCard className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {result.status === 'completed' ? (
                                        <CheckCircle size={24} className="text-neon-green" />
                                    ) : result.status === 'failed' ? (
                                        <AlertCircle size={24} className="text-red-400" />
                                    ) : (
                                        <Loader2 size={24} className="text-neon-blue animate-spin" />
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-white">
                                            {result.status === 'completed' ? 'Generation Complete' :
                                             result.status === 'failed' ? 'Generation Failed' :
                                             'Generating Script...'}
                                        </h3>
                                        <p className="text-sm text-text-dim">
                                            {result.current_stage || 'Processing...'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="px-4 py-2 rounded-lg border border-white/20 text-text-dim hover:text-white hover:bg-white/5 transition-all duration-200 text-sm"
                                    >
                                        Back to Editor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="px-4 py-2 rounded-lg border border-white/20 text-text-dim hover:text-white hover:bg-white/5 transition-all duration-200 text-sm"
                                    >
                                        New Brief
                                    </button>
                                </div>
                            </div>
                            
                            {result.error && (
                                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm flex flex-col gap-4">
                                    <p>{result.error}</p>
                                    <button
                                        onClick={handleBack}
                                        className="self-start px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Back to Editor
                                    </button>
                                </div>
                            )}
                        </GlassCard>
                    
                    {/* Scores */}
                    {result?.scores && result.scores.overall > 0 && (
                        <GlassCard className="p-6">
                            <ScoreDisplay scores={result.scores} />
                        </GlassCard>
                    )}
                    
                    {/* Final Script */}
                    {result?.artifacts?.final_script && (() => {
                        const finalScript = result.artifacts!.final_script!;
                        return (
                            <GlassCard className="p-6">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                    <Award size={20} className="text-neon-green" />
                                    Winning Script
                                </h3>
                                <ScriptCard
                                    script={finalScript}
                                    isWinner
                                    expanded={expandedScript === finalScript.id}
                                    onToggle={() => setExpandedScript(
                                        expandedScript === finalScript.id 
                                            ? null 
                                            : finalScript.id
                                    )}
                                />
                                
                                {result.artifacts!.final_rationale && (
                                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                                        <h4 className="text-sm font-medium text-text-dim mb-2">Selection Rationale</h4>
                                        <p className="text-sm text-white/80">{result.artifacts!.final_rationale}</p>
                                    </div>
                                )}
                            </GlassCard>
                        );
                    })()}
                    
                    {/* All Scripts */}
                    {result?.artifacts?.polished_3 && result.artifacts.polished_3.length > 0 && (
                        <GlassCard className="p-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                <FileText size={20} />
                                All Developed Scripts
                            </h3>
                            <div className="space-y-3">
                                {result.artifacts.polished_3.map(script => (
                                    <ScriptCard
                                        key={script.id}
                                        script={script}
                                        isWinner={script.id === result.artifacts?.final_script?.id}
                                        expanded={expandedScript === script.id}
                                        onToggle={() => setExpandedScript(
                                            expandedScript === script.id ? null : script.id
                                        )}
                                    />
                                ))}
                            </div>
                        </GlassCard>
                    )}
                    
                    {/* Braintrust Feedback */}
                    {result?.artifacts?.braintrust_feedback && result.artifacts.braintrust_feedback.length > 0 && (
                        <GlassCard className="p-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                <Users size={20} />
                                Braintrust Feedback
                            </h3>
                            <BraintrustFeedback feedback={result.artifacts.braintrust_feedback} />
                        </GlassCard>
                    )}
                    
                    {/* Compliance */}
                    {result?.artifacts?.compliance_checks && result.artifacts.compliance_checks.length > 0 && (
                        <GlassCard className="p-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                <Shield size={20} />
                                Compliance Check
                            </h3>
                            <ComplianceStatus checks={result.artifacts.compliance_checks} />
                        </GlassCard>
                    )}
                    
                    {/* Press Release */}
                    {result?.artifacts?.press_release && (
                        <GlassCard className="p-6">
                            <details>
                                <summary className="cursor-pointer text-lg font-semibold text-white flex items-center gap-2">
                                    <FileText size={20} />
                                    Vision Document (Working Backwards)
                                </summary>
                                <pre className="mt-4 text-sm text-white/80 whitespace-pre-wrap bg-black/30 rounded-lg p-4 overflow-x-auto">
                                    {result.artifacts.press_release}
                                </pre>
                            </details>
                        </GlassCard>
                    )}
                </div>
            )}

            {/* History Drawer */}
            <HistoryDrawer 
                history={history} 
                onSelect={(run) => {
                    setResult(run);
                    // Populate form with brief data so user can edit/regenerate based on it
                    setForm({
                        website_url: '', // Not stored in brief currently
                        objective: run.brief.objective,
                        target_audience: run.brief.target_audience,
                        single_minded_proposition: run.brief.single_minded_proposition,
                        tone_of_voice: run.brief.tone_of_voice,
                        asset_name: run.brief.asset_name,
                        length_seconds: run.brief.length_seconds || 30,
                        mandatories: (run.brief.mandatories || []).join(', '),
                        creative_mode: run.brief.creative_mode,
                        market: ((run.brief as any).market as Market) || 'uk',
                        visual_style: ((run.brief as any).visual_style as VisualStyle) || '',
                        brand_name: run.brief.brand_name || '',
                        product_service: run.brief.product_service || '',
                        budget_range: (Object.entries(BUDGET_RANGE_OPTIONS).find(([_, opt]) => opt.label === run.brief.budget_range)?.[1].value as BudgetRange) || 'no_budget',
                        comms_style: run.brief.comms_style || '',
                        brand_colors: (run.brief.brand_colors || []).join(', '),
                    });
                    setBriefingDocs([]);
                    setBriefingContext('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={handleDelete}
                currentRunId={result?.run_id}
            />
        </div>
        </PageContainer>
    );
};

