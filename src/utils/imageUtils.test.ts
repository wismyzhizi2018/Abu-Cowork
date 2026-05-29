import { describe, it, expect } from 'vitest';
import { SUPPORTED_IMAGE_TYPES, generateAttachmentId } from './imageUtils';

describe('imageUtils', () => {
  describe('SUPPORTED_IMAGE_TYPES', () => {
    it('contains common image MIME types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
    });

    it('has exactly 4 types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toHaveLength(4);
    });
  });

  describe('generateAttachmentId', () => {
    it('returns a non-empty string', () => {
      const id = generateAttachmentId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateAttachmentId()));
      // With Date.now + Math.random, collisions should be extremely rare
      expect(ids.size).toBe(100);
    });
  });
});
