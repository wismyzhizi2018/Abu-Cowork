/**
 * Pet State Machine — pure functions, fully unit-testable
 *
 * 12 main states + priority system + one-shot protection + sleep sequence
 * + working tiers + idle animations + queue mechanism.
 *
 * PRD §1.1–1.6
 */

import type { PetDisplayState } from '@/stores/petStore';

// ── Priority (higher = more important) ──────────────────────────────
export const STATE_PRIORITY: Record<PetDisplayState, number> = {
  sleeping: 0,
  idle: 1,
  thinking: 2,
  working: 3,
  building: 4,
  carrying: 4,
  attention: 5,
  sweeping: 6,
  notification: 7,
  error: 8,
  yawning: 0,
  dozing: 0,
  collapsing: 0,
  waking: 0,
  // Mini
  'mini-enter': 0,
  'mini-idle': 0,
  'mini-peek': 0,
  'mini-alert': 7,
  'mini-happy': 5,
  'mini-sleep': 0,
  'mini-crabwalk': 0,
};

// ── Timings (ms) ────────────────────────────────────────────────────
export interface PetTimings {
  minDisplay: Partial<Record<PetDisplayState, number>>;
  autoReturn: Partial<Record<PetDisplayState, number>>;
  mouseIdleTimeout: number;
  mouseSleepTimeout: number;
  yawnDuration: number;
  wakeDuration: number;
  collapseDuration: number;
  deepSleepTimeout: number;
  dndSkipYawn: boolean;
}

export const DEFAULT_TIMINGS: PetTimings = {
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
};

// ── One-shot states ─────────────────────────────────────────────────
export const ONE_SHOT_STATES: PetDisplayState[] = [
  'attention',
  'error',
  'sweeping',
  'notification',
  'carrying',
];

export function isOneShot(state: PetDisplayState): boolean {
  return ONE_SHOT_STATES.includes(state);
}

// ── Agent event → state mapping ─────────────────────────────────────
export type AgentEvent =
  | 'agent_start'
  | 'agent_thinking'
  | 'agent_tool_start'
  | 'agent_tool_end'
  | 'agent_complete'
  | 'agent_error'
  | 'subagent_start'
  | 'subagent_multi'
  | 'permission_request'
  | 'file_write_start'
  | 'file_sweep'
  | 'session_idle';

export function mapAgentEvent(event: AgentEvent): PetDisplayState {
  switch (event) {
    case 'agent_start':
    case 'agent_thinking':
      return 'thinking';
    case 'agent_tool_start':
    case 'agent_tool_end':
      return 'working';
    case 'agent_complete':
      return 'attention';
    case 'agent_error':
      return 'error';
    case 'subagent_start':
      return 'building';
    case 'subagent_multi':
      return 'building';
    case 'permission_request':
      return 'notification';
    case 'file_write_start':
      return 'carrying';
    case 'file_sweep':
      return 'sweeping';
    case 'session_idle':
      return 'idle';
  }
}

// ── Working tiers (PRD §1.5) ────────────────────────────────────────
export function getWorkingTier(sessionCount: number): PetDisplayState {
  if (sessionCount >= 3) return 'building';
  if (sessionCount >= 2) return 'building'; // juggling → building for now
  return 'working';
}

// ── State transition logic ──────────────────────────────────────────

export interface StateTransition {
  next: PetDisplayState;
  autoReturnAt: number | null;
  minDisplayEnds: number;
}

/**
 * Should the new state be allowed to replace the current one?
 * Respects minDisplay and priority.
 */
export function shouldTransition(
  current: PetDisplayState,
  candidate: PetDisplayState,
  stateEnteredAt: number,
  now: number,
  timings: PetTimings,
): boolean {
  // Always allow transition if current state's minDisplay has elapsed
  const minDisplay = timings.minDisplay[current] ?? 0;
  if (now - stateEnteredAt >= minDisplay) return true;

  // Higher priority can always preempt
  return (STATE_PRIORITY[candidate] ?? 0) > (STATE_PRIORITY[current] ?? 0);
}

/**
 * Compute next state after a candidate event arrives.
 * Returns null if the transition should be queued instead.
 */
export function computeTransition(
  current: PetDisplayState,
  candidate: PetDisplayState,
  stateEnteredAt: number,
  now: number,
  timings: PetTimings,
): StateTransition | 'queue' {
  if (shouldTransition(current, candidate, stateEnteredAt, now, timings)) {
    const autoReturn = isOneShot(candidate)
      ? now + (timings.autoReturn[candidate] ?? 5000)
      : null;
    const minDisplayEnds = now + (timings.minDisplay[candidate] ?? 0);
    return { next: candidate, autoReturnAt: autoReturn, minDisplayEnds };
  }
  return 'queue';
}

/**
 * Resolve the display state from multiple session states.
 * Takes the highest-priority state across all sessions.
 */
export function resolveDisplayState(
  sessionStates: PetDisplayState[],
  permissionLock: boolean,
): PetDisplayState {
  if (permissionLock) return 'notification';
  if (sessionStates.length === 0) return 'idle';

  let best: PetDisplayState = 'idle';
  let bestPri = 0;
  for (const s of sessionStates) {
    const pri = STATE_PRIORITY[s] ?? 0;
    if (pri > bestPri) {
      best = s;
      bestPri = pri;
    }
  }
  return best;
}

// ── Sleep sequence (PRD §1.3) ───────────────────────────────────────

export type SleepPhase = 'awake' | 'yawning' | 'dozing' | 'collapsing' | 'sleeping';

export function getNextSleepState(
  current: PetDisplayState,
  mouseIdleMs: number,
  stateElapsedMs: number,
  timings: PetTimings,
  mode: 'full' | 'direct',
  dnd: boolean,
): PetDisplayState | null {
  if (mode === 'direct') {
    // Direct: idle → (60s) → sleeping → waking
    if (current === 'idle' && mouseIdleMs >= timings.mouseSleepTimeout) {
      return 'sleeping';
    }
    return null;
  }

  // Full mode — use mouseIdleMs for idle→yawning (total mouse idle),
  // stateElapsedMs for yawning→dozing, dozing→collapsing (time in state).
  if (current === 'idle' && mouseIdleMs >= timings.mouseSleepTimeout) {
    return dnd && timings.dndSkipYawn ? 'collapsing' : 'yawning';
  }
  if (current === 'yawning' && stateElapsedMs >= timings.yawnDuration) {
    return 'dozing';
  }
  if (current === 'dozing' && stateElapsedMs >= timings.deepSleepTimeout) {
    return 'collapsing';
  }
  if (current === 'collapsing' && stateElapsedMs >= timings.collapseDuration) {
    return 'sleeping';
  }
  return null;
}

/**
 * Determine wake animation based on which sleep state we're in.
 * PRD §1.3: dozing → 350ms quick wake; sleeping/collapsing → 1.5s waking.
 */
export function getWakeState(current: PetDisplayState): PetDisplayState | null {
  if (current === 'dozing') return 'idle'; // 350ms quick animation handled by renderer
  if (current === 'sleeping' || current === 'collapsing') return 'waking';
  if (current === 'yawning') return 'idle';
  return null;
}

// ── Mini mode state mapping (PRD §4.3) ──────────────────────────────

export function mapToMiniState(fullState: PetDisplayState): PetDisplayState {
  switch (fullState) {
    case 'notification':
      return 'mini-alert';
    case 'attention':
      return 'mini-happy';
    case 'working':
    case 'thinking':
    case 'building':
      return 'mini-idle'; // Could be mini-working if theme supports it
    default:
      return 'mini-idle';
  }
}
