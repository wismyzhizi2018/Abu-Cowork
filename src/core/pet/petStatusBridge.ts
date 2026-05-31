/**
 * Pet status bridge — main-window side
 *
 * Aggregates agent status across all conversations using the state machine,
 * and emits 'pet-status-update' events to the pet window.
 *
 * PRD §8: Agent events → state mapping + multi-session aggregation + debounce.
 *
 * Event mapping:
 *   agent_start / agent_thinking     → thinking
 *   agent_tool_start / agent_tool_end → working
 *   agent_complete                    → attention (one-shot)
 *   agent_error                       → error
 *   subagent_start                    → building (1个)
 *   subagent_multi                    → building (2+个)
 *   permission_request                → notification
 *   file_write_start                  → carrying
 *   file_sweep                        → sweeping
 *   session_idle                      → idle
 */

import { emitTo } from '@tauri-apps/api/event';
import { useChatStore } from '@/stores/chatStore';
import type { ConversationStatus } from '@/types';
import {
  type AgentEvent,
  mapAgentEvent,
  resolveDisplayState,
  type PetDisplayState,
} from '@/core/pet/stateMachine';

const MIN_INTERVAL_MS = 3_000;
const PET_WINDOW_LABEL = 'pet';
const EVENT_NAME = 'pet-status-update';

let lastEmittedState: PetDisplayState | null = null;
let lastEmittedAt = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let storeUnsub: (() => void) | null = null;

// Event buffer for agent events (separate from store-driven status)
const agentEventBuffer: { event: AgentEvent; sessionId: string; timestamp: number }[] = [];

function mapConversationStatus(s: ConversationStatus): PetDisplayState {
  switch (s) {
    case 'running':
      return 'working';
    case 'completed':
      return 'attention';
    case 'error':
      return 'error';
    case 'idle':
    default:
      return 'idle';
  }
}

function aggregateFromStore(): PetDisplayState {
  const convs = useChatStore.getState().conversations;
  const statuses = Object.values(convs).map((c) => mapConversationStatus(c.status));

  // Also consider recent agent events
  const now = Date.now();
  const recentEvents = agentEventBuffer.filter((e) => now - e.timestamp < 10_000);
  const eventStates = recentEvents.map((e) => mapAgentEvent(e.event));

  return resolveDisplayState([...statuses, ...eventStates], false);
}

function emitNow(state: PetDisplayState): void {
  emitTo(PET_WINDOW_LABEL, EVENT_NAME, { state }).catch(() => {
    // Pet window not open — silently drop
  });
  lastEmittedState = state;
  lastEmittedAt = Date.now();
}

function scheduleEmit(): void {
  const state = aggregateFromStore();
  if (state === lastEmittedState) return;

  const now = Date.now();
  const elapsed = now - lastEmittedAt;

  if (elapsed >= MIN_INTERVAL_MS) {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    emitNow(state);
    return;
  }

  const wait = MIN_INTERVAL_MS - elapsed;
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const latest = aggregateFromStore();
    emitNow(latest);
  }, wait);
}

/**
 * Record an agent event. This is called from the main window when agent
 * lifecycle events occur.
 */
export function recordAgentEvent(event: AgentEvent, sessionId: string): void {
  agentEventBuffer.push({ event, sessionId, timestamp: Date.now() });

  // Keep buffer size manageable
  if (agentEventBuffer.length > 100) {
    agentEventBuffer.splice(0, agentEventBuffer.length - 50);
  }

  scheduleEmit();
}

/**
 * Start subscribing to chatStore changes and emitting pet-status-update.
 * Idempotent — safe to call multiple times.
 */
export function startPetStatusBridge(): void {
  if (started) return;
  started = true;

  // Initial emit
  emitNow(aggregateFromStore());

  storeUnsub = useChatStore.subscribe(() => {
    scheduleEmit();
  });
}

export function stopPetStatusBridge(): void {
  if (!started) return;
  started = false;
  storeUnsub?.();
  storeUnsub = null;
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

/**
 * Force-emit the current state, bypassing debounce.
 */
export function resyncPetStatus(): void {
  if (!started) return;
  emitNow(aggregateFromStore());
}
