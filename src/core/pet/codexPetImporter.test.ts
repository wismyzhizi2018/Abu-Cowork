import { describe, it, expect } from 'vitest';
import {
  validatePetJson,
  validateZipEntry,
  validateImportUrl,
  generateThemeJson,
  type CodexPetMeta,
} from './codexPetImporter';

describe('validatePetJson', () => {
  it('accepts valid pet.json', () => {
    const result = validatePetJson({
      id: 'test-pet',
      displayName: 'Test Pet',
      spritesheetPath: 'spritesheet.png',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null/undefined', () => {
    expect(validatePetJson(null).valid).toBe(false);
    expect(validatePetJson(undefined).valid).toBe(false);
  });

  it('rejects missing id', () => {
    const result = validatePetJson({
      spritesheetPath: 'spritesheet.png',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or empty "id" field');
  });

  it('rejects empty id', () => {
    const result = validatePetJson({
      id: '  ',
      spritesheetPath: 'spritesheet.png',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing spritesheetPath', () => {
    const result = validatePetJson({
      id: 'test-pet',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing "spritesheetPath" field');
  });

  it('rejects non-image spritesheetPath', () => {
    const result = validatePetJson({
      id: 'test-pet',
      spritesheetPath: 'spritesheet.txt',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('.png or .webp');
  });

  it('accepts .webp spritesheetPath', () => {
    const result = validatePetJson({
      id: 'test-pet',
      spritesheetPath: 'spritesheet.webp',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects displayName over 100 chars', () => {
    const result = validatePetJson({
      id: 'test-pet',
      spritesheetPath: 'spritesheet.png',
      displayName: 'a'.repeat(101),
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('100 characters');
  });

  it('rejects description over 500 chars', () => {
    const result = validatePetJson({
      id: 'test-pet',
      spritesheetPath: 'spritesheet.png',
      description: 'a'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('500 characters');
  });
});

describe('validateZipEntry', () => {
  it('accepts normal entry', () => {
    expect(validateZipEntry('pet.json', 1024, false).safe).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(validateZipEntry('../etc/passwd', 100, false).safe).toBe(false);
  });

  it('rejects absolute path', () => {
    expect(validateZipEntry('/etc/passwd', 100, false).safe).toBe(false);
  });

  it('rejects encrypted entries', () => {
    expect(validateZipEntry('file.png', 100, true).safe).toBe(false);
  });

  it('rejects oversized pet.json', () => {
    expect(validateZipEntry('pet.json', 100_000, false).safe).toBe(false);
  });

  it('rejects oversized spritesheet', () => {
    expect(validateZipEntry('spritesheet.png', 20_000_000, false).safe).toBe(false);
  });
});

describe('validateImportUrl', () => {
  it('accepts valid HTTPS URL', () => {
    expect(validateImportUrl('https://example.com/pet.zip').safe).toBe(true);
  });

  it('rejects HTTP', () => {
    expect(validateImportUrl('http://example.com/pet.zip').safe).toBe(false);
  });

  it('rejects localhost', () => {
    expect(validateImportUrl('https://localhost/pet.zip').safe).toBe(false);
  });

  it('rejects 127.0.0.1', () => {
    expect(validateImportUrl('https://127.0.0.1/pet.zip').safe).toBe(false);
  });

  it('rejects 10.x.x.x', () => {
    expect(validateImportUrl('https://10.0.0.1/pet.zip').safe).toBe(false);
  });

  it('rejects 192.168.x.x', () => {
    expect(validateImportUrl('https://192.168.1.1/pet.zip').safe).toBe(false);
  });

  it('rejects 172.16.x.x', () => {
    expect(validateImportUrl('https://172.16.0.1/pet.zip').safe).toBe(false);
  });

  it('rejects invalid URL', () => {
    expect(validateImportUrl('not-a-url').safe).toBe(false);
  });
});

describe('generateThemeJson', () => {
  const pet: CodexPetMeta = {
    id: 'test-pet',
    displayName: 'Test Pet',
    spritesheetPath: 'spritesheet.png',
  };

  it('generates valid theme config', () => {
    const theme = generateThemeJson(pet);
    expect(theme.schemaVersion).toBe(1);
    expect(theme.name).toBe('Test Pet');
    expect(theme.eyeTracking.enabled).toBe(false);
    expect(theme.sleepSequence?.mode).toBe('direct');
  });

  it('maps atlas rows to states', () => {
    const theme = generateThemeJson(pet);
    expect(theme.states.idle).toBeDefined();
    expect(theme.states.working).toBeDefined();
    expect(theme.states.attention).toBeDefined();
    expect(theme.states.error).toBeDefined();
    expect(theme.states.thinking).toBeDefined();
    expect(theme.states.notification).toBeDefined();
  });

  it('generates correct file names', () => {
    const theme = generateThemeJson(pet);
    expect(theme.states.idle[0]).toBe('test-pet-row0.png');
    expect(theme.states.error[0]).toBe('test-pet-row5.png');
  });

  it('has all required timing fields', () => {
    const theme = generateThemeJson(pet);
    expect(theme.timings.mouseIdleTimeout).toBe(20000);
    expect(theme.timings.mouseSleepTimeout).toBe(60000);
    expect(theme.timings.yawnDuration).toBe(8000);
    expect(theme.timings.collapseDuration).toBe(5200);
    expect(theme.timings.deepSleepTimeout).toBe(600000);
  });
});
