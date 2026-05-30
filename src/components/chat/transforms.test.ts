import { describe, it, expect } from 'vitest';
import { wrapSvgAsHtml } from './transforms';

describe('transforms', () => {
  describe('wrapSvgAsHtml', () => {
    it('wraps SVG code with HTML boilerplate', () => {
      const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
      const html = wrapSvgAsHtml(svg);
      expect(html).toContain('<style>');
      expect(html).toContain(svg);
      expect(html).toContain('margin:0');
    });

    it('preserves SVG content verbatim', () => {
      const svg = '<svg><text>Hello</text></svg>';
      const html = wrapSvgAsHtml(svg);
      expect(html).toContain(svg);
    });

    it('handles empty string', () => {
      const html = wrapSvgAsHtml('');
      expect(html).toContain('<style>');
    });
  });
});
