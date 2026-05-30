import { describe, it, expect } from 'vitest';
import { ITEM_NAME_RE } from './validation';

describe('ITEM_NAME_RE', () => {
  it('matches valid lowercase names', () => {
    expect(ITEM_NAME_RE.test('my-skill')).toBe(true);
    expect(ITEM_NAME_RE.test('agent123')).toBe(true);
    expect(ITEM_NAME_RE.test('a')).toBe(true);
    expect(ITEM_NAME_RE.test('test-skill-v2')).toBe(true);
    expect(ITEM_NAME_RE.test('abc')).toBe(true);
  });

  it('rejects names starting with hyphen', () => {
    expect(ITEM_NAME_RE.test('-bad')).toBe(false);
  });

  it('rejects names ending with hyphen', () => {
    expect(ITEM_NAME_RE.test('bad-')).toBe(false);
  });

  it('allows uppercase letters', () => {
    expect(ITEM_NAME_RE.test('Bad')).toBe(true);
    expect(ITEM_NAME_RE.test('mySkill')).toBe(true);
  });

  it('allows Unicode names (Chinese, etc.)', () => {
    expect(ITEM_NAME_RE.test('订单助手')).toBe(true);
    expect(ITEM_NAME_RE.test('日本語テスト')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(ITEM_NAME_RE.test('')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(ITEM_NAME_RE.test('my skill')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(ITEM_NAME_RE.test('my_skill')).toBe(false);
    expect(ITEM_NAME_RE.test('my@skill')).toBe(false);
    expect(ITEM_NAME_RE.test('my.skill')).toBe(false);
  });

  it('allows single character names', () => {
    expect(ITEM_NAME_RE.test('a')).toBe(true);
    expect(ITEM_NAME_RE.test('z')).toBe(true);
    expect(ITEM_NAME_RE.test('0')).toBe(true);
  });
});
