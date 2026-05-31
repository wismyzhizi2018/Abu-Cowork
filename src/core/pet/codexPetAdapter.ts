/**
 * Codex Pet adapter — coordinates atlas splitting + theme generation
 *
 * PRD §7.4: Import flow
 * 1. Validate pet.json + spritesheet
 * 2. Send spritesheet to Rust for atlas → APNG splitting
 * 3. Generate theme.json with state mapping
 * 4. Install to ~/.abu/themes/codex-pet-{id}/
 */

import { invoke } from '@tauri-apps/api/core';
import type { CodexPetMeta, ImportResult } from './codexPetImporter';
import { validatePetJson, generateThemeJson } from './codexPetImporter';

interface SplitResult {
  files: { state: string; path: string }[];
}

/**
 * Full import flow for a Codex Pet.
 * petJson: parsed pet.json content
 * spritesheetPath: absolute path to spritesheet on disk (already extracted from zip)
 * themesDir: target themes directory (e.g. ~/.abu/themes/)
 */
export async function adaptCodexPet(
  petJson: unknown,
  spritesheetPath: string,
  themesDir: string,
): Promise<ImportResult> {
  // 1. Validate pet.json
  const validation = validatePetJson(petJson);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  const pet = petJson as CodexPetMeta;

  // 2. Call Rust side to split atlas into per-row APNGs
  let splitResult: SplitResult;
  try {
    splitResult = await invoke<SplitResult>('codex_pet_split_atlas', {
      spritesheetPath,
      petId: pet.id,
      outputDir: `${themesDir}/codex-pet-${pet.id}/assets`,
    });
  } catch (err) {
    return { success: false, error: `Atlas splitting failed: ${err}` };
  }

  // 3. Generate theme.json
  const theme = generateThemeJson(pet);

  // Update states to reference the actual generated file paths
  for (const { state, path: filePath } of splitResult.files) {
    const fileName = filePath.split('/').pop() ?? filePath;
    if (!theme.states[state]) theme.states[state] = [];
    theme.states[state].push(fileName);
  }

  // 4. Install theme.json via Rust
  try {
    await invoke('codex_pet_install_theme', {
      petId: pet.id,
      themeJson: JSON.stringify(theme),
      themesDir,
    });
  } catch (err) {
    return { success: false, error: `Theme install failed: ${err}` };
  }

  return { success: true, themeId: `codex-pet-${pet.id}` };
}

/**
 * Read pet.json from a zip file already extracted to a temp directory.
 */
export async function readPetJsonFromDir(tempDir: string): Promise<CodexPetMeta | null> {
  try {
    const content = await invoke<string>('read_file_content', {
      path: `${tempDir}/pet.json`,
    });
    return JSON.parse(content) as CodexPetMeta;
  } catch {
    return null;
  }
}
