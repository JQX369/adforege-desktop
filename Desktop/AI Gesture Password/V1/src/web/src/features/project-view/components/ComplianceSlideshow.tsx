import React, { useState } from 'react';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import { ArrowLeft, ArrowRight, Download, RotateCcw, Loader2, Shield, CheckCircle, AlertCircle, Clock, AlertTriangle, Zap, TrendingUp, FileText, XCircle, List, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Collapsible Flag Item Component
const CollapsibleFlag: React.FC<{ flag: any; type: 'red' | 'yellow' | 'blue'; frames?: any[] }> = ({ flag, type, frames = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const title = flag.issue || flag.description || "Issue";
    const severity = flag.severity?.toUpperCase() || 'INFO';
    const frameIndices = flag.frame_indices || [];
    
    const colorClasses = {
        red: { bg: 'bg-red-500/5', border: 'border-red-500/10', badge: 'bg-red-500/20 text-red-400', icon: 'text-red-400' },
        yellow: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400', icon: 'text-yellow-400' },
        blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/10', badge: 'bg-blue-500/20 text-blue-400', icon: 'text-blue-400' }
    };
    const colors = colorClasses[type];
    
    return (
        <div className={`rounded-lg ${colors.bg} border ${colors.border} overflow-hidden`}>
            {/* Header - Always Visible */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isOpen ? <ChevronDown size={14} className={colors.icon} /> : <ChevronRight size={14} className={colors.icon} />}
                    <span className="text-white font-medium text-sm truncate">{title}</span>
                </div>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold shrink-0 ml-2 ${colors.badge}`}>
                    {severity}
                </span>
            </button>
            
            {/* Expanded Content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                            {/* Explanation / Impact */}
                            {(flag.explanation || flag.impact) && (
                                <p className="text-xs text-text-dim">{flag.explanation || flag.impact}</p>
                            )}
                            
                            {/* Category & Timestamp */}
                            <div className="flex gap-4 text-[10px] text-white/40">
                                {flag.category && <span>Category: {flag.category}</span>}
                                {flag.timestamp && <span>At: {flag.timestamp}</span>}
                            </div>
                            
                            {/* Fix Guidance */}
                            {flag.fix_guidance && (
                                <div className="p-2 bg-white/5 rounded border border-white/10 text-xs text-white/80">
                                    <span className="text-neon-blue font-medium">Fix: </span>{flag.fix_guidance}
                                </div>
                            )}
                            
                            {/* Frame Thumbnails */}
                            {frameIndices.length > 0 && frames.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
                                    {frameIndices.map((idx: number) => {
                                        const frame = frames[idx];
                                        if (!frame?.image) return null;
                                        return (
                                            <div key={idx} className="relative shrink-0 w-24 h-16 rounded overflow-hidden border border-white/10">
                                                <img
                                                    src={`data:image/jpeg;base64,${frame.image}`}
                                                    alt={`Frame ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5">
                                                    {frame.timestamp || `Frame ${idx + 1}`}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface AnalysisResult {
    id: string;
    video_name: string;
    created_at: string;
    clearcast_check?: any;
    ai_breakdown?: any;
}

interface ComplianceSlideshowProps {
    result: AnalysisResult;
    onRunCheck: () => void;
    isRunning: boolean;
    analysisId: string;
    onPolish: () => void;
    isPolishing?: boolean;
}

export const ComplianceSlideshow: React.FC<ComplianceSlideshowProps> = ({ result, onRunCheck, isRunning, analysisId, onPolish, isPolishing }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    if (!result.clearcast_check) {
        return (
            <GlassCard className="text-center py-12">
                <div className="text-neon-blue mb-4">
                    <Shield size={64} className="mx-auto opacity-80" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Compliance Check Yet</h3>
                <p className="text-text-dim mb-6 max-w-md mx-auto">
                    Run a Clearcast compliance check to verify your ad meets broadcast standards.
                </p>
                <button
                    onClick={onRunCheck}
                    disabled={isRunning}
                    className="px-6 py-3 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                    {isRunning ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Checking Compliance...
                        </>
                    ) : (
                        'Run Compliance Check'
                    )}
                </button>
            </GlassCard>
        );
    }

    const report = result.clearcast_check;
    const pdfUrl = api.downloadClearcastPdf(analysisId);
    const status = report.status || 'pending';
    const prediction = report.clearance_prediction || 'Unknown';
    
    // Get analyzed frames for thumbnail display
    const analyzedFrames = report.analyzed_frames || [];
    
    // Consolidate flags into lists
    // Filter out INFO-level slate detection flags (these are not issues)
    const redFlags = report.red_flags || [];
    const yellowFlags = report.yellow_flags || report.amber_flags || [];
    const blueFlags = (report.blue_flags || []).filter((flag: any) => {
        // Filter out slate detection INFO flags - these are not errors
        const isSlateInfo = flag.severity?.toUpperCase() === 'INFO' && 
                           flag.issue?.toLowerCase().includes('slate');
        return !isSlateInfo;
    });
    const recommendations = report.recommendations || [];
    const claims = report.claims_check || [];
    
    // Technical/Visual flags are blue flags + audio report summary
    const technicalFlags = [...blueFlags];
    if (report.audio_report && report.audio_report.status === "needs_normalization") {
        technicalFlags.push({
            issue: "Audio loudness outside broadcast target",
            severity: "MEDIUM",
            explanation: report.audio_report.recommendation,
            fix_guidance: "Normalize audio to -23 LUFS"
        });
    }

    // Slides Definition
    const slides = [
        // Slide 1: Executive Summary
        {
            title: "Executive Summary",
            content: (
                <div className="flex flex-col h-full space-y-8 justify-center">
                    {/* Big Status Indicator */}
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center"
                    >
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 mb-4 ${
                            prediction.toLowerCase().includes('pass') || prediction.toLowerCase().includes('likely') ? 'border-green-500 bg-green-500/10' :
                            prediction.toLowerCase().includes('fail') || prediction.toLowerCase().includes('unlikely') ? 'border-red-500 bg-red-500/10' :
                            'border-yellow-500 bg-yellow-500/10'
                        }`}>
                            {prediction.toLowerCase().includes('pass') || prediction.toLowerCase().includes('likely') ? <CheckCircle size={48} className="text-green-500" /> :
                             prediction.toLowerCase().includes('fail') || prediction.toLowerCase().includes('unlikely') ? <AlertCircle size={48} className="text-red-500" /> :
                             <AlertTriangle size={48} className="text-yellow-500" />}
                        </div>
                        <h3 className="text-xl font-bold text-text-dim mb-1">Clearance Estimate</h3>
                        <h2 className="text-3xl font-bold text-white mb-2">{prediction.replace(/pending\s*/gi, '').trim() || 'Analysis Complete'}</h2>
                        <p className="text-text-dim max-w-2xl text-center text-lg leading-relaxed">
                            {report.summary || "Analysis complete."}
                        </p>
                    </motion.div>

                    {/* High Level Stats */}
                    <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                            <p className="text-2xl font-bold text-red-400">{redFlags.length}</p>
                            <p className="text-xs text-red-200/70 uppercase tracking-wider">Critical Issues</p>
                        </div>
                        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                            <p className="text-2xl font-bold text-yellow-400">{yellowFlags.length}</p>
                            <p className="text-xs text-yellow-200/70 uppercase tracking-wider">Warnings</p>
                        </div>
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                            <p className="text-2xl font-bold text-blue-400">{technicalFlags.length}</p>
                            <p className="text-xs text-blue-200/70 uppercase tracking-wider">Technical Flags</p>
                        </div>
                    </div>

                    {/* Primary Action */}
                    {(status === 'completed' && (redFlags.length > 0 || technicalFlags.length > 0)) && (
                        <div className="flex justify-center">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onPolish}
                                disabled={isPolishing}
                                className="px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg shadow-cyan-500/25 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isPolishing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                                Auto-Fix Detected Issues
                            </motion.button>
                        </div>
                    )}
                </div>
            )
        },
        // Slide 2: Detailed Analysis (Grid View)
        {
            title: "Detailed Analysis",
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-2">
                    {/* Left Column: Technical, Fixes, Classification */}
                    <div className="space-y-6">
                        {/* Technical / Visual Section with Embedded Fix Button */}
                        <GlassCard className="border-l-4 border-l-blue-500 relative">
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-10 bg-background-end/95 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 pb-3 mb-2 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Shield className="text-blue-500" size={20} />
                                        Technical / Visual ({technicalFlags.length})
                                    </h4>
                                    {technicalFlags.length > 0 && !isPolishing && (
                                        <button 
                                            onClick={onPolish}
                                            className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 flex items-center gap-1 transition-colors"
                                        >
                                            <Zap size={12} /> Fix Issues
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Delivery Metadata */}
                            {report.delivery_metadata && (
                                <div className="mb-4 p-3 bg-black/20 rounded-lg text-xs space-y-1">
                                    <p className="text-text-dim uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10}/> Delivery Metadata</p>
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Clock Number:</span>
                                        <span className="text-white font-mono">{report.delivery_metadata.clock_number || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-dim">Slate:</span>
                                        <span className={report.delivery_metadata.has_slate ? 'text-red-400' : 'text-text-dim'}>
                                            {report.delivery_metadata.has_slate ? 'Present (Remove for tx)' : 'Missing'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {technicalFlags.length > 0 ? (
                                <div className="space-y-2">
                                    {technicalFlags.map((flag: any, idx: number) => (
                                        <CollapsibleFlag key={idx} flag={flag} type="blue" frames={analyzedFrames} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-dim italic text-sm">No technical issues detected.</p>
                            )}
                            
                            {isPolishing && (
                                <div className="mt-4 w-full py-2 bg-blue-500/10 rounded text-center text-blue-400 text-sm animate-pulse">
                                    Applying automated fixes...
                                </div>
                            )}
                        </GlassCard>

                        {/* Classification Profile */}
                        {report.classification && (
                            <GlassCard className="relative">
                                {/* Sticky Header */}
                                <div className="sticky top-0 z-10 bg-background-end/95 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 pb-3 mb-2 border-b border-white/5">
                                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <FileText className="text-purple-400" size={20} />
                                        Classification Profile
                                    </h4>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {report.classification.product_type && (
                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                            <span className="text-text-dim">Product Type</span>
                                            <span className="text-white">{report.classification.product_type}</span>
                                        </div>
                                    )}
                                    {report.classification.script_type && (
                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                            <span className="text-text-dim">Script Tone</span>
                                            <span className="text-white">{report.classification.script_type}</span>
                                        </div>
                                    )}
                                    {report.classification.brand_sector && (
                                        <div className="flex justify-between">
                                            <span className="text-text-dim">Sector</span>
                                            <span className="text-white">{report.classification.brand_sector}</span>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>
                        )}
                    </div>

                    {/* Right Column: Critical Issues, Warnings, Claims */}
                    <div className="space-y-6">
                        {/* Critical Issues */}
                        <GlassCard className="border-l-4 border-l-red-500 relative">
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-10 bg-background-end/95 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 pb-3 mb-2 border-b border-white/5">
                                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <XCircle className="text-red-500" size={20} />
                                    Critical Issues ({redFlags.length})
                                </h4>
                            </div>
                            {redFlags.length > 0 ? (
                                <div className="space-y-2">
                                    {redFlags.map((flag: any, idx: number) => (
                                        <CollapsibleFlag key={idx} flag={flag} type="red" frames={analyzedFrames} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-dim italic text-sm">No critical blocking issues.</p>
                            )}
                        </GlassCard>

                        {/* Warnings */}
                        <GlassCard className="border-l-4 border-l-yellow-500 relative">
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-10 bg-background-end/95 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 pb-3 mb-2 border-b border-white/5">
                                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <AlertCircle className="text-yellow-500" size={20} />
                                    Warnings ({yellowFlags.length})
                                </h4>
                            </div>
                            {yellowFlags.length > 0 ? (
                                <div className="space-y-2">
                                    {yellowFlags.map((flag: any, idx: number) => (
                                        <CollapsibleFlag key={idx} flag={flag} type="yellow" frames={analyzedFrames} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-dim italic text-sm">No warnings detected.</p>
                            )}
                        </GlassCard>

                        {/* Claims & Evidence */}
                        {claims.length > 0 && (
                            <GlassCard className="relative">
                                {/* Sticky Header */}
                                <div className="sticky top-0 z-10 bg-background-end/95 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 pb-3 mb-2 border-b border-white/5">
                                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <List className="text-green-400" size={20} />
                                        Required Evidence ({claims.length})
                                    </h4>
                                </div>
                                <div className="space-y-2">
                                    {claims.map((claim: any, idx: number) => (
                                        <div key={idx} className="p-2 bg-white/5 rounded border border-white/5 text-sm">
                                            <p className="text-white/90 font-medium mb-1">"{claim.claim_text}"</p>
                                            <p className="text-text-dim text-xs">Requires: {claim.claim_type} substantiation</p>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Recommendations */}
                        {recommendations.length > 0 && (
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                                    <TrendingUp size={16} /> Recommendations ({recommendations.length})
                                </h4>
                                <ul className="space-y-2">
                                    {recommendations.slice(0, 3).map((rec: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-white/80">
                                            <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )
        }
    ];

    const nextSlide = () => { if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1); };
    const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">Compliance Report</h3>
                    <p className="text-text-dim">Clearcast & Broadcast Standards Check</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onRunCheck} disabled={isRunning} className="px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors flex items-center gap-2">
                        {isRunning ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                        Rerun
                    </button>
                    <a href={pdfUrl} download className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-2">
                        <Download size={18} /> Export PDF
                    </a>
                </div>
            </div>

            {/* Slide Content with Edge Navigation */}
            <div className="relative min-h-[500px]">
                {/* Left Arrow - Edge of content */}
                <button 
                    onClick={prevSlide} 
                    disabled={currentSlide === 0} 
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-110"
                >
                    <ArrowLeft size={20} />
                </button>
                
                {/* Right Arrow - Edge of content */}
                <button 
                    onClick={nextSlide} 
                    disabled={currentSlide === slides.length - 1} 
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-110"
                >
                    <ArrowRight size={20} />
                </button>
                
                {/* Content Area - with padding for arrows */}
                <div className="px-14">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full"
                        >
                            {slides[currentSlide].content}
                        </motion.div>
                    </AnimatePresence>
                </div>
                
                {/* Bottom Slide Indicators */}
                <div className="flex items-center justify-center gap-2 mt-6">
                    {slides.map((_, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => setCurrentSlide(idx)} 
                            className={`h-2 rounded-full transition-all duration-300 ${
                                currentSlide === idx 
                                    ? 'w-8 bg-neon-blue' 
                                    : 'w-2 bg-white/20 hover:bg-white/40'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
