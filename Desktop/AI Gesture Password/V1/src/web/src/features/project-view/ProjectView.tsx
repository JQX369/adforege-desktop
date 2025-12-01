import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import type { ReactionOverviewResponse, PolishVideoPayload, SimilarAd, BenchmarkData, CreativeProfile } from '@lib/services/api';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Video, Download, AlertCircle, CheckCircle, XCircle, Loader2, TrendingUp, RotateCcw, Target, Zap, Shield, Clock, Mic, List, FileText, X, Settings } from 'lucide-react';
import { useToast } from '@shared/components/Toast';
import { PageContainer } from '@shared/components/PageContainer';
import { AIBreakdownSlideshow } from './components/AIBreakdownSlideshow';
import { ComplianceSlideshow } from './components/ComplianceSlideshow';
import { SimilarAdsSlideshow } from './components/SimilarAdsSlideshow';

interface AnalysisResult {
    id: string;
    video_name: string;
    created_at: string;
    avg_engagement: number;
    emotion_summary: Record<string, number>;
    emotion_timeline: Array<{ timestamp: number;[key: string]: number }>;
    clearcast_check?: any;
    ai_breakdown?: any;
    audience_engagement?: number;
    ai_effectiveness?: number;
    score_source?: string;
    reaction_count?: number;
}

type TabType = 'clearcast' | 'ai' | 'similar';

