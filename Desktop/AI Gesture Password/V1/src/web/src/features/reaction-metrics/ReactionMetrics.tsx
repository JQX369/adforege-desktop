import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import type { ReactionOverviewResponse, ReactionJob, ReactionDetailResponse } from '@lib/services/api';
import { ArrowLeft, TrendingUp, Smile, Frown, Meh, Heart, Zap, Play, Pause, Volume2, VolumeX, Loader2, ChevronDown } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageContainer } from '@shared/components/PageContainer';

interface AnalysisResult {
    id: string;
    video_name: string;
    created_at: string;
    avg_engagement: number;
    emotion_summary: Record<string, number>;
    emotion_timeline: Array<{ timestamp: number;[key: string]: number }>;
    audience_engagement?: number;
    ai_effectiveness?: number;
    score_source?: string;
}

type EmotionTimelinePoint = {
    timestamp: number;
    engagement: number;
    emotion?: string;
    [key: string]: number | string | undefined;
};

const EMOTION_SERIES = ['joy', 'surprise', 'neutral', 'calm', 'sadness', 'love'] as const;
const AGGREGATE_REACTION_ID = '__aggregate';
const EMOTION_COLORS: Record<(typeof EMOTION_SERIES)[number], string> = {
    joy: '#22d3ee',
    surprise: '#facc15',
    neutral: '#94a3b8',
    calm: '#34d399',
    sadness: '#60a5fa',
    love: '#fb7185',
};

const formatViewerLabel = (reactionId: string) => `Viewer #${reactionId.slice(-4)}`;
const toTimestamp = (value?: string) => (value ? new Date(value).getTime() : 0);
const formatTimestamp = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const statusChipClass = (status?: string) => {
    if (status === 'completed') return 'bg-green-500/15 text-green-300';
    if (status === 'failed') return 'bg-red-500/15 text-red-300';
    return 'bg-yellow-500/15 text-yellow-200';
};

