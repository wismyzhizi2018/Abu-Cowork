/**
 * EyeTracker — requestAnimationFrame-based eye tracking
 *
 * PRD §2.5: Two tracking systems (single-layer / multi-layer).
 * Low-power pause when idle > 5s. Adaptive polling interval.
 *
 * System A (default): Direct transform on eyes/body/shadow SVG elements.
 * System B (Calico theme): Multi-layer with lerp interpolation.
 */

import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ThemeEyeTracking } from '@/core/pet/themeLoader';

interface EyeTrackerProps {
  svgEl: SVGSVGElement | null;
  config: ThemeEyeTracking | null;
  displayState: string;
  isLowPower: boolean;
}

// Adaptive polling intervals (ms)
const INTERVALS = {
  dragging: 50,
  lowPowerIdle: 5000,
  lowPowerMini: 2000,
  activeIdle: 100,
  idle: 250,
  reacting: 500,
  background: 750,
};

// Max cursor distance for full eye offset (px)
const SATURATION_DISTANCE = 300;

function getCursorPos(): { x: number; y: number } {
  // Use a global mouse position tracker (set by the main process or DOM events)
  return (window as unknown as { __cursorPos?: { x: number; y: number } }).__cursorPos ?? { x: 0, y: 0 };
}

export default function EyeTracker({ svgEl, config, displayState, isLowPower }: EyeTrackerProps) {
  const rafId = useRef<number | null>(null);
  const lastTick = useRef(0);
  const isPaused = useRef(false);

  // System A state
  const eyeOffset = useRef({ dx: 0, dy: 0 });

  // System B state (multi-layer lerp)
  const layers = useRef<
    Map<string, { x: number; y: number; elements: SVGElement[]; maxOffset: number; ease: number }>
  >(new Map());

  // Cached window position (logical pixels, updated via onMoved)
  const winPosRef = useRef({ x: 0, y: 0 });

  // Latest props for RAF callback (avoids stale closures)
  const svgRef = useRef<SVGSVGElement | null>(null);
  const configRef = useRef<ThemeEyeTracking | null>(null);
  const isLowPowerRef = useRef(false);

  // Sync props to refs inside effects (not during render)
  useEffect(() => { svgRef.current = svgEl; });
  useEffect(() => { configRef.current = config; });
  useEffect(() => { isLowPowerRef.current = isLowPower; });

  // Cache window position for screen→viewport coordinate conversion
  useEffect(() => {
    const win = getCurrentWindow();
    win.outerPosition().then((pos) => {
      const scale = window.devicePixelRatio || 1;
      winPosRef.current = { x: pos.x / scale, y: pos.y / scale };
    });
    let unlisten: (() => void) | null = null;
    win.onMoved(({ payload }) => {
      const scale = window.devicePixelRatio || 1;
      winPosRef.current = { x: payload.x / scale, y: payload.y / scale };
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Initialize layers from config
  useEffect(() => {
    if (!svgEl || !config?.enabled) return;

    const newLayers = new Map<string, { x: number; y: number; elements: SVGElement[]; maxOffset: number; ease: number }>();

    if (config.trackingLayers) {
      // System B: multi-layer
      for (const [name, layerConfig] of Object.entries(config.trackingLayers)) {
        const elements: SVGElement[] = [];
        for (const id of layerConfig.ids) {
          const el = svgEl.querySelector(`#${id}`);
          if (el) elements.push(el as SVGElement);
        }
        for (const cls of layerConfig.classes ?? []) {
          svgEl.querySelectorAll(`.${cls}`).forEach((el) => elements.push(el as SVGElement));
        }
        newLayers.set(name, { x: 0, y: 0, elements, maxOffset: layerConfig.maxOffset, ease: layerConfig.ease });
      }
    } else if (config.ids) {
      // System A: single-layer
      const eyesEl = svgEl.querySelector(`#${config.ids.eyes}`);
      const bodyEl = svgEl.querySelector(`#${config.ids.body}`);
      const shadowEl = svgEl.querySelector(`#${config.ids.shadow}`);

      if (eyesEl) newLayers.set('eyes', { x: 0, y: 0, elements: [eyesEl as SVGElement], maxOffset: config.maxOffset, ease: 1 });
      if (bodyEl) newLayers.set('body', { x: 0, y: 0, elements: [bodyEl as SVGElement], maxOffset: config.maxOffset * config.bodyScale, ease: 1 });
      if (shadowEl) newLayers.set('shadow', { x: 0, y: 0, elements: [shadowEl as SVGElement], maxOffset: config.maxOffset * config.shadowStretch, ease: 1 });
    }

    layers.current = newLayers;
  }, [svgEl, config]);

  // RAF loop — tick logic lives here to satisfy react-hooks lint rules
  useEffect(() => {
    if (!config?.enabled) return;
    if (!config.states?.includes(displayState)) return;
    if (isPaused.current) return;

    const tick = () => {
      const svg = svgRef.current;
      const cfg = configRef.current;
      if (!svg || !cfg?.enabled) return;

      const now = performance.now();
      const interval = isLowPowerRef.current ? INTERVALS.lowPowerIdle : INTERVALS.idle;

      if (now - lastTick.current < interval) {
        rafId.current = requestAnimationFrame(tick);
        return;
      }
      lastTick.current = now;

      // Get cursor position (screen coords) and eye position (convert viewport → screen)
      const cursor = getCursorPos();
      const rect = svg.getBoundingClientRect();
      const { x: wx, y: wy } = winPosRef.current;
      const eyeX = wx + rect.left + rect.width * (cfg.eyeRatioX ?? 0.5);
      const eyeY = wy + rect.top + rect.height * (cfg.eyeRatioY ?? 0.5);

      const relX = cursor.x - eyeX;
      const relY = cursor.y - eyeY;
      const dist = Math.sqrt(relX * relX + relY * relY);
      const scale = Math.min(1, dist / SATURATION_DISTANCE);

      if (cfg.trackingLayers) {
        // System B: lerp each layer
        for (const [, layer] of layers.current) {
          const targetX = dist > 0 ? (relX / dist) * layer.maxOffset * scale : 0;
          const targetY = dist > 0 ? (relY / dist) * layer.maxOffset * scale : 0;

          // Clamp Y to 0.5×maxOffset, X to 0.85×maxOffset
          const clampedX = Math.max(-layer.maxOffset * 0.85, Math.min(layer.maxOffset * 0.85, targetX));
          const clampedY = Math.max(-layer.maxOffset * 0.5, Math.min(layer.maxOffset * 0.5, targetY));

          // Lerp
          layer.x += (clampedX - layer.x) * layer.ease;
          layer.y += (clampedY - layer.y) * layer.ease;

          // Quantize to 0.25px grid
          const qx = Math.round(layer.x * 4) / 4;
          const qy = Math.round(layer.y * 4) / 4;

          // Snap if close enough
          if (Math.abs(layer.x - clampedX) < 0.02) layer.x = clampedX;
          if (Math.abs(layer.y - clampedY) < 0.02) layer.y = clampedY;

          // Apply transform
          for (const el of layer.elements) {
            el.setAttribute('transform', `translate(${qx}, ${qy})`);
          }
        }
      } else {
        // System A: direct transform
        const maxOff = cfg.maxOffset ?? 20;
        const bodyScale = cfg.bodyScale ?? 0.33;
        const shadowStretch = cfg.shadowStretch ?? 0.15;
        const shadowShift = cfg.shadowShift ?? 0.3;

        const dx = dist > 0 ? Math.round((relX / dist) * maxOff * scale * 2) / 2 : 0;
        const dy = dist > 0 ? Math.round(Math.min(maxOff * 0.5, (relY / dist) * maxOff * scale) * 2) / 2 : 0;

        eyeOffset.current = { dx, dy };

        const bodyDx = Math.round(dx * bodyScale * 2) / 2;
        const bodyDy = Math.round(dy * bodyScale * 2) / 2;

        for (const [, layer] of layers.current) {
          if (layer.elements[0]?.id === cfg.ids?.eyes) {
            for (const el of layer.elements) {
              el.setAttribute('transform', `translate(${dx}, ${dy})`);
            }
          } else if (layer.elements[0]?.id === cfg.ids?.body) {
            for (const el of layer.elements) {
              el.setAttribute('transform', `translate(${bodyDx}, ${bodyDy})`);
            }
          } else if (layer.elements[0]?.id === cfg.ids?.shadow) {
            const shadowDx = bodyDx * shadowShift;
            const stretch = 1 + Math.abs(bodyDx) * shadowStretch;
            for (const el of layer.elements) {
              el.setAttribute('transform', `translate(${shadowDx}, 0) scale(${stretch}, 1)`);
            }
          }
        }
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [config, displayState]);

  // Low power pause/resume
  useEffect(() => {
    if (isLowPower) {
      isPaused.current = true;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    } else {
      isPaused.current = false;
      if (config?.enabled && config.states?.includes(displayState)) {
        // Restart RAF loop — the main effect will handle it on next render
        // Force re-render by toggling a no-op state would be wasteful.
        // Instead, directly start a new loop here.
        const tick = () => {
          const svg = svgRef.current;
          const cfg = configRef.current;
          if (!svg || !cfg?.enabled) return;

          const now = performance.now();
          const interval = INTERVALS.idle;
          if (now - lastTick.current < interval) {
            rafId.current = requestAnimationFrame(tick);
            return;
          }
          lastTick.current = now;

          const cursor = getCursorPos();
          const rect = svg.getBoundingClientRect();
          const { x: wx, y: wy } = winPosRef.current;
          const eyeX = wx + rect.left + rect.width * (cfg.eyeRatioX ?? 0.5);
          const eyeY = wy + rect.top + rect.height * (cfg.eyeRatioY ?? 0.5);
          const relX = cursor.x - eyeX;
          const relY = cursor.y - eyeY;
          const dist = Math.sqrt(relX * relX + relY * relY);
          const s = Math.min(1, dist / SATURATION_DISTANCE);

          if (cfg.trackingLayers) {
            for (const [, layer] of layers.current) {
              const targetX = dist > 0 ? (relX / dist) * layer.maxOffset * s : 0;
              const targetY = dist > 0 ? (relY / dist) * layer.maxOffset * s : 0;
              const clampedX = Math.max(-layer.maxOffset * 0.85, Math.min(layer.maxOffset * 0.85, targetX));
              const clampedY = Math.max(-layer.maxOffset * 0.5, Math.min(layer.maxOffset * 0.5, targetY));
              layer.x += (clampedX - layer.x) * layer.ease;
              layer.y += (clampedY - layer.y) * layer.ease;
              const qx = Math.round(layer.x * 4) / 4;
              const qy = Math.round(layer.y * 4) / 4;
              if (Math.abs(layer.x - clampedX) < 0.02) layer.x = clampedX;
              if (Math.abs(layer.y - clampedY) < 0.02) layer.y = clampedY;
              for (const el of layer.elements) {
                el.setAttribute('transform', `translate(${qx}, ${qy})`);
              }
            }
          } else {
            const maxOff = cfg.maxOffset ?? 20;
            const bodyScale = cfg.bodyScale ?? 0.33;
            const shadowStretch = cfg.shadowStretch ?? 0.15;
            const shadowShift = cfg.shadowShift ?? 0.3;
            const dx = dist > 0 ? Math.round((relX / dist) * maxOff * s * 2) / 2 : 0;
            const dy = dist > 0 ? Math.round(Math.min(maxOff * 0.5, (relY / dist) * maxOff * s) * 2) / 2 : 0;
            eyeOffset.current = { dx, dy };
            const bodyDx = Math.round(dx * bodyScale * 2) / 2;
            const bodyDy = Math.round(dy * bodyScale * 2) / 2;
            for (const [, layer] of layers.current) {
              if (layer.elements[0]?.id === cfg.ids?.eyes) {
                for (const el of layer.elements) el.setAttribute('transform', `translate(${dx}, ${dy})`);
              } else if (layer.elements[0]?.id === cfg.ids?.body) {
                for (const el of layer.elements) el.setAttribute('transform', `translate(${bodyDx}, ${bodyDy})`);
              } else if (layer.elements[0]?.id === cfg.ids?.shadow) {
                const shadowDx = bodyDx * shadowShift;
                const stretch = 1 + Math.abs(bodyDx) * shadowStretch;
                for (const el of layer.elements) el.setAttribute('transform', `translate(${shadowDx}, 0) scale(${stretch}, 1)`);
              }
            }
          }
          rafId.current = requestAnimationFrame(tick);
        };
        rafId.current = requestAnimationFrame(tick);
      }
    }
  }, [isLowPower, config, displayState]);

  // Cursor tracking via mousemove
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      (window as unknown as { __cursorPos: { x: number; y: number } }).__cursorPos = {
        x: e.screenX,
        y: e.screenY,
      };
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  return null; // No visual output — transforms SVG elements in-place
}
