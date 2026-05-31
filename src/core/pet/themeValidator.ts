/**
 * Theme validator — validates theme.json structure
 *
 * PRD §6.1: Complete field reference for theme.json
 */

import type { ThemeConfig } from './themeLoader';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FIELDS = [
  'schemaVersion',
  'name',
  'viewBox',
  'layout',
  'eyeTracking',
  'states',
  'timings',
];

const VALID_STATES = [
  'idle',
  'thinking',
  'working',
  'building',
  'carrying',
  'attention',
  'sweeping',
  'notification',
  'error',
  'yawning',
  'dozing',
  'collapsing',
  'sleeping',
  'waking',
];

/**
 * Validate a theme.json configuration
 */
export function validateTheme(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Theme config is not an object'], warnings };
  }

  const c = config as Record<string, unknown>;

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in c)) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // schemaVersion
  if (c.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }

  // viewBox
  if (c.viewBox && typeof c.viewBox === 'object') {
    const vb = c.viewBox as Record<string, unknown>;
    if (typeof vb.width !== 'number' || vb.width <= 0) {
      errors.push('viewBox.width must be a positive number');
    }
    if (typeof vb.height !== 'number' || vb.height <= 0) {
      errors.push('viewBox.height must be a positive number');
    }
  }

  // states
  if (c.states && typeof c.states === 'object') {
    const states = c.states as Record<string, unknown>;
    for (const key of Object.keys(states)) {
      if (!VALID_STATES.includes(key)) {
        warnings.push(`Unknown state "${key}" — will be ignored if not handled`);
      }
      const files = states[key];
      if (!Array.isArray(files)) {
        errors.push(`states.${key} must be an array of file names`);
      }
    }

    // Must have idle
    if (!states.idle || (Array.isArray(states.idle) && states.idle.length === 0)) {
      errors.push('states must include at least one "idle" file');
    }
  }

  // eyeTracking
  if (c.eyeTracking && typeof c.eyeTracking === 'object') {
    const et = c.eyeTracking as Record<string, unknown>;
    if (typeof et.enabled !== 'boolean') {
      errors.push('eyeTracking.enabled must be a boolean');
    }
    if (et.enabled) {
      if (typeof et.eyeRatioX !== 'number' || et.eyeRatioX < 0 || et.eyeRatioX > 1) {
        errors.push('eyeTracking.eyeRatioX must be between 0 and 1');
      }
      if (typeof et.eyeRatioY !== 'number' || et.eyeRatioY < 0 || et.eyeRatioY > 1) {
        errors.push('eyeTracking.eyeRatioY must be between 0 and 1');
      }
      if (typeof et.maxOffset !== 'number' || et.maxOffset < 0) {
        errors.push('eyeTracking.maxOffset must be a non-negative number');
      }
    }
  }

  // timings
  if (c.timings && typeof c.timings === 'object') {
    const t = c.timings as Record<string, unknown>;
    const timingFields = [
      'mouseIdleTimeout',
      'mouseSleepTimeout',
      'yawnDuration',
      'wakeDuration',
      'collapseDuration',
      'deepSleepTimeout',
    ];
    for (const field of timingFields) {
      if (field in t && typeof t[field] !== 'number') {
        errors.push(`timings.${field} must be a number`);
      }
    }
  }

  // layout
  if (c.layout && typeof c.layout === 'object') {
    const l = c.layout as Record<string, unknown>;
    if (l.contentBox && typeof l.contentBox === 'object') {
      const cb = l.contentBox as Record<string, unknown>;
      if (typeof cb.width !== 'number' || typeof cb.height !== 'number') {
        errors.push('layout.contentBox must have numeric width and height');
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check if a theme has Mini mode support
 */
export function hasMiniSupport(config: ThemeConfig): boolean {
  return config.miniMode?.supported === true;
}

/**
 * Check if a theme uses SVG eye tracking (vs static APNG)
 */
export function hasEyeTracking(config: ThemeConfig): boolean {
  return config.eyeTracking?.enabled === true;
}
