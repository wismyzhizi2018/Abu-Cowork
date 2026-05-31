/**
 * Codex Pet importer — zip/URL import with security validation
 *
 * PRD §7:
 * - Reads pet.json + spritesheet.png from zip or URL
 * - Validates pet.json fields and spritesheet dimensions (1536×1872)
 * - Splits atlas into per-row APNG (Rust side)
 * - Generates theme.json with state mapping
 * - Installs to ~/.abu/themes/codex-pet-{id}/
 */

import type { ThemeConfig } from './themeLoader';

export interface CodexPetMeta {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
}

export interface ImportResult {
  success: boolean;
  themeId?: string;
  error?: string;
}

const _MAX_ZIP_SIZE = 25 * 1024 * 1024; // 25MB — used by Rust side
const MAX_SPRITESHEET_SIZE = 16 * 1024 * 1024; // 16MB
const MAX_PET_JSON_SIZE = 64 * 1024; // 64KB
const SPRITESHEET_WIDTH = 1536;
const SPRITESHEET_HEIGHT = 1872;

// Atlas row layout (PRD §7.2)
const ATLAS_ROWS: { row: number; state: string; frames: number }[] = [
  { row: 0, state: 'idle', frames: 6 },
  { row: 1, state: 'working', frames: 8 },
  { row: 2, state: 'working', frames: 8 }, // mirrored
  { row: 3, state: 'attention', frames: 4 },
  { row: 4, state: 'attention', frames: 5 }, // alternative
  { row: 5, state: 'error', frames: 8 },
  { row: 6, state: 'thinking', frames: 6 },
  { row: 7, state: 'working', frames: 8 }, // alternative
  { row: 8, state: 'notification', frames: 6 },
];

/**
 * Validate pet.json structure
 */
