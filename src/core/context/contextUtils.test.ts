import { describe, it, expect } from 'vitest';
import { getMessageText, identifyRounds } from './contextUtils';

describe('contextUtils', () => {
  describe('getMessageText', () => {
    it('returns string content as-is', () => {
      expect(getMessageText('hello world')).toBe('hello world');
    });

    it('returns empty string for empty string', () => {
      expect(getMessageText('')).toBe('');
    });

    it('extracts text from MessageContent array', () => {
      const content = [
        { type: 'text' as const, text: 'line 1' },
        { type: 'text' as const, text: 'line 2' },
      ];
      expect(getMessageText(content)).toBe('line 1\nline 2');
    });

    it('filters non-text content types', () => {
      const content = [
        { type: 'text' as const, text: 'text part' },
        { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png', data: 'abc' } },
        { type: 'text' as const, text: 'another text' },
      ];
      expect(getMessageText(content)).toBe('text part\nanother text');
    });

    it('returns empty string for array with no text items', () => {
      const content = [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png', data: 'abc' } },
      ];
      expect(getMessageText(content)).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(getMessageText([])).toBe('');
    });
  });

  describe('identifyRounds', () => {
    it('groups user + assistant messages into rounds', () => {
      const messages = [
        { id: '1', role: 'user' as const, content: 'hi', timestamp: 1 },
        { id: '2', role: 'assistant' as const, content: 'hello', timestamp: 2 },
      ];
      const rounds = identifyRounds(messages);
      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toHaveLength(2);
    });

    it('creates separate rounds for each user message', () => {
      const messages = [
        { id: '1', role: 'user' as const, content: 'q1', timestamp: 1 },
        { id: '2', role: 'assistant' as const, content: 'a1', timestamp: 2 },
        { id: '3', role: 'user' as const, content: 'q2', timestamp: 3 },
        { id: '4', role: 'assistant' as const, content: 'a2', timestamp: 4 },
      ];
      const rounds = identifyRounds(messages);
      expect(rounds).toHaveLength(2);
    });

    it('handles messages starting with assistant', () => {
      const messages = [
        { id: '1', role: 'assistant' as const, content: 'hello', timestamp: 1 },
        { id: '2', role: 'user' as const, content: 'hi', timestamp: 2 },
      ];
      const rounds = identifyRounds(messages);
      expect(rounds).toHaveLength(2);
    });

    it('handles empty message list', () => {
      expect(identifyRounds([])).toEqual([]);
    });

    it('handles single user message', () => {
      const messages = [
        { id: '1', role: 'user' as const, content: 'solo', timestamp: 1 },
      ];
      const rounds = identifyRounds(messages);
      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toHaveLength(1);
    });

    it('groups multiple assistant messages after one user message', () => {
      const messages = [
        { id: '1', role: 'user' as const, content: 'q', timestamp: 1 },
        { id: '2', role: 'assistant' as const, content: 'a1', timestamp: 2 },
        { id: '3', role: 'assistant' as const, content: 'a2', timestamp: 3 },
      ];
      const rounds = identifyRounds(messages);
      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toHaveLength(3);
    });
  });
});
