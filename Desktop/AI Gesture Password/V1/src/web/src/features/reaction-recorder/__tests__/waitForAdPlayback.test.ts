import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { waitForAdPlayback } from '../waitForAdPlayback';

const createStubVideo = () => {
    const target = new EventTarget();
    const video = target as HTMLVideoElement;
    let readyStateValue = 0;

    Object.defineProperty(video, 'readyState', {
        get: () => readyStateValue,
        set: (value: number) => {
            readyStateValue = value;
        },
        configurable: true,
    });

    Object.assign(video, {
        muted: false,
        currentTime: 0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        load: vi.fn(),
    });

    return {
        video,
        setReadyState: (value: number) => {
            readyStateValue = value;
        },
    };
};

describe('waitForAdPlayback', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves immediately when the ad is already ready', async () => {
        const { video, setReadyState } = createStubVideo();
        setReadyState(3);

        await expect(waitForAdPlayback(video, { timeoutMs: 200 })).resolves.toBeUndefined();
        expect(video.play).not.toHaveBeenCalled();
    });

    it('waits for canplay before resolving', async () => {
        const { video, setReadyState } = createStubVideo();

        const promise = waitForAdPlayback(video, { timeoutMs: 2000 });
        setReadyState(3);
        video.dispatchEvent(new Event('canplay'));

        await expect(promise).resolves.toBeUndefined();
        expect(video.play).toHaveBeenCalled();
        expect(video.currentTime).toBe(0);
    });

    it('rejects when the timeout is exceeded', async () => {
        vi.useFakeTimers();
        const { video } = createStubVideo();

        const promise = waitForAdPlayback(video, { timeoutMs: 500 });
        const expectation = expect(promise).rejects.toMatchObject({
            code: 'timeout',
        });

        await vi.advanceTimersByTimeAsync(500);
        await expectation;
    });

    it('emits state changes while preparing', async () => {
        const { video, setReadyState } = createStubVideo();
        const onStateChange = vi.fn();

        const promise = waitForAdPlayback(video, { timeoutMs: 1000, onStateChange });
        setReadyState(3);
        video.dispatchEvent(new Event('canplay'));
        await promise;

        expect(onStateChange).toHaveBeenCalled();
        const phases = onStateChange.mock.calls.map(([payload]) => payload.phase);
        expect(phases).toContain('start');
        expect(phases).toContain('ready');
    });
});

