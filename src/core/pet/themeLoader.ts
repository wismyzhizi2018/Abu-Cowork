/**
 * Theme loader — reads theme.json + caches asset URLs
 *
 * PRD §6: theme structure with viewBox, layout, eyeTracking, states,
 * timings, reactions, sounds, miniMode, etc.
 */

export interface ThemeTrackingLayer {
  ids: string[];
  classes?: string[];
  maxOffset: number;
  ease: number;
}

export interface ThemeEyeTracking {
  enabled: boolean;
  states: string[];
  eyeRatioX: number;
  eyeRatioY: number;
  maxOffset: number;
  bodyScale: number;
  shadowStretch: number;
  shadowShift: number;
  ids?: { eyes: string; body: string; shadow: string };
  trackingLayers?: Record<string, ThemeTrackingLayer>;
}

export interface ThemeTimings {
  minDisplay: Record<string, number>;
  autoReturn: Record<string, number>;
  mouseIdleTimeout: number;
  mouseSleepTimeout: number;
  yawnDuration: number;
  wakeDuration: number;
  collapseDuration: number;
  deepSleepTimeout: number;
  dndSkipYawn: boolean;
}

export interface ThemeLayout {
  contentBox: { x: number; y: number; width: number; height: number };
  centerX: number;
  baselineY: number;
  visibleHeightRatio: number;
  baselineBottomRatio: number;
}

export interface ThemeConfig {
  schemaVersion: number;
  name: string;
  author: string;
  version: string;
  description: string;
  viewBox: { x: number; y: number; width: number; height: number };
  layout: ThemeLayout;
  eyeTracking: ThemeEyeTracking;
  states: Record<string, string[]>;
  workingTiers?: { minSessions: number; file: string }[];
  idleAnimations?: { file: string; duration: number }[];
  timings: ThemeTimings;
  sleepSequence?: { mode: 'full' | 'direct' };
  hitBoxes?: Record<string, { x: number; y: number; w: number; h: number }>;
  reactions?: Record<string, { file?: string; files?: string[]; duration?: number }>;
  sounds?: Record<string, string>;
  miniMode?: {
    supported: boolean;
    flipAssets: boolean;
    offsetRatio: number;
    states: Record<string, string[]>;
    timings: Record<string, Record<string, number>>;
  };
  objectScale?: Record<string, unknown>;
  displayHintMap?: Record<string, string>;
}

interface CachedTheme {
  config: ThemeConfig;
  assetUrls: Map<string, string>;
  basePath: string;
}

const cache = new Map<string, CachedTheme>();

/**
 * Load theme.json from a base path (relative to app assets or filesystem).
 * Fetches the JSON and resolves all asset references to blob URLs.
 */
export async function loadTheme(basePath: string): Promise<ThemeConfig> {
  const jsonUrl = `${basePath}/theme.json`;
  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error(`Failed to load theme: ${res.status}`);

  const config: ThemeConfig = await res.json();

  // Collect all referenced asset files
  const assetFiles = new Set<string>();
  for (const files of Object.values(config.states)) {
    files.forEach((f) => assetFiles.add(f));
  }
  config.workingTiers?.forEach((t) => assetFiles.add(t.file));
  config.idleAnimations?.forEach((a) => assetFiles.add(a.file));
  if (config.reactions) {
    for (const r of Object.values(config.reactions)) {
      if (r.file) assetFiles.add(r.file);
      r.files?.forEach((f) => assetFiles.add(f));
    }
  }
  Object.values(config.sounds ?? {}).forEach((f) => assetFiles.add(f));
  if (config.miniMode) {
    for (const files of Object.values(config.miniMode.states)) {
      files.forEach((f) => assetFiles.add(f));
    }
  }

  // Cache asset URLs (direct references — no blob conversion needed for local assets)
  const assetUrls = new Map<string, string>();
  for (const file of assetFiles) {
    assetUrls.set(file, `${basePath}/assets/${file}`);
  }

  cache.set(basePath, { config, assetUrls, basePath });
  return config;
}

/**
 * Get the URL for a specific asset file in a loaded theme.
 */
export function getAssetUrl(themePath: string, fileName: string): string | null {
  const cached = cache.get(themePath);
  return cached?.assetUrls.get(fileName) ?? null;
}

/**
 * Get a loaded theme config by path.
 */
export function getThemeConfig(themePath: string): ThemeConfig | null {
  return cache.get(themePath)?.config ?? null;
}

/**
 * Get all state files for a given display state from a theme.
 */
export function getStateFiles(themePath: string, state: string): string[] {
  const config = getThemeConfig(themePath);
  if (!config) return [];
  return config.states[state] ?? [];
}

/**
 * Get the working tier file for a given session count.
 */
export function getWorkingTierFile(themePath: string, sessionCount: number): string | null {
  const config = getThemeConfig(themePath);
  if (!config?.workingTiers) return null;

  // Find the highest minSessions that doesn't exceed sessionCount
  let best: string | null = null;
  let bestMin = -1;
  for (const tier of config.workingTiers) {
    if (sessionCount >= tier.minSessions && tier.minSessions > bestMin) {
      best = tier.file;
      bestMin = tier.minSessions;
    }
  }
  return best;
}

/**
 * Get a random idle animation file + duration.
 */
export function getRandomIdleAnimation(
  themePath: string,
): { file: string; duration: number } | null {
  const config = getThemeConfig(themePath);
  if (!config?.idleAnimations?.length) return null;
  return config.idleAnimations[Math.floor(Math.random() * config.idleAnimations.length)];
}

/**
 * Clear all cached themes.
 */
export function clearThemeCache(): void {
  cache.clear();
}
