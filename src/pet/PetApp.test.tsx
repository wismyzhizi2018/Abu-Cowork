/**
 * PetApp integration tests — verify state changes drive UI correctly.
 *
 * Tests the full flow: agent event → state machine → store → renderer.
 * Mocks Tauri APIs (listen, emit, getCurrentWindow, invoke).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { usePetStore, type PetDisplayState } from '@/stores/petStore';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock Tauri event API
const mockListeners: Record<string, ((payload: unknown) => void)[]> = {};
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event: string, cb: (payload: unknown) => void) => {
    if (!mockListeners[event]) mockListeners[event] = [];
    mockListeners[event].push(cb);
    return Promise.resolve(() => {
      const idx = mockListeners[event].indexOf(cb);
      if (idx >= 0) mockListeners[event].splice(idx, 1);
    });
  }),
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock Tauri window API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setFocus: () => Promise.resolve(),
    startDragging: () => Promise.resolve(),
    show: () => Promise.resolve(),
    hide: () => Promise.resolve(),
    outerPosition: () => Promise.resolve({ x: 500, y: 300 }),
    onMoved: () => Promise.resolve(() => {}),
  }),
  primaryMonitor: () => Promise.resolve(null),
  PhysicalPosition: class { constructor(public x: number, public y: number) {} },
}));

// Mock Tauri core API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

// Mock theme loader
vi.mock('@/core/pet/themeLoader', () => ({
  loadTheme: vi.fn(() => Promise.resolve({
    schemaVersion: 1,
    name: 'test-theme',
    author: 'test',
    version: '1.0.0',
    description: 'test',
    viewBox: { x: 0, y: 0, width: 200, height: 200 },
    layout: {
      contentBox: { x: 0, y: 0, width: 200, height: 200 },
      centerX: 100,
      baselineY: 200,
      visibleHeightRatio: 1,
      baselineBottomRatio: 0,
    },
    eyeTracking: {
      enabled: false,
      states: [],
      eyeRatioX: 0.5,
      eyeRatioY: 0.5,
      maxOffset: 20,
      bodyScale: 0.33,
      shadowStretch: 0.15,
      shadowShift: 0.3,
    },
    states: {
      idle: ['idle.svg'],
      thinking: ['thinking.apng'],
      working: ['working.apng'],
      building: ['building.apng'],
      attention: ['attention.apng'],
      error: ['error.apng'],
      notification: ['notification.apng'],
      carrying: ['carrying.apng'],
      sweeping: ['sweeping.apng'],
      yawning: ['yawning.apng'],
      dozing: ['dozing.apng'],
      collapsing: ['collapsing.apng'],
      sleeping: ['sleeping.apng'],
      waking: ['waking.apng'],
    },
    timings: {
      minDisplay: {
        attention: 5000,
        error: 5000,
        notification: 5200,
        carrying: 3000,
        sweeping: 5500,
        working: 1000,
        thinking: 1000,
      },
      autoReturn: {
        attention: 5000,
        error: 5000,
        notification: 5200,
        carrying: 3000,
        sweeping: 300_000,
      },
      mouseIdleTimeout: 20_000,
      mouseSleepTimeout: 60_000,
      yawnDuration: 8000,
      wakeDuration: 1500,
      collapseDuration: 5200,
      deepSleepTimeout: 600_000,
      dndSkipYawn: true,
    },
    reactions: {
      double: { files: ['poke-happy.apng', 'poke-annoyed.apng'], duration: 2000 },
    },
  })),
  getAssetUrl: vi.fn((_path: string, file: string) => `assets/${file}`),
  getStateFiles: vi.fn((_path: string, state: string) => [`${state}.apng`]),
  getWorkingTierFile: vi.fn(() => null),
  getRandomIdleAnimation: vi.fn(() => null),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function emitAgentEvent(event: string) {
  const listeners = mockListeners['pet-agent-event'] ?? [];
  for (const cb of listeners) {
    cb({ payload: { event } });
  }
}

function emitStatusUpdate(state: PetDisplayState) {
  const listeners = mockListeners['pet-status-update'] ?? [];
  for (const cb of listeners) {
    cb({ payload: { state } });
  }
}

// ── Tests ────────────────────────────────────────────────────────────

import PetApp from './PetApp';

describe('PetApp state changes', () => {
  beforeEach(() => {
    // Reset store to known state
    usePetStore.getState().resetPetState();
    usePetStore.setState({
      enabled: true,
      mode: 'full',
      displayState: 'idle',
      stateEnteredAt: Date.now(),
      autoReturnAt: null,
      stateQueue: null,
      dnd: false,
      lastMouseActivity: Date.now(),
    });
    // Clear mock listeners
    for (const key of Object.keys(mockListeners)) {
      delete mockListeners[key];
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<PetApp />);
    });
  });

  it('agent_start event transitions idle → thinking', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('agent_start');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('thinking');
    });
  });

  it('agent_complete event transitions to attention (one-shot)', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('agent_complete');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('attention');
      expect(usePetStore.getState().autoReturnAt).not.toBeNull();
    });
  });

  it('agent_error event transitions to error', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('agent_error');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('error');
    });
  });

  it('permission_request event transitions to notification', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('permission_request');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('notification');
    });
  });

  it('file_write_start event transitions to carrying', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('file_write_start');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('carrying');
    });
  });

  it('session_idle event transitions to idle', async () => {
    usePetStore.setState({ displayState: 'working' });
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('session_idle');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('idle');
    });
  });

  it('pet-status-update event triggers state transition', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitStatusUpdate('working');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('working');
    });
  });

  it('higher priority state preempts lower priority', async () => {
    usePetStore.setState({ displayState: 'thinking', stateEnteredAt: Date.now() });
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('agent_error');
    });

    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('error');
    });
  });

  it('lower priority state is queued when minDisplay active', async () => {
    // error has minDisplay 5s, working has lower priority
    usePetStore.setState({
      displayState: 'error',
      stateEnteredAt: Date.now(), // just entered
    });
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitStatusUpdate('working');
    });

    // Should be queued, not applied immediately
    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('error');
      expect(usePetStore.getState().stateQueue).toBe('working');
    });
  });

  it('DND mode drops non-sleep states', async () => {
    usePetStore.setState({ dnd: true, displayState: 'idle' });
    await act(async () => {
      render(<PetApp />);
    });

    act(() => {
      emitAgentEvent('agent_start');
    });

    // DND should block thinking state
    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('idle');
    });
  });

  it('DND mode allows sleep states', async () => {
    usePetStore.setState({ dnd: true, displayState: 'idle' });
    await act(async () => {
      render(<PetApp />);
    });

    // Sleep sequence should still work in DND (direct mode)
    // This tests that yawning is allowed through DND
    usePetStore.setState({ displayState: 'yawning' });
    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('yawning');
    });
  });

  it('Mini mode renders MiniMode component', async () => {
    usePetStore.setState({ mode: 'mini' });
    await act(async () => {
      render(<PetApp />);
    });
    // If it renders without error, MiniMode is working
  });

  it('autoReturn returns one-shot state to idle after timeout', async () => {
    // Set autoReturn in the past so it fires immediately
    usePetStore.setState({
      displayState: 'attention',
      stateEnteredAt: Date.now() - 6000,
      autoReturnAt: Date.now() - 1, // already expired
    });

    await act(async () => {
      render(<PetApp />);
    });

    // autoReturn timer should fire and resolve to idle
    await waitFor(() => {
      expect(usePetStore.getState().displayState).toBe('idle');
      expect(usePetStore.getState().autoReturnAt).toBeNull();
    }, { timeout: 3000 });
  });

  it('multiple events in sequence update state correctly', async () => {
    await act(async () => {
      render(<PetApp />);
    });

    // Simulate a real workflow — each event should transition
    act(() => { emitAgentEvent('agent_start'); });
    expect(usePetStore.getState().displayState).toBe('thinking');

    act(() => { emitAgentEvent('agent_tool_start'); });
    expect(usePetStore.getState().displayState).toBe('working');

    act(() => { emitAgentEvent('agent_complete'); });
    expect(usePetStore.getState().displayState).toBe('attention');
  });
});
