import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addToast', () => {
    it('adds a toast with generated ID', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'Hello' });
      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].title).toBe('Hello');
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].id).toBeTruthy();
    });

    it('adds toast with optional message', () => {
      useToastStore.getState().addToast({ type: 'success', title: 'Done', message: 'All good' });
      expect(useToastStore.getState().toasts[0].message).toBe('All good');
    });

    it('auto-removes after default duration (3s)', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'temp' });
      expect(useToastStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(3000);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('auto-removes after custom duration', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'custom', duration: 5000 });
      vi.advanceTimersByTime(4999);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('does not auto-remove when duration is 0', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'persistent', duration: 0 });
      vi.advanceTimersByTime(10000);
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('uses longer default duration for actionable toasts', () => {
      useToastStore.getState().addToast({
        type: 'info',
        title: 'action',
        actions: [{ label: 'OK', onClick: () => {} }],
      });
      vi.advanceTimersByTime(3000);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(7000);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('adds multiple toasts', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'A' });
      useToastStore.getState().addToast({ type: 'error', title: 'B' });
      expect(useToastStore.getState().toasts).toHaveLength(2);
    });
  });

  describe('removeToast', () => {
    it('removes toast by ID', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'temp' });
      const id = useToastStore.getState().toasts[0].id;
      useToastStore.getState().removeToast(id);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('clears auto-remove timeout on manual remove', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'temp' });
      const id = useToastStore.getState().toasts[0].id;
      useToastStore.getState().removeToast(id);
      // Advancing time should not cause errors
      vi.advanceTimersByTime(5000);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('does nothing for unknown ID', () => {
      useToastStore.getState().addToast({ type: 'info', title: 'temp' });
      useToastStore.getState().removeToast('nonexistent');
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });
});
