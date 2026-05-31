/**
 * PetRenderer — SVG/APNG rendering + state switching
 *
 * Renders the current display state's animation asset.
 * - idle: SVG with eye tracking (if theme supports)
 * - other states: APNG/GIF/WebP loop
 * - one-shot states: auto-return after duration
 */

import { useEffect, useRef, useState } from 'react';
import { usePetStore } from '@/stores/petStore';
import {
  getAssetUrl,
  getStateFiles,
  getWorkingTierFile,
  getRandomIdleAnimation,
  type ThemeConfig,
} from '@/core/pet/themeLoader';

interface PetRendererProps {
  theme: ThemeConfig | null;
  themePath: string;
  onEyeTrackingRef?: (svgEl: SVGSVGElement | null) => void;
}

export default function PetRenderer({ theme, themePath, onEyeTrackingRef }: PetRendererProps) {
  const displayState = usePetStore((s) => s.displayState);
  const activeSessionCount = usePetStore(s => s.activeSessionCount);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string | null>(null);
  const [isSvg, setIsSvg] = useState(false);
  const idleAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleBaseAsset = useRef<string | null>(null);
  const idleBaseIsSvg = useRef(false);

  // Pass SVG ref up for eye tracking
  useEffect(() => {
    onEyeTrackingRef?.(svgRef.current);
  }, [currentAsset, onEyeTrackingRef]);

  // Resolve asset for current state
  useEffect(() => {
    if (!theme || !themePath) return;

    // Working tiers: override with session count
    if (displayState === 'working' || displayState === 'building') {
      const tierFile = getWorkingTierFile(themePath, activeSessionCount);
      if (tierFile) {
        const url = getAssetUrl(themePath, tierFile);
        if (url) {
          setCurrentAsset(url);
          setIsSvg(tierFile.endsWith('.svg'));
          return;
        }
      }
    }

    // Idle animations: alternate between follow-svg and random animation
    if (displayState === 'idle') {
      const files = getStateFiles(themePath, 'idle');
      if (files.length > 0) {
        const idleFile = files[0]; // Primary idle (SVG with eye tracking)
        const url = getAssetUrl(themePath, idleFile);
        if (url) {
          setCurrentAsset(url);
          setIsSvg(idleFile.endsWith('.svg'));
          idleBaseAsset.current = url;
          idleBaseIsSvg.current = idleFile.endsWith('.svg');

          // Schedule random idle animation after mouseIdleTimeout
          const anim = getRandomIdleAnimation(themePath);
          if (anim) {
            const mouseIdleTimeout = theme?.timings?.mouseIdleTimeout ?? 20_000;
            idleAnimTimer.current = setTimeout(() => {
              const animUrl = getAssetUrl(themePath, anim.file);
              if (animUrl) {
                setCurrentAsset(animUrl);
                setIsSvg(anim.file.endsWith('.svg'));
                // BUG FIX: Track inner timer to prevent leak
                idleReturnTimer.current = setTimeout(() => {
                  setCurrentAsset(url);
                  setIsSvg(idleFile.endsWith('.svg'));
                  idleReturnTimer.current = null;
                }, anim.duration);
              }
            }, mouseIdleTimeout);
          }
        }
        return;
      }
    }

    // Default: get state files from theme
    const files = getStateFiles(themePath, displayState);
    if (files.length > 0) {
      const file = files[0];
      const url = getAssetUrl(themePath, file);
      if (url) {
        setCurrentAsset(url);
        setIsSvg(file.endsWith('.svg'));
      }
    } else {
      // Fallback to idle
      const idleFiles = getStateFiles(themePath, 'idle');
      if (idleFiles.length > 0) {
        const url = getAssetUrl(themePath, idleFiles[0]);
        if (url) {
          setCurrentAsset(url);
          setIsSvg(idleFiles[0].endsWith('.svg'));
        }
      }
    }

    return () => {
      if (idleAnimTimer.current) {
        clearTimeout(idleAnimTimer.current);
        idleAnimTimer.current = null;
      }
      if (idleReturnTimer.current) {
        clearTimeout(idleReturnTimer.current);
        idleReturnTimer.current = null;
      }
    };
  }, [displayState, theme, themePath, activeSessionCount]);

  // BUG FIX: Mouse movement interrupts idle animation (PRD §1.4)
  useEffect(() => {
    if (displayState !== 'idle') return;

    const onMouseMove = () => {
      if (idleAnimTimer.current) {
        clearTimeout(idleAnimTimer.current);
        idleAnimTimer.current = null;
      }
      if (idleReturnTimer.current) {
        clearTimeout(idleReturnTimer.current);
        idleReturnTimer.current = null;
      }
      // Return to idle-follow SVG immediately
      if (idleBaseAsset.current) {
        setCurrentAsset(idleBaseAsset.current);
        setIsSvg(idleBaseIsSvg.current);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [displayState]);

  if (!currentAsset) {
    return <div style={{ width: '100%', height: '100%' }} />;
  }

  if (isSvg) {
    return (
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%' }}
        viewBox={theme ? `${theme.viewBox.x} ${theme.viewBox.y} ${theme.viewBox.width} ${theme.viewBox.height}` : '0 0 200 200'}
      >
        <image href={currentAsset} width="100%" height="100%" />
      </svg>
    );
  }

  return (
    <img
      src={currentAsset}
      alt="Abu"
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
      }}
    />
  );
}
