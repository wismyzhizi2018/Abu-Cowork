import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerHook,
  emitHook,
  getHookCount,
  clearAllHooks,
  type AgentStartEvent,
  type TurnEndEvent,
} from './lifecycleHooks';

describe('lifecycleHooks', () => {
  beforeEach(() => {
    clearAllHooks();
  });

  describe('registerHook', () => {
    it('registers a hook and returns unsubscribe function', () => {
      const unsub = registerHook('agentStart', () => {});
      expect(getHookCount()).toBe(1);
      unsub();
      expect(getHookCount()).toBe(0);
    });

    it('registers hooks for different event types', () => {
      registerHook('agentStart', () => {});
      registerHook('turnEnd', () => {});
      registerHook('preToolCall', () => {});
      expect(getHookCount()).toBe(3);
      expect(getHookCount('agentStart')).toBe(1);
      expect(getHookCount('turnEnd')).toBe(1);
    });

    it('sorts hooks by priority', async () => {
      const order: number[] = [];
      registerHook('agentStart', () => { order.push(1); }, 200);
      registerHook('agentStart', () => { order.push(2); }, 50);
      registerHook('agentStart', () => { order.push(3); }, 100);
      await emitHook({ type: 'agentStart', agentName: 'test', loopId: 'l1', timestamp: Date.now() });
      expect(order).toEqual([2, 3, 1]);
    });

    it('unsubscribes only the specific hook', () => {
      const unsub1 = registerHook('agentStart', () => {});
      const unsub2 = registerHook('agentStart', () => {});
      expect(getHookCount('agentStart')).toBe(2);
      unsub1();
      expect(getHookCount('agentStart')).toBe(1);
      unsub2();
      expect(getHookCount('agentStart')).toBe(0);
    });
  });

  describe('emitHook', () => {
    it('calls matching hooks with the event', async () => {
      const handler = vi.fn();
      registerHook('agentStart', handler);
      const event: AgentStartEvent = {
        type: 'agentStart',
        agentName: 'test',
        loopId: 'l1',
        timestamp: Date.now(),
      };
      await emitHook(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('does not call hooks for different event types', async () => {
      const handler = vi.fn();
      registerHook('agentStart', handler);
      await emitHook({ type: 'turnEnd', turnNumber: 1, toolCallCount: 0, timestamp: Date.now() });
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns event synchronously when no hooks registered', () => {
      const event = { type: 'turnEnd' as const, turnNumber: 1, toolCallCount: 0, timestamp: Date.now() };
      const result = emitHook(event);
      expect(result).toBe(event);
    });

    it('returns a promise when hooks are registered (even sync)', async () => {
      registerHook('turnEnd', () => {});
      const event: TurnEndEvent = { type: 'turnEnd', turnNumber: 1, toolCallCount: 0, timestamp: Date.now() };
      const result = emitHook(event);
      // emitHook always returns a Promise when hooks exist
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved).toBe(event);
    });

    it('continues executing hooks even if one throws', async () => {
      const handler2 = vi.fn();
      registerHook('agentStart', () => { throw new Error('oops'); });
      registerHook('agentStart', handler2);
      const event: AgentStartEvent = { type: 'agentStart', agentName: 'test', loopId: 'l1', timestamp: Date.now() };
      await emitHook(event);
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('getHookCount', () => {
    it('returns 0 when no hooks registered', () => {
      expect(getHookCount()).toBe(0);
    });

    it('counts all hooks when no type specified', () => {
      registerHook('agentStart', () => {});
      registerHook('turnEnd', () => {});
      expect(getHookCount()).toBe(2);
    });

    it('counts hooks for specific type', () => {
      registerHook('agentStart', () => {});
      registerHook('agentStart', () => {});
      registerHook('turnEnd', () => {});
      expect(getHookCount('agentStart')).toBe(2);
      expect(getHookCount('turnEnd')).toBe(1);
      expect(getHookCount('preToolCall')).toBe(0);
    });
  });

  describe('clearAllHooks', () => {
    it('removes all hooks', () => {
      registerHook('agentStart', () => {});
      registerHook('turnEnd', () => {});
      registerHook('preToolCall', () => {});
      clearAllHooks();
      expect(getHookCount()).toBe(0);
    });
  });
});