// Rerun Options Modal
const RerunModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onRun: (options: any) => void;
    type: TabType;
    isRunning: boolean;
}> = ({ isOpen, onClose, onRun, type, isRunning }) => {
    const [selectedOption, setSelectedOption] = useState('uk');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-background-start border border-glass-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-glass-border flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-white">
                        Run {type === 'clearcast' ? 'Compliance Check' : 'AI Analysis'}
                    </h3>
                    <button onClick={onClose} className="text-text-dim hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-dim mb-2">
                            {type === 'clearcast' ? 'Clearance Standard' : 'Target Demographic'}
                        </label>
                        <select
                            value={selectedOption}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-blue transition-colors"
                        >
                            {type === 'clearcast' ? (
                                <>
                                    <option value="uk">Clearcast (UK)</option>
                                    <option value="us" disabled>US Network (Coming Soon)</option>
                                    <option value="eu" disabled>EU General (Coming Soon)</option>
                                </>
                            ) : (
                                <>
                                    <option value="uk">United Kingdom</option>
                                    <option value="us">United States</option>
                                    <option value="global">Global / General</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                        <div className="text-blue-400 mt-0.5"><Shield size={18} /></div>
                        <p className="text-sm text-blue-100/80">
                            {type === 'clearcast'
                                ? "This will analyze the video against the selected broadcast standards and generate a new compliance report."
                                : "AI will re-analyze the video content focusing on cultural nuances of the selected demographic."}
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-glass-border bg-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-text-dim hover:text-white font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onRun({ option: selectedOption })}
                        disabled={isRunning}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${type === 'clearcast'
                                ? 'bg-neon-blue text-black hover:bg-neon-blue/90'
                                : 'bg-neon-purple text-white hover:bg-neon-purple/90'
                            }`}
                    >
                        {isRunning && <Loader2 size={18} className="animate-spin" />}
                        {isRunning ? 'Running...' : 'Run Analysis'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Polish Options Modal
const PolishModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onRun: (options: any) => void;
    isPolishing: boolean;
}> = ({ isOpen, onClose, onRun, isPolishing }) => {
    const [options, setOptions] = useState({
        // Audio
        normalize_audio: true,
        remove_noise: false,
        enhance_voice: false,
        // Video
        broadcast_safe: true,
        auto_levels: true,
        denoise: false,
        // Format
        scale_hd: true,
        convert_fps: true,
        deinterlace: true,
        // Delivery
        add_padding: false,
        add_slate: false,
        // Standard & Quality
        standard: 'UK_CLEARCAST',
        quality: 'standard',
        export_bright: false,
        // Slate Metadata
        clock_number: '',
        client_name: '',
        agency_name: '',
        product_name: '',
        title: ''
    });

    const handleOptionChange = (key: string, value: any) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-background-start border border-glass-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-glass-border flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-semibold text-white">Polish Options</h3>
                        <p className="text-text-dim">Select technical fixes to apply</p>
                    </div>
                    <button onClick={onClose} className="text-text-dim hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Audio Section */}
                    <section>
                        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                            <Mic size={20} className="text-neon-blue" /> Audio Processing
                        </h4>
                        <div className="space-y-3 pl-2">
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.normalize_audio}
                                    onChange={e => handleOptionChange('normalize_audio', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Normalize to -23 LUFS (broadcast standard)</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.remove_noise}
                                    onChange={e => handleOptionChange('remove_noise', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Remove background noise</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.enhance_voice}
                                    onChange={e => handleOptionChange('enhance_voice', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Enhance dialogue clarity</span>
                            </label>
                        </div>
                    </section>

                    {/* Video Section */}
                    <section>
                        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                            <Video size={20} className="text-neon-purple" /> Video Color & Exposure
                        </h4>
                        <div className="space-y-3 pl-2">
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.broadcast_safe}
                                    onChange={e => handleOptionChange('broadcast_safe', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Apply broadcast-safe colors (16-235)</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.auto_levels}
                                    onChange={e => handleOptionChange('auto_levels', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Auto brightness / contrast correction</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.denoise}
                                    onChange={e => handleOptionChange('denoise', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Reduce video noise / grain</span>
                            </label>
                        </div>
                    </section>

                    {/* Format Section */}
                    <section>
                        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                            <Settings size={20} className="text-yellow-500" /> Format & Frame Rate
                        </h4>
                        <div className="space-y-3 pl-2">
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.scale_hd}
                                    onChange={e => handleOptionChange('scale_hd', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Convert to 1920x1080 HD</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.convert_fps}
                                    onChange={e => handleOptionChange('convert_fps', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Convert to 25fps (PAL)</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.deinterlace}
                                    onChange={e => handleOptionChange('deinterlace', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Remove interlacing artifacts</span>
                            </label>
                        </div>
                    </section>

                    {/* Delivery Section */}
                    <section>
                        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-green-500" /> Broadcast Delivery
                        </h4>
                        <div className="space-y-3 pl-2">
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.add_padding}
                                    onChange={e => handleOptionChange('add_padding', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Add black & silence padding (2s head/tail)</span>
                            </label>
                            <label className="flex items-center gap-3 text-text-dim hover:text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.add_slate}
                                    onChange={e => handleOptionChange('add_slate', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Add clock slate with countdown</span>
                            </label>

                            {options.add_slate && (
                                <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                                    <div className="space-y-1">
                                        <label className="text-xs text-text-dim uppercase">Clock Number</label>
                                        <input
                                            type="text"
                                            value={options.clock_number}
                                            onChange={e => handleOptionChange('clock_number', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-neon-blue focus:outline-none"
                                            placeholder="e.g. AAA/BBBB001/030"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-text-dim uppercase">Client</label>
                                        <input
                                            type="text"
                                            value={options.client_name}
                                            onChange={e => handleOptionChange('client_name', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-neon-blue focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-text-dim uppercase">Product</label>
                                        <input
                                            type="text"
                                            value={options.product_name}
                                            onChange={e => handleOptionChange('product_name', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-neon-blue focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-text-dim uppercase">Title</label>
                                        <input
                                            type="text"
                                            value={options.title}
                                            onChange={e => handleOptionChange('title', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-neon-blue focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <div className="border-t border-white/10 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Broadcast Standard</label>
                            <select
                                value={options.standard}
                                onChange={e => handleOptionChange('standard', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-blue"
                            >
                                <option value="UK_CLEARCAST">🇬🇧 UK (Clearcast)</option>
                                <option value="US_BROADCAST">🇺🇸 US (FCC/ATSC)</option>
                                <option value="WEB_BRIGHT">🌐 Web (Bright HQ)</option>
                            </select>
                            <label className="flex items-center gap-2 mt-3 text-sm text-text-dim cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.export_bright}
                                    onChange={e => handleOptionChange('export_bright', e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue"
                                />
                                <span>Also export 'Bright' format copy</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Output Quality</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
                                    <input
                                        type="radio"
                                        name="quality"
                                        value="high"
                                        checked={options.quality === 'high'}
                                        onChange={e => handleOptionChange('quality', e.target.value)}
                                        className="text-neon-blue focus:ring-neon-blue"
                                    />
                                    High (ProRes - very large)
                                </label>
                                <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
                                    <input
                                        type="radio"
                                        name="quality"
                                        value="standard"
                                        checked={options.quality === 'standard'}
                                        onChange={e => handleOptionChange('quality', e.target.value)}
                                        className="text-neon-blue focus:ring-neon-blue"
                                    />
                                    Standard (H.264 50Mbps)
                                </label>
                                <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
                                    <input
                                        type="radio"
                                        name="quality"
                                        value="web"
                                        checked={options.quality === 'web'}
                                        onChange={e => handleOptionChange('quality', e.target.value)}
                                        className="text-neon-blue focus:ring-neon-blue"
                                    />
                                    Web Optimized (H.264 10Mbps)
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-glass-border bg-white/5 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-lg border border-white/10 text-text-dim hover:text-white hover:bg-white/5 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onRun(options)}
                        disabled={isPolishing}
                        className="px-8 py-3 rounded-lg bg-neon-blue text-black hover:bg-neon-blue/90 font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isPolishing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Process Video'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const buildPolishPayload = (options: any): PolishVideoPayload => {
    const booleanFields = [
        'normalize_audio',
        'remove_noise',
        'enhance_voice',
        'broadcast_safe',
        'auto_levels',
        'denoise',
        'scale_hd',
        'convert_fps',
        'deinterlace',
        'add_padding',
        'add_slate',
    ];

    const actions: Record<string, boolean> = {};
    booleanFields.forEach(field => {
        actions[field] = Boolean(options?.[field]);
    });

    const payload: PolishVideoPayload = {
        actions,
        quality: options?.quality || 'standard',
        standard: options?.standard || 'UK_CLEARCAST',
        export_bright: Boolean(options?.export_bright),
    };

    if (options?.add_slate) {
        const slateInfo = {
            clock_number: options?.clock_number?.trim(),
            client_name: options?.client_name?.trim(),
            agency_name: options?.agency_name?.trim(),
            product_name: options?.product_name?.trim(),
            title: options?.title?.trim(),
        };
        const filtered = Object.fromEntries(
            Object.entries(slateInfo).filter(([, value]) => Boolean(value))
        );
        if (Object.keys(filtered).length > 0) {
            payload.slate_info = filtered;
        }
    }

    return payload;
};

// Clearcast Tab Content Component
const ClearcastTabContent: React.FC<{
    result: AnalysisResult;
    onRunCheck: () => void;
    isRunning: boolean;
    analysisId: string;
    onPolish: () => void;
    isPolishing?: boolean;
}> = ({ result, onRunCheck, isRunning, analysisId, onPolish, isPolishing = false }) => {
    if (!result.clearcast_check) {
        return (
            <GlassCard className="text-center py-12">
                <AlertCircle className="mx-auto mb-4 text-neon-blue" size={64} />
                <h3 className="text-xl font-semibold text-white mb-2">No Clearcast Check Yet</h3>
                <p className="text-text-dim mb-6">Run a compliance check to see detailed analysis</p>
                <button
                    onClick={onRunCheck}
                    disabled={isRunning}
                    className="px-6 py-3 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                    {isRunning ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Running Check...
                        </>
                    ) : (
                        'Run Clearcast Check'
                    )}
                </button>
            </GlassCard>
        );
    }

    const report = result.clearcast_check;
    const pdfUrl = api.downloadClearcastPdf(analysisId);

    // Get analyzed frames from the report for thumbnail display
    const analyzedFrames = report.analyzed_frames || [];

    const renderFlagContent = (flag: any) => {
        if (typeof flag === 'string') return <p className="text-white font-medium">{flag}</p>;

        const title = flag.description || flag.issue || flag.aspect || "Details";

        // Get related frame thumbnails if available
        const frameIndices: number[] = flag.frame_indices || [];
        const relatedFrames = frameIndices
            .filter((idx: number) => idx >= 0 && idx < analyzedFrames.length)
            .slice(0, 4); // Limit to 4 frames max

        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-medium">{title}</p>
                            {/* Subjective/May Clear badge */}
                            {flag.subjective && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase tracking-wide">
                                    May clear
                                </span>
                            )}
                        </div>
                        {flag.explanation && <p className="text-sm text-text-dim">{flag.explanation}</p>}
                        {flag.suggested_action && (
                            <p className="text-sm text-text-dim"><span className="font-semibold text-yellow-500">Suggestion:</span> {flag.suggested_action}</p>
                        )}
                        {flag.required_action && (
                            <p className="text-sm text-text-dim"><span className="font-semibold text-red-400">Required:</span> {flag.required_action}</p>
                        )}
                        {flag.guideline_title && (
                            <p className="text-xs text-white/40">Ref: {flag.guideline_title} {flag.guideline_code ? `(${flag.guideline_code})` : ''}</p>
                        )}
                        {flag.timestamp && <p className="text-xs text-text-dim mt-1">At {flag.timestamp}</p>}
                    </div>

                    {/* How to Fix tooltip */}
                    {flag.fix_guidance && (
                        <div className="group relative shrink-0">
                            <button className="px-2 py-1 text-xs rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors">
                                How to Fix
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-lg bg-black/95 border border-white/20 text-xs text-text-dim opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                                <p className="font-medium text-white mb-1">Fix Guidance</p>
                                <p className="leading-relaxed">{flag.fix_guidance}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Frame thumbnails */}
                {relatedFrames.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {relatedFrames.map((idx: number) => {
                            const frame = analyzedFrames[idx];
                            if (!frame) return null;
                            return (
                                <div key={idx} className="relative shrink-0 w-20 h-14 rounded overflow-hidden border border-white/10 group/thumb">
                                    <img
                                        src={`data:image/jpeg;base64,${frame.image}`}
                                        alt={`Frame ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                        <span className="text-[10px] text-white">{frame.timestamp || `Frame ${idx + 1}`}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {frameIndices.length > 4 && (
                            <div className="shrink-0 w-20 h-14 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                                <span className="text-xs text-text-dim">+{frameIndices.length - 4} more</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header with PDF download and Rerun */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">Compliance Report</h3>
                    <p className="text-text-dim">UK Clearcast Standards</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onRunCheck}
                        disabled={isRunning}
                        className="px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 hover:shadow-lg hover:shadow-neon-blue/10 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Rerunning...
                            </>
                        ) : (
                            <>
                                <RotateCcw size={18} />
                                Rerun Analysis
                            </>
                        )}
                    </button>
                    <a
                        href={pdfUrl}
                        download
                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 hover:shadow-lg hover:shadow-white/5 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export PDF
                    </a>
                </div>
            </div>

            {/* Executive Summary with Status & Clearance Prediction */}
            <GlassCard className={`border-l-4 ${report.status === 'pass' ? 'border-l-green-500' :
                report.clearance_prediction?.toLowerCase().includes('likely') || report.clearance_prediction?.toLowerCase().includes('will clear') ? 'border-l-green-500' :
                    'border-l-red-500'}`}>
                <div className="space-y-4">
                    {/* Status Header */}
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${report.status === 'pass' || report.clearance_prediction?.toLowerCase().includes('likely') || report.clearance_prediction?.toLowerCase().includes('will clear')
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                            {report.status === 'pass' || report.clearance_prediction?.toLowerCase().includes('likely') || report.clearance_prediction?.toLowerCase().includes('will clear')
                                ? <CheckCircle size={32} />
                                : <AlertCircle size={32} />}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white">
                                Compliance Summary
                            </h4>
                            <p className="text-text-dim">
                                {report.status === 'pass' || report.clearance_prediction?.toLowerCase().includes('likely') || report.clearance_prediction?.toLowerCase().includes('will clear')
                                    ? 'No critical blocking issues found. Likely to pass Clearcast review.'
                                    : report.summary || 'Critical issues detected. Please review below.'}
                            </p>
                        </div>
                        {report.clearance_prediction && (
                            <div className="shrink-0 p-4 rounded-lg bg-black/40 border border-white/10 text-center min-w-[150px]">
                                <p className="text-text-dim text-xs uppercase mb-1">Clearance Prediction</p>
                                <p className={`text-2xl font-bold ${report.clearance_prediction.toLowerCase().includes('likely') || report.clearance_prediction.toLowerCase().includes('will clear') ? 'text-green-500' :
                                    report.clearance_prediction.toLowerCase().includes('modification') || report.clearance_prediction.toLowerCase().includes('needs') || report.clearance_prediction.toLowerCase().includes('review') ? 'text-yellow-500' :
                                        'text-red-500'
                                    }`}>
                                    {report.clearance_prediction}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Executive Summary */}
                    {report.one_sentence_summary && (
                        <div className="pt-4 border-t border-white/10">
                            <h4 className="text-lg font-bold text-white mb-2">Executive Summary</h4>
                            <p className="text-base text-white/90 leading-relaxed">{report.one_sentence_summary}</p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Technical Compliance, Classification & Substantiation - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Classification Profile */}
                {(report.classification?.product_type || report.classification?.script_type || report.classification?.brand_sector || report.classification?.product || report.classification?.script || report.classification?.brand || report.focus_summary) && (
                    <GlassCard className="h-full">
                        <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-neon-blue" />
                            Classification Profile
                        </h4>
                        <div className="space-y-4">
                            {report.classification && (
                                <div className="space-y-4">
                                    {/* Product Details */}
                                    {(report.classification.product_type || report.classification.product?.sector) && (
                                        <div className="space-y-2">
                                            <p className="text-text-dim text-xs uppercase tracking-wider">Product</p>
                                            {(report.classification.product_type || report.classification.product?.sector) && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">Type</span>
                                                    <span className="text-white">{report.classification.product_type || report.classification.product?.sector}</span>
                                                </div>
                                            )}
                                            {report.classification.product?.subcategory && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">Sub-category</span>
                                                    <span className="text-white">{report.classification.product.subcategory}</span>
                                                </div>
                                            )}
                                            {report.classification.product?.inherent_risk && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">Inherent Risk</span>
                                                    <span className="text-yellow-500">{report.classification.product.inherent_risk}</span>
                                                </div>
                                            )}
                                            {report.classification.product?.regulatory_flags?.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="text-text-dim block mb-1">Regulatory Flags</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {report.classification.product.regulatory_flags.map((flag: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">{flag}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(report.classification.product_type || report.classification.product?.sector) && (report.classification.script_type || report.classification.script) && (
                                        <div className="border-t border-white/10 my-4" />
                                    )}

                                    {/* Script Details */}
                                    {(report.classification.script_type || report.classification.script) && (
                                        <div className="space-y-2">
                                            <p className="text-text-dim text-xs uppercase tracking-wider">Script</p>
                                            {(report.classification.script_type || report.classification.script?.tone) && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">Style</span>
                                                    <span className="text-white">{report.classification.script_type || report.classification.script?.tone}</span>
                                                </div>
                                            )}
                                            {report.classification.script?.primary_claims?.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="text-text-dim block mb-1">Primary Claims</span>
                                                    <div className="text-white text-xs">{report.classification.script.primary_claims.join(', ')}</div>
                                                </div>
                                            )}
                                            {report.classification.script?.sensitive_topics?.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="text-text-dim block mb-1">Sensitive Topics</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {report.classification.script.sensitive_topics.map((topic: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">{topic}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {((report.classification.script_type || report.classification.script) || (report.classification.product_type || report.classification.product?.sector)) && (report.classification.brand_sector || report.classification.brand) && (
                                        <div className="border-t border-white/10 my-4" />
                                    )}

                                    {/* Brand Details */}
                                    {(report.classification.brand_sector || report.classification.brand) && (
                                        <div className="space-y-2">
                                            <p className="text-text-dim text-xs uppercase tracking-wider">Brand</p>
                                            {(report.classification.brand_sector || report.classification.brand?.industry) && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">Sector</span>
                                                    <span className="text-white">{report.classification.brand_sector || report.classification.brand?.industry}</span>
                                                </div>
                                            )}
                                            {report.classification.brand?.clearcast_history && (
                                                <div className="flex justify-between text-sm border-b border-white/10 pb-1">
                                                    <span className="text-text-dim">History</span>
                                                    <span className="text-white">{report.classification.brand.clearcast_history}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {report.focus_summary && (
                                <div className="pt-2 border-t border-white/10">
                                    <p className="text-text-dim text-sm mb-1">Focus Area</p>
                                    <p className="text-white text-sm italic">{report.focus_summary}</p>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                )}

                {/* Substantiation & Claims - Full Width */}
                {(report.substantiation_pack?.length > 0 || report.claims_check?.length > 0) && (
                    <GlassCard className="h-full lg:col-span-2">
                        <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-neon-purple" />
                            Substantiation & Claims
                        </h4>

                        {/* Two Column Grid: Identified Claims | Required Evidence */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Identified Claims */}
                            <div>
                                <p className="text-text-dim text-sm mb-2 uppercase tracking-wide text-xs font-semibold">Identified Claims</p>
                                {report.claims_check?.length > 0 ? (
                                    <div className="space-y-3">
                                        {report.claims_check.map((claim: any, idx: number) => (
                                            <div key={idx} className="p-3 rounded bg-white/5 border border-white/10">
                                                <p className="text-white font-medium text-sm mb-1">{claim.claim_text}</p>
                                                <span className="text-xs px-2 py-0.5 rounded bg-neon-blue/20 text-neon-blue">{claim.claim_type}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-text-dim text-sm italic">No specific claims identified.</p>
                                )}
                            </div>

                            {/* Right Column: Required Evidence */}
                            <div>
                                <p className="text-text-dim text-sm mb-2 uppercase tracking-wide text-xs font-semibold">Required Evidence</p>
                                {report.substantiation_pack?.length > 0 ? (
                                    <div className="space-y-2">
                                        {report.substantiation_pack.map((item: any, idx: number) => (
                                            <div key={idx} className="p-3 rounded bg-white/5 border border-white/10 text-sm h-full">
                                                <p className="text-white font-medium mb-1">{item.claim || item.title}</p>
                                                {Array.isArray(item.requirements) && item.requirements.length > 0 ? (
                                                    <ul className="list-disc list-inside text-xs text-text-dim space-y-1 mt-2">
                                                        {item.requirements.map((req: string, rIdx: number) => (
                                                            <li key={rIdx}>{req}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-text-dim text-xs">{item.required_evidence || item.description || item.requirements}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-text-dim text-sm text-center italic h-full flex items-center justify-center">
                                        No specific evidence required.
                                    </div>
                                )}
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* Required Disclaimers */}
            {report.disclaimers_required && report.disclaimers_required.length > 0 && (
                <GlassCard>
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <List size={20} className="text-yellow-500" />
                        Required Disclaimers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.disclaimers_required.map((disclaimer: string, idx: number) => (
                            <div key={idx} className="p-3 rounded bg-white/5 border border-white/10 flex items-start gap-3">
                                <AlertCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                                <span className="text-sm text-white">{disclaimer}</span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}



            {/* Compliance Flags Widget (Red, Amber, Blue, Recommendations) */}
            <GlassCard className="h-full border-white/5 bg-black/40 shadow-inner">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Technical / Visual (Merged with Technical Compliance) */}
                    <div className="space-y-6">
                        {/* Merged Technical Compliance (Audio, Metadata, etc.) */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Shield className="text-blue-500" size={20} />
                                <h4 className="text-lg font-semibold text-white">Technical / Visual ({report.blue_flags?.length || 0})</h4>
                            </div>

                            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden p-4 space-y-4">
                                {/* Audio Levels */}
                                {report.audio_report && (
                                    <div>
                                        <p className="text-text-dim text-xs mb-2 flex items-center gap-2 uppercase tracking-wider">
                                            <Mic size={12} /> Audio Levels
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded bg-white/5 border border-white/10">
                                                <span className="text-xs text-text-dim block">LUFS</span>
                                                <span className={`font-medium ${report.audio_report.lufs >= -24 && report.audio_report.lufs <= -22 ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {report.audio_report.lufs}
                                                </span>
                                            </div>
                                            <div className="p-2 rounded bg-white/5 border border-white/10">
                                                <span className="text-xs text-text-dim block">True Peak</span>
                                                <span className={`font-medium ${report.audio_report.peak <= -1 ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {report.audio_report.peak} dBTP
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(report.audio_report && report.delivery_metadata) && (
                                    <div className="border-t border-white/10" />
                                )}

                                {/* Delivery Metadata (Grouped with Action Button) */}
                                {report.delivery_metadata && (
                                    <div>
                                        <p className="text-text-dim text-xs mb-2 flex items-center gap-2 uppercase tracking-wider">
                                            <Clock size={12} /> Delivery Metadata
                                        </p>
                                        <div className="space-y-2 mb-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-text-dim">Clock Number:</span>
                                                <span className="text-white font-mono">{report.delivery_metadata.clock_number || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-text-dim">Slate:</span>
                                                <span className={report.delivery_metadata.has_slate ? 'text-green-500' : 'text-red-500'}>
                                                    {report.delivery_metadata.has_slate ? 'Detected' : 'Missing'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Fix for Broadcast Button - Integrated directly below Metadata */}
                                        <button
                                            onClick={onPolish}
                                            disabled={isPolishing}
                                            className="w-full py-2 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {isPolishing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Polishing...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={14} />
                                                    Fix Issues
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Fallback for no metadata but audio issues */}
                                {!report.delivery_metadata && report.audio_report && (
                                    <div className="pt-2 border-t border-white/10">
                                        <button
                                            onClick={onPolish}
                                            disabled={isPolishing}
                                            className="w-full py-2 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {isPolishing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Polishing...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={14} />
                                                    Fix Issues
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Technical / Visual Flags List */}
                            {report.blue_flags && report.blue_flags.length > 0 ? (
                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10">
                                    {report.blue_flags.map((flag: any, idx: number) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                                            {renderFlagContent(flag)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-text-dim text-sm text-center italic">
                                    No visual/technical flags detected.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Issues (Red & Amber) & Recommendations */}
                    <div className="space-y-6">
                        {/* Critical Issues */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <XCircle className="text-red-500" size={20} />
                                <h4 className="text-lg font-semibold text-white">Critical Issues ({report.red_flags?.length || 0})</h4>
                            </div>
                            {report.red_flags && report.red_flags.length > 0 ? (
                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10">
                                    {report.red_flags.map((flag: any, idx: number) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                                            {renderFlagContent(flag)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-text-dim text-sm text-center italic">
                                    No critical issues detected.
                                </div>
                            )}
                        </div>

                        {/* Warnings */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="text-yellow-500" size={20} />
                                <h4 className="text-lg font-semibold text-white">Warnings ({report.amber_flags?.length || 0})</h4>
                            </div>
                            {report.amber_flags && report.amber_flags.length > 0 ? (
                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10">
                                    {report.amber_flags.map((flag: any, idx: number) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                                            {renderFlagContent(flag)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-text-dim text-sm text-center italic">
                                    No warnings detected.
                                </div>
                            )}
                        </div>

                        {/* Recommendations */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-green-500" size={20} />
                                <h4 className="text-lg font-semibold text-white">Recommendations ({report.recommendations?.length || 0})</h4>
                            </div>
                            {report.recommendations && report.recommendations.length > 0 ? (
                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10">
                                    {report.recommendations.map((rec: string, idx: number) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex items-start gap-2">
                                            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                                            <p className="text-white text-sm">{rec}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-text-dim text-sm text-center italic">
                                    No specific recommendations.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Green Flags (Strengths) - Kept Separate if desired or merge above? User asked for specific widgets. Keeping separate for now as it's 'Strengths' */}
            {report.green_flags && report.green_flags.length > 0 && (
                <GlassCard className="h-full">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="text-green-500" size={24} />
                        <h4 className="text-xl font-semibold text-white">Strengths ({report.green_flags.length})</h4>
                    </div>
                    <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden divide-y divide-white/10">
                        {report.green_flags.map((flag: any, idx: number) => (
                            <div key={idx} className="p-4 hover:bg-white/5 transition-colors flex items-start gap-2">
                                <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                                <div>{renderFlagContent(flag)}</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}
        </div>
    );
};


// Similar Ads Tab Content Component
const SimilarAdsTabContent: React.FC<{
    result: AnalysisResult;
    onRunSearch: () => void;
    isSearching: boolean;
    similarAds: SimilarAd[];
    benchmarks: BenchmarkData | null;
    creativeProfile: CreativeProfile | null;
}> = ({ result, onRunSearch, isSearching, similarAds, benchmarks, creativeProfile }) => {
    // Check if AI breakdown exists
    if (!result.ai_breakdown) {
        return (
            <GlassCard className="text-center py-12">
                <div className="text-amber-500 mb-4">
                    <AlertCircle size={64} className="mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">AI Breakdown Required</h3>
                <p className="text-text-dim mb-6 max-w-md mx-auto">
                    Run the AI Video Breakdown first to enable similar ads discovery.
                    The breakdown analysis is used to find ads with similar themes, audiences, and messaging.
                </p>
                <div className="flex items-center justify-center gap-2 text-text-dim text-sm">
                    <Target size={16} />
                    <span>Switch to the "AI Video Breakdown" tab to analyze your video</span>
                </div>
            </GlassCard>
        );
    }

    // Helper to get percentile color
    const getPercentileColor = (percentile: number) => {
        if (percentile >= 75) return 'text-green-400';
        if (percentile >= 50) return 'text-teal-400';
        if (percentile >= 25) return 'text-amber-400';
        return 'text-red-400';
    };

    // Helper to get percentile bar width
    const getPercentileBarStyle = (percentile: number) => ({
        width: `${percentile}%`,
        background: percentile >= 75 ? 'linear-gradient(to right, #10b981, #34d399)' :
            percentile >= 50 ? 'linear-gradient(to right, #14b8a6, #2dd4bf)' :
                percentile >= 25 ? 'linear-gradient(to right, #f59e0b, #fbbf24)' :
                    'linear-gradient(to right, #ef4444, #f87171)'
    });

    // Metric display names
    const metricLabels: Record<string, string> = {
        overall_impact: 'Overall Impact',
        pulse_score: 'Immediate Engagement',
        echo_score: 'Brand Memorability'
    };

    const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

    // Show results or search button
    return (
        <div className="space-y-6">
            {/* Header with Search Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">Find Similar Ads</h3>
                    <p className="text-text-dim">Discover ads with similar themes, audiences, and creative approaches</p>
                </div>
                <button
                    onClick={onRunSearch}
                    disabled={isSearching}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg text-white font-medium hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-teal-600/25"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Target size={18} />
                            {similarAds.length > 0 ? 'Search Again' : 'Find Similar Ads'}
                        </>
                    )}
                </button>
            </div>

            {/* Benchmarks Card - Only show after search with benchmarks */}
            {benchmarks && Object.keys(benchmarks.metrics).length > 0 && (
                <GlassCard className="bg-gradient-to-br from-teal-900/20 to-cyan-900/20 border-teal-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                <TrendingUp size={20} className="text-teal-400" />
                                Your Performance
                            </h4>
                            <p className="text-sm text-text-dim">
                                Benchmarked against {benchmarks.sample_size} {benchmarks.category} ads
                            </p>
                        </div>
                        {creativeProfile && (
                            <div className="flex flex-wrap gap-1">
                                {creativeProfile.format_type && (
                                    <span className="text-xs px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded">
                                        {creativeProfile.format_type}
                                    </span>
                                )}
                                {creativeProfile.objective && (
                                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                                        {creativeProfile.objective}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Metric Bars */}
                    <div className="space-y-4">
                        {Object.entries(benchmarks.metrics).map(([key, metric]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white font-medium">{metricLabels[key] || key}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/70">{metric.value.toFixed(1)}/10</span>
                                        <span className={`font-semibold ${getPercentileColor(metric.percentile)}`}>
                                            Top {100 - metric.percentile}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={getPercentileBarStyle(metric.percentile)}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-text-dim">
                                    <span>Category avg: {metric.category_avg.toFixed(1)}</span>
                                    <span>Range: {metric.category_min.toFixed(1)} - {metric.category_max.toFixed(1)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Strengths and Improvements */}
                    {(benchmarks.strengths.length > 0 || benchmarks.improvements.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10">
                            {benchmarks.strengths.length > 0 && (
                                <div>
                                    <h5 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                                        <CheckCircle size={14} />
                                        Strengths
                                    </h5>
                                    <ul className="space-y-1">
                                        {benchmarks.strengths.map((strength, i) => (
                                            <li key={i} className="text-xs text-white/70">{strength}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {benchmarks.improvements.length > 0 && (
                                <div>
                                    <h5 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        Areas to Improve
                                    </h5>
                                    <ul className="space-y-1">
                                        {benchmarks.improvements.map((improvement, i) => (
                                            <li key={i} className="text-xs text-white/70">{improvement}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </GlassCard>
            )}

            {/* Results */}
            {similarAds.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {similarAds.map((ad, index) => {
                        const isExpanded = expandedAdId === ad.id;

                        return (
                            <GlassCard
                                key={ad.id}
                                className={`transition-all duration-300 ${isExpanded ? 'ring-1 ring-teal-500/50 bg-white/5' : 'hover:bg-white/5 cursor-pointer'}`}
                                onClick={() => !isExpanded && setExpandedAdId(ad.id)}
                            >
                                {/* Card Header / Summary */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded">
                                                #{index + 1} Match
                                            </span>
                                            {ad.year && (
                                                <span className="text-xs text-text-dim">{ad.year}</span>
                                            )}
                                            {ad.category && (
                                                <span className="text-xs text-text-dim px-1.5 py-0.5 bg-white/5 rounded border border-white/10">
                                                    {ad.category}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-semibold text-white">{ad.title || 'Untitled Ad'}</h4>
                                        {ad.brand && (
                                            <p className="text-sm text-teal-400 font-medium">{ad.brand}</p>
                                        )}
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <div>
                                            <div className="text-2xl font-bold text-teal-400">
                                                {Math.round(ad.similarity_score * 100)}%
                                            </div>
                                            <div className="text-xs text-text-dim">Similarity</div>
                                        </div>
                                        {isExpanded && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedAdId(null);
                                                }}
                                                className="p-1 hover:bg-white/10 rounded text-text-dim hover:text-white"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded ? (
                                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {/* Video Player Template */}
                                        {ad.video_url ? (
                                            <div className="rounded-lg overflow-hidden bg-black aspect-video relative group">
                                                <video
                                                    src={ad.video_url}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                    poster="/placeholder-video.png" // You might want a poster
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg bg-black/40 p-8 text-center border border-white/5 border-dashed">
                                                <Video size={32} className="mx-auto text-text-dim mb-2" />
                                                <p className="text-text-dim text-sm">Video preview not available</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Details Column */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                                        <FileText size={14} className="text-teal-400" />
                                                        Description
                                                    </h5>
                                                    <p className="text-sm text-white/80 leading-relaxed">
                                                        {ad.description}
                                                    </p>
                                                </div>

                                                {ad.awards.length > 0 && (
                                                    <div>
                                                        <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                                            <Zap size={14} className="text-amber-400" />
                                                            Awards
                                                        </h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {ad.awards.map((award, i) => (
                                                                <span key={i} className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 text-xs border border-amber-500/20">
                                                                    {award}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {ad.tags.length > 0 && (
                                                    <div>
                                                        <h5 className="text-sm font-medium text-white mb-2">Tags</h5>
                                                        <div className="flex flex-wrap gap-1">
                                                            {ad.tags.map((tag, i) => (
                                                                <span key={i} className="text-xs px-2 py-0.5 bg-white/10 text-white/70 rounded">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Script & Metrics Column */}
                                            <div className="space-y-4">
                                                {ad.script_excerpt && (
                                                    <div>
                                                        <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                                            <List size={14} className="text-purple-400" />
                                                            Script Excerpt
                                                        </h5>
                                                        <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-sm text-white/70 italic font-mono leading-relaxed">
                                                            "{ad.script_excerpt}"
                                                        </div>
                                                    </div>
                                                )}

                                                {ad.effectiveness_score !== null && (
                                                    <div className="bg-gradient-to-r from-green-900/20 to-teal-900/20 p-3 rounded-lg border border-teal-500/20">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-white">Effectiveness Score</span>
                                                            <span className="text-lg font-bold text-green-400">{ad.effectiveness_score.toFixed(1)}/10</span>
                                                        </div>
                                                        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-green-500 rounded-full"
                                                                style={{ width: `${(ad.effectiveness_score / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Collapsed Summary */
                                    <div className="mt-2 text-sm text-text-dim line-clamp-2">
                                        {ad.description}
                                    </div>
                                )}

                                {!isExpanded && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-teal-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Click to expand details <Target size={12} />
                                    </div>
                                )}
                            </GlassCard>
                        );
                    })}
                </div>
            ) : !isSearching ? (
                <GlassCard className="text-center py-12 border-dashed border-2 border-white/10">
                    <Target className="mx-auto mb-4 text-teal-400" size={48} />
                    <h4 className="text-lg font-semibold text-white mb-2">Ready to Discover Similar Ads</h4>
                    <p className="text-text-dim text-sm max-w-md mx-auto">
                        Click "Find Similar Ads" to search our database of TV advertisements
                        for creative inspiration and competitive insights.
                    </p>
                </GlassCard>
            ) : null}
        </div>
    );
};


export const ProjectView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast, showLoadingToast, dismissToast } = useToast();
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('clearcast');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [runningClearcast, setRunningClearcast] = useState(false);
    const [runningAi, setRunningAi] = useState(false);
    const [runningSimilarAds, setRunningSimilarAds] = useState(false);
    const [similarAds, setSimilarAds] = useState<SimilarAd[]>([]);
    const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null);
    const [creativeProfile, setCreativeProfile] = useState<CreativeProfile | null>(null);
    const [isPolishing, setIsPolishing] = useState(false);
    const [showRerunModal, setShowRerunModal] = useState(false);
    const [showPolishModal, setShowPolishModal] = useState(false);
    const [rerunType, setRerunType] = useState<TabType>('clearcast');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoReady, setVideoReady] = useState(true);
    const [playbackJobId, setPlaybackJobId] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [videoProgress, setVideoProgress] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const progressBarRef = React.useRef<HTMLDivElement>(null);
    const videoUrl = id ? api.getVideoUrl(id) : '';
    const [videoCacheKey, setVideoCacheKey] = useState(() => Date.now());
    const cachedVideoUrl = videoUrl ? `${videoUrl}?v=${videoCacheKey}` : '';
    const [error, setError] = useState<string | null>(null);
    const [reactionOverview, setReactionOverview] = useState<ReactionOverviewResponse>({ jobs: [], reactions: [] });
    const reactionJobsRef = React.useRef(0);

    const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
        showToast(message, { type });
    };

    const renderVideoOptimizingCard = () => (
        <GlassCard className="overflow-hidden p-8 flex flex-col items-center justify-center gap-4 h-full">
            <div className="animate-spin rounded-full border-2 border-white/30 border-t-neon-blue w-12 h-12" />
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white">Optimizing Video for Web</h3>
                <p className="text-text-dim text-sm">
                    This upload is still being converted into a streaming-friendly MP4. Once complete, playback will start automatically.
                </p>
                {playbackJobId && (
                    <p className="text-xs text-text-dim/80">Job ID: {playbackJobId}</p>
                )}
            </div>
            <button
                onClick={fetchResult}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
            >
                Refresh Status
            </button>
        </GlassCard>
    );

    const handlePolish = async (options?: any) => {
        if (!id) return;

        // Open modal if called without options (from button click)
        if (!options && !isPolishing) {
            setShowPolishModal(true);
            return;
        }

        if (!options) {
            return;
        }

        setShowPolishModal(false);
        setIsPolishing(true);
        try {
            const payload = buildPolishPayload(options);
            const result = await api.polishVideo(id, payload);
            const downloadUrl = result?.download_url || api.getPolishedVideoUrl(id);
            window.open(downloadUrl, '_blank');
            showToastMessage('Video polished successfully. Download started.');
        } catch (error: any) {
            console.error("Failed to polish video", error);
            const detail = error?.response?.data?.detail || error?.message || 'Failed to polish video';
            showToastMessage(detail, 'error');
        } finally {
            setIsPolishing(false);
        }
    };

    const fetchResult = React.useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.getResults(id);
            setResult(data);
            setVideoReady(data?.playback_ready !== false);
            setPlaybackJobId(data?.playback_job_id ?? null);
            setVideoCacheKey(Date.now());
        } catch (err: any) {
            console.error("Failed to fetch result", err);
            setError("Failed to load project details. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchResult();
    }, [fetchResult]);

    // Log video URL changes
    useEffect(() => {
        console.log('[ProjectView] Video URL changed:', {
            analysisId: id,
            videoUrl: cachedVideoUrl,
            videoReady,
            playbackJobId,
        });
    }, [id, cachedVideoUrl, videoReady, playbackJobId]);

    // Log video element state periodically
    useEffect(() => {
        if (!videoReady || !videoRef.current) return;

        const logVideoState = () => {
            const video = videoRef.current;
            if (!video) return;

            console.log('[ProjectView] Video state:', {
                src: video.src,
                readyState: video.readyState,
                networkState: video.networkState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration,
                currentTime: video.currentTime,
                paused: video.paused,
                muted: video.muted,
                error: video.error ? {
                    code: video.error.code,
                    message: video.error.message,
                } : null,
            });
        };

        // Log immediately
        logVideoState();

        // Log every 2 seconds for debugging
        const interval = setInterval(logVideoState, 2000);
        return () => clearInterval(interval);
    }, [videoReady]);

    useEffect(() => {
        if (!id || videoReady) {
            return;
        }
        const interval = setInterval(fetchResult, 4000);
        return () => clearInterval(interval);
    }, [id, videoReady, fetchResult]);

    useEffect(() => {
        if (!id) return;
        let active = true;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;

        const loadOverview = async () => {
            try {
                const data = await api.getReactionsOverview(id);
                if (!active) return;
                setReactionOverview(data);
                const pending = data.jobs.filter(job => job.status === 'queued' || job.status === 'processing').length;
                if (pending === 0 && reactionJobsRef.current > 0) {
                    fetchResult();
                }
                reactionJobsRef.current = pending;
                if (pending > 0 && !pollingTimer) {
                    pollingTimer = setInterval(loadOverview, 4000);
                } else if (pending === 0 && pollingTimer) {
                    clearInterval(pollingTimer);
                    pollingTimer = null;
                }
            } catch (error) {
                if (!active) return;
                console.error("Failed to load reaction overview", error);
            }
        };

        loadOverview();

        return () => {
            active = false;
            if (pollingTimer) {
                clearInterval(pollingTimer);
            }
        };
    }, [id, fetchResult]);

    // ... (handlers)

    const handleVideoPlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleMuteToggle = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setVideoProgress(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadataForDuration = () => {
        if (videoRef.current && videoRef.current.duration) {
            setVideoDuration(videoRef.current.duration);
        }
    };

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || !videoRef.current || !videoDuration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * videoDuration;
        videoRef.current.currentTime = newTime;
        setVideoProgress(newTime);
    };

    // Handler for seeking video from external components (e.g., EmotionalTimelineChart)
    const handleSeekVideo = React.useCallback((time: number) => {
        if (!videoRef.current) return;
        const clampedTime = Math.max(0, Math.min(time, videoDuration || time));
        videoRef.current.currentTime = clampedTime;
        setVideoProgress(clampedTime);
    }, [videoDuration]);

    const handleVideoError = React.useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const video = e.currentTarget;
        const error = video.error;
        const errorDetails = error ? {
            code: error.code,
            message: error.message,
            MEDIA_ERR_ABORTED: error.MEDIA_ERR_ABORTED,
            MEDIA_ERR_NETWORK: error.MEDIA_ERR_NETWORK,
            MEDIA_ERR_DECODE: error.MEDIA_ERR_DECODE,
            MEDIA_ERR_SRC_NOT_SUPPORTED: error.MEDIA_ERR_SRC_NOT_SUPPORTED,
        } : null;
        console.error('[ProjectView] Video error:', {
            analysisId: id,
            videoUrl: cachedVideoUrl,
            error: errorDetails,
            readyState: video.readyState,
            networkState: video.networkState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
            currentTime: video.currentTime,
        });
        setVideoError('Your browser could not play this source. Download it or re-upload an MP4 (H.264) version.');
    }, [id, cachedVideoUrl]);

    const handleVideoLoaded = React.useCallback(() => {
        const video = videoRef.current;
        if (video) {
            console.log('[ProjectView] Video loaded:', {
                analysisId: id,
                videoUrl: cachedVideoUrl,
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration,
                networkState: video.networkState,
            });
        }
        setVideoError(null);
    }, [id, cachedVideoUrl]);

    const retryVideoPlayback = React.useCallback(() => {
        setVideoError(null);
        const player = videoRef.current;
        if (player) {
            player.load();
            player.play().catch((err) => {
                console.warn('ProjectView: retry playback failed', err);
            });
        }
    }, []);

    const renderVideoErrorOverlay = () => {
        if (!videoError) {
            return null;
        }
        return (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
                <p className="text-sm text-red-200">{videoError}</p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <button
                        onClick={retryVideoPlayback}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        Retry playback
                    </button>
                    {videoUrl && (
                        <a
                            href={videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
                        >
                            Download video
                        </a>
                    )}
                </div>
            </div>
        );
    };

    const handleRunClearcast = async (options?: any) => {
        if (!id) return;

        // If called without options (from button click), open modal
        if (!options && !runningClearcast) {
            setRerunType('clearcast');
            setShowRerunModal(true);
            return;
        }

        setShowRerunModal(false);
        setRunningClearcast(true);
        const loadingToastId = showLoadingToast('Running Clearcast compliance check...');
        try {
            await api.runClearcastCheck(id);
            await fetchResult();
            dismissToast(loadingToastId);
            showToastMessage('Clearcast analysis updated successfully');
        } catch (error) {
            console.error("Failed to run Clearcast check", error);
            dismissToast(loadingToastId);
            showToastMessage('Failed to run Clearcast check', 'error');
        } finally {
            setRunningClearcast(false);
        }
    };

    const handleRunAi = async (options?: any) => {
        if (!id) return;

        // If called without options (from button click), open modal
        if (!options && !runningAi) {
            setRerunType('ai');
            setShowRerunModal(true);
            return;
        }

        setShowRerunModal(false);
        setRunningAi(true);
        const loadingToastId = showLoadingToast('Running AI video analysis...');
        try {
            await api.runAiBreakdown(id, 'full', options?.option === 'global' ? undefined : options?.option);
            await fetchResult();
            dismissToast(loadingToastId);
            showToastMessage('AI Breakdown updated successfully');
        } catch (error) {
            console.error("Failed to run AI breakdown", error);
            dismissToast(loadingToastId);
            showToastMessage('Failed to run AI breakdown', 'error');
        } finally {
            setRunningAi(false);
        }
    };

    const handleSearchSimilarAds = async () => {
        if (!id) return;

        setRunningSimilarAds(true);
        const loadingToastId = showLoadingToast('Searching for similar ads...');
        try {
            const response = await api.findSimilarAds(id);
            setSimilarAds(response.similar_ads);
            setBenchmarks(response.benchmarks);
            setCreativeProfile(response.creative_profile);
            dismissToast(loadingToastId);
            const benchmarkMsg = response.benchmarks ? ' with benchmarks' : '';
            showToastMessage(`Found ${response.similar_ads.length} similar ads${benchmarkMsg}`);
        } catch (error: any) {
            console.error("Failed to search similar ads", error);
            dismissToast(loadingToastId);
            const errorMessage = error.response?.data?.detail || 'Failed to search similar ads';
            showToastMessage(errorMessage, 'error');
        } finally {
            setRunningSimilarAds(false);
        }
    };

    if (loading) return <div className="text-white text-center mt-20">Loading analysis...</div>;
    if (error) return (
        <div className="text-center mt-20">
            <div className="text-red-500 text-xl font-bold mb-2">Error Loading Project</div>
            <div className="text-text-dim">{error}</div>
            <button onClick={fetchResult} className="mt-4 px-4 py-2 bg-white/10 rounded hover:bg-white/20 text-white">Retry</button>
        </div>
    );
    if (!result) return <div className="text-white text-center mt-20">Project not found</div>;

    const reactionCount = result.reaction_count ?? reactionOverview?.reactions?.length ?? 0;

    // Try to get AI score from top-level or fallback to nested breakdown
    let aiScoreRaw = result.ai_effectiveness;
    if (typeof aiScoreRaw !== 'number' && result.ai_breakdown?.estimated_outcome?.effectiveness_score) {
        aiScoreRaw = result.ai_breakdown.estimated_outcome.effectiveness_score;
    }
    const aiPercent = (typeof aiScoreRaw === 'number' && aiScoreRaw > 0) ? Math.round(aiScoreRaw) : null;
    const audiencePercentRaw = result.audience_engagement;
    const audiencePercent = (typeof audiencePercentRaw === 'number' && audiencePercentRaw > 0)
        ? Math.round(audiencePercentRaw * 100)
        : 0;

    // Logic:
    // 1. If both AI and Audience exist:
    //    - Weight Audience based on sample size (reactionCount)
    //    - Small sample (0-5) -> 10% weight
    //    - Medium sample (6-20) -> 20% weight
    //    - Large sample (20+) -> 30% weight
    // 2. If only AI exists -> 100% AI
    // 3. If only Audience exists -> 100% Audience

    let audienceWeight = 0;
    if (audiencePercent > 0) {
        if (reactionCount > 20) audienceWeight = 0.3;
        else if (reactionCount > 5) audienceWeight = 0.2;
        else audienceWeight = 0.1;
    }

    let combinedEngagementScore = 0;
    let scoreSourceText = 'No data available';

    if (aiPercent !== null && audiencePercent > 0) {
        // Both exist
        combinedEngagementScore = Math.round(aiPercent * (1 - audienceWeight) + audiencePercent * audienceWeight);
        scoreSourceText = `AI (${Math.round((1 - audienceWeight) * 100)}%) + Audience (${Math.round(audienceWeight * 100)}%)`;
    } else if (aiPercent !== null) {
        // Only AI
        combinedEngagementScore = aiPercent;
        scoreSourceText = 'AI Breakdown (100%)';
    } else if (audiencePercent > 0) {
        // Only Audience
        combinedEngagementScore = audiencePercent;
        scoreSourceText = 'Audience Reactions (100%)';
    } else {
        // None
        combinedEngagementScore = 0;
        scoreSourceText = 'No scoring data available';
    }

    const scoreSource = scoreSourceText;

    // Clearance Status Logic
    const clearanceReport = result.clearcast_check;
    const clearanceStatus = clearanceReport?.status || 'pending';
    const clearancePrediction = clearanceReport?.clearance_prediction || 'Unknown';

    return (
        <PageContainer>
            <div className="space-y-8">
                {/* Header */}
                <header className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white active:scale-95 transition-all duration-200"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-3xl font-semibold tracking-tight text-white">{result.video_name}</h2>
                        <p className="text-text-dim">Analysis generated on {new Date(result.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={() => navigate(`/reaction-metrics/${id}`)}
                        className="px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 hover:shadow-lg hover:shadow-neon-blue/10 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2"
                    >
                        <TrendingUp size={18} />
                        Reaction Metrics
                    </button>
                    <button
                        onClick={() => navigate(`/record-reaction/${id}`)}
                        className="px-4 py-2 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20 hover:shadow-lg hover:shadow-neon-purple/10 active:scale-95 transition-all duration-200 font-medium flex items-center gap-2"
                    >
                        <Video size={18} />
                        Record Reaction
                    </button>
                </header>

                {/* Main Content Stack */}
                <div className="space-y-10">
                    {/* Top Section: Video + Key Metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Video Player Section (Spans 2 columns) */}
                        <div className="lg:col-span-2">
                            {videoReady ? (
                                <GlassCard className="overflow-hidden p-0 relative group h-full">
                                    <div className="aspect-video bg-black relative h-full">
                                        <video
                                            ref={videoRef}
                                            src={cachedVideoUrl}
                                            className="w-full h-full object-contain"
                                            onPlay={() => {
                                                console.log('[ProjectView] Video play event');
                                                setIsPlaying(true);
                                            }}
                                            onPause={() => {
                                                console.log('[ProjectView] Video pause event');
                                                setIsPlaying(false);
                                            }}
                                            onError={handleVideoError}
                                            onLoadedData={handleVideoLoaded}
                                            onTimeUpdate={handleTimeUpdate}
                                            onLoadedMetadata={() => {
                                                const video = videoRef.current;
                                                console.log('[ProjectView] Video metadata loaded:', {
                                                    videoWidth: video?.videoWidth,
                                                    videoHeight: video?.videoHeight,
                                                    duration: video?.duration,
                                                    readyState: video?.readyState,
                                                });
                                                handleLoadedMetadataForDuration();
                                            }}
                                            onCanPlay={() => {
                                                const video = videoRef.current;
                                                console.log('[ProjectView] Video can play:', {
                                                    readyState: video?.readyState,
                                                    videoWidth: video?.videoWidth,
                                                    videoHeight: video?.videoHeight,
                                                });
                                                // Auto-play disabled - user must click play button
                                            }}
                                            onCanPlayThrough={() => {
                                                console.log('[ProjectView] Video can play through');
                                            }}
                                            onWaiting={() => {
                                                console.warn('[ProjectView] Video waiting for data');
                                            }}
                                            onStalled={() => {
                                                console.warn('[ProjectView] Video stalled');
                                            }}
                                            onSuspend={() => {
                                                console.log('[ProjectView] Video suspended');
                                            }}
                                            onLoadStart={() => {
                                                console.log('[ProjectView] Video load start:', { videoUrl: cachedVideoUrl });
                                            }}
                                        />
                                        {renderVideoErrorOverlay()}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={handleVideoPlayPause}
                                                    className="p-2 rounded-full bg-white text-black hover:scale-110 transition-transform"
                                                >
                                                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                                </button>
                                                <div
                                                    ref={progressBarRef}
                                                    onClick={handleProgressBarClick}
                                                    className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer"
                                                >
                                                    <div
                                                        className="h-full bg-neon-blue rounded-full transition-all duration-100"
                                                        style={{ width: videoDuration > 0 ? `${(videoProgress / videoDuration) * 100}%` : '0%' }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleMuteToggle}
                                                    className="text-white hover:text-neon-blue transition-colors"
                                                >
                                                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </GlassCard>
                            ) : (
                                renderVideoOptimizingCard()
                            )}
                        </div>

                        {/* Right Column: Metrics Widgets */}
                        <div className="flex flex-col gap-4">
                            {/* Engagement Score - Compact & Hierarchical */}
                            <GlassCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-medium text-text-dim uppercase tracking-wider">Overall Score</h3>
                                        <div className="mt-1 flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-white leading-none">{combinedEngagementScore}%</span>
                                        </div>
                                        <div className="mt-1.5 text-xs text-text-dim flex items-center gap-2">
                                            <span className="flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-neon-blue/50"></span>
                                                Audience {audiencePercent}%
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-neon-purple/50"></span>
                                                AI {aiPercent !== null ? `${aiPercent}%` : '--'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative w-12 h-12 shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                                            <circle
                                                cx="24" cy="24"
                                                r="20"
                                                stroke="#38BDF8"
                                                strokeWidth="4"
                                                fill="none"
                                                strokeDasharray={126}
                                                strokeDashoffset={126 - (126 * combinedEngagementScore) / 100}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Clearance Estimate - Compact */}
                            <GlassCard className="p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-medium text-text-dim uppercase tracking-wider">Clearance Estimate</h3>

                                        {/* Status Text */}
                                        <div className="mt-1">
                                            {!clearanceReport ? (
                                                <p className="text-lg font-semibold text-white">Not Checked</p>
                                            ) : (
                                                <p className={`text-lg font-semibold truncate ${
                                                    clearancePrediction?.toLowerCase().includes('likely') || clearancePrediction?.toLowerCase().includes('will clear') 
                                                        ? 'text-green-400' 
                                                        : clearancePrediction?.toLowerCase().includes('fail') || clearancePrediction?.toLowerCase().includes('unlikely')
                                                            ? 'text-red-400' 
                                                            : 'text-yellow-400'
                                                    }`}>
                                                    {clearancePrediction && !clearancePrediction.toLowerCase().includes('unknown')
                                                        ? clearancePrediction.replace(/pending\s*/gi, '').split('.')[0]
                                                        : (clearanceStatus === 'pass' ? 'Likely to Clear' : 'Issues Detected')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action or Icon */}
                                    <div className="shrink-0">
                                        {!clearanceReport ? (
                                            <button
                                                onClick={() => handleRunClearcast()}
                                                disabled={runningClearcast}
                                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors whitespace-nowrap"
                                            >
                                                {runningClearcast ? 'Checking...' : 'Run Check'}
                                            </button>
                                        ) : (
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                clearancePrediction?.toLowerCase().includes('likely') || clearancePrediction?.toLowerCase().includes('will clear')
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : clearancePrediction?.toLowerCase().includes('fail') || clearancePrediction?.toLowerCase().includes('unlikely')
                                                        ? 'bg-red-500/20 text-red-400' 
                                                        : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {clearancePrediction?.toLowerCase().includes('likely') || clearancePrediction?.toLowerCase().includes('will clear') 
                                                    ? <CheckCircle size={20} /> 
                                                    : clearancePrediction?.toLowerCase().includes('fail') || clearancePrediction?.toLowerCase().includes('unlikely')
                                                        ? <XCircle size={20} /> 
                                                        : <AlertCircle size={20} />}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    </div>

                    {/* Reports Section */}
                    <div>
                        {/* Tab Headers */}
                        <div className="flex items-center justify-between border-b border-white/10 mb-6">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('clearcast')}
                                    className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'clearcast'
                                        ? 'text-neon-blue'
                                        : 'text-text-dim hover:text-white'
                                        }`}
                                >
                                    Compliance Report
                                    {activeTab === 'clearcast' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('ai')}
                                    className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'ai'
                                        ? 'text-neon-purple'
                                        : 'text-text-dim hover:text-white'
                                        }`}
                                >
                                    AI Video Breakdown
                                    {activeTab === 'ai' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-purple" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('similar')}
                                    className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'similar'
                                        ? 'text-teal-400'
                                        : 'text-text-dim hover:text-white'
                                        }`}
                                >
                                    Find Similar Ads
                                    {activeTab === 'similar' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
                                    )}
                                </button>
                            </div>

                            {/* Dropdowns removed, moved to RerunModal */}
                        </div>

                        {/* Tab Content */}
                        <div className="min-h-[400px]">
                            {activeTab === 'clearcast' && (
                                <ComplianceSlideshow
                                    result={result}
                                    onRunCheck={() => handleRunClearcast()}
                                    isRunning={runningClearcast}
                                    analysisId={id || ''}
                                    onPolish={() => handlePolish()}
                                    isPolishing={isPolishing}
                                />
                            )}
                            {activeTab === 'ai' && (
                                <AIBreakdownSlideshow
                                    result={result}
                                    onRunAnalysis={() => handleRunAi()}
                                    isRunning={runningAi}
                                    analysisId={id || ''}
                                    onSeekVideo={handleSeekVideo}
                                    currentVideoTime={videoProgress}
                                />
                            )}
                            {activeTab === 'similar' && (
                                <SimilarAdsSlideshow
                                    result={result}
                                    onRunSearch={handleSearchSimilarAds}
                                    isSearching={runningSimilarAds}
                                    similarAds={similarAds}
                                    benchmarks={benchmarks}
                                    creativeProfile={creativeProfile}
                                />
                            )}
                        </div>
                    </div>

                    <RerunModal
                        isOpen={showRerunModal}
                        onClose={() => setShowRerunModal(false)}
                        onRun={rerunType === 'clearcast' ? handleRunClearcast : handleRunAi}
                        type={rerunType}
                        isRunning={rerunType === 'clearcast' ? runningClearcast : runningAi}
                    />

                    <PolishModal
                        isOpen={showPolishModal}
                        onClose={() => setShowPolishModal(false)}
                        onRun={handlePolish}
                        isPolishing={isPolishing}
                    />
                </div>
            </div>
        </PageContainer>
    );
};



