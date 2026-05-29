import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setComputerUseActive,
  incrementComputerUseStep,
  pauseComputerUseStatus,
  updateLatestScreenshot,
  setSessionWindowHidden,
  isSessionWindowHidden,
  checkCUSessionLimits,
  setCurrentAction,
  getCUStatusSnapshot,
  subscribeCUStatus,
} from './computerUseStatus';

describe('computerUseStatus', () => {
  beforeEach(() => {
    setComputerUseActive(false);
  });

  describe('setComputerUseActive', () => {
    it('activates CU session', () => {
      setComputerUseActive(true, 'conv-1');
      const state = getCUStatusSnapshot();
      expect(state.status).toBe('active');
      expect(state.stepCount).toBe(0);
      expect(state.activeConversationId).toBe('conv-1');
    });

    it('deactivates CU session', () => {
      setComputerUseActive(true, 'conv-1');
      setComputerUseActive(false);
      const state = getCUStatusSnapshot();
      expect(state.status).toBe('idle');
      expect(state.stepCount).toBe(0);
      expect(state.activeConversationId).toBeNull();
    });
  });

  describe('incrementComputerUseStep', () => {
    it('increments step count when active', () => {
      setComputerUseActive(true);
      incrementComputerUseStep();
      expect(getCUStatusSnapshot().stepCount).toBe(1);
      incrementComputerUseStep();
      expect(getCUStatusSnapshot().stepCount).toBe(2);
    });

    it('sets current action', () => {
      setComputerUseActive(true);
      incrementComputerUseStep('clicking button');
      expect(getCUStatusSnapshot().currentAction).toBe('clicking button');
    });

    it('does nothing when idle', () => {
      incrementComputerUseStep();
      expect(getCUStatusSnapshot().stepCount).toBe(0);
    });
  });

  describe('pauseComputerUseStatus', () => {
    it('pauses active session', () => {
      setComputerUseActive(true);
      pauseComputerUseStatus();
      expect(getCUStatusSnapshot().status).toBe('paused');
    });

    it('does nothing when idle', () => {
      pauseComputerUseStatus();
      expect(getCUStatusSnapshot().status).toBe('idle');
    });
  });

  describe('updateLatestScreenshot', () => {
    it('updates screenshot when active', () => {
      setComputerUseActive(true);
      updateLatestScreenshot('base64data');
      expect(getCUStatusSnapshot().latestScreenshot).toBe('base64data');
    });

    it('does nothing when idle', () => {
      updateLatestScreenshot('base64data');
      expect(getCUStatusSnapshot().latestScreenshot).toBeNull();
    });
  });

  describe('setSessionWindowHidden / isSessionWindowHidden', () => {
    it('tracks window hidden state', () => {
      expect(isSessionWindowHidden()).toBe(false);
      setSessionWindowHidden(true);
      expect(isSessionWindowHidden()).toBe(true);
      setSessionWindowHidden(false);
      expect(isSessionWindowHidden()).toBe(false);
    });
  });

  describe('checkCUSessionLimits', () => {
    it('returns null when idle', () => {
      expect(checkCUSessionLimits()).toBeNull();
    });

    it('returns null when within limits', () => {
      setComputerUseActive(true);
      expect(checkCUSessionLimits()).toBeNull();
    });

    it('returns error when step count exceeds limit', () => {
      setComputerUseActive(true);
      for (let i = 0; i < 30; i++) {
        incrementComputerUseStep();
      }
      const result = checkCUSessionLimits();
      expect(result).toBeTruthy();
      expect(result).toContain('30');
    });
  });

  describe('setCurrentAction', () => {
    it('sets action description', () => {
      setCurrentAction('typing');
      expect(getCUStatusSnapshot().currentAction).toBe('typing');
    });

    it('clears action with null', () => {
      setCurrentAction('typing');
      setCurrentAction(null);
      expect(getCUStatusSnapshot().currentAction).toBeNull();
    });
  });

  describe('subscribeCUStatus', () => {
    it('calls callback on state change', () => {
      const cb = vi.fn();
      subscribeCUStatus(cb);
      setComputerUseActive(true);
      expect(cb).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = subscribeCUStatus(cb);
      unsub();
      setComputerUseActive(true);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('getCUStatusSnapshot', () => {
    it('returns current state', () => {
      const state = getCUStatusSnapshot();
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('stepCount');
      expect(state).toHaveProperty('currentAction');
    });
  });
});
