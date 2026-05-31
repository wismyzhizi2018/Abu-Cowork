/**
 * Desktop pet root — full PRD implementation
 *
 * Integrates: PetRenderer + EyeTracker + InteractionLayer + MiniMode
 * State machine drives display state from agent events.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { usePetStore, type PetDisplayState } from '@/stores/petStore';
import {
  computeTransition,
  isOneShot,
  DEFAULT_TIMINGS,
  getNextSleepState,
  getWakeState,
  resolveDisplayState,
  STATE_PRIORITY,
  mapAgentEvent,
  type AgentEvent,
} from '@/core/pet/stateMachine';
import { loadTheme, type ThemeConfig } from '@/core/pet/themeLoader';
import PetRenderer from './PetRenderer';
import EyeTracker from './EyeTracker';
import InteractionLayer from './InteractionLayer';
import MiniMode from './MiniMode';
import StatusLight from './StatusLight';
import { usePetDrag } from './usePetDrag';

// Theme paths — will be resolved from app assets
const THEME_BASE = 'themes/calico-placeholder';

export default function PetApp() {
  const mode = usePetStore((s) => s.mode);
  const displayState = usePetStore((s) => s.displayState);
  const autoReturnAt = usePetStore((s) => s.autoReturnAt);
  const sleepSequenceMode = usePetStore((s) => s.sleepSequenceMode);
  const dnd = usePetStore((s) => s.dnd);
  const setDisplayState = usePetStore((s) => s.setDisplayState);
  const setAutoReturn = usePetStore((s) => s.setAutoReturn);
  const updateMouseActivity = usePetStore((s) => s.updateMouseActivity);
  const setMode = usePetStore((s) => s.setMode);
  const setDnd = usePetStore((s) => s.setDnd);

  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [themePath, setThemePath] = useState<string>('');
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [isLowPower, setIsLowPower] = useState(false);
  const lowPowerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preDragState = useRef<PetDisplayState | null>(null);
  const dragRef = usePetDrag<HTMLDivElement>();

  // Load theme on mount
  useEffect(() => {
    loadTheme(THEME_BASE)
      .then((config) => {
        setTheme(config);
        setThemePath(THEME_BASE);
      })
      .catch(console.error);
  }, []);

  // Listen for agent events from main window
  // BUG FIX: Read from store instead of closure to avoid stale displayState/stateEnteredAt
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    const applyTransition = (candidate: PetDisplayState) => {
      const now = Date.now();
      const store = usePetStore.getState();
      const timings = theme?.timings ?? DEFAULT_TIMINGS;
      const result = computeTransition(
        store.displayState,
        candidate,
        store.stateEnteredAt,
        now,
        timings,
      );

      if (result === 'queue') {
        // BUG FIX: Check priority before overwriting queue (PRD §1.6)
        const currentQueue = store.stateQueue;
        if (!currentQueue || (STATE_PRIORITY[candidate] ?? 0) > (STATE_PRIORITY[currentQueue] ?? 0)) {
          store.setStateQueue(candidate);
        }
      } else {
        store.setDisplayState(result.next);
        store.setAutoReturn(result.autoReturnAt);
      }
    };

    listen<{ event: AgentEvent }>('pet-agent-event', ({ payload }) => {
      const newState = mapAgentEvent(payload.event);
      if (newState) applyTransition(newState);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    listen<{ state: PetDisplayState }>('pet-status-update', ({ payload }) => {
      applyTransition(payload.state);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        const prev = unlisten;
        unlisten = () => { prev?.(); fn(); };
      }
    });

    listen('pet-resync-request', () => {
      const state = usePetStore.getState().displayState;
      emit('pet-status-update', { state }).catch(() => {});
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        const prev = unlisten;
        unlisten = () => { prev?.(); fn(); };
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [theme, setDisplayState, setAutoReturn]);

  // Auto-return timer for one-shot states
  useEffect(() => {
    if (!autoReturnAt) return;

    const timer = setTimeout(() => {
      const store = usePetStore.getState();
      const queue = store.stateQueue;

      if (queue) {
        store.setDisplayState(queue);
        store.setStateQueue(null);
        const timings = theme?.timings ?? DEFAULT_TIMINGS;
        store.setAutoReturn(isOneShot(queue) ? Date.now() + (timings.autoReturn[queue] ?? 5000) : null);
      } else {
        // BUG FIX: Resolve from all sessions instead of hardcoded 'idle'
        // This respects active sessions that may still be running
        const resolved = resolveDisplayState([], false);
        store.setDisplayState(resolved);
        store.setAutoReturn(null);
      }
    }, Math.max(0, autoReturnAt - Date.now()));

    return () => clearTimeout(timer);
  }, [autoReturnAt, theme]);

  // Process queue when minDisplay of current state expires (PRD §1.6)
  useEffect(() => {
    const timings = theme?.timings ?? DEFAULT_TIMINGS;
    const minDisplay = timings.minDisplay[displayState] ?? 0;
    if (minDisplay <= 0) return;

    const timer = setTimeout(() => {
      const store = usePetStore.getState();
      const queue = store.stateQueue;

      if (queue) {
        store.setDisplayState(queue);
        store.setStateQueue(null);
        store.setAutoReturn(isOneShot(queue) ? Date.now() + (timings.autoReturn[queue] ?? 5000) : null);
      }
    }, minDisplay);

    return () => clearTimeout(timer);
  }, [displayState, theme]);

  // Sleep sequence
  // BUG FIX: DND should use direct mode, not skip entirely
  useEffect(() => {
    const checkSleep = () => {
      const now = Date.now();
      const store = usePetStore.getState();
      const mouseIdleMs = now - store.lastMouseActivity;
      const stateElapsedMs = now - store.stateEnteredAt;

      // BUG FIX: DND forces direct mode (skip yawning/dozing/collapsing)
      const effectiveMode = store.dnd ? 'direct' : sleepSequenceMode;

      const nextState = getNextSleepState(
        store.displayState,
        mouseIdleMs,
        stateElapsedMs,
        theme?.timings ?? DEFAULT_TIMINGS,
        effectiveMode,
        store.dnd,
      );

      if (nextState) {
        store.setDisplayState(nextState);
      }
    };

    const interval = setInterval(checkSleep, 1000);
    return () => clearInterval(interval);
  }, [sleepSequenceMode, theme]);

  // Wake on mouse activity
  useEffect(() => {
    const onMouseMove = () => {
      updateMouseActivity();

      const store = usePetStore.getState();
      const state = store.displayState;
      if (state === 'sleeping' || state === 'dozing' || state === 'yawning' || state === 'collapsing') {
        const wakeState = getWakeState(state);
        if (wakeState) {
          store.setDisplayState(wakeState);
          // BUG FIX: waking state needs autoReturn after wakeDuration
          if (wakeState === 'waking') {
            const timings = theme?.timings ?? DEFAULT_TIMINGS;
            store.setAutoReturn(Date.now() + timings.wakeDuration);
          } else {
            store.setAutoReturn(null);
          }
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [updateMouseActivity, theme]);

  // Low power mode: idle > 5s → pause animations
  useEffect(() => {
    if (lowPowerTimer.current) clearTimeout(lowPowerTimer.current);

    if (displayState === 'idle' || displayState === 'mini-idle' || displayState === 'dozing') {
      lowPowerTimer.current = setTimeout(() => setIsLowPower(true), 5000);
    } else {
      setIsLowPower(false);
    }

    return () => {
      if (lowPowerTimer.current) clearTimeout(lowPowerTimer.current);
    };
  }, [displayState]);

  // Resume from low power on mouse move
  useEffect(() => {
    const onMouseMove = () => {
      if (isLowPower) setIsLowPower(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [isLowPower]);

  const handleEyeTrackingRef = useCallback((el: SVGSVGElement | null) => {
    setSvgEl(el);
  }, []);

  const handlePoke = useCallback((_direction: 'left' | 'right') => {
    // PRD §3.3: 50% annoyed probability — selects different reaction file
    const isAnnoyed = Math.random() < 0.5;
    const reactionFiles = theme?.reactions?.double?.files;
    if (reactionFiles?.length) {
      const fileIndex = isAnnoyed && reactionFiles.length > 1 ? 1 : 0;
      // Reaction file will be resolved by PetRenderer when it sees 'attention' state
      // For now, store the selected reaction index for the renderer to pick up
      (window as unknown as { __pokeReactionIndex?: number }).__pokeReactionIndex = fileIndex;
    }
    setDisplayState('attention');
  }, [theme, setDisplayState]);

  const handleMiniExit = useCallback(() => {
    // PRD §4.5: exiting Mini auto-closes DND
    if (dnd) setDnd(false);
    setMode('full');
  }, [setMode, dnd, setDnd]);

  const handleDragStart = useCallback(() => {
    preDragState.current = usePetStore.getState().displayState;
    setDisplayState('attention'); // Use attention as drag reaction placeholder
  }, [setDisplayState]);

  const handleDragEnd = useCallback(() => {
    // BUG FIX: Use resolveDisplayState instead of blindly restoring old state
    // A higher-priority event may have occurred during the drag
    const resolved = resolveDisplayState([], false);
    setDisplayState(resolved);
    preDragState.current = null;
  }, [setDisplayState]);

  // Mini mode rendering
  if (mode === 'mini') {
    return <MiniMode theme={theme} themePath={themePath} onExit={handleMiniExit} />;
  }

  // Full mode
  return (
    <InteractionLayer
      onPoke={handlePoke}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      dragRef={dragRef}
    >
      <PetRenderer
        theme={theme}
        themePath={themePath}
        onEyeTrackingRef={handleEyeTrackingRef}
      />
      <EyeTracker
        svgEl={svgEl}
        config={theme?.eyeTracking ?? null}
        displayState={displayState}
        isLowPower={isLowPower}
      />
      <StatusLight status={displayStateToLegacy(displayState)} />
    </InteractionLayer>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function displayStateToLegacy(state: PetDisplayState): 'idle' | 'running' | 'waiting' | 'error' | 'done' {
  switch (state) {
    case 'thinking':
    case 'working':
    case 'building':
    case 'carrying':
      return 'running';
    case 'notification':
      return 'waiting';
    case 'error':
      return 'error';
    case 'attention':
    case 'sweeping':
      return 'done';
    default:
      return 'idle';
  }
}
