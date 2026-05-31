/**
 * Pet Store — desktop pet state management
 *
 * Controls: enabled, mode (off/full/mini), size, theme, DND, position,
 * sleep sequence, and display state for the state machine.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PetMode = 'off' | 'full' | 'mini';
export type PetDisplayState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'building'
  | 'carrying'
  | 'attention'
  | 'sweeping'
  | 'notification'
  | 'error'
  | 'yawning'
  | 'dozing'
  | 'collapsing'
  | 'sleeping'
  | 'waking'
  // Mini states
  | 'mini-enter'
  | 'mini-idle'
  | 'mini-peek'
  | 'mini-alert'
  | 'mini-happy'
  | 'mini-sleep'
  | 'mini-crabwalk';

export interface PetState {
  // Core
  enabled: boolean;
  mode: PetMode;
  size: number; // 1-100 slider value
  themeId: string;
  dnd: boolean;

  // Position (physical pixels)
  positionX: number;
  positionY: number;
  positionSaved: boolean;

  // State machine
  displayState: PetDisplayState;
  previousState: PetDisplayState | null;
  stateQueue: PetDisplayState | null;
  stateEnteredAt: number;
  autoReturnAt: number | null;

  // Sleep
  sleepSequenceMode: 'full' | 'direct';
  lastMouseActivity: number;

  // Working tiers
  activeSessionCount: number;

  // Sound
  soundEnabled: boolean;
  lastSoundPlayedAt: Record<string, number>;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setMode: (mode: PetMode) => void;
  setSize: (size: number) => void;
  setThemeId: (id: string) => void;
  setDnd: (dnd: boolean) => void;
  setPosition: (x: number, y: number) => void;
  setDisplayState: (state: PetDisplayState) => void;
  setStateQueue: (state: PetDisplayState | null) => void;
  setAutoReturn: (at: number | null) => void;
  setPreviousState: (state: PetDisplayState | null) => void;
  setSleepSequenceMode: (mode: 'full' | 'direct') => void;
  updateMouseActivity: () => void;
  setActiveSessionCount: (count: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  recordSoundPlayed: (soundId: string) => void;
  resetPetState: () => void;
}

const INITIAL_STATE = {
  enabled: false,
  mode: 'off' as PetMode,
  size: 50,
  themeId: 'calico-placeholder',
  dnd: false,
  positionX: 0,
  positionY: 0,
  positionSaved: false,
  displayState: 'idle' as PetDisplayState,
  previousState: null as PetDisplayState | null,
  stateQueue: null as PetDisplayState | null,
  stateEnteredAt: Date.now(),
  autoReturnAt: null as number | null,
  sleepSequenceMode: 'full' as 'full' | 'direct',
  lastMouseActivity: Date.now(),
  activeSessionCount: 0,
  soundEnabled: true,
  lastSoundPlayedAt: {} as Record<string, number>,
};

export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setEnabled: (enabled) => set({ enabled }),
      setMode: (mode) => set({ mode }),
      setSize: (size) => set({ size: Math.max(1, Math.min(100, size)) }),
      setThemeId: (id) => set({ themeId: id }),
      setDnd: (dnd) => set({ dnd }),
      setPosition: (x, y) => set({ positionX: x, positionY: y, positionSaved: true }),
      setDisplayState: (state) =>
        set((s) => {
          // PRD §4.5: DND mode silently drops most state changes
          // Allow sleep-related states and idle to pass through
          const DND_ALLOWED: PetDisplayState[] = [
            'idle', 'yawning', 'dozing', 'collapsing', 'sleeping', 'waking',
            'mini-idle', 'mini-sleep',
          ];
          if (s.dnd && !DND_ALLOWED.includes(state)) {
            return s; // no-op
          }
          return {
            displayState: state,
            previousState: s.displayState,
            stateEnteredAt: Date.now(),
          };
        }),
      setStateQueue: (state) => set({ stateQueue: state }),
      setAutoReturn: (at) => set({ autoReturnAt: at }),
      setPreviousState: (state) => set({ previousState: state }),
      setSleepSequenceMode: (mode) => set({ sleepSequenceMode: mode }),
      updateMouseActivity: () => set({ lastMouseActivity: Date.now() }),
      setActiveSessionCount: (count) => set({ activeSessionCount: count }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      recordSoundPlayed: (soundId) =>
        set((s) => ({
          lastSoundPlayedAt: { ...s.lastSoundPlayedAt, [soundId]: Date.now() },
        })),
      resetPetState: () => set(INITIAL_STATE),
    }),
    {
      name: 'abu-pet',
      partialize: (state) => ({
        enabled: state.enabled,
        mode: state.mode,
        size: state.size,
        themeId: state.themeId,
        dnd: state.dnd,
        positionX: state.positionX,
        positionY: state.positionY,
        positionSaved: state.positionSaved,
        sleepSequenceMode: state.sleepSequenceMode,
        soundEnabled: state.soundEnabled,
      }),
    },
  ),
);
