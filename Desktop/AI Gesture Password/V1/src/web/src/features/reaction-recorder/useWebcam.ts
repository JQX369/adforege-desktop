import { useCallback, useEffect, useRef, useState } from 'react';

export type PreviewStatus = 'idle' | 'starting' | 'live' | 'stopped' | 'error';
export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopped';

export interface UseWebcamState {
  previewStatus: PreviewStatus;
  recordingStatus: RecordingStatus;
  error: string | null;
  autoplayBlocked: boolean;
  startPreview: () => Promise<void>;
  startRecording: () => Promise<MediaStream>;
  stopPreview: () => void;
  stopRecording: () => void;
  stopAll: () => void;
  resumePreviewPlayback: () => Promise<void>;
  getPreviewStream: () => MediaStream | null;
  getRecordingStream: () => MediaStream | null;
}

const MEDIA_ERROR_MESSAGE = 'Unable to access your webcam. Please check permissions and try again.';

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach(track => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

export function useWebcam(videoRef: React.RefObject<HTMLVideoElement | null>): UseWebcamState {
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const previewStreamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  const ensurePlayback = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }
    try {
      if (typeof videoEl.play === 'function') {
        await videoEl.play();
      }
      setAutoplayBlocked(false);
    } catch (err) {
      const isAutoplayError =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
      if (isAutoplayError) {
        setAutoplayBlocked(true);
      } else {
        console.error('Failed to play webcam preview', err);
        setError(MEDIA_ERROR_MESSAGE);
      }
      throw err;
    }
  }, [videoRef]);

  const attachStreamToVideo = useCallback(
    async (stream: MediaStream) => {
      const videoEl = videoRef.current;
      if (!videoEl) {
        return;
      }
      videoEl.srcObject = stream;
      try {
        await ensurePlayback();
      } catch (err) {
        const isAutoplayError =
          err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
        if (!isAutoplayError) {
          throw err;
        }
      }
    },
    [ensurePlayback, videoRef]
  );

  const startPreview = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(MEDIA_ERROR_MESSAGE);
      setPreviewStatus('error');
      return;
    }

    setPreviewStatus('starting');
    setError(null);

    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      previewStreamRef.current = stream;
      await attachStreamToVideo(stream);
      setPreviewStatus('live');
    } catch (err) {
      console.error('startPreview failed', err);
      setError(MEDIA_ERROR_MESSAGE);
      setPreviewStatus('error');
      throw err;
    }
  }, [attachStreamToVideo]);

  const startRecording = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(MEDIA_ERROR_MESSAGE);
      setRecordingStatus('stopped');
      throw new Error(MEDIA_ERROR_MESSAGE);
    }

    setRecordingStatus('starting');
    setError(null);

    stopStream(recordingStreamRef.current);
    recordingStreamRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      recordingStreamRef.current = stream;
      await attachStreamToVideo(stream);
      setRecordingStatus('recording');
      stopStream(previewStreamRef.current);
      previewStreamRef.current = null;
      return stream;
    } catch (err) {
      console.error('startRecording failed', err);
      setError(MEDIA_ERROR_MESSAGE);
      setRecordingStatus('stopped');
      throw err;
    }
  }, [attachStreamToVideo]);

  const stopPreview = useCallback(() => {
    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;
    setPreviewStatus('stopped');
  }, []);

  const stopRecording = useCallback(() => {
    stopStream(recordingStreamRef.current);
    recordingStreamRef.current = null;
    setRecordingStatus('stopped');
  }, []);

  const stopAll = useCallback(() => {
    stopRecording();
    stopPreview();
  }, [stopPreview, stopRecording]);

  const resumePreviewPlayback = useCallback(async () => {
    try {
      await ensurePlayback();
      setAutoplayBlocked(false);
    } catch {
      // autoplay errors already handled in ensurePlayback
    }
  }, [ensurePlayback]);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return {
    previewStatus,
    recordingStatus,
    error,
    autoplayBlocked,
    startPreview,
    startRecording,
    stopPreview,
    stopRecording,
    stopAll,
    resumePreviewPlayback,
    getPreviewStream: () => previewStreamRef.current,
    getRecordingStream: () => recordingStreamRef.current,
  };
}

