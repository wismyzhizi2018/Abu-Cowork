/**
 * InteractionLayer — click / double-click / right-click / drag
 *
 * PRD §3:
 * - Single click: show HUD / focus terminal (Phase C)
 * - Double click (400ms): poke reaction
 * - Right click: context menu
 * - Drag: usePetDrag handles via Tauri startDragging
 */

import { useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { usePetStore } from '@/stores/petStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

interface InteractionLayerProps {
  children: React.ReactNode;
  onPoke?: (direction: 'left' | 'right') => void;
  onFlail?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  dragRef?: React.RefObject<HTMLElement | null>;
}

const DOUBLE_CLICK_MS = 400;
const QUICK_CLICK_COUNT = 4;
const _QUICK_CLICK_WINDOW = 800;

export default function InteractionLayer({ children, onPoke, onFlail, onDragStart, onDragEnd, dragRef }: InteractionLayerProps) {
  const updateMouseActivity = usePetStore((s) => s.updateMouseActivity);
  const lastClickTime = useRef(0);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mouse activity for sleep sequence
  useEffect(() => {
    const onMouseMove = () => updateMouseActivity();
    const onMouseDown = () => updateMouseActivity();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [updateMouseActivity]);

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button !== 0) return; // Left click only

      const now = Date.now();
      const timeSinceLast = now - lastClickTime.current;
      lastClickTime.current = now;

      clickCount.current++;

      // Clear pending timer
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }

      if (clickCount.current >= QUICK_CLICK_COUNT) {
        // 4x rapid click: flail easter egg (PRD §3.3)
        clickCount.current = 0;
        onFlail?.();
        return;
      }

      if (clickCount.current === 2 && timeSinceLast < DOUBLE_CLICK_MS) {
        // Double click: poke reaction
        clickCount.current = 0;
        const direction = e.clientX > (e.currentTarget as HTMLElement).offsetWidth / 2 ? 'right' : 'left';
        onPoke?.(direction);
        return;
      }

      // Single click (wait for possible double-click)
      clickTimer.current = setTimeout(() => {
        if (clickCount.current === 1) {
          // Single click: focus terminal / show HUD
          // For now, just focus the pet window
          getCurrentWindow().setFocus().catch(() => {});
        }
        clickCount.current = 0;
      }, DOUBLE_CLICK_MS);
    },
    [onPoke, onFlail],
  );

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      // Show native context menu via Tauri command
      invoke('pet_show_context_menu', {
        x: e.screenX,
        y: e.screenY,
      }).catch(() => {});
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button === 0) {
        // Pointer Capture prevents losing the drag target on rapid moves (PRD §3.1)
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        onDragStart?.();
        // BUG FIX: usePetDrag already calls startDragging via its own mousedown listener.
        // Don't call it again here — it would cause a double-startDragging.
      }
    },
    [onDragStart],
  );

  // Listen for drag end via mouseup
  useEffect(() => {
    const onMouseUp = () => {
      onDragEnd?.();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [onDragEnd]);

  return (
    <div
      ref={dragRef as React.RefObject<HTMLDivElement>}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      style={{
        width: '100%',
        height: '100%',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}