export const ReactionMetrics: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [reactionOverview, setReactionOverview] = useState<ReactionOverviewResponse>({ jobs: [], reactions: [] });
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [selectedReactionId, setSelectedReactionId] = useState<string>(AGGREGATE_REACTION_ID);
    const [selectedReactionDetail, setSelectedReactionDetail] = useState<ReactionDetailResponse | null>(null);
    const [isViewerDropdownOpen, setIsViewerDropdownOpen] = useState(false);
    const viewerDropdownRef = useRef<HTMLDivElement>(null);
    const [isReactionDetailLoading, setIsReactionDetailLoading] = useState(false);
    const [reactionDetailError, setReactionDetailError] = useState<string | null>(null);
    const [hasInitializedViewer, setHasInitializedViewer] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const pendingJobsRef = useRef(0);
    const [isVideoReady, setIsVideoReady] = useState(true);
    const [playbackJobId, setPlaybackJobId] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const videoUrl = id ? api.getVideoUrl(id) : '';
    const [videoCacheKey, setVideoCacheKey] = useState(() => Date.now());
    const cachedVideoUrl = videoUrl ? `${videoUrl}?v=${videoCacheKey}` : '';
    const fetchAnalysisResult = useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.getResults(id);
            setResult(data);
            setIsVideoReady(data?.playback_ready !== false);
            setPlaybackJobId(data?.playback_job_id ?? null);
            setVideoCacheKey(Date.now());
        } catch (error) {
            console.error("Failed to fetch analysis", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        setLoading(true);
        fetchAnalysisResult();
    }, [fetchAnalysisResult]);

    useEffect(() => {
        if (!id || isVideoReady) {
            return;
        }
        const interval = setInterval(fetchAnalysisResult, 4000);
        return () => clearInterval(interval);
    }, [id, isVideoReady, fetchAnalysisResult]);

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
                if (pending === 0 && pendingJobsRef.current > 0) {
                    fetchAnalysisResult();
                }
                pendingJobsRef.current = pending;
                if (pending > 0 && !pollingTimer) {
                    pollingTimer = setInterval(loadOverview, 4000);
                } else if (pending === 0 && pollingTimer) {
                    clearInterval(pollingTimer);
                    pollingTimer = null;
                }
            } catch (error) {
                if (!active) return;
                console.error("Failed to fetch reaction overview", error);
            }
        };

        loadOverview();

        return () => {
            active = false;
            if (pollingTimer) {
                clearInterval(pollingTimer);
            }
        };
    }, [id, fetchAnalysisResult]);

    const processingJobs = useMemo(
        () => reactionOverview.jobs.filter(job => job.status === 'queued' || job.status === 'processing'),
        [reactionOverview.jobs]
    );

    const reactionsByRecency = useMemo(
        () =>
            [...reactionOverview.reactions].sort((a, b) => {
                const diff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
                return diff !== 0 ? diff : b.id.localeCompare(a.id);
            }),
        [reactionOverview.reactions]
    );

    useEffect(() => {
        if (!reactionsByRecency.length) {
            setSelectedReactionId(AGGREGATE_REACTION_ID);
            setSelectedReactionDetail(null);
            setHasInitializedViewer(false);
            return;
        }
        const newestId = reactionsByRecency[0].id;

        if (!hasInitializedViewer) {
            setSelectedReactionId(newestId);
            setHasInitializedViewer(true);
            return;
        }

        if (selectedReactionId === AGGREGATE_REACTION_ID) {
            return;
        }

        const stillExists = reactionOverview.reactions.some(reaction => reaction.id === selectedReactionId);
        if (!stillExists) {
            setSelectedReactionId(newestId);
        }
    }, [reactionsByRecency, reactionOverview.reactions, selectedReactionId, hasInitializedViewer]);

    useEffect(() => {
        if (selectedReactionId === AGGREGATE_REACTION_ID) {
            setSelectedReactionDetail(null);
            setIsReactionDetailLoading(false);
            setReactionDetailError(null);
            return;
        }
        if (selectedReactionDetail?.job?.reaction_id === selectedReactionId) {
            return;
        }
        let cancelled = false;
        setIsReactionDetailLoading(true);
        setReactionDetailError(null);
        api.getReactionDetail(selectedReactionId)
            .then(detail => {
                if (!cancelled) {
                    setSelectedReactionDetail(detail);
                }
            })
            .catch(error => {
                console.error('Failed to fetch reaction detail', error);
                if (!cancelled) {
                    setReactionDetailError('Failed to load viewer data.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsReactionDetailLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [selectedReactionId, selectedReactionDetail]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewerDropdownRef.current && !viewerDropdownRef.current.contains(event.target as Node)) {
                setIsViewerDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const reactionJobMap = useMemo(() => {
        const map = new Map<string, ReactionJob>();
        reactionOverview.jobs.forEach(job => map.set(job.reaction_id, job));
        return map;
    }, [reactionOverview.jobs]);

    const recentReactions = useMemo(() => {
        if (!reactionsByRecency.length) return [];
        return reactionsByRecency.slice(0, 4).map(reaction => ({
            ...reaction,
            job: reactionJobMap.get(reaction.id),
        }));
    }, [reactionsByRecency, reactionJobMap]);

    const selectedReactionSummary = useMemo(() => {
        if (selectedReactionId === AGGREGATE_REACTION_ID) {
            return null;
        }
        return reactionOverview.reactions.find(reaction => reaction.id === selectedReactionId) || null;
    }, [reactionOverview.reactions, selectedReactionId]);
    const selectedReactionJob =
        selectedReactionId === AGGREGATE_REACTION_ID ? null : reactionJobMap.get(selectedReactionId);

    const baseTimeline = result?.emotion_timeline ?? [];
    const timelineData = useMemo<EmotionTimelinePoint[]>(() => {
        if (selectedReactionDetail?.reaction?.emotion_timeline?.length) {
            return selectedReactionDetail.reaction.emotion_timeline as EmotionTimelinePoint[];
        }
        return baseTimeline as EmotionTimelinePoint[];
    }, [selectedReactionDetail, baseTimeline]);

    const emotionSeriesKeys = useMemo(() => {
        const keys = new Set<(typeof EMOTION_SERIES)[number]>();
        timelineData.forEach(point => {
            EMOTION_SERIES.forEach(emotion => {
                const value = point[emotion];
                if (typeof value === 'number' && value > 0) {
                    keys.add(emotion);
                }
            });
        });
        return keys.size ? Array.from(keys) : ['joy'];
    }, [timelineData]);

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

    const handleVideoError = useCallback(() => {
        console.error('ReactionMetrics: failed to play source video', { analysisId: id, videoUrl: cachedVideoUrl });
        setVideoError('Unable to render this format in-browser. Download it or re-upload an MP4 (H.264) version.');
    }, [id, cachedVideoUrl]);

    const handleVideoLoaded = useCallback(() => {
        setVideoError(null);
    }, []);

    const retryVideoPlayback = useCallback(() => {
        setVideoError(null);
        const element = videoRef.current;
        if (element) {
            element.load();
            element.play().catch((err) => console.warn('ReactionMetrics: retry playback failed', err));
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

    const renderVideoOptimizingCard = () => (
        <GlassCard className="overflow-hidden p-8 flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full border-2 border-white/30 border-t-neon-blue w-12 h-12" />
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white">Optimizing Video for Web Playback</h3>
                <p className="text-text-dim text-sm">
                    Once conversion completes, timelines and synced playback will unlock automatically.
                </p>
                {playbackJobId && <p className="text-xs text-text-dim/80">Job ID: {playbackJobId}</p>}
            </div>
            <button
                onClick={fetchAnalysisResult}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
            >
                Refresh Status
            </button>
        </GlassCard>
    );

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleChartClick = (data: any) => {
        // Recharts click event provides activePayload array with data points
        const timestamp = data?.activePayload?.[0]?.payload?.timestamp;
        if (typeof timestamp === 'number' && videoRef.current) {
            videoRef.current.currentTime = timestamp;
            setCurrentTime(timestamp);
        }
    };

    if (loading) return <PageContainer><div className="text-white text-center mt-20">Loading metrics...</div></PageContainer>;
    if (!result) return <PageContainer><div className="text-white text-center mt-20">Analysis not found</div></PageContainer>;

    const audiencePercent = Math.round((result.audience_engagement ?? result.avg_engagement ?? 0) * 100);
    const aiPercent = typeof result.ai_effectiveness === 'number' ? Math.round(result.ai_effectiveness) : null;
    const combinedEngagementPercent =
        aiPercent !== null ? Math.round(aiPercent * 0.7 + audiencePercent * 0.3) : audiencePercent;
    const scoreSourceLabel = (() => {
        const source = result.score_source;
        if (source === 'blended') return 'AI + Audience blend (70/30)';
        if (source === 'ai_only') return 'AI effectiveness only';
        if (source === 'audience_only') return 'Audience reactions only';
        return aiPercent !== null ? 'AI + Audience blend' : 'Audience reactions';
    })();
    const hasReactionData = timelineData.length > 0;

    return (
        <PageContainer>
            <div className="space-y-6 pb-10">
                {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate(`/project/${id}`)}
                    className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-bold text-white">Reaction Metrics</h2>
                    <p className="text-text-dim">{result.video_name}</p>
                </div>
            </header>

            {processingJobs.length > 0 && hasReactionData && (
                <GlassCard className="flex items-center gap-4 border border-yellow-500/20 bg-yellow-500/5 text-white">
                    <Loader2 size={24} className="animate-spin text-yellow-200" />
                    <div>
                        <p className="font-semibold">
                            Processing {processingJobs.length} reaction{processingJobs.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-yellow-100/80">
                            Metrics will refresh automatically when the analysis completes.
                        </p>
                    </div>
                </GlassCard>
            )}

            {!hasReactionData ? (
                processingJobs.length > 0 ? (
                    <GlassCard className="text-center py-12">
                        <div className="text-yellow-300 mb-4">
                            <Loader2 size={48} className="mx-auto animate-spin" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing Viewer Reaction</h3>
                        <p className="text-text-dim mb-6">
                            {processingJobs.length === 1
                                ? 'We are processing the latest recording. Metrics will update automatically when the analysis completes.'
                                : `Processing ${processingJobs.length} reactions in the background. This page will refresh automatically.`}
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <button
                                onClick={() => navigate(`/record-reaction/${id}`)}
                                className="px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                Record Another Reaction
                            </button>
                            <button
                                onClick={() => navigate(`/project/${id}`)}
                                className="px-6 py-3 rounded-lg border border-white/10 text-text-dim hover:text-white transition-colors"
                            >
                                Back to Project
                            </button>
                        </div>
                    </GlassCard>
                ) : (
                    <GlassCard className="text-center py-12">
                        <div className="text-neon-blue mb-4">
                            <Zap size={64} className="mx-auto" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Reaction Data Yet</h3>
                        <p className="text-text-dim mb-6">Record a reaction to see detailed emotion metrics and engagement patterns</p>
                        <button
                            onClick={() => navigate(`/record-reaction/${id}`)}
                            className="px-6 py-3 rounded-lg bg-neon-blue text-white font-medium hover:bg-neon-blue/80 transition-colors"
                        >
                            Record Reaction Now
                        </button>
                    </GlassCard>
                )
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Video & Timeline */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Video Player */}
                        {isVideoReady ? (
                            <GlassCard className="overflow-hidden p-0 relative group">
                                <div className="aspect-video bg-black relative">
                                    <video
                                        ref={videoRef}
                                        src={cachedVideoUrl}
                                        className="w-full h-full object-contain"
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onError={handleVideoError}
                                        onLoadedData={handleVideoLoaded}
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
                                            <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = e.clientX - rect.left;
                                                const percent = x / rect.width;
                                                if (videoRef.current) {
                                                    videoRef.current.currentTime = percent * duration;
                                                }
                                            }}>
                                                <div
                                                    className="h-full bg-neon-blue rounded-full relative"
                                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                                >
                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-white font-mono">
                                                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} /
                                                {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                                            </span>
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

                        {/* Synced Emotion Timeline */}
                        <GlassCard>
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Emotion Timeline</h3>
                                    <p className="text-text-dim text-sm">
                                        {selectedReactionId === AGGREGATE_REACTION_ID
                                            ? 'Aggregated audience sentiment across all reactions'
                                            : `${formatViewerLabel(selectedReactionId)} • ${selectedReactionSummary?.dominant_emotion || 'processing'}`}
                                    </p>
                                </div>
                                {reactionsByRecency.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-text-dim">
                                            Viewer
                                        </label>
                                        <div ref={viewerDropdownRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsViewerDropdownOpen(!isViewerDropdownOpen)}
                                                className="flex items-center gap-2 bg-neon-blue/20 border border-neon-blue/40 rounded-lg px-3 py-2 text-sm text-white hover:bg-neon-blue/30 focus:outline-none focus:border-neon-blue transition-colors min-w-[140px]"
                                            >
                                                <span className="flex-1 text-left">
                                                    {selectedReactionId === AGGREGATE_REACTION_ID
                                                        ? 'All viewers'
                                                        : formatViewerLabel(selectedReactionId)}
                                                </span>
                                                <ChevronDown
                                                    size={16}
                                                    className={`transition-transform ${isViewerDropdownOpen ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                            {isViewerDropdownOpen && (
                                                <div className="absolute right-0 mt-1 w-full min-w-[160px] bg-slate-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedReactionDetail(null);
                                                            setSelectedReactionId(AGGREGATE_REACTION_ID);
                                                            setIsViewerDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                                                            selectedReactionId === AGGREGATE_REACTION_ID
                                                                ? 'bg-neon-blue/30 text-white'
                                                                : 'text-white/90 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        All viewers
                                                    </button>
                                                    {reactionsByRecency.map(reaction => (
                                                        <button
                                                            key={reaction.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedReactionDetail(null);
                                                                setSelectedReactionId(reaction.id);
                                                                setIsViewerDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                                                                selectedReactionId === reaction.id
                                                                    ? 'bg-neon-blue/30 text-white'
                                                                    : 'text-white/90 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            {formatViewerLabel(reaction.id)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-[#38BDF8]" />
                                    <span className="text-text-dim">Engagement</span>
                                </div>
                                {emotionSeriesKeys.map(key => (
                                    <div key={key} className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: EMOTION_COLORS[key as keyof typeof EMOTION_COLORS] }}
                                        />
                                        <span className="text-text-dim capitalize">{key}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                        data={timelineData}
                                        onClick={handleChartClick}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                        <XAxis
                                            dataKey="timestamp"
                                            stroke="#94A3B8"
                                            tickFormatter={(val) => formatTimestamp(Number(val))}
                                            fontSize={12}
                                        />
                                        <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 1]} tickFormatter={(val) => `${Math.round(val * 100)}%`} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px'
                                            }}
                                            cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}
                                            formatter={(value: any, name) => {
                                                if (typeof value !== 'number') return value;
                                                return [`${Math.round(value * 100)}%`, name === 'engagement' ? 'Engagement' : String(name).replace('_', ' ')];
                                            }}
                                            labelFormatter={(label) => formatTimestamp(Number(label))}
                                        />
                                        <ReferenceLine x={currentTime} stroke="#fff" strokeDasharray="3 3" />
                                        <Area
                                            type="monotone"
                                            dataKey="engagement"
                                            stroke="#38BDF8"
                                            strokeWidth={2}
                                            fillOpacity={0.2}
                                            fill="#38BDF833"
                                            name="Engagement"
                                            animationDuration={300}
                                        />
                                        {emotionSeriesKeys.map(key => (
                                            <Line
                                                key={key}
                                                type="monotone"
                                                dataKey={key}
                                                stroke={EMOTION_COLORS[key as keyof typeof EMOTION_COLORS]}
                                                strokeWidth={2}
                                                dot={false}
                                                name={key.charAt(0).toUpperCase() + key.slice(1)}
                                                animationDuration={300}
                                            />
                                        ))}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            {isReactionDetailLoading && selectedReactionId !== AGGREGATE_REACTION_ID && (
                                <div className="text-xs text-text-dim flex items-center gap-2 mt-3">
                                    <Loader2 size={14} className="animate-spin" />
                                    Loading viewer data...
                                </div>
                            )}
                            {reactionDetailError && (
                                <p className="text-xs text-red-400 mt-3">{reactionDetailError}</p>
                            )}
                            {selectedReactionSummary && (
                                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-dim">
                                    <span>
                                        Dominant emotion{' '}
                                        <span className="text-white capitalize">
                                            {selectedReactionSummary.dominant_emotion || 'neutral'}
                                        </span>
                                    </span>
                                    <span>
                                        Engagement{' '}
                                        <span className="text-white">
                                            {Math.round((selectedReactionSummary.engagement_score || 0) * 100)}%
                                        </span>
                                    </span>
                                    {selectedReactionJob && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusChipClass(selectedReactionJob.status)}`}>
                                            {selectedReactionJob.status}
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className="text-center text-text-dim text-sm mt-4">Click on the chart to jump to that moment in the video</p>
                        </GlassCard>
                    </div>

                    {/* Right Column: Stats & Breakdown */}
                    <div className="space-y-6">
                        {/* Engagement Card */}
                        <GlassCard className="relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp size={96} />
                            </div>
                            <div className="flex items-start justify-between gap-6">
                                <div>
                                    <h3 className="text-lg font-bold text-text-dim mb-1">Engagement Score</h3>
                                    <p className="text-text-dim text-sm">{scoreSourceLabel}</p>
                                    <div className="flex flex-wrap gap-2 mt-4 text-xs text-text-dim">
                                        <span className="px-3 py-1 rounded-full bg-white/5">
                                            Audience {audiencePercent}%
                                        </span>
                                        {aiPercent !== null && (
                                            <span className="px-3 py-1 rounded-full bg-white/5">
                                                AI {aiPercent}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="relative w-24 h-24 shrink-0">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="42"
                                            stroke="#38BDF8"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={264}
                                            strokeDashoffset={264 - (264 * combinedEngagementPercent) / 100}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold text-white">{combinedEngagementPercent}%</span>
                                        <span className="text-[10px] uppercase tracking-wide text-text-dim">Overall</span>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Emotion Summary */}
                        <GlassCard>
                            <h3 className="text-xl font-bold text-white mb-6">Emotion Breakdown</h3>
                            <div className="space-y-4">
                                {Object.entries(result.emotion_summary).sort(([, a], [, b]) => b - a).map(([emotion, value]) => {
                                    const icons = {
                                        joy: Smile,
                                        surprise: Zap,
                                        neutral: Meh,
                                        sadness: Frown,
                                        love: Heart
                                    };
                                    const Icon = icons[emotion as keyof typeof icons] || Meh;
                                    const colors = {
                                        joy: 'text-green-400 bg-green-400/20',
                                        surprise: 'text-yellow-400 bg-yellow-400/20',
                                        neutral: 'text-gray-400 bg-gray-400/20',
                                        sadness: 'text-blue-400 bg-blue-400/20',
                                        love: 'text-pink-400 bg-pink-400/20'
                                    };
                                    const colorClass = colors[emotion as keyof typeof colors] || 'text-purple-400 bg-purple-400/20';

                                    return (
                                        <div key={emotion} className="group">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${colorClass}`}>
                                                        <Icon size={18} />
                                                    </div>
                                                    <span className="text-white capitalize font-medium">{emotion}</span>
                                                </div>
                                                <span className="text-white font-bold">{value.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${colorClass.split(' ')[0].replace('text-', 'bg-')}`}
                                                    style={{ width: `${value}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>

                        {/* Detailed Metrics Table */}
                        <GlassCard>
                            <h3 className="text-xl font-bold text-white mb-4">Detailed Metrics</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-2 text-text-dim font-medium">Metric</th>
                                            <th className="text-right py-2 text-text-dim font-medium">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 text-white">Attention Span</td>
                                            <td className="py-3 text-right text-white">8.5/10</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 text-white">Emotional Peak</td>
                                            <td className="py-3 text-right text-white">0:45</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 text-white">Dominant Emotion</td>
                                            <td className="py-3 text-right text-white capitalize">
                                                {Object.entries(result.emotion_summary).sort(([, a], [, b]) => b - a)[0][0]}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>

                        {recentReactions.length > 0 && (
                            <GlassCard>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-white">Recent Reactions</h3>
                                    <span className="text-xs text-text-dim">{reactionOverview.reactions.length} total</span>
                                </div>
                                <div className="space-y-4">
                                    {recentReactions.map(reaction => {
                                        const job = reaction.job;
                                        const status = job?.status || 'completed';
                                        const engagementPercent = Math.round((reaction.engagement_score || 0) * 100);
                                        return (
                                            <div key={reaction.id} className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-semibold">Viewer #{reaction.id.slice(-4)}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusChipClass(status)}`}>{status}</span>
                                                    </div>
                                                    <p className="text-text-dim text-sm">
                                                        Dominant emotion{' '}
                                                        <span className="capitalize">{reaction.dominant_emotion || 'neutral'}</span> • Engagement{' '}
                                                        {engagementPercent}%
                                                    </p>
                                                </div>
                                                <span className="text-xs text-text-dim whitespace-nowrap">
                                                    {job?.finished_at
                                                        ? new Date(job.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : job?.created_at
                                                            ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                            : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        )}
                    </div>
                </div>
            )}
        </div>
        </PageContainer>
    );
};
