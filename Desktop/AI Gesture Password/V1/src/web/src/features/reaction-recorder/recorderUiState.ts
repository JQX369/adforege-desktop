export type RecorderPhase = 'idle' | 'preparing' | 'arming' | 'entering-fullscreen' | 'recording' | 'stopping';

const phaseLabelMap: Record<RecorderPhase, string> = {
    idle: 'Start Recording',
    preparing: 'Preparing ad…',
    arming: 'Starting camera…',
    'entering-fullscreen': 'Entering fullscreen…',
    recording: 'Recording…',
    stopping: 'Stopping…',
};

export function getStartButtonLabel(phase: RecorderPhase): string {
    return phaseLabelMap[phase];
}

export function isStartButtonDisabled(params: {
    phase: RecorderPhase;
    isPreparingRecording: boolean;
    videoReady: boolean;
}): boolean {
    if (!params.videoReady) {
        return true;
    }
    if (params.isPreparingRecording) {
        return true;
    }
    return params.phase !== 'idle';
}

export function shouldShowAdOverlay(params: {
    adReadyState: number;
    isRecording: boolean;
    isPreparingRecording: boolean;
    hideWhileRecording: boolean;
    phase: RecorderPhase;
}): boolean {
    const enteringFullscreen = params.phase === 'entering-fullscreen';
    const forceDuringRecording = params.isPreparingRecording || (enteringFullscreen && !params.isRecording);
    if (forceDuringRecording) {
        return true;
    }
    if (params.hideWhileRecording) {
        return false;
    }
    return !params.isRecording && params.adReadyState < 3;
}

export function getAdOverlayMessage(params: {
    isPreparingRecording: boolean;
    phase: RecorderPhase;
}): string {
    if (params.isPreparingRecording) {
        return 'Preparing fullscreen recording…';
    }
    if (params.phase === 'entering-fullscreen') {
        return 'Opening fullscreen…';
    }
    return 'Loading ad…';
}