export function validatePetJson(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid pet.json: not an object'] };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') {
    errors.push('Missing or empty "id" field');
  }

  if (!obj.spritesheetPath || typeof obj.spritesheetPath !== 'string') {
    errors.push('Missing "spritesheetPath" field');
  } else if (!/\.(png|webp)$/i.test(obj.spritesheetPath)) {
    errors.push('spritesheetPath must point to a .png or .webp file');
  }

  if (obj.displayName && typeof obj.displayName === 'string' && obj.displayName.length > 100) {
    errors.push('displayName exceeds 100 characters');
  }

  if (obj.description && typeof obj.description === 'string' && obj.description.length > 500) {
    errors.push('description exceeds 500 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Security checks for zip contents
 */
export function validateZipEntry(
  name: string,
  size: number,
  isEncrypted: boolean,
): { safe: boolean; reason?: string } {
  // Path traversal
  if (name.includes('..') || name.startsWith('/')) {
    return { safe: false, reason: `Path traversal detected: ${name}` };
  }

  // Encrypted entries
  if (isEncrypted) {
    return { safe: false, reason: 'Encrypted zip entries are not allowed' };
  }

  // Size checks
  if (name.endsWith('.json') && size > MAX_PET_JSON_SIZE) {
    return { safe: false, reason: `pet.json exceeds ${MAX_PET_JSON_SIZE / 1024}KB` };
  }

  if ((name.endsWith('.png') || name.endsWith('.webp')) && size > MAX_SPRITESHEET_SIZE) {
    return { safe: false, reason: `Spritesheet exceeds ${MAX_SPRITESHEET_SIZE / 1024 / 1024}MB` };
  }

  return { safe: true };
}

/**
 * Validate URL for remote import (security checks)
 */
export function validateImportUrl(url: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  // Only HTTPS
  if (parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only HTTPS URLs are allowed' };
  }

  // Block internal/private IPs
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return { safe: false, reason: 'Internal network addresses are not allowed' };
  }

  return { safe: true };
}

/**
 * Generate a theme.json from Codex Pet metadata
 */
export function generateThemeJson(pet: CodexPetMeta): ThemeConfig {
  const states: Record<string, string[]> = {};
  for (const row of ATLAS_ROWS) {
    const stateName = row.state;
    const fileName = `${pet.id}-row${row.row}.png`;
    if (!states[stateName]) states[stateName] = [];
    states[stateName].push(fileName);
  }

  return {
    schemaVersion: 1,
    name: pet.displayName || pet.id,
    author: 'Codex Pet Community',
    version: '1.0.0',
    description: pet.description || `Imported Codex Pet: ${pet.id}`,
    viewBox: { x: 0, y: 0, width: SPRITESHEET_WIDTH, height: SPRITESHEET_HEIGHT },
    layout: {
      contentBox: { x: 0, y: 0, width: SPRITESHEET_WIDTH, height: SPRITESHEET_HEIGHT },
      centerX: SPRITESHEET_WIDTH / 2,
      baselineY: SPRITESHEET_HEIGHT,
      visibleHeightRatio: 1,
      baselineBottomRatio: 0,
    },
    eyeTracking: {
      enabled: false, // Codex Pet idle is APNG, not SVG
      states: [],
      eyeRatioX: 0.5,
      eyeRatioY: 0.5,
      maxOffset: 0,
      bodyScale: 0,
      shadowStretch: 0,
      shadowShift: 0,
    },
    states,
    timings: {
      minDisplay: {
        attention: 5000,
        error: 5000,
        notification: 5200,
        working: 1000,
        thinking: 1000,
      },
      autoReturn: {
        attention: 5000,
        error: 5000,
        notification: 5200,
      },
      mouseIdleTimeout: 20000,
      mouseSleepTimeout: 60000,
      yawnDuration: 8000,
      wakeDuration: 1500,
      collapseDuration: 5200,
      deepSleepTimeout: 600000,
      dndSkipYawn: true,
    },
    sleepSequence: { mode: 'direct' },
    hitBoxes: {
      default: { x: 0, y: 0, w: SPRITESHEET_WIDTH, h: SPRITESHEET_HEIGHT },
      sleeping: { x: 0, y: SPRITESHEET_HEIGHT * 0.5, w: SPRITESHEET_WIDTH, h: SPRITESHEET_HEIGHT * 0.5 },
    },
    displayHintMap: {},
  };
}

/**
 * Import a Codex Pet from a zip file path on disk.
 * Full flow: extract zip → validate → split atlas → generate theme → install.
 */
export async function importCodexPetFromPath(zipPath: string): Promise<ImportResult> {
  const { invoke } = await import('@tauri-apps/api/core');

  // 1. Extract zip via Rust (validates size, encryption, path traversal)
  let extractResult: { temp_dir: string; pet_json_path: string; spritesheet_path: string };
  try {
    extractResult = await invoke('codex_pet_extract_zip', { zipPath });
  } catch (err) {
    return { success: false, error: `Zip extraction failed: ${err}` };
  }

  // 2. Read and validate pet.json
  let petJsonContent: string;
  try {
    petJsonContent = await invoke<string>('read_file_content', { path: extractResult.pet_json_path });
  } catch (err) {
    return { success: false, error: `Failed to read pet.json: ${err}` };
  }

  let petJson: unknown;
  try {
    petJson = JSON.parse(petJsonContent);
  } catch {
    return { success: false, error: 'pet.json is not valid JSON' };
  }

  const validation = validatePetJson(petJson);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  const pet = petJson as CodexPetMeta;

  // 3. Validate spritesheet dimensions via Rust
  try {
    await invoke('codex_pet_validate_spritesheet', { path: extractResult.spritesheet_path });
  } catch (err) {
    return { success: false, error: `Spritesheet validation failed: ${err}` };
  }

  // 4. Split atlas via Rust
  const themesDir = await getThemesDir();
  const assetsDir = `${themesDir}/codex-pet-${pet.id}/assets`;

  let splitResult: { files: { state: string; path: string }[] };
  try {
    splitResult = await invoke('codex_pet_split_atlas', {
      spritesheetPath: extractResult.spritesheet_path,
      petId: pet.id,
      outputDir: assetsDir,
    });
  } catch (err) {
    return { success: false, error: `Atlas splitting failed: ${err}` };
  }

  // 5. Generate theme.json
  const theme = generateThemeJson(pet);

  // Update states to reference generated file names
  for (const { state, path: filePath } of splitResult.files) {
    const fileName = filePath.split('/').pop() ?? filePath;
    if (!theme.states[state]) theme.states[state] = [];
    if (!theme.states[state].includes(fileName)) {
      theme.states[state].push(fileName);
    }
  }

  // 6. Install theme
  try {
    await invoke('codex_pet_install_theme', {
      petId: pet.id,
      themeJson: JSON.stringify(theme),
      themesDir,
    });
  } catch (err) {
    return { success: false, error: `Theme install failed: ${err}` };
  }

  // 7. Cleanup temp directory
  try {
    await invoke('codex_pet_cleanup_temp', { tempDir: extractResult.temp_dir });
  } catch {
    // Non-fatal: temp dir will be cleaned by OS eventually
  }

  return { success: true, themeId: `codex-pet-${pet.id}` };
}

async function getThemesDir(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  // Returns ~/.abu/themes/
  return invoke('get_app_themes_dir');
}

/**
 * Import a Codex Pet from a remote URL
 */
export async function importCodexPetFromUrl(url: string): Promise<ImportResult> {
  const urlCheck = validateImportUrl(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  // In a real implementation, this would:
  // 1. Fetch the URL with timeout and redirect limits
  // 2. If it's a zip, process like importCodexPetFromFile
  // 3. If it's a pet.json, fetch the spritesheet from spritesheetPath

  return { success: false, error: 'URL import not yet implemented — use Tauri IPC' };
}
