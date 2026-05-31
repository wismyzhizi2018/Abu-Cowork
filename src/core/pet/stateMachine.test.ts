import { describe, it, expect } from 'vitest';
import {
  STATE_PRIORITY,
  DEFAULT_TIMINGS,
  ONE_SHOT_STATES,
  isOneShot,
  mapAgentEvent,
  shouldTransition,
  computeTransition,
  resolveDisplayState,
  getNextSleepState,
  getWakeState,
  mapToMiniState,
} from './stateMachine';

describe('STATE_PRIORITY', () => {
  it('sleeping has lowest priority (0)', () => {
    expect(STATE_PRIORITY.sleeping).toBe(0);
  });

  it('error has highest priority (8)', () => {
    expect(STATE_PRIORITY.error).toBe(8);
  });

  it('notification > attention', () => {
    expect(STATE_PRIORITY.notification).toBeGreaterThan(STATE_PRIORITY.attention);
  });

  it('working > thinking', () => {
    expect(STATE_PRIORITY.working).toBeGreaterThan(STATE_PRIORITY.thinking);
  });
});

describe('isOneShot', () => {
  it.each(ONE_SHOT_STATES)('%s is one-shot', (state) => {
    expect(isOneShot(state)).toBe(true);
  });

  it('idle is not one-shot', () => {
    expect(isOneShot('idle')).toBe(false);
  });

  it('working is not one-shot', () => {
    expect(isOneShot('working')).toBe(false);
  });

  it('sleeping is not one-shot', () => {
    expect(isOneShot('sleeping')).toBe(false);
  });
});

describe('mapAgentEvent', () => {
  it('maps agent_start to thinking', () => {
    expect(mapAgentEvent('agent_start')).toBe('thinking');
  });

  it('maps agent_complete to attention', () => {
    expect(mapAgentEvent('agent_complete')).toBe('attention');
  });

  it('maps agent_error to error', () => {
    expect(mapAgentEvent('agent_error')).toBe('error');
  });

  it('maps permission_request to notification', () => {
    expect(mapAgentEvent('permission_request')).toBe('notification');
  });

  it('maps file_write_start to carrying', () => {
    expect(mapAgentEvent('file_write_start')).toBe('carrying');
  });

  it('maps file_sweep to sweeping', () => {
    expect(mapAgentEvent('file_sweep')).toBe('sweeping');
  });

  it('maps session_idle to idle', () => {
    expect(mapAgentEvent('session_idle')).toBe('idle');
  });
});

describe('shouldTransition', () => {
  const now = Date.now();

  it('allows transition after minDisplay elapsed', () => {
    const stateEnteredAt = now - 6000; // 6s ago, minDisplay for attention is 5s
    expect(shouldTransition('attention', 'idle', stateEnteredAt, now, DEFAULT_TIMINGS)).toBe(true);
  });

  it('blocks transition before minDisplay with lower priority', () => {
    const stateEnteredAt = now - 1000; // 1s ago, minDisplay for attention is 5s
    expect(shouldTransition('attention', 'idle', stateEnteredAt, now, DEFAULT_TIMINGS)).toBe(false);
  });

  it('allows higher priority to preempt before minDisplay', () => {
    const stateEnteredAt = now - 1000;
    expect(shouldTransition('attention', 'error', stateEnteredAt, now, DEFAULT_TIMINGS)).toBe(true);
  });
});

describe('computeTransition', () => {
  const now = Date.now();

  it('returns transition for allowed state change', () => {
    const result = computeTransition('idle', 'working', now - 10000, now, DEFAULT_TIMINGS);
    expect(result).not.toBe('queue');
    if (result !== 'queue') {
      expect(result.next).toBe('working');
      expect(result.autoReturnAt).toBeNull(); // working is not one-shot
    }
  });

  it('sets autoReturn for one-shot states', () => {
    const result = computeTransition('idle', 'attention', now - 10000, now, DEFAULT_TIMINGS);
    expect(result).not.toBe('queue');
    if (result !== 'queue') {
      expect(result.autoReturnAt).not.toBeNull();
    }
  });

  it('returns queue when transition is blocked', () => {
    const stateEnteredAt = now - 1000;
    const result = computeTransition('error', 'idle', stateEnteredAt, now, DEFAULT_TIMINGS);
    expect(result).toBe('queue');
  });
});

describe('resolveDisplayState', () => {
  it('returns idle for empty sessions', () => {
    expect(resolveDisplayState([], false)).toBe('idle');
  });

  it('returns notification when permissionLock is true', () => {
    expect(resolveDisplayState(['idle', 'working'], true)).toBe('notification');
  });

  it('returns highest priority state', () => {
    expect(resolveDisplayState(['idle', 'working', 'error'], false)).toBe('error');
  });
});

describe('getNextSleepState', () => {
  const timings = DEFAULT_TIMINGS;

  it('idle → yawning after mouseSleepTimeout', () => {
    const result = getNextSleepState('idle', 61000, 0, timings, 'full', false);
    expect(result).toBe('yawning');
  });

  it('idle stays idle before mouseSleepTimeout', () => {
    const result = getNextSleepState('idle', 30000, 0, timings, 'full', false);
    expect(result).toBeNull();
  });

  it('yawning → dozing after yawnDuration', () => {
    const result = getNextSleepState('yawning', 65000, 9000, timings, 'full', false);
    expect(result).toBe('dozing');
  });

  it('yawning stays before yawnDuration', () => {
    const result = getNextSleepState('yawning', 65000, 3000, timings, 'full', false);
    expect(result).toBeNull();
  });

  it('dozing → collapsing after deepSleepTimeout', () => {
    const result = getNextSleepState('dozing', 700000, 601000, timings, 'full', false);
    expect(result).toBe('collapsing');
  });

  it('collapsing → sleeping after collapseDuration', () => {
    const result = getNextSleepState('collapsing', 800000, 6000, timings, 'full', false);
    expect(result).toBe('sleeping');
  });

  it('direct mode: idle → sleeping after mouseSleepTimeout', () => {
    const result = getNextSleepState('idle', 61000, 0, timings, 'direct', false);
    expect(result).toBe('sleeping');
  });

  it('DND + dndSkipYawn: idle → collapsing', () => {
    const result = getNextSleepState('idle', 61000, 0, timings, 'full', true);
    expect(result).toBe('collapsing');
  });
});

describe('getWakeState', () => {
  it('dozing → idle (quick wake)', () => {
    expect(getWakeState('dozing')).toBe('idle');
  });

  it('sleeping → waking', () => {
    expect(getWakeState('sleeping')).toBe('waking');
  });

  it('collapsing → waking', () => {
    expect(getWakeState('collapsing')).toBe('waking');
  });

  it('yawning → idle', () => {
    expect(getWakeState('yawning')).toBe('idle');
  });

  it('idle → null', () => {
    expect(getWakeState('idle')).toBeNull();
  });
});

describe('mapToMiniState', () => {
  it('notification → mini-alert', () => {
    expect(mapToMiniState('notification')).toBe('mini-alert');
  });

  it('attention → mini-happy', () => {
    expect(mapToMiniState('attention')).toBe('mini-happy');
  });

  it('working → mini-idle', () => {
    expect(mapToMiniState('working')).toBe('mini-idle');
  });

  it('idle → mini-idle', () => {
    expect(mapToMiniState('idle')).toBe('mini-idle');
  });
});
