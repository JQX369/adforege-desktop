import React, { useState } from 'react';
import { GlassCard } from '@shared/components/GlassCard';
import { ArrowLeft, ArrowRight, Target, Loader2, Play, Star, ExternalLink, TrendingUp, Zap, Award, Clock, Globe, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SimilarAd, BenchmarkData, CreativeProfile } from '@lib/services/api';

interface AnalysisResult {
    ai_breakdown?: any;
}

interface SimilarAdsSlideshowProps {
    result: AnalysisResult;
    onRunSearch: () => void;
    isSearching: boolean;
    similarAds: SimilarAd[];
    benchmarks: BenchmarkData | null;
    creativeProfile: CreativeProfile | null;
}

export const SimilarAdsSlideshow: React.FC<SimilarAdsSlideshowProps> = ({ result, onRunSearch, isSearching, similarAds, benchmarks, creativeProfile }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    if (!result.ai_breakdown) {
        return (
            <GlassCard className="text-center py-12">
                <div className="text-amber-500 mb-4">
                    <Target size={64} className="mx-auto opacity-80" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">AI Breakdown Required</h3>
                <p className="text-text-dim mb-6 max-w-md mx-auto">
                    Run the AI Video Breakdown first to enable similar ads discovery.
                </p>
            </GlassCard>
        );
    }

    // Show search button if no ads
    if (similarAds.length === 0) {
        return (
            <GlassCard className="text-center py-12">
                <div className="text-teal-400 mb-4">
                    <Target size={64} className="mx-auto opacity-80" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Find Similar Ads</h3>
                <p className="text-text-dim mb-6 max-w-md mx-auto">
                    Discover ads with similar themes, audiences, and creative approaches.
                </p>
                <button
                    onClick={onRunSearch}
                    disabled={isSearching}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium hover:shadow-lg hover:shadow-teal-500/25 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Target size={20} />
                            Find Similar Ads
                        </>
                    )}
                </button>
            </GlassCard>
        );
    }

    // Group ads into pages of 3
    const adsPerPage = 3;
    const adPages = [];
    for (let i = 0; i < similarAds.length; i += adsPerPage) {
        adPages.push(similarAds.slice(i, i + adsPerPage));
    }

    const slides = [
        // Slide 1: Benchmarks
        {
            title: "Benchmarks",
            content: (
                <div className="space-y-6 h-full flex flex-col justify-center">
                    {benchmarks && Object.keys(benchmarks.metrics).length > 0 ? (
                        <>
                            <div className="bg-gradient-to-br from-teal-900/40 to-cyan-900/40 border border-teal-500/20 rounded-2xl p-6">
                                <h4 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                    <TrendingUp className="text-teal-400" />
                                    Category Benchmarks: {benchmarks.category}
                                </h4>
                                <div className="space-y-6">
                                    {Object.entries(benchmarks.metrics).map(([key, metric]: [string, any]) => (
                                        <div key={key}>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-text-dim text-sm capitalize">{key.replace('_', ' ')}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-bold">{metric.value}/10</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                                        metric.percentile >= 75 ? 'bg-green-500/20 text-green-400' :
                                                        metric.percentile >= 50 ? 'bg-teal-500/20 text-teal-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                        Top {100 - metric.percentile}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${metric.percentile}%` }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                    className={`h-full rounded-full ${
                                                        metric.percentile >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                                                        metric.percentile >= 50 ? 'bg-gradient-to-r from-teal-500 to-cyan-400' :
                                                        'bg-gradient-to-r from-yellow-500 to-orange-400'
                                                    }`}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1 text-[10px] text-text-dim">
                                                <span>Avg: {metric.category_avg}</span>
                                                <span>Max: {metric.category_max}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {benchmarks.insights?.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <h5 className="text-teal-400 font-medium mb-2 text-sm flex items-center gap-2">
                                            <Zap size={14} /> Key Insights
                                        </h5>
                                        <ul className="space-y-2">
                                            {benchmarks.insights.slice(0, 3).map((insight: string, i: number) => (
                                                <li key={i} className="text-xs text-white/80 flex gap-2">
                                                    <span className="text-teal-500/50">•</span>
                                                    {insight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <h5 className="text-green-400 font-medium mb-2 text-sm flex items-center gap-2">
                                            <Star size={14} /> Top Performer Traits
                                        </h5>
                                        <ul className="space-y-2">
                                            {benchmarks.strengths?.slice(0, 3).map((strength: string, i: number) => (
                                                <li key={i} className="text-xs text-white/80 flex gap-2">
                                                    <span className="text-green-500/50">•</span>
                                                    {strength}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-text-dim h-64">
                            <TrendingUp size={48} className="mb-4 opacity-20" />
                            <p>No benchmarks available for this category.</p>
                        </div>
                    )}
                </div>
            )
        },
        // Dynamic Ads Pages
        ...adPages.map((ads, pageIdx) => ({
            title: `Similar Ads (${pageIdx + 1}/${adPages.length})`,
            content: (
                <div className="grid grid-cols-1 gap-6 h-full overflow-y-auto custom-scrollbar pr-2">
                    {ads.map((ad, idx) => (
                        <motion.div
                            key={ad.id}
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="group rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-teal-500/30 transition-all cursor-pointer relative overflow-hidden"
                        >
                            {/* Top Row: Video Preview + Main Info */}
                            <div className="flex gap-4 p-4">
                                {/* Video Preview Thumbnail */}
                                <div className="relative flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-black/40 border border-white/10">
                                    {ad.video_url ? (
                                        <>
                                            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 to-cyan-900/40 flex items-center justify-center">
                                                <Play size={24} className="text-white/80 drop-shadow-lg" fill="white" />
                                            </div>
                                            <div className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded">
                                                Preview
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-white/30">
                                            <Target size={20} />
                                        </div>
                                    )}
                                </div>

                                {/* Main Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h4 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors truncate">
                                                {ad.title}
                                            </h4>
                                            <p className="text-sm text-teal-200/80 font-medium">{ad.brand}</p>
                                        </div>

                                        {/* Scores Section */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            {/* Similarity Score - Prominent */}
                                            <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/30 px-3 py-1.5 rounded-lg text-center">
                                                <div className="flex items-center gap-1">
                                                    <Percent size={12} className="text-purple-300" />
                                                    <span className="text-lg font-bold text-purple-200">
                                                        {Math.round(ad.similarity_score * 100)}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-purple-300/70 block -mt-0.5">Match</span>
                                            </div>

                                            {/* Effectiveness Score */}
                                            {ad.effectiveness_score && (
                                                <div className="bg-black/40 px-3 py-1.5 rounded-lg text-center border border-white/10">
                                                    <span className={`text-lg font-bold ${
                                                        ad.effectiveness_score >= 8 ? 'text-green-400' :
                                                        ad.effectiveness_score >= 6 ? 'text-teal-400' : 'text-amber-400'
                                                    }`}>{ad.effectiveness_score}</span>
                                                    <span className="text-[9px] text-text-dim block -mt-0.5">Score</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-text-dim mt-2 line-clamp-2 group-hover:line-clamp-3 transition-all duration-300">
                                        {ad.description}
                                    </p>
                                </div>
                            </div>

                            {/* Awards Row */}
                            {ad.awards && ad.awards.length > 0 && (
                                <div className="px-4 pb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Award size={12} className="text-amber-400" />
                                        {ad.awards.slice(0, 3).map((award, aIdx) => (
                                            <span key={aIdx} className="px-2 py-0.5 rounded-full bg-amber-500/15 text-[10px] text-amber-300 border border-amber-500/20 font-medium">
                                                {award}
                                            </span>
                                        ))}
                                        {ad.awards.length > 3 && (
                                            <span className="text-[10px] text-amber-400/60">+{ad.awards.length - 3} more</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Footer: Tags & Metadata */}
                            <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t border-white/5">
                                <div className="flex flex-wrap gap-2">
                                    {ad.year && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[10px] text-white/60 border border-white/10">
                                            <Clock size={10} />
                                            {ad.year}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[10px] text-white/60 border border-white/10">
                                        <Globe size={10} />
                                        {ad.category}
                                    </span>
                                    {ad.tags?.slice(0, 2).map((tag, tIdx) => (
                                        <span key={tIdx} className="px-2 py-1 rounded bg-teal-500/10 text-[10px] text-teal-300 border border-teal-500/20">
                                            {tag}
                                        </span>
                                    ))}
                                    {ad.tags && ad.tags.length > 2 && (
                                        <span className="text-[10px] text-text-dim">+{ad.tags.length - 2}</span>
                                    )}
                                </div>

                                {/* View Details Link */}
                                <div className="flex items-center gap-1 text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span>View Details</span>
                                    <ExternalLink size={12} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )
        }))
    ];

    const nextSlide = () => { if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1); };
    const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">Similar Ads</h3>
                    <p className="text-text-dim">Strategic References & Benchmarks</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onRunSearch} disabled={isSearching} className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-500 hover:to-cyan-500 transition-all flex items-center gap-2">
                        {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Target size={18} />}
                        {similarAds.length > 0 ? 'Search Again' : 'Find Ads'}
                    </button>
                </div>
            </div>

            {/* Slideshow Controls */}
            <div className="flex items-center justify-between bg-white/5 rounded-full p-2 border border-white/10 mb-8">
                <button onClick={prevSlide} disabled={currentSlide === 0} className="p-3 rounded-full hover:bg-white/10 text-white disabled:opacity-30 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                    {slides.map((_, idx) => (
                        <div key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1.5 rounded-full transition-all cursor-pointer duration-300 ${currentSlide === idx ? 'w-12 bg-teal-500' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
                    ))}
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 text-sm font-medium text-white/90">
                    <span className="text-teal-400 mr-2">{currentSlide + 1}.</span>{slides[currentSlide].title}
                </div>
                <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="p-3 rounded-full hover:bg-white/10 text-white disabled:opacity-30 transition-all">
                    <ArrowRight size={20} />
                </button>
            </div>

            {/* Slide Content */}
            <div className="min-h-[500px]">
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
        </div>
    );
};





