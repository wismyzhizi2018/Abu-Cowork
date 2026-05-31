/**
 * Sound player — DND-aware, cooldown-protected
 *
 * PRD §2.4: complete.mp3 (attention) and confirm.mp3 (notification),
 * both <1s with 10s cooldown. DND mode mutes all.
 */

const SOUND_COOLDOWN_MS = 10_000;

interface SoundEntry {
  el: HTMLAudioElement | null;
  url: string;
}

const sounds: Record<string, SoundEntry> = {};
const lastPlayed: Record<string, number> = {};

let _dnd = false;
let _muted = false;

export function setDndMode(dnd: boolean): void {
  _dnd = dnd;
}

export function setMuted(muted: boolean): void {
  _muted = muted;
}

/**
 * Register a sound. Call once at init with the asset URL.
 */
export function registerSound(id: string, url: string): void {
  sounds[id] = { el: null, url };
}

/**
 * Play a sound if allowed. Returns true if playback started.
 */
export function playSound(id: string): boolean {
  if (_dnd || _muted) return false;

  const now = Date.now();
  const last = lastPlayed[id] ?? 0;
  if (now - last < SOUND_COOLDOWN_MS) return false;

  const entry = sounds[id];
  if (!entry) return false;

  // Lazy-create Audio element
  if (!entry.el) {
    entry.el = new Audio(entry.url);
    entry.el.preload = 'auto';
  }

  // Reset and play
  entry.el.currentTime = 0;
  entry.el.play().catch(() => {
    // Autoplay blocked — ignore
  });
  lastPlayed[id] = now;
  return true;
}

/**
 * Cleanup all audio elements.
 */
export function disposeSounds(): void {
  for (const entry of Object.values(sounds)) {
    if (entry.el) {
      entry.el.pause();
      entry.el.src = '';
      entry.el = null;
    }
  }
}
