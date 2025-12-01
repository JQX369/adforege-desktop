import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Info, Download, Loader2, Shield, X } from 'lucide-react';
import { PageContainer } from '@shared/components/PageContainer';

interface ClearcastResult {
    status: string;
    red_flags: Array<{ description: string; timestamp?: string; evidence_source?: string }>;
    amber_flags: Array<{ description: string; timestamp?: string; evidence_source?: string }>;
    green_flags: Array<{ description: string }>;
    blue_flags?: Array<Record<string, any>>;
    analyzed_frames?: Array<{ timestamp: string; base64_data: string; label: string }>;
    validation_mode?: string;
    [key: string]: any;
}

export const ClearcastReport: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [report, setReport] = useState<ClearcastResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [runningCheck, setRunningCheck] = useState(false);

    // Pure Clearcast mode state
    const [showPureModal, setShowPureModal] = useState(false);
    const [pureClockNumber, setPureClockNumber] = useState('');
    const [pureAgencyCode, setPureAgencyCode] = useState('');
    const [runningPureCheck, setRunningPureCheck] = useState(false);
    const [pureError, setPureError] = useState<string | null>(null);

    const fetchReport = async () => {
        if (!id) return;
        try {
            const data = await api.getResults(id);
            if (data.clearcast_check) {
                setReport({
                    ...data.clearcast_check,
                    analyzed_frames: data.analyzed_frames
                });
            }
        } catch (error) {
            console.error("Failed to fetch report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [id]);

    const handleRunCheck = async () => {
        if (!id) return;
        setRunningCheck(true);
        try {
            await api.runClearcastCheck(id);
            await fetchReport();
        } catch (error) {
            console.error("Failed to run Clearcast check", error);
        } finally {
            setRunningCheck(false);
        }
    };

    const handleRunPureCheck = async () => {
        if (!id || !pureClockNumber.trim()) {
            setPureError('Clock number is required');
            return;
        }
        setPureError(null);
        setRunningPureCheck(true);
        try {
            await api.runPureClearcastCheck(
                id,
                pureClockNumber.trim(),
                pureAgencyCode.trim() || undefined
            );
            await fetchReport();
            setShowPureModal(false);
            setPureClockNumber('');
            setPureAgencyCode('');
        } catch (error: any) {
            console.error("Failed to run Pure Clearcast check", error);
            setPureError(error.response?.data?.detail || 'Failed to run check');
        } finally {
            setRunningPureCheck(false);
        }
    };

    if (loading) return <PageContainer><div className="text-white text-center mt-20">Loading report...</div></PageContainer>;

    if (!report) {
        return (
            <PageContainer>
                <div className="space-y-8">
                    <header className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/project/${id}`)}
                        className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-white">Clearcast Compliance Report</h2>
                        <p className="text-text-dim">Automated pre-clearance check against UK broadcast standards</p>
                    </div>
                </header>

                <GlassCard className="text-center py-12">
                    <AlertTriangle className="mx-auto mb-4 text-neon-blue" size={64} />
                    <h3 className="text-xl font-bold text-white mb-2">No Clearcast Check Yet</h3>
                    <p className="text-text-dim mb-6">Run a compliance check to see detailed analysis</p>
                    <button
                        onClick={handleRunCheck}
                        disabled={runningCheck}
                        className="px-6 py-3 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors font-medium flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {runningCheck ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Running Check...
                            </>
                        ) : (
                            'Run Clearcast Check'
                        )}
                    </button>
                </GlassCard>
            </div>
            </PageContainer>
        );
    }

    const getEvidenceImage = (source?: string) => {
        if (!source || !report.analyzed_frames) return null;
        // Parse "Frame X" from source
        const match = source.match(/Frame (\d+)/);
        if (match) {
            const frameIndex = parseInt(match[1]) - 1; // 1-based to 0-based
            if (report.analyzed_frames[frameIndex]) {
                return report.analyzed_frames[frameIndex].base64_data;
            }
        }
        return null;
    };

    const renderTechnicalDetails = (flag: any) => {
        const height = flag.height_check;
        const duration = flag.duration_check;
        if (!height && !duration) return null;

        return (
            <div className="mt-3 space-y-3">
                {height && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-xs uppercase tracking-wide text-text-dim font-semibold">Super Size</p>
                        <p className="text-sm text-white/80 mt-1">{height.message}</p>
                        <p className="text-xs text-white/40 mt-1">
                            Actual: {height.hd_lines?.toFixed(1)} HD lines (~{Math.round(height.actual_pixels ?? 0)}px) •
                            Required: {height.required_lines} lines (~{Math.round(height.required_pixels ?? 0)}px)
                        </p>
                    </div>
                )}
                {duration && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-xs uppercase tracking-wide text-text-dim font-semibold">Hold Time</p>
                        <p className="text-sm text-white/80 mt-1">{duration.message}</p>
                        <p className="text-xs text-white/40 mt-1">
                            Words: {duration.word_count} • Required: {duration.required?.toFixed(1)}s • Actual: {duration.actual?.toFixed(1)}s
                        </p>
                        <p className="text-xs text-white/40">
                            Recognition delay: +{duration.recognition_delay?.toFixed(1)}s (
                            {duration.recognition_delay_type === 'long'
                                ? `≥${duration.delay_threshold} words`
                                : `<${duration.delay_threshold} words`}
                            )
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <PageContainer>
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate(`/project/${id}`)}
                    className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-bold text-white">Clearcast Compliance Report</h2>
                    <p className="text-text-dim">Automated pre-clearance check against UK broadcast standards</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={() => setShowPureModal(true)}
                        className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors font-medium flex items-center gap-2"
                    >
                        <Shield size={18} />
                        Full Broadcast Clearance
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors font-medium flex items-center gap-2">
                        <Download size={18} />
                        Export PDF
                    </button>
                </div>
            </header>

            {/* Pure Mode Badge */}
            {report.validation_mode === 'pure' && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 w-fit">
                    <Shield size={16} className="text-blue-400" />
                    <span className="text-blue-400 text-sm font-medium">Pure Broadcast Mode - Full DPP AS-11 Validation</span>
                </div>
            )}

            {/* Summary Status */}
            <GlassCard className={`border-l-4 ${report.status === 'pass' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${report.status === 'pass' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {report.status === 'pass' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {report.status === 'pass' ? 'Ready for Submission' : 'Attention Required'}
                        </h3>
                        <p className="text-text-dim">
                            {report.status === 'pass'
                                ? 'No critical issues found. This video is likely to pass Clearcast review.'
                                : 'Critical issues detected that may cause rejection. Please review below.'}
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Red Flags */}
            {report.red_flags && report.red_flags.length > 0 && (
                <GlassCard>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <XCircle className="text-red-500" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Critical Issues ({report.red_flags.length})</h3>
                            <p className="text-sm text-text-dim">Must be addressed before submission</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {report.red_flags.map((flag, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-white font-medium mb-2">{flag.description}</p>
                                {flag.timestamp && (
                                    <p className="text-sm text-text-dim mb-2">Timestamp: {flag.timestamp}</p>
                                )}
                                {getEvidenceImage(flag.evidence_source) && (
                                    <img
                                        src={`data:image/jpeg;base64,${getEvidenceImage(flag.evidence_source)}`}
                                        alt="Evidence"
                                        className="mt-2 rounded-lg max-w-xs"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Amber Flags */}
            {report.amber_flags && report.amber_flags.length > 0 && (
                <GlassCard>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                            <AlertTriangle className="text-yellow-500" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Warnings ({report.amber_flags.length})</h3>
                            <p className="text-sm text-text-dim">Review recommended</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {report.amber_flags.map((flag, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <p className="text-white font-medium mb-2">{flag.description}</p>
                                {flag.timestamp && (
                                    <p className="text-sm text-text-dim mb-2">Timestamp: {flag.timestamp}</p>
                                )}
                                {getEvidenceImage(flag.evidence_source) && (
                                    <img
                                        src={`data:image/jpeg;base64,${getEvidenceImage(flag.evidence_source)}`}
                                        alt="Evidence"
                                        className="mt-2 rounded-lg max-w-xs"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Technical / Legibility Flags */}
            {report.blue_flags && report.blue_flags.length > 0 && (
                <GlassCard>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Shield className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Technical / Legibility ({report.blue_flags.length})</h3>
                            <p className="text-sm text-text-dim">Size, duration, audio, and delivery issues to fix</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {report.blue_flags.map((flag, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <p className="text-white font-medium">{flag.issue || flag.description || 'Technical issue'}</p>
                                {flag.timestamp && (
                                    <p className="text-sm text-text-dim mt-1">Timestamp: {flag.timestamp}</p>
                                )}
                                {flag.impact && (
                                    <p className="text-xs text-white/60 mt-1">{flag.impact}</p>
                                )}
                                {renderTechnicalDetails(flag)}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Green Flags */}
            {report.green_flags && report.green_flags.length > 0 && (
                <GlassCard>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <CheckCircle className="text-green-500" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Compliance Strengths ({report.green_flags.length})</h3>
                            <p className="text-sm text-text-dim">What this ad does well</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {report.green_flags.map((flag, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                <div className="flex items-start gap-2">
                                    <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <p className="text-white text-sm">{flag.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Info Box */}
            <GlassCard className="bg-neon-blue/5 border-neon-blue/20">
                <div className="flex items-start gap-3">
                    <Info className="text-neon-blue shrink-0" size={24} />
                    <div>
                        <h4 className="text-white font-semibold mb-2">About This Report</h4>
                        <p className="text-text-dim text-sm">
                            This automated analysis uses AI to identify potential compliance issues based on Clearcast's
                            UK Code of Broadcast Advertising. While comprehensive, this is not a substitute for official
                            Clearcast clearance. Always submit your final creative for professional review.
                        </p>
                    </div>
                </div>
            </GlassCard>
        </div>

        {/* Pure Clearcast Modal */}
        {showPureModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-glass-surface border border-glass-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-600/20">
                                <Shield className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Full Broadcast Clearance</h3>
                                <p className="text-sm text-text-dim">DPP AS-11 strict validation</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setShowPureModal(false);
                                setPureError(null);
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-text-dim">
                            Run maximum strictness validation for final broadcast delivery.
                            No auto-downgrade - all issues reported at true severity.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Clock Number <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={pureClockNumber}
                                onChange={(e) => setPureClockNumber(e.target.value.toUpperCase())}
                                placeholder="AAA/BBBB123/030"
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none transition-colors"
                            />
                            <p className="text-xs text-text-dim mt-1">Format: 3 letters / 4-7 alphanumeric / 3 digits</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Agency Code <span className="text-text-dim">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={pureAgencyCode}
                                onChange={(e) => setPureAgencyCode(e.target.value)}
                                placeholder="e.g. AGENCY01"
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none transition-colors"
                            />
                        </div>

                        {pureError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {pureError}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowPureModal(false);
                                    setPureError(null);
                                }}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRunPureCheck}
                                disabled={runningPureCheck || !pureClockNumber.trim()}
                                className="flex-1 px-4 py-3 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {runningPureCheck ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Shield size={18} />
                                        Run Full Check
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </PageContainer>
    );
};
