import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api } from '@lib/services/api';
import type { ReactionJob, ReactionSummary, QueueJobStatus } from '@lib/services/api';
import { ArrowLeft, Circle, Square, AlertCircle, Maximize, Minimize, Share2 } from 'lucide-react';
import { JobStatus, queueJobToStatus } from '@shared/components/JobStatus';
import { useToast } from '@shared/components/Toast';
import { PageContainer } from '@shared/components/PageContainer';
import { useWebcam } from './useWebcam';
import { waitForAdPlayback, WaitForAdPlaybackError } from './waitForAdPlayback';
import type { RecorderPhase } from './recorderUiState';
import {
    getAdOverlayMessage,
    getStartButtonLabel,
    isStartButtonDisabled,
    shouldShowAdOverlay,
} from './recorderUiState';

export const ReactionRecorder: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [videoName, setVideoName] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const webcamRef = useRef<HTMLVideoElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [reactionJob, setReactionJob] = useState<ReactionJob | null>(null);
    const [recentReaction, setRecentReaction] = useState<ReactionSummary | null>(null);
    const [shareNoticeVisible, setShareNoticeVisible] = useState(false);
    const [previewMessage, setPreviewMessage] = useState<string | null>(null);
    const [previewRequested, setPreviewRequested] = useState(false);
    const [queueJobId, setQueueJobId] = useState<string | null>(null);
    const [queueJob, setQueueJob] = useState<QueueJobStatus | null>(null);
    const lastQueueStatusRef = useRef<string | null>(null);
    // Start with false to show "Optimizing" until we confirm playback is ready
    const [videoReady, setVideoReady] = useState(false);
    const [playbackJobId, setPlaybackJobId] = useState<string | null>(null);
    const [isPreparingRecording, setIsPreparingRecording] = useState(false);
    const [preparationError, setPreparationError] = useState<string | null>(null);
    const [adReadyState, setAdReadyState] = useState(() => videoRef.current?.readyState ?? 0);
    const [recorderPhase, setRecorderPhase] = useState<RecorderPhase>('idle');
    const fullscreenFallbackRef = useRef<number | null>(null);
    const reactionPollFailuresRef = useRef(0);
    const {
        previewStatus,
        recordingStatus,
        error: webcamError,
        autoplayBlocked,
        startPreview,
        startRecording,
        stopPreview,
        stopRecording,
        stopAll,
        resumePreviewPlayback,
        getRecordingStream,
    } = useWebcam(webcamRef);

    // Re-attach recording stream to webcam video element when switching to cinema mode
    // This is needed because the video element changes when isRecording becomes true
    const isRecording = recordingStatus === 'recording';
    useEffect(() => {
        if (isRecording && webcamRef.current) {
            const stream = getRecordingStream();
            if (stream && webcamRef.current.srcObject !== stream) {
                webcamRef.current.srcObject = stream;
                webcamRef.current.play().catch(err => {
                    console.warn('[ReactionRecorder] Failed to play webcam in cinema mode:', err);
                });
            }
        }
    }, [isRecording, getRecordingStream]);
    const logRecorderEvent = useCallback(
        (event: string, data: Record<string, unknown> = {}) => {
            if (typeof window === 'undefined' || !import.meta.env.DEV) {
                return;
            }
            const payload = {
                analysisId: id,
                readyState: videoRef.current?.readyState ?? null,
                previewStatus,
                recordingStatus,
                ...data,
            };
            console.info(`[ReactionRecorder] ${event}`, payload);
        },
        [id, previewStatus, recordingStatus]
    );
    const videoUrl = id ? api.getVideoUrl(id) : '';
    const [adVideoError, setAdVideoError] = useState<string | null>(null);
    const [videoCacheKey, setVideoCacheKey] = useState(() => Date.now());
    const cachedVideoUrl = videoUrl ? `${videoUrl}?v=${videoCacheKey}` : '';
    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const pipSupported = Boolean((document as any).pictureInPictureEnabled);
        logRecorderEvent('environment', {
            fullscreenEnabled: document.fullscreenEnabled,
            pictureInPictureEnabled: pipSupported,
            mediaRecorderSupported: typeof window.MediaRecorder !== 'undefined',
        });
    }, [logRecorderEvent]);
    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        (window as any).debugRecorder = {
            get video() {
                return videoRef.current;
            },
            get webcam() {
                return webcamRef.current;
            },
            get mediaRecorder() {
                return mediaRecorderRef.current;
            },
        };
        return () => {
            if ((window as any).debugRecorder) {
                delete (window as any).debugRecorder;
            }
            if (fullscreenFallbackRef.current) {
                window.clearTimeout(fullscreenFallbackRef.current);
                fullscreenFallbackRef.current = null;
            }
        };
    }, []);
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) {
            return;
        }
        const trackedEvents: Array<keyof HTMLMediaElementEventMap> = [
            'loadeddata',
            'canplay',
            'canplaythrough',
            'waiting',
            'stalled',
            'suspend',
        ];
        const handleReadyState = (event: Event) => {
            setAdReadyState(videoElement.readyState);
            logRecorderEventRef.current?.(`adVideo.${event.type}`, {
                readyState: videoElement.readyState,
                recordingStatus,
            });
        };
        trackedEvents.forEach((evt) => videoElement.addEventListener(evt, handleReadyState));
        setAdReadyState(videoElement.readyState);
        return () => {
            trackedEvents.forEach((evt) => videoElement.removeEventListener(evt, handleReadyState));
        };
    }, [videoRef, recordingStatus]);
    const waitForFullscreen = useCallback(
        async (target: Element | null, timeoutMs = 1500) => {
            if (!target) {
                return;
            }
            if (document.fullscreenElement === target) {
                return;
            }
            await new Promise<void>((resolve, reject) => {
                const cleanup = () => {
                    document.removeEventListener('fullscreenchange', handleChange);
                    document.removeEventListener('fullscreenerror', handleError);
                    window.clearTimeout(timeoutId);
                };
                const handleChange = () => {
                    if (document.fullscreenElement === target) {
                        cleanup();
                        resolve();
                    }
                };
                const handleError = () => {
                    cleanup();
                    reject(new Error('Fullscreen request failed'));
                };
                const timeoutId = window.setTimeout(() => {
                    cleanup();
                    reject(new Error('Fullscreen request timed out'));
                }, timeoutMs);
                document.addEventListener('fullscreenchange', handleChange);
                document.addEventListener('fullscreenerror', handleError);
            });
        },
        []
    );
    const logRecorderEventRef = useRef(logRecorderEvent);
    useEffect(() => {
        logRecorderEventRef.current = logRecorderEvent;
    }, [logRecorderEvent]);

    const handleAdVideoError = useCallback(() => {
        console.error('ReactionRecorder: failed to play advertisement video', { analysisId: id, videoUrl: cachedVideoUrl });
        setAdVideoError(
            'We could not play this source file in your browser. Please download it or re-upload an MP4 (H.264) version.'
        );
    }, [id, cachedVideoUrl]);

    const handleAdVideoLoaded = useCallback(() => {
        setAdVideoError(null);
        setAdReadyState(videoRef.current?.readyState ?? 0);
        logRecorderEventRef.current?.('adVideo.loadeddata', {
            readyState: videoRef.current?.readyState ?? null,
        });
    }, []);
    const handleAdCanPlay = useCallback(() => {
        setAdVideoError(null);
        setAdReadyState(videoRef.current?.readyState ?? 0);
        logRecorderEventRef.current?.('adVideo.canplay', {
            readyState: videoRef.current?.readyState ?? null,
        });
    }, []);

    const retryAdPlayback = useCallback(() => {
        setAdVideoError(null);
        const videoElement = videoRef.current;
        if (videoElement) {
            videoElement.load();
            videoElement.play().catch((err) => {
                console.warn('Retrying ad playback failed', err);
            });
        }
    }, []);

    const renderAdVideoErrorOverlay = () => {
        if (!adVideoError) {
            return null;
        }
        return (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
                <p className="text-sm text-red-200">{adVideoError}</p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <button
                        onClick={retryAdPlayback}
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

    const renderAdOptimizingCard = () => (
        <GlassCard className="overflow-hidden p-8 flex flex-col items-center justify-center gap-4 h-full">
            <div className="animate-spin rounded-full border-2 border-white/30 border-t-neon-blue w-12 h-12" />
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white">Preparing Advertisement</h3>
                <p className="text-text-dim text-sm">
                    We are converting this upload into a streaming-friendly MP4 before recording reactions.
                </p>
                {playbackJobId && <p className="text-xs text-text-dim/80">Job ID: {playbackJobId}</p>}
            </div>
            <button
                onClick={() => id && api.getResults(id).then(data => {
                    setVideoName(data.video_name);
                    setVideoReady(data?.playback_ready === true);
                    setPlaybackJobId(data?.playback_job_id ?? null);
                    setVideoCacheKey(Date.now());
                }).catch(err => console.error('Failed to refresh playback status', err))}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
            >
                Refresh Status
            </button>
        </GlassCard>
    );
    const renderAdLoadingOverlay = (options?: { hideWhileRecording?: boolean }) => {
        if (adVideoError) {
            return null;
        }
        const hideWhileRecording = options?.hideWhileRecording ?? false;
        const shouldShow = shouldShowAdOverlay({
            adReadyState,
            isRecording,
            isPreparingRecording,
            hideWhileRecording,
            phase: recorderPhase,
        });
        if (!shouldShow) {
            return null;
        }
        const message = getAdOverlayMessage({
            isPreparingRecording,
            phase: recorderPhase,
        });
        return (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-white text-center px-6">
                <div className="animate-spin rounded-full border-2 border-white/40 border-t-neon-blue w-10 h-10" />
                <p className="text-sm font-semibold">{message}</p>
                <p className="text-xs text-white/70">readyState {adReadyState}/4</p>
            </div>
        );
    };
    const cameraError = webcamError;
    const previewReady = previewStatus === 'live';
    const showPreviewCTA = !isRecording && !previewReady;
    const previewButtonLabel =
        previewStatus === 'starting'
            ? 'Enabling camera…'
            : previewRequested
                ? 'Retry preview'
                : 'Enable camera preview';
    const previewOverlayMessage =
        previewMessage || cameraError || 'Enable your camera preview so you can line up your shot before recording.';
    const startButtonLabel = getStartButtonLabel(recorderPhase);
    const startButtonDisabled = isStartButtonDisabled({
        phase: recorderPhase,
        isPreparingRecording,
        videoReady,
    });

    const requestPreview = useCallback(async () => {
        setPreviewMessage(null);
        try {
            await startPreview();
        } catch (err) {
            setPreviewMessage('Unable to access your webcam. Please allow camera access and try again.');
            throw err;
        }
    }, [startPreview]);

    const handleEnablePreview = useCallback(async () => {
        setPreviewRequested(true);
        try {
            await requestPreview();
        } catch {
            // message already set
        }
    }, [requestPreview]);

    useEffect(() => {
        const fetchProject = async () => {
            if (!id) return;
            try {
                const data = await api.getResults(id);
                setVideoName(data.video_name);
                // Only set videoReady=true if playback_ready is explicitly true
                // null/undefined means still processing, false means failed
                setVideoReady(data?.playback_ready === true);
                setPlaybackJobId(data?.playback_job_id ?? null);
                setVideoCacheKey(Date.now());
            } catch (error) {
                console.error("Failed to fetch project", error);
            }
        };
        fetchProject();
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            stopAll();
        };
    }, [id, stopAll]);

    useEffect(() => {
        if (!id || videoReady) {
            return;
        }
        const interval = setInterval(async () => {
            try {
                const data = await api.getResults(id);
                setVideoName(data.video_name);
                // Only set videoReady=true if playback_ready is explicitly true
                setVideoReady(data?.playback_ready === true);
                setPlaybackJobId(data?.playback_job_id ?? null);
                setVideoCacheKey(Date.now());
            } catch (error) {
                console.error("Failed to refresh playback readiness", error);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [id, videoReady]);

    useEffect(() => {
        let cancelled = false;
        if (navigator.permissions?.query) {
            navigator.permissions
                .query({ name: 'camera' as PermissionName })
                .then(result => {
                    if (cancelled) return;
                    if (result.state === 'granted') {
                        requestPreview().catch(() => {});
                    }
                    result.onchange = () => {
                        if (cancelled) return;
                        if (result.state === 'granted') {
                            requestPreview().catch(() => {});
                        }
                    };
                })
                .catch(() => {
                    // ignore permission query failures
                });
        }
        return () => {
            cancelled = true;
        };
    }, [requestPreview]);

    const handleStartRecording = async () => {
        if (!videoRef.current) {
            showToast('Advertisement video is still loading. Please wait and try again.', { type: 'error' });
            return;
        }

        setRecordedBlob(null);
        setUploadState('idle');
        setUploadError(null);
        setReactionJob(null);
        setRecentReaction(null);
        setPreparationError(null);

        logRecorderEvent('startRecordingClicked', {
            previewReady,
            adReadyState,
            fullscreenActive: Boolean(document.fullscreenElement),
        });

        setRecorderPhase('preparing');
        setIsPreparingRecording(true);
        let handshakeComplete = false;
        try {
            await waitForAdPlayback(videoRef.current, {
                timeoutMs: 6000,
                onStateChange: (state) => logRecorderEvent(`waitForAdPlayback:${state.phase}`, state),
            });
            handshakeComplete = true;
        } catch (error) {
            const isWaitError = error instanceof WaitForAdPlaybackError;
            const message =
                isWaitError && error.code === 'timeout'
                    ? 'The advertisement is still buffering. Please try again in a few seconds.'
                    : 'Unable to prepare the advertisement for fullscreen playback.';
            setPreparationError(message);
            logRecorderEvent('waitForAdPlayback:error', {
                message: error instanceof Error ? error.message : error,
                code: isWaitError ? error.code : undefined,
            });
            showToast(message, { type: 'error' });
        } finally {
            setIsPreparingRecording(false);
        }

        if (!handshakeComplete) {
            setRecorderPhase('idle');
            return;
        }

        logRecorderEvent('waitForAdPlayback:complete', {
            readyState: videoRef.current?.readyState ?? null,
        });

        setRecorderPhase('arming');

        try {
            const stream = await startRecording();

            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                setRecordedBlob(blob);
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(console.warn);
                }
                setRecorderPhase((phase) => (phase === 'stopping' ? phase : 'idle'));
            };

            mediaRecorderRef.current.start();
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

            setRecorderPhase('entering-fullscreen');
            if (fullscreenFallbackRef.current) {
                window.clearTimeout(fullscreenFallbackRef.current);
            }
            fullscreenFallbackRef.current = window.setTimeout(() => {
                setRecorderPhase((phase) => (phase === 'entering-fullscreen' ? 'recording' : phase));
                fullscreenFallbackRef.current = null;
            }, 2000);

            const fullscreenTarget = containerRef.current ?? document.documentElement;
            try {
                const targetName = fullscreenTarget === document.documentElement ? 'document' : 'recorder-container';
                logRecorderEvent('fullscreen.request', { target: targetName });
                await document.documentElement.requestFullscreen();
                await waitForFullscreen(document.documentElement);
                logRecorderEvent('fullscreen.entered', { success: true, target: targetName });
            } catch (err) {
                console.warn('Could not enter fullscreen:', err);
                logRecorderEvent('fullscreen.entered', {
                    success: false,
                    error: err instanceof Error ? err.message : err,
                });
            }

            await new Promise((resolve) => setTimeout(resolve, 150));

            const playPromises: Promise<unknown>[] = [];
            if (videoRef.current) {
                playPromises.push(
                    videoRef.current
                        .play()
                        .then(() => logRecorderEvent('adVideo.playAfterFullscreen', { success: true }))
                        .catch((err) => {
                            console.warn('Ad video play failed:', err);
                            logRecorderEvent('adVideo.playAfterFullscreen', {
                                success: false,
                                error: err instanceof Error ? err.message : err,
                            });
                        })
                );
            }

            if (webcamRef.current) {
                playPromises.push(
                    webcamRef.current
                        .play()
                        .then(() => logRecorderEvent('webcam.playAfterFullscreen', { success: true }))
                        .catch((err) => {
                            console.warn('Webcam PIP play failed:', err);
                            logRecorderEvent('webcam.playAfterFullscreen', {
                                success: false,
                                error: err instanceof Error ? err.message : err,
                            });
                        })
                );
            }

            if (playPromises.length > 0) {
                await Promise.allSettled(playPromises);
            }

            setRecorderPhase('recording');
            if (fullscreenFallbackRef.current) {
                window.clearTimeout(fullscreenFallbackRef.current);
                fullscreenFallbackRef.current = null;
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            showToast(
                error instanceof Error ? error.message : 'Failed to start recording. Please check camera permissions.',
                { type: 'error' }
            );
            logRecorderEvent('startRecordingFailed', {
                message: error instanceof Error ? error.message : error,
            });
            setRecorderPhase('idle');
            if (fullscreenFallbackRef.current) {
                window.clearTimeout(fullscreenFallbackRef.current);
                fullscreenFallbackRef.current = null;
            }
        }
    };

    const handleStopRecording = () => {
        if (!mediaRecorderRef.current || !isRecording) {
            return;
        }

        setRecorderPhase('stopping');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        stopRecording();

        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }

        requestPreview()
            .catch(() => {})
            .finally(() => setRecorderPhase('idle'));
    };

    const handleSaveReaction = async () => {
        if (!recordedBlob || !id) return;
        setUploadState('uploading');
        setUploadError(null);
        try {
            const response = await api.uploadReaction(id, recordedBlob);
            setReactionJob(response.job);
            setRecentReaction(null);
            setUploadState('success');
            if (response.queue_job_id) {
                setQueueJobId(response.queue_job_id);
            } else {
                setQueueJobId(null);
            }
            setQueueJob(null);
            showToast('Reaction uploaded. Processing will start shortly.', { type: 'info' });
            if (response.job.status === 'processing_fallback') {
                showToast('Processing inline because the worker is restarting. This may take a bit longer.', {
                    type: 'info',
                });
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/34da6422-fe7c-4d92-bc38-e043d71f5efc',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'pre-fix',
                    hypothesisId:'H2',
                    location:'ReactionRecorder.tsx:175',
                    message:'uploadReaction success',
                    data:{queueJobId:response.queue_job_id ?? null, reactionStatus:response.job.status},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
        } catch (error: any) {
            console.error('Failed to upload reaction', error);
            setUploadState('error');
            const message = error?.response?.data?.detail ?? 'Failed to upload reaction. Please try again.';
            setUploadError(typeof message === 'string' ? message : 'Failed to upload reaction. Please try again.');
        }
    };

    const handleResetRecording = () => {
        setRecordedBlob(null);
        setReactionJob(null);
        setRecentReaction(null);
        setUploadState('idle');
        setUploadError(null);
        setQueueJobId(null);
        setQueueJob(null);
        stopRecording();
        stopPreview();
        requestPreview().catch(() => {});
        setRecorderPhase('idle');
    };

    useEffect(() => {
        if (!reactionJob) return;
        if (reactionJob.status === 'completed' || reactionJob.status === 'failed') {
            if (reactionJob.status === 'failed') {
                setUploadState('error');
                setUploadError(reactionJob.error || 'Reaction analysis failed. Please try again.');
            }
            return;
        }

        let cancelled = false;

        const poll = async () => {
            try {
                const detail = await api.getReactionDetail(reactionJob.reaction_id);
                if (cancelled) return;
                reactionPollFailuresRef.current = 0;
                setReactionJob(detail.job);
                setRecentReaction(detail.reaction || null);
                if (detail.job.status === 'failed') {
                    setUploadState('error');
                    setUploadError(detail.job.error || 'Reaction analysis failed. Please try again.');
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/34da6422-fe7c-4d92-bc38-e043d71f5efc',{
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({
                            sessionId:'debug-session',
                            runId:'pre-fix',
                            hypothesisId:'H3',
                            location:'ReactionRecorder.tsx:265',
                            message:'reaction job failed during polling',
                            data:{reactionId:detail.job.reaction_id,pageJobStatus:detail.job.status},
                            timestamp:Date.now()
                        })
                    }).catch(()=>{});
                    // #endregion
                }
            } catch (error) {
                if (!cancelled) {
                    reactionPollFailuresRef.current += 1;
                    if (reactionPollFailuresRef.current === 3) {
                        showToast('Reaction status is still pending. Please keep the tab open while we retry.', {
                            type: 'warning',
                        });
                    } else if (reactionPollFailuresRef.current % 6 === 0) {
                        showToast('Still waiting for the backend to respond. Check API logs if this continues.', {
                            type: 'error',
                        });
                    }
                    console.error("Failed to poll reaction job", error);
                }
            }
        };

        poll();
        const interval = setInterval(poll, 4000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [reactionJob?.reaction_id, reactionJob?.status]);

    useEffect(() => {
        if (!queueJobId) return;
        let cancelled = false;
        const poll = async () => {
            try {
                const job = await api.getQueueJobStatus(queueJobId);
                if (cancelled) return;
                setQueueJob(job);
                const prevStatus = lastQueueStatusRef.current;
                if (job.status !== prevStatus) {
                    lastQueueStatusRef.current = job.status;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/34da6422-fe7c-4d92-bc38-e043d71f5efc',{
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({
                            sessionId:'debug-session',
                            runId:'pre-fix',
                            hypothesisId:'H2',
                            location:'ReactionRecorder.tsx:296',
                            message:'queue job status change',
                            data:{queueJobId:job.job_id,status:job.status},
                            timestamp:Date.now()
                        })
                    }).catch(()=>{});
                    // #endregion
                    if (job.status === 'completed') {
                        showToast('Reaction processed successfully.', { type: 'success' });
                    } else if (job.status === 'failed') {
                        setUploadState('error');
                        setUploadError(job.error_user_message || job.error || 'Reaction analysis failed.');
                        showToast(job.error_user_message || 'Reaction analysis failed.', { type: 'error' });
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    if ((error as Error).message === 'queue-job-not-found') {
                        setQueueJobId(null);
                        setQueueJob(null);
                        return;
                    }
                    console.error('Failed to poll queue job', error);
                }
            }
        };
        poll();
        const interval = setInterval(poll, 4000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [queueJobId, showToast]);

    const handleRetryQueueJob = useCallback(async () => {
        if (!queueJob) return;
        try {
            const retried = await api.retryQueueJob(queueJob.job_id);
            setQueueJobId(retried.job_id);
            setQueueJob(retried);
            showToast('Retry scheduled.', { type: 'info' });
        } catch (error) {
            console.error('Failed to retry reaction job', error);
            showToast('Retry failed. Please try again.', { type: 'error' });
        }
    }, [queueJob, showToast]);

    const reactionJobToStatus = (job: ReactionJob): Parameters<typeof JobStatus>[0]['job'] => ({
        status: job.status,
        queue_job_id: job.queue_job_id || undefined,
        error: job.error || undefined,
        error_user_message: job.error_user_message || undefined,
        label: 'Reaction Processing',
    });

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!isFullscreen) {
                await containerRef.current.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen failed", error);
        }
    };

    return (
        <PageContainer>
            <div ref={containerRef} className={`space-y-8 ${isFullscreen ? 'bg-dark-bg p-8 h-screen overflow-auto' : ''}`}>
                <header className="flex items-center gap-4 flex-wrap">
                <button
                    onClick={() => navigate(`/project/${id}`)}
                    className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white">Record Reaction</h2>
                    <p className="text-text-dim">{videoName}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Placeholder for future public invite flow */}
                    <button
                        onClick={() => setShareNoticeVisible(true)}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-2 text-sm"
                        title="Create a public reaction link (coming soon)"
                    >
                        <Share2 size={18} />
                        Share Recording Link
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg hover:bg-white/10 text-white hover:text-neon-blue transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                </div>
            </header>
            {shareNoticeVisible && (
                <div className="mt-2 text-xs text-neon-blue/80">
                    A shareable reaction URL will live here soon—this button will generate invite links tied to the current project.
                </div>
            )}

            {isRecording ? (
                videoReady ? (
                    // Cinema Mode Layout
                    <div className="fixed inset-0 z-50 bg-black flex flex-col">
                        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                            {/* Main Video */}
                            <video
                                ref={videoRef}
                                src={cachedVideoUrl}
                                className="w-full h-full object-contain"
                                autoPlay
                                playsInline
                                onError={handleAdVideoError}
                            onLoadedData={handleAdVideoLoaded}
                            onCanPlay={handleAdCanPlay}
                                onEnded={() => {
                                    if (isRecording) {
                                        handleStopRecording();
                                    }
                                }}
                            />
                            {renderAdVideoErrorOverlay()}
                        {renderAdLoadingOverlay({ hideWhileRecording: true })}

                            {/* Webcam Overlay (PIP) */}
                            <div className="absolute bottom-8 right-8 w-64 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                                <video
                                    ref={webcamRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover mirror"
                                />
                                <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 bg-red-500 rounded-full">
                                    <Circle size={8} fill="white" className="animate-pulse" />
                                    <span className="text-white text-xs font-medium">
                                        {new Date(recordingTime * 1000).toISOString().substr(14, 5)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recording Controls Bar */}
                        <div className="h-24 bg-black/80 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-8">
                            <div className="text-white/50 text-sm">
                                Recording in progress...
                            </div>
                            <button
                                onClick={handleStopRecording}
                                className="px-8 py-4 rounded-lg bg-red-500 text-white font-bold text-lg hover:bg-red-600 transition-colors flex items-center gap-3 shadow-lg shadow-red-500/20"
                            >
                                <Square size={24} fill="currentColor" />
                                Stop Recording
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                        {renderAdOptimizingCard()}
                    </div>
                )
            ) : (
                // Standard Layout
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Video Player */}
                        {videoReady ? (
                            <GlassCard>
                                <h3 className="text-lg font-bold text-white mb-4">Advertisement</h3>
                                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                    <video
                                        ref={videoRef}
                                        src={cachedVideoUrl}
                                        className="w-full h-full object-contain"
                                        onError={handleAdVideoError}
                                    onLoadedData={handleAdVideoLoaded}
                                    onCanPlay={handleAdCanPlay}
                                        onEnded={() => {
                                            if (isRecording) {
                                                handleStopRecording();
                                            }
                                        }}
                                    />
                                    {renderAdVideoErrorOverlay()}
                                {renderAdLoadingOverlay()}
                                </div>
                            </GlassCard>
                        ) : (
                            renderAdOptimizingCard()
                        )}

                        <GlassCard>
                            <h3 className="text-lg font-bold text-white mb-4">Your Reaction</h3>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                <video
                                    ref={webcamRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover mirror"
                                />
                                {showPreviewCTA && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/75 px-6 text-center">
                                        <div className="space-y-4">
                                            <p className="text-sm text-white/80">{previewOverlayMessage}</p>
                                            <button
                                                onClick={handleEnablePreview}
                                                disabled={previewStatus === 'starting'}
                                                className={`px-5 py-2 rounded-lg font-semibold ${
                                                    previewStatus === 'starting'
                                                        ? 'bg-white/20 text-white/70 cursor-not-allowed'
                                                        : 'bg-white text-black hover:bg-white/80'
                                                }`}
                                            >
                                                {previewButtonLabel}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {autoplayBlocked && previewReady && !isRecording && (
                                    <button
                                        onClick={resumePreviewPlayback}
                                        className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm font-semibold"
                                    >
                                        Tap to enable preview
                                    </button>
                                )}
                            </div>
                        </GlassCard>
                    </div>

                    {/* Controls */}
                    <GlassCard>
                        {!recordedBlob ? (
                            <>
                                <div className="flex flex-col items-center justify-center gap-3">
                                    <button
                                        onClick={handleStartRecording}
                                        disabled={startButtonDisabled}
                                        className={`px-8 py-4 rounded-lg font-bold text-lg flex items-center gap-3 transition-colors ${
                                            startButtonDisabled
                                                ? 'bg-white/20 text-white/60 cursor-not-allowed'
                                                : 'bg-neon-blue text-white hover:bg-neon-blue/80'
                                        }`}
                                        aria-busy={isPreparingRecording}
                                    >
                                        <Circle size={24} fill="currentColor" />
                                        {startButtonLabel}
                                    </button>
                                    {!videoReady && (
                                        <p className="text-xs text-text-dim text-center">
                                            Advertisement is still being optimized for playback.
                                        </p>
                                    )}
                                    {preparationError && (
                                        <p className="text-sm text-red-300 text-center">{preparationError}</p>
                                    )}
                                </div>
                                <div className="mt-6 p-4 rounded-lg bg-neon-blue/5 border border-neon-blue/20">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="text-neon-blue shrink-0 mt-1" size={20} />
                                        <div className="text-sm text-text-dim">
                                            <p className="mb-2"><strong className="text-white">How it works:</strong></p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Position your face in the webcam frame</li>
                                                <li>Click "Start Recording" to begin</li>
                                                <li>Watch the advertisement while we analyze your reactions</li>
                                                <li>Click "Stop" when finished (auto-stops when the ad ends)</li>
                                            </ol>
                                            <p className="mt-3 text-xs">
                                                <strong>Tip:</strong> When the ad finishes, we’ll automatically stop recording so you can immediately upload or re-record.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {reactionJob ? 'Reaction Upload Saved' : 'Reaction Ready'}
                                        </h3>
                                        <p className="text-text-dim text-sm">
                                            {reactionJob
                                                ? 'We are processing this recording and will update the Reaction Metrics dashboard automatically.'
                                                : 'Upload your recording so we can analyze emotions and update the Reaction Metrics dashboard.'}
                                        </p>
                                    </div>
                                    {reactionJob && (
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                reactionJob.status === 'completed'
                                                    ? 'bg-green-500/15 text-green-300'
                                                    : reactionJob.status === 'failed'
                                                        ? 'bg-red-500/15 text-red-300'
                                                        : 'bg-yellow-500/15 text-yellow-200'
                                            }`}
                                        >
                                            {reactionJob.status.toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {!reactionJob ? (
                                    <div className="flex flex-wrap items-center gap-4">
                                        <button
                                            onClick={handleSaveReaction}
                                            disabled={uploadState === 'uploading'}
                                            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                                                uploadState === 'uploading'
                                                    ? 'bg-white/20 text-white/60 cursor-not-allowed'
                                                    : 'bg-green-500/90 text-white hover:bg-green-400'
                                            }`}
                                        >
                                            {uploadState === 'uploading' ? 'Uploading...' : 'Upload & Analyze'}
                                        </button>
                                        <button
                                            onClick={handleResetRecording}
                                            className="px-6 py-3 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors font-semibold"
                                        >
                                            Re-record
                                        </button>
                                        {uploadState === 'error' && (
                                            <span className="text-red-400 text-sm font-medium">{uploadError}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(queueJob || reactionJob) && (
                                            <JobStatus
                                                job={queueJob ? queueJobToStatus(queueJob) : reactionJobToStatus(reactionJob!)}
                                                showRetry={(queueJob?.status === 'failed') || (reactionJob?.status === 'failed')}
                                                onRetry={
                                                    queueJob?.status === 'failed'
                                                        ? handleRetryQueueJob
                                                        : reactionJob?.status === 'failed'
                                                            ? () => {
                                                                setReactionJob(null);
                                                                handleSaveReaction();
                                                            }
                                                            : undefined
                                                }
                                            />
                                        )}
                                        {reactionJob?.status === 'processing_fallback' && (
                                            <p className="text-xs text-amber-200/80">
                                                Processing inline while the worker restarts. Results may take a little longer than usual.
                                            </p>
                                        )}
                                        {recentReaction && reactionJob.status === 'completed' && (
                                            <div className="rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-white/90">
                                                <div className="font-semibold mb-1">Latest Highlights</div>
                                                <p>
                                                    Dominant emotion: <span className="capitalize">{recentReaction.dominant_emotion}</span> •
                                                    Engagement: {Math.round((recentReaction.engagement_score || 0) * 100)}%
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={() => navigate(`/reaction-metrics/${id}`)}
                                                className="px-5 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors text-sm font-medium"
                                            >
                                                View Reaction Metrics
                                            </button>
                                            <button
                                                onClick={handleResetRecording}
                                                className="px-5 py-2 rounded-lg border border-white/10 text-text-dim hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
                                            >
                                                Record Another
                                            </button>
                                            {reactionJob.status === 'failed' && (
                                                <button
                                                    onClick={() => {
                                                        setReactionJob(null);
                                                        handleSaveReaction();
                                                    }}
                                                    className="px-5 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 text-sm font-medium"
                                                >
                                                    Retry Upload
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </GlassCard>
                </>
            )}

            <style>{`
                .mirror {
                    transform: scaleX(-1);
                }
            `}</style>
            </div>
        </PageContainer>
    );
};
