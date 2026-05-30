import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSubagentController,
  cancelSubagent,
  getActiveSubagents,
  subscribeToActiveSubagents,
  cancelAllSubagents,
} from './subagentAbort';

describe('subagentAbort', () => {
  beforeEach(() => {
    cancelAllSubagents();
  });

  describe('createSubagentController', () => {
    it('returns a unique subagent ID', () => {
      const { subagentId: id1 } = createSubagentController('agent-a');
      const { subagentId: id2 } = createSubagentController('agent-b');
      expect(id1).not.toBe(id2);
    });

    it('returns a signal that is not initially aborted', () => {
      const { signal } = createSubagentController('agent-a');
      expect(signal.aborted).toBe(false);
    });

    it('registers the subagent in the active list', () => {
      createSubagentController('agent-a');
      const active = getActiveSubagents();
      expect(active).toHaveLength(1);
      expect(active[0].agentName).toBe('agent-a');
    });

    it('cascades parent abort to child', () => {
      const parent = new AbortController();
      const { signal } = createSubagentController('agent-a', parent.signal);
      expect(signal.aborted).toBe(false);
      parent.abort();
      expect(signal.aborted).toBe(true);
    });

    it('immediately aborts child if parent is already aborted', () => {
      const parent = new AbortController();
      parent.abort();
      const { signal } = createSubagentController('agent-a', parent.signal);
      expect(signal.aborted).toBe(true);
    });

    it('cleanup removes subagent from active list', () => {
      const { cleanup } = createSubagentController('agent-a');
      expect(getActiveSubagents()).toHaveLength(1);
      cleanup();
      expect(getActiveSubagents()).toHaveLength(0);
    });
  });

  describe('cancelSubagent', () => {
    it('cancels and removes the subagent', () => {
      const { subagentId } = createSubagentController('agent-a');
      const result = cancelSubagent(subagentId);
      expect(result).toBe(true);
      expect(getActiveSubagents()).toHaveLength(0);
    });

    it('returns false for unknown ID', () => {
      expect(cancelSubagent('nonexistent')).toBe(false);
    });

    it('aborts the signal on cancel', () => {
      const { subagentId, signal } = createSubagentController('agent-a');
      expect(signal.aborted).toBe(false);
      cancelSubagent(subagentId);
      expect(signal.aborted).toBe(true);
    });
  });

  describe('getActiveSubagents', () => {
    it('returns empty array when no subagents', () => {
      expect(getActiveSubagents()).toEqual([]);
    });

    it('returns multiple subagents', () => {
      createSubagentController('agent-a');
      createSubagentController('agent-b');
      expect(getActiveSubagents()).toHaveLength(2);
    });

    it('includes startTime', () => {
      const before = Date.now();
      createSubagentController('agent-a');
      const active = getActiveSubagents();
      expect(active[0].startTime).toBeGreaterThanOrEqual(before);
    });
  });

  describe('subscribeToActiveSubagents', () => {
    it('calls callback when subagent is added', () => {
      const cb = vi.fn();
      subscribeToActiveSubagents(cb);
      createSubagentController('agent-a');
      expect(cb).toHaveBeenCalled();
    });

    it('calls callback when subagent is removed', () => {
      const cb = vi.fn();
      const { subagentId } = createSubagentController('agent-a');
      subscribeToActiveSubagents(cb);
      cancelSubagent(subagentId);
      expect(cb).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = subscribeToActiveSubagents(cb);
      unsub();
      createSubagentController('agent-a');
      // Should not be called after unsubscribe
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('cancelAllSubagents', () => {
    it('removes all subagents', () => {
      createSubagentController('agent-a');
      createSubagentController('agent-b');
      cancelAllSubagents();
      expect(getActiveSubagents()).toHaveLength(0);
    });

    it('aborts all signals', () => {
      const { signal: s1 } = createSubagentController('agent-a');
      const { signal: s2 } = createSubagentController('agent-b');
      cancelAllSubagents();
      expect(s1.aborted).toBe(true);
      expect(s2.aborted).toBe(true);
    });
  });
});
