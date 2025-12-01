import { describe, expect, it } from 'vitest';

import type { RecorderPhase } from '../recorderUiState';
import {
  getAdOverlayMessage,
  getStartButtonLabel,
  isStartButtonDisabled,
  shouldShowAdOverlay,
} from '../recorderUiState';

describe('recorderUiState helpers', () => {
  it('returns descriptive labels for every recorder phase', () => {
    const phases: RecorderPhase[] = ['idle', 'preparing', 'arming', 'entering-fullscreen', 'recording', 'stopping'];
    const labels = phases.map((phase) => getStartButtonLabel(phase));

    expect(labels).toEqual([
      'Start Recording',
      'Preparing ad…',
      'Starting camera…',
      'Entering fullscreen…',
      'Recording…',
      'Stopping…',
    ]);
  });

  it('disables the start button whenever the phase is not idle or the ad is not ready', () => {
    expect(
      isStartButtonDisabled({
        phase: 'idle',
        isPreparingRecording: false,
        videoReady: true,
      })
    ).toBe(false);

    expect(
      isStartButtonDisabled({
        phase: 'preparing',
        isPreparingRecording: true,
        videoReady: true,
      })
    ).toBe(true);

    expect(
      isStartButtonDisabled({
        phase: 'idle',
        isPreparingRecording: false,
        videoReady: false,
      })
    ).toBe(true);
  });

  it('decides whether to show the loading overlay based on recording state, ready state, and fullscreen entry', () => {
    const base = {
      adReadyState: 0,
      isPreparingRecording: false,
      hideWhileRecording: false,
    };

    expect(
      shouldShowAdOverlay({
        ...base,
        isRecording: false,
        phase: 'idle',
      })
    ).toBe(true);

    expect(
      shouldShowAdOverlay({
        ...base,
        isRecording: true,
        phase: 'entering-fullscreen',
      })
    ).toBe(true);

    expect(
      shouldShowAdOverlay({
        ...base,
        isRecording: true,
        hideWhileRecording: true,
        phase: 'recording',
      })
    ).toBe(false);
  });

  it('returns the correct overlay message for each state', () => {
    expect(
      getAdOverlayMessage({
        isPreparingRecording: true,
        phase: 'preparing',
      })
    ).toBe('Preparing fullscreen recording…');

    expect(
      getAdOverlayMessage({
        isPreparingRecording: false,
        phase: 'entering-fullscreen',
      })
    ).toBe('Opening fullscreen…');

    expect(
      getAdOverlayMessage({
        isPreparingRecording: false,
        phase: 'idle',
      })
    ).toBe('Loading ad…');
  });
});


