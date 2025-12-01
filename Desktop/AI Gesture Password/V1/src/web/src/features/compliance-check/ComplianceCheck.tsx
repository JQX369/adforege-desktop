import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { PageContainer } from '@shared/components/PageContainer';
import { api } from '@lib/services/api';
import {
    Shield,
    Upload,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    ArrowLeft,
    RotateCcw,
    FileVideo
} from 'lucide-react';

interface ComplianceFlag {
    flag_id: string;
    severity: 'red' | 'yellow' | 'blue';
    category: string;
    message: string;
    fix_guidance?: string;
    details?: Record<string, any>;
}

interface ComplianceResult {
    passed: boolean;
    red_flags: ComplianceFlag[];
    yellow_flags: ComplianceFlag[];
    blue_flags: ComplianceFlag[];
    summary: string;
}

type CheckStep = 'upload' | 'checking' | 'results';

export const ComplianceCheck: React.FC = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<CheckStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [clockNumber, setClockNumber] = useState('');
    const [agencyCode, setAgencyCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ComplianceResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = useCallback((selectedFile: File) => {
        const validTypes = ['.mp4', '.mov', '.mxf', '.avi', '.webm'];
        const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));

        if (!validTypes.includes(ext)) {
            setError(`Invalid file type. Supported formats: ${validTypes.join(', ')}`);
            return;
        }

        setFile(selectedFile);
        setError(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    }, [handleFileSelect]);

    const runComplianceCheck = async () => {
        if (!file) {
            setError('Please select a video file');
            return;
        }

        if (!clockNumber.trim()) {
            setError('Clock number is required for compliance check');
            return;
        }

        setError(null);
        setStep('checking');

        try {
            const checkResult = await api.runQuickComplianceCheck(
                file,
                clockNumber.trim(),
                agencyCode.trim() || undefined
            );
            setResult(checkResult);
            setStep('results');
        } catch (err: any) {
            console.error('Compliance check failed:', err);
            setError(err.response?.data?.detail || err.message || 'Compliance check failed');
            setStep('upload');
        }
    };

    const resetCheck = () => {
        setFile(null);
        setClockNumber('');
        setAgencyCode('');
        setResult(null);
        setError(null);
        setStep('upload');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'red':
                return <XCircle className="text-red-500" size={18} />;
            case 'yellow':
                return <AlertTriangle className="text-yellow-500" size={18} />;
            case 'blue':
                return <Info className="text-blue-400" size={18} />;
            default:
                return <Info className="text-text-dim" size={18} />;
        }
    };

    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case 'red':
                return 'border-red-500/30 bg-red-500/5';
            case 'yellow':
                return 'border-yellow-500/30 bg-yellow-500/5';
            case 'blue':
                return 'border-blue-400/30 bg-blue-400/5';
            default:
                return 'border-glass-border bg-glass-subtle';
        }
    };

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-text-dim" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Shield className="text-blue-400" size={28} />
                            360 Compliance Check
                        </h1>
                        <p className="text-text-dim text-sm mt-1">
                            Full DPP AS-11 broadcast validation • One-shot analysis
                        </p>
                    </div>
                </div>

                {/* Upload Step */}
                {step === 'upload' && (
                    <GlassCard className="p-8">
                        {/* File Upload Zone */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                                isDragging
                                    ? 'border-blue-400 bg-blue-400/10'
                                    : file
                                        ? 'border-neon-green/50 bg-neon-green/5'
                                        : 'border-glass-border hover:border-white/30'
                            }`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".mp4,.mov,.mxf,.avi,.webm"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />

                            {file ? (
                                <div className="flex flex-col items-center gap-3">
                                    <FileVideo className="text-neon-green" size={48} />
                                    <div>
                                        <p className="text-white font-medium">{file.name}</p>
                                        <p className="text-text-dim text-sm">
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        className="text-sm text-text-dim hover:text-white transition-colors"
                                    >
                                        Change file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <Upload className="text-text-dim" size={48} />
                                    <div>
                                        <p className="text-white font-medium">
                                            Drop video file here or click to upload
                                        </p>
                                        <p className="text-text-dim text-sm mt-1">
                                            Supported: .mp4, .mov, .mxf, .avi, .webm
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Form Fields */}
                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Clock Number <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={clockNumber}
                                    onChange={(e) => setClockNumber(e.target.value.toUpperCase())}
                                    placeholder="AAA/BBBB123/030"
                                    className="w-full px-4 py-3 rounded-lg bg-black/30 border border-glass-border text-white placeholder-text-dim focus:border-blue-400 focus:outline-none transition-colors"
                                />
                                <p className="text-xs text-text-dim mt-1">
                                    Format: 3 letters / 4-7 alphanumeric / 3 digits (duration)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Agency Code <span className="text-text-dim">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={agencyCode}
                                    onChange={(e) => setAgencyCode(e.target.value)}
                                    placeholder="Enter agency code"
                                    className="w-full px-4 py-3 rounded-lg bg-black/30 border border-glass-border text-white placeholder-text-dim focus:border-blue-400 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={runComplianceCheck}
                            disabled={!file || !clockNumber.trim()}
                            className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/20"
                        >
                            Run Full Compliance Check
                        </button>

                        <p className="mt-3 text-center text-xs text-text-dim">
                            Video is processed temporarily and not stored in the system
                        </p>
                    </GlassCard>
                )}

                {/* Checking Step */}
                {step === 'checking' && (
                    <GlassCard className="p-12 text-center">
                        <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={48} />
                        <h3 className="text-xl font-bold text-white mb-2">
                            Running Compliance Check
                        </h3>
                        <p className="text-text-dim">
                            Analyzing {file?.name}...
                        </p>
                        <p className="text-xs text-text-dim mt-4">
                            This may take a moment depending on video length
                        </p>
                    </GlassCard>
                )}

                {/* Results Step */}
                {step === 'results' && result && (
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <GlassCard className={`p-6 ${result.passed ? 'border-neon-green/30' : 'border-red-500/30'}`}>
                            <div className="flex items-center gap-4">
                                {result.passed ? (
                                    <CheckCircle2 className="text-neon-green" size={48} />
                                ) : (
                                    <XCircle className="text-red-500" size={48} />
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-white">
                                        {result.passed ? 'Compliance Check Passed' : 'Issues Found'}
                                    </h3>
                                    <p className="text-text-dim">{result.summary}</p>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <XCircle className="text-red-500" size={16} />
                                    <span className="text-white">{result.red_flags.length} Critical</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="text-yellow-500" size={16} />
                                    <span className="text-white">{result.yellow_flags.length} Warnings</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Info className="text-blue-400" size={16} />
                                    <span className="text-white">{result.blue_flags.length} Info</span>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Critical Issues */}
                        {result.red_flags.length > 0 && (
                            <div>
                                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <XCircle className="text-red-500" size={20} />
                                    Critical Issues
                                </h4>
                                <div className="space-y-3">
                                    {result.red_flags.map((flag, idx) => (
                                        <GlassCard key={idx} className={`p-4 ${getSeverityStyle('red')}`}>
                                            <div className="flex items-start gap-3">
                                                {getSeverityIcon('red')}
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{flag.message}</p>
                                                    {flag.fix_guidance && (
                                                        <p className="text-text-dim text-sm mt-1">
                                                            Fix: {flag.fix_guidance}
                                                        </p>
                                                    )}
                                                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-white/10 text-text-dim">
                                                        {flag.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warnings */}
                        {result.yellow_flags.length > 0 && (
                            <div>
                                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <AlertTriangle className="text-yellow-500" size={20} />
                                    Warnings
                                </h4>
                                <div className="space-y-3">
                                    {result.yellow_flags.map((flag, idx) => (
                                        <GlassCard key={idx} className={`p-4 ${getSeverityStyle('yellow')}`}>
                                            <div className="flex items-start gap-3">
                                                {getSeverityIcon('yellow')}
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{flag.message}</p>
                                                    {flag.fix_guidance && (
                                                        <p className="text-text-dim text-sm mt-1">
                                                            Fix: {flag.fix_guidance}
                                                        </p>
                                                    )}
                                                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-white/10 text-text-dim">
                                                        {flag.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        {result.blue_flags.length > 0 && (
                            <div>
                                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Info className="text-blue-400" size={20} />
                                    Information
                                </h4>
                                <div className="space-y-3">
                                    {result.blue_flags.map((flag, idx) => (
                                        <GlassCard key={idx} className={`p-4 ${getSeverityStyle('blue')}`}>
                                            <div className="flex items-start gap-3">
                                                {getSeverityIcon('blue')}
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{flag.message}</p>
                                                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-white/10 text-text-dim">
                                                        {flag.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Check Another Button */}
                        <div className="flex gap-4">
                            <button
                                onClick={resetCheck}
                                className="flex-1 py-3 rounded-xl bg-white/5 border border-glass-border text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={18} />
                                Check Another Video
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="px-6 py-3 rounded-xl bg-white/5 border border-glass-border text-text-dim hover:bg-white/10 transition-colors"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
};
