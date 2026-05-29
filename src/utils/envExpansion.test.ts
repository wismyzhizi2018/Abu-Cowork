import { describe, it, expect } from 'vitest';
import { expandEnvString } from './envExpansion';

describe('envExpansion', () => {
  describe('expandEnvString', () => {
    it('expands simple ${VAR} references', () => {
      const result = expandEnvString('${HOME}/projects', { HOME: '/Users/alice' });
      expect(result).toBe('/Users/alice/projects');
    });

    it('expands multiple variables', () => {
      const result = expandEnvString('${HOST}:${PORT}', { HOST: 'localhost', PORT: '3000' });
      expect(result).toBe('localhost:3000');
    });

    it('returns empty string for unset variables without default', () => {
      const result = expandEnvString('${MISSING}', {});
      expect(result).toBe('');
    });

    it('uses default value when variable is unset', () => {
      const result = expandEnvString('${VAR:-fallback}', {});
      expect(result).toBe('fallback');
    });

    it('uses default value when variable is empty', () => {
      const result = expandEnvString('${VAR:-fallback}', { VAR: '' });
      expect(result).toBe('fallback');
    });

    it('uses variable value over default when set', () => {
      const result = expandEnvString('${VAR:-fallback}', { VAR: 'actual' });
      expect(result).toBe('actual');
    });

    it('handles empty default value', () => {
      const result = expandEnvString('${VAR:-}', { VAR: '' });
      expect(result).toBe('');
    });

    it('returns input unchanged when no variables present', () => {
      const result = expandEnvString('no variables here', { HOME: '/tmp' });
      expect(result).toBe('no variables here');
    });

    it('handles multiple variables in one string', () => {
      const result = expandEnvString('${A}/${B}/${C}', { A: '1', B: '2', C: '3' });
      expect(result).toBe('1/2/3');
    });

    it('handles variables with special characters in default', () => {
      const result = expandEnvString('${VAR:-/path/to/dir}', {});
      expect(result).toBe('/path/to/dir');
    });

    it('handles nested dollar signs in default', () => {
      const result = expandEnvString('${VAR:-${OTHER}}', {});
      expect(result).toBe('${OTHER}');
    });
  });
});
