import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventRouter, createEventRouter } from './eventRouter';
import type { TaskExecutionStore } from '../../stores/taskExecutionStore';

function createMockStore(): TaskExecutionStore {
  return {
    createExecution: vi.fn(),
    getExecutionByLoopId: vi.fn().mockReturnValue(null),
    addStep: vi.fn(),
    setStepResult: vi.fn(),
    setStepError: vi.fn(),
    addDetailBlock: vi.fn(),
    addChildStep: vi.fn(),
    updateChildStep: vi.fn(),
    completeExecution: vi.fn(),
    errorExecution: vi.fn(),
    appendThinking: vi.fn(),
    setThinkingDuration: vi.fn(),
    setUsage: vi.fn(),
  } as unknown as TaskExecutionStore;
}

describe('EventRouter', () => {
  let store: TaskExecutionStore;
  let router: EventRouter;

  beforeEach(() => {
    store = createMockStore();
    router = createEventRouter({ executionStore: store }, 'zh');
  });

  describe('route', () => {
    it('handles execution-start event', async () => {
      await router.route({
        type: 'execution-start',
        loopId: 'loop-1',
        conversationId: 'conv-1',
      });
      expect(store.createExecution).toHaveBeenCalledWith('conv-1', 'loop-1');
    });

    it('handles step-start event without crashing when no execution', async () => {
      await router.route({
        type: 'step-start',
        loopId: 'loop-1',
        step: {
          toolName: 'read_file',
          toolInput: { path: '/tmp/test.txt' },
        },
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles usage event', async () => {
      await router.route({
        type: 'usage',
        loopId: 'loop-1',
        usage: { inputTokens: 100, outputTokens: 50 },
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles done event', async () => {
      await router.route({
        type: 'done',
        loopId: 'loop-1',
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles error event', async () => {
      await router.route({
        type: 'error',
        loopId: 'loop-1',
        error: 'something went wrong',
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles text-delta event without crashing', async () => {
      await router.route({
        type: 'text-delta',
        loopId: 'loop-1',
        delta: 'hello',
      });
      // text-delta is a no-op in the router
    });

    it('handles thinking-start event', async () => {
      await router.route({
        type: 'thinking-start',
        loopId: 'loop-1',
      });
      // Should not crash
    });

    it('handles thinking-delta event', async () => {
      await router.route({
        type: 'thinking-delta',
        loopId: 'loop-1',
        content: 'thinking...',
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles thinking-end event', async () => {
      await router.route({
        type: 'thinking-end',
        loopId: 'loop-1',
        duration: 5,
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles step-progress event', async () => {
      await router.route({
        type: 'step-progress',
        loopId: 'loop-1',
        stepId: 'step-1',
        progress: 50,
      });
      // step-progress is a no-op currently
    });

    it('handles step-end event', async () => {
      await router.route({
        type: 'step-end',
        loopId: 'loop-1',
        stepId: 'step-1',
        result: 'ok',
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });

    it('handles step-error event', async () => {
      await router.route({
        type: 'step-error',
        loopId: 'loop-1',
        stepId: 'step-1',
        error: 'failed',
      });
      expect(store.getExecutionByLoopId).toHaveBeenCalledWith('loop-1');
    });
  });

  describe('getCurrentStepId', () => {
    it('returns null when no execution', () => {
      expect(router.getCurrentStepId('loop-1')).toBeNull();
    });

    it('returns null when no running step', () => {
      (store.getExecutionByLoopId as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'exec-1',
        steps: [{ id: 'step-1', status: 'completed' }],
      });
      expect(router.getCurrentStepId('loop-1')).toBeNull();
    });

    it('returns running step ID', () => {
      (store.getExecutionByLoopId as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'exec-1',
        steps: [{ id: 'step-1', status: 'running' }],
      });
      expect(router.getCurrentStepId('loop-1')).toBe('step-1');
    });
  });

  describe('createStepForToolUse', () => {
    it('returns null when no execution', () => {
      const result = router.createStepForToolUse('loop-1', {
        toolName: 'read_file',
        toolInput: { path: '/tmp/test.txt' },
      });
      expect(result).toBeNull();
    });

    it('creates a step and returns ID', () => {
      (store.getExecutionByLoopId as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'exec-1',
        steps: [],
      });
      const stepId = router.createStepForToolUse('loop-1', {
        toolName: 'read_file',
        toolInput: { path: '/tmp/test.txt' },
      });
      expect(stepId).toBeTruthy();
      expect(store.addStep).toHaveBeenCalled();
    });
  });

  describe('createEventRouter', () => {
    it('creates an EventRouter instance', () => {
      const r = createEventRouter({ executionStore: store });
      expect(r).toBeInstanceOf(EventRouter);
    });

    it('accepts locale parameter', () => {
      const r = createEventRouter({ executionStore: store }, 'en');
      expect(r).toBeInstanceOf(EventRouter);
    });
  });
});
