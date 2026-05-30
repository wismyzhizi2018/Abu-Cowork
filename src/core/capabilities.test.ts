import { describe, it, expect } from 'vitest';
import { providerSupportsWebSearch, providerSupportsImageGen, getBuiltinSearchConfig } from './capabilities';

describe('capabilities', () => {
  describe('providerSupportsWebSearch', () => {
    it('returns true for providers with webSearch capability', () => {
      expect(providerSupportsWebSearch('bailian')).toBe(true);
      expect(providerSupportsWebSearch('anthropic')).toBe(true);
      expect(providerSupportsWebSearch('moonshot')).toBe(true);
    });

    it('returns false for providers without webSearch', () => {
      expect(providerSupportsWebSearch('openai')).toBe(false);
      expect(providerSupportsWebSearch('deepseek')).toBe(false);
      expect(providerSupportsWebSearch('ollama')).toBe(false);
    });
  });

  describe('providerSupportsImageGen', () => {
    it('returns true for providers with imageGen capability', () => {
      expect(providerSupportsImageGen('bailian')).toBe(true);
      expect(providerSupportsImageGen('openai')).toBe(true);
      expect(providerSupportsImageGen('zhipu')).toBe(true);
    });

    it('returns false for providers without imageGen', () => {
      expect(providerSupportsImageGen('deepseek')).toBe(false);
      expect(providerSupportsImageGen('moonshot')).toBe(false);
      expect(providerSupportsImageGen('ollama')).toBe(false);
    });
  });

  describe('getBuiltinSearchConfig', () => {
    it('returns config when provider supports it and userPref is true', () => {
      const config = getBuiltinSearchConfig('anthropic', true);
      expect(config).toBeDefined();
      expect(config!.type).toBe('tool');
    });

    it('returns undefined when userPref is false', () => {
      expect(getBuiltinSearchConfig('anthropic', false)).toBeUndefined();
    });

    it('returns undefined when provider does not support webSearch', () => {
      expect(getBuiltinSearchConfig('deepseek', true)).toBeUndefined();
    });
  });
});
