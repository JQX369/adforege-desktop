export type WaitForAdPlaybackPhase = 'start' | 'already-ready' | 'nudging' | 'ready';

export interface WaitForAdPlaybackOptions {
    timeoutMs?: number;
    onStateChange?: (state: { phase: WaitForAdPlaybackPhase; readyState: number; elapsedMs: number }) => void;
}

export class WaitForAdPlaybackError extends Error {
    public readonly code: 'missing-video' | 'timeout' | 'playback-error';

    constructor(message: string, code: 'missing-video' | 'timeout' | 'playback-error') {
        super(message);
        this.name = 'WaitForAdPlaybackError';
        this.code = code;
    }
}

export async function waitForAdPlayback(
    videoElement: HTMLVideoElement | null,
    options: WaitForAdPlaybackOptions = {}
): Promise<void> {
    if (!videoElement) {
        throw new WaitForAdPlaybackError('Ad video element is not available', 'missing-video');
    }

    const { timeoutMs = 5000, onStateChange } = options;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const emit = (phase: WaitForAdPlaybackPhase) => {
        onStateChange?.({
            phase,
            readyState: videoElement.readyState,
            elapsedMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start,
        });
    };

    emit('start');

    try {
        videoElement.pause();
    } catch {
        // ignore pause errors
    }

    try {
        if (videoElement.currentTime !== 0) {
            videoElement.currentTime = 0;
        }
    } catch {
        // seeking can fail on some browsers before metadata is loaded—ignore
    }

    if (videoElement.readyState >= 3) {
        emit('already-ready');
        return;
    }

    const originalMuted = videoElement.muted;
    const listeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [];
    let timeoutId: number | null = null;

    const cleanup = () => {
        listeners.forEach(([event, handler]) => {
            videoElement.removeEventListener(event, handler as EventListener);
        });
        listeners.length = 0;
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
        videoElement.muted = originalMuted;
    };

    const readyPromise = new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
            emit('ready');
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new WaitForAdPlaybackError('Advertisement failed to load before recording started', 'playback-error'));
        };

        listeners.push(['canplay', handleCanPlay], ['canplaythrough', handleCanPlay], ['error', handleError]);

        listeners.forEach(([event, handler]) => {
            videoElement.addEventListener(event, handler as EventListener);
        });

        timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new WaitForAdPlaybackError('Timed out waiting for advertisement to buffer for fullscreen playback', 'timeout'));
        }, timeoutMs);

        // If the video becomes ready after listeners are attached but before we await, resolve immediately.
        if (videoElement.readyState >= 3) {
            handleCanPlay();
        }
    });

    emit('nudging');
    videoElement.muted = true;

    // Attempt to kick off buffering/playback while we wait for canplay.
    try {
        await videoElement.play().catch(() => undefined);
    } catch {
        // ignore autoplay-related failures – the ready event will still fire when enough data is loaded
    }

    try {
        await readyPromise;
    } finally {
        try {
            videoElement.pause();
        } catch {
            // ignore pause errors
        }
        try {
            if (videoElement.currentTime !== 0) {
                videoElement.currentTime = 0;
            }
        } catch {
            // ignore seeking errors
        }
        cleanup();
    }
}









