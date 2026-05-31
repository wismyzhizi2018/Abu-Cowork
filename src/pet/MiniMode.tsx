/**
 * MiniMode — edge-embedded mini pet
 *
 * PRD §4:
 * - Enter via right-click menu or shortcut
 * - Exit via click on pet or shortcut
 * - State mapping: notification→mini-alert, attention→mini-happy, etc.
 * - Own timings independent of main state
 */

import { useEffect, useState, useCallback } from 'react';
import { usePetStore, type PetDisplayState } from '@/stores/petStore';
import { mapToMiniState } from '@/core/pet/stateMachine';
import { getAssetUrl, type ThemeConfig } from '@/core/pet/themeLoader';

interface MiniModeProps {
  theme: ThemeConfig | null;
  themePath: string;
  onExit: () => void;
}

export default function MiniMode({ theme, themePath, onExit }: MiniModeProps) {
  const displayState = usePetStore((s) => s.displayState);
  const [miniState, setMiniState] = useState<PetDisplayState>('mini-idle');
  const [isHovered, setIsHovered] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<string | null>(null);

  // Map full state to mini state
  useEffect(() => {
    const mapped = mapToMiniState(displayState);
    setMiniState(mapped);
  }, [displayState]);

  // Handle hover → mini-peek
  useEffect(() => {
    if (isHovered && miniState === 'mini-idle') {
      setMiniState('mini-peek');
    } else if (!isHovered && miniState === 'mini-peek') {
      setMiniState('mini-idle');
    }
  }, [isHovered, miniState]);

  // Resolve asset for mini state
  useEffect(() => {
    if (!theme?.miniMode || !themePath) return;

    // BUG FIX: Try requested state first, then fallback to mini-idle, then any mini state
    const files = theme.miniMode.states[miniState]
      ?? theme.miniMode.states['mini-idle']
      ?? Object.values(theme.miniMode.states)[0]
      ?? [];
    if (files.length > 0) {
      const url = getAssetUrl(themePath, files[0]);
      if (url) {
        setCurrentAsset(url);
        return;
      }
    }
    // Last resort: try main theme idle
    const idleFiles = theme.states['idle'] ?? [];
    if (idleFiles.length > 0) {
      const url = getAssetUrl(themePath, idleFiles[0]);
      if (url) setCurrentAsset(url);
    }
  }, [miniState, theme, themePath]);

  const handleClick = useCallback(() => {
    onExit();
  }, [onExit]);

  if (!currentAsset) return null;

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <img
        src={currentAsset}
        alt="Abu Mini"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
