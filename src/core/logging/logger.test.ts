import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, getRecentLogs, clearLogs } from './logger';

describe('logger', () => {
  beforeEach(() => {
    clearLogs();
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('returns an object with debug/info/warn/error methods', () => {
      const logger = createLogger('test');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('logs messages that appear in getRecentLogs', () => {
      const logger = createLogger('myModule');
      logger.info('hello world');
      const logs = getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('hello world');
      expect(logs[0].module).toBe('myModule');
      expect(logs[0].level).toBe('info');
    });

    it('logs with data', () => {
      const logger = createLogger('test');
      logger.warn('something happened', { code: 42 });
      const logs = getRecentLogs();
      expect(logs[0].data).toEqual({ code: 42 });
    });
  });

  describe('getRecentLogs', () => {
    it('returns empty array when no logs', () => {
      expect(getRecentLogs()).toEqual([]);
    });

    it('filters by module', () => {
      const a = createLogger('modA');
      const b = createLogger('modB');
      a.info('from A');
      b.info('from B');
      const logs = getRecentLogs({ module: 'modA' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('from A');
    });

    it('filters by level', () => {
      const logger = createLogger('test');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');
      const warns = getRecentLogs({ level: 'warn' });
      expect(warns).toHaveLength(1);
      expect(warns[0].message).toBe('warn msg');
    });

    it('filters by timestamp', () => {
      const logger = createLogger('test');
      logger.info('old msg');
      // Use a cutoff far in the future so 'old msg' is filtered out
      const cutoff = Date.now() + 10_000;
      const logs = getRecentLogs({ since: cutoff });
      expect(logs.some(l => l.message === 'old msg')).toBe(false);
    });
  });

  describe('clearLogs', () => {
    it('clears all log entries', () => {
      const logger = createLogger('test');
      logger.info('msg1');
      logger.info('msg2');
      expect(getRecentLogs()).toHaveLength(2);
      clearLogs();
      expect(getRecentLogs()).toHaveLength(0);
    });
  });
});
