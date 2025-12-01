import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWebcam } from '../useWebcam';

const mockGetUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>();

const createMockStream = () => {
  const trackStop = vi.fn();
  const track: MediaStreamTrack = {
    enabled: true,
    id: 'track',
    kind: 'video',
    label: 'mock-track',
    muted: false,
    onended: null,
    onmute: null,
    onunmute: null,
    readyState: 'live',
    contentHint: '',
    clone: () => track,
    stop: trackStop,
    applyConstraints: async () => undefined,
    getCapabilities: () => ({}),
    getConstraints: () => ({}),
    getSettings: () => ({}),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  };

  const stream = {
    active: true,
    id: `mock-stream-${Math.random()}`,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    addTrack: () => undefined,
    removeTrack: () => undefined,
    clone: () => stream,
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
    getTrackById: () => track,
  } as unknown as MediaStream;

  return { stream, trackStop };
};

beforeEach(() => {
  mockGetUserMedia.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    configurable: true,
    writable: true,
  });
});

describe('useWebcam', () => {
  it('starts preview and attaches stream to the provided video element', async () => {
    const videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
    const { stream } = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useWebcam({ current: videoEl }));

    await act(async () => {
      await result.current.startPreview();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(videoEl.srcObject).toBe(stream);
    expect(result.current.previewStatus).toBe('live');
    expect(result.current.autoplayBlocked).toBe(false);
  });

  it('stops preview tracks when unmounted', async () => {
    const videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
    const { stream, trackStop } = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result, unmount } = renderHook(() => useWebcam({ current: videoEl }));

    await act(async () => {
      await result.current.startPreview();
    });

    unmount();

    expect(trackStop).toHaveBeenCalled();
  });

  it('flags autoplay blockers and retries playback when resumePreviewPlayback is called', async () => {
    const videoEl = document.createElement('video');
    videoEl.play = vi
      .fn()
      .mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    const { stream } = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useWebcam({ current: videoEl }));

    await act(async () => {
      await result.current.startPreview();
    });

    expect(result.current.autoplayBlocked).toBe(true);

    videoEl.play = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.resumePreviewPlayback();
    });

    expect(videoEl.play).toHaveBeenCalled();
    expect(result.current.autoplayBlocked).toBe(false);
  });

  it('upgrades to an audio+video stream when starting a recording', async () => {
    const videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
    const preview = createMockStream();
    const recording = createMockStream();
    mockGetUserMedia
      .mockResolvedValueOnce(preview.stream)
      .mockResolvedValueOnce(recording.stream);

    const { result } = renderHook(() => useWebcam({ current: videoEl }));

    await act(async () => {
      await result.current.startPreview();
    });

    expect(preview.trackStop).not.toHaveBeenCalled();

    let activeRecording: MediaStream | null = null;
    await act(async () => {
      activeRecording = await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenLastCalledWith({ video: true, audio: true });
    expect(activeRecording).toBe(recording.stream);
    expect(result.current.getRecordingStream()).toBe(recording.stream);
    expect(preview.trackStop).toHaveBeenCalledTimes(1);
    expect(result.current.recordingStatus).toBe('recording');
  });
});

