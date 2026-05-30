import { describe, it, expect } from 'vitest';
import { buildPatternSummary } from './taskLog';
import type { TaskPattern } from './taskLog';

describe('taskLog', () => {
  describe('buildPatternSummary', () => {
    it('returns empty string for no patterns', () => {
      expect(buildPatternSummary([])).toBe('');
    });

    it('formats a single pattern without skill/agent', () => {
      const patterns: TaskPattern[] = [
        { category: 'coding', count: 5, recentSummaries: ['fix bug'], hasSkill: false, hasAgent: false },
      ];
      const result = buildPatternSummary(patterns);
      expect(result).toContain('coding');
      expect(result).toContain('5次');
      expect(result).toContain('未沉淀');
    });

    it('formats pattern with existing skill', () => {
      const patterns: TaskPattern[] = [
        { category: 'translation', count: 3, recentSummaries: [], hasSkill: true, hasAgent: false },
      ];
      const result = buildPatternSummary(patterns);
      expect(result).toContain('已有技能');
    });

    it('formats pattern with existing agent', () => {
      const patterns: TaskPattern[] = [
        { category: 'research', count: 2, recentSummaries: [], hasSkill: false, hasAgent: true },
      ];
      const result = buildPatternSummary(patterns);
      expect(result).toContain('已有代理');
    });

    it('formats multiple patterns', () => {
      const patterns: TaskPattern[] = [
        { category: 'coding', count: 10, recentSummaries: [], hasSkill: false, hasAgent: false },
        { category: 'writing', count: 3, recentSummaries: [], hasSkill: true, hasAgent: false },
      ];
      const result = buildPatternSummary(patterns);
      expect(result).toContain('coding');
      expect(result).toContain('writing');
      // Each pattern on its own line
      expect(result.split('\n')).toHaveLength(2);
    });
  });
});
