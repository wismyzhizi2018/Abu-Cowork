import { describe, it, expect } from 'vitest';
import { getOverallStatus, getResultsByCategory } from './diagnosticStore';
import type { DiagnosticState } from './diagnosticStore';
import type { CheckResult } from '@/core/diagnostic/types';

// Helper to build a minimal DiagnosticState
function makeState(overrides: Partial<DiagnosticState> = {}): DiagnosticState {
  return {
    results: {},
    lastCheckedAt: null,
    isChecking: false,
    reRunning: {},
    exportInProgress: false,
    lastExportPath: null,
    includeRawText: false,
    ...overrides,
  };
}

function makeResult(id: string, category: string, status: CheckResult['status']): CheckResult {
  return {
    id,
    category: category as CheckResult['category'],
    label: id,
    status,
    message: '',
  };
}

describe('diagnosticStore selectors', () => {
  describe('getOverallStatus', () => {
    it('returns "checking" when isChecking is true', () => {
      expect(getOverallStatus(makeState({ isChecking: true }))).toBe('checking');
    });

    it('returns "no-data" when results are empty', () => {
      expect(getOverallStatus(makeState())).toBe('no-data');
    });

    it('returns "has-failures" when any result is failed', () => {
      const state = makeState({
        results: {
          a: makeResult('a', 'system', 'passed'),
          b: makeResult('b', 'system', 'failed'),
        },
      });
      expect(getOverallStatus(state)).toBe('has-failures');
    });

    it('returns "has-warnings" when any result is warning (no failures)', () => {
      const state = makeState({
        results: {
          a: makeResult('a', 'system', 'passed'),
          b: makeResult('b', 'system', 'warning'),
        },
      });
      expect(getOverallStatus(state)).toBe('has-warnings');
    });

    it('returns "all-passed" when all results are passed', () => {
      const state = makeState({
        results: {
          a: makeResult('a', 'system', 'passed'),
          b: makeResult('b', 'network', 'passed'),
        },
      });
      expect(getOverallStatus(state)).toBe('all-passed');
    });

    it('prioritizes failures over warnings', () => {
      const state = makeState({
        results: {
          a: makeResult('a', 'system', 'warning'),
          b: makeResult('b', 'system', 'failed'),
        },
      });
      expect(getOverallStatus(state)).toBe('has-failures');
    });
  });

  describe('getResultsByCategory', () => {
    it('returns empty array when no results match', () => {
      const state = makeState({
        results: { a: makeResult('a', 'system', 'passed') },
      });
      expect(getResultsByCategory(state, 'network' as CheckResult['category'])).toEqual([]);
    });

    it('filters results by category', () => {
      const state = makeState({
        results: {
          a: makeResult('a', 'system', 'passed'),
          b: makeResult('b', 'network', 'passed'),
          c: makeResult('c', 'system', 'warning'),
        },
      });
      const result = getResultsByCategory(state, 'system' as CheckResult['category']);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['a', 'c']);
    });

    it('returns empty array for empty results', () => {
      expect(getResultsByCategory(makeState(), 'system' as CheckResult['category'])).toEqual([]);
    });
  });
});
