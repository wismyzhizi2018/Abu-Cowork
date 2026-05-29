import { describe, it, expect, beforeEach } from 'vitest';
import {
  reconcileActiveProvider,
  useSettingsStore,
  getActiveProvider,
  getActiveProviderAndModel,
  getActiveApiKey,
  providerRequiresApiKey,
  getEffectiveModel,
  resolveAgentModel,
  getAllEnabledModels,
  getAvailableProviders,
  PROVIDER_CONFIGS,
} from './settingsStore';
import type { ProviderInstance, ActiveModel } from '@/types/provider';

// ─── Test fixture helpers ─────────────────────────────────────

function makeProvider(overrides: Partial<ProviderInstance> = {}): ProviderInstance {
  return {
    id: 'p1',
    source: 'builtin',
    name: 'Provider 1',
    enabled: true,
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.example.com',
    apiKey: 'sk-test',
    models: [{ id: 'm1', label: 'Model 1' }],
    status: 'unchecked',
    sortOrder: 0,
    ...overrides,
  };
}

function makeState(
  providers: ProviderInstance[],
  activeModel: ActiveModel,
): { providers: ProviderInstance[]; activeModel: ActiveModel } {
  return { providers, activeModel };
}

describe('reconcileActiveProvider', () => {
  // ─── Branch 1: active provider exists and is enabled — no-op ───
  describe('when active provider is enabled', () => {
    it('leaves state unchanged', () => {
      const p = makeProvider({ id: 'p1', enabled: true, apiKey: 'key' });
      const state = makeState([p], { providerId: 'p1', modelId: 'm1' });
      const before = JSON.parse(JSON.stringify(state));

      reconcileActiveProvider(state);

      expect(state).toEqual(before);
    });
  });

  // ─── Branch 2: active provider missing entirely ───
  describe('when active provider does not exist in providers[]', () => {
    it('switches to first usable enabled provider (has key)', () => {
      const usable = makeProvider({
        id: 'usable',
        enabled: true,
        apiKey: 'key',
        models: [{ id: 'usable-m1', label: 'M1' }],
      });
      const enabledNoKey = makeProvider({
        id: 'enabled-no-key',
        enabled: true,
        apiKey: '',
        sortOrder: 1,
      });
      const state = makeState(
        [enabledNoKey, usable],
        { providerId: 'ghost', modelId: 'gone' },
      );

      reconcileActiveProvider(state);

      expect(state.activeModel).toEqual({
        providerId: 'usable',
        modelId: 'usable-m1',
      });
    });

    it('falls back to ollama (no key needed) if available', () => {
      const ollama = makeProvider({
        id: 'ollama',
        enabled: true,
        apiKey: '',
        models: [{ id: 'llama3', label: 'Llama 3' }],
      });
      const state = makeState([ollama], { providerId: 'ghost', modelId: 'gone' });

      reconcileActiveProvider(state);

      expect(state.activeModel).toEqual({
        providerId: 'ollama',
        modelId: 'llama3',
      });
    });

    it('falls back to any enabled provider if no usable one exists', () => {
      const enabledNoKey = makeProvider({
        id: 'p1',
        enabled: true,
        apiKey: '',
        models: [{ id: 'm1', label: 'M1' }],
      });
      const state = makeState([enabledNoKey], { providerId: 'ghost', modelId: 'gone' });

      reconcileActiveProvider(state);

      expect(state.activeModel).toEqual({
        providerId: 'p1',
        modelId: 'm1',
      });
    });

    it('leaves activeModel untouched if no enabled provider exists at all', () => {
      const disabled = makeProvider({ id: 'p1', enabled: false, apiKey: 'key' });
      const state = makeState([disabled], { providerId: 'ghost', modelId: 'gone' });

      reconcileActiveProvider(state);

      // No usable fallback — activeModel preserved (caller can detect via getActiveProvider returning undefined)
      expect(state.activeModel).toEqual({ providerId: 'ghost', modelId: 'gone' });
      // Importantly: does NOT silently force-enable a random disabled provider
      expect(state.providers[0].enabled).toBe(false);
    });

    it('handles provider with empty models array gracefully', () => {
      const noModels = makeProvider({
        id: 'p1',
        enabled: true,
        apiKey: 'key',
        models: [],
      });
      const state = makeState([noModels], { providerId: 'ghost', modelId: 'gone' });

      reconcileActiveProvider(state);

      expect(state.activeModel).toEqual({ providerId: 'p1', modelId: '' });
    });
  });

  // ─── Branch 3: active provider exists but is disabled, and is usable ───
  describe('when active provider is disabled but has a key', () => {
    it('silently re-enables it (preserves V14 default behavior)', () => {
      const p = makeProvider({ id: 'p1', enabled: false, apiKey: 'key' });
      const state = makeState([p], { providerId: 'p1', modelId: 'm1' });

      reconcileActiveProvider(state);

      expect(state.providers[0].enabled).toBe(true);
      expect(state.activeModel).toEqual({ providerId: 'p1', modelId: 'm1' });
    });

    it('silently re-enables ollama even with empty key', () => {
      const p = makeProvider({ id: 'ollama', enabled: false, apiKey: '' });
      const state = makeState([p], { providerId: 'ollama', modelId: 'm1' });

      reconcileActiveProvider(state);

      expect(state.providers[0].enabled).toBe(true);
    });

    it('treats whitespace-only apiKey as empty (not usable)', () => {
      const whitespaceKey = makeProvider({
        id: 'p1',
        enabled: false,
        apiKey: '   ',
      });
      const usableFallback = makeProvider({
        id: 'p2',
        enabled: true,
        apiKey: 'real-key',
        models: [{ id: 'm2', label: 'M2' }],
      });
      const state = makeState(
        [whitespaceKey, usableFallback],
        { providerId: 'p1', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      // Whitespace key is NOT considered usable → switch to p2
      expect(state.activeModel).toEqual({ providerId: 'p2', modelId: 'm2' });
      expect(state.providers[0].enabled).toBe(false); // p1 stays disabled
    });
  });

  // ─── Branch 4: active provider disabled AND unusable — needs fallback ───
  describe('when active provider is disabled and has no key', () => {
    it('switches active to a usable enabled fallback, leaving original disabled', () => {
      const disabledNoKey = makeProvider({
        id: 'p1',
        enabled: false,
        apiKey: '',
      });
      const usable = makeProvider({
        id: 'p2',
        enabled: true,
        apiKey: 'key',
        models: [{ id: 'm2', label: 'M2' }],
      });
      const state = makeState(
        [disabledNoKey, usable],
        { providerId: 'p1', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      expect(state.activeModel).toEqual({ providerId: 'p2', modelId: 'm2' });
      // Critical: original active provider STAYS disabled — user intent preserved
      expect(state.providers[0].enabled).toBe(false);
    });

    it('prefers fallback that is usable over fallback that is enabled-but-keyless', () => {
      const disabledNoKey = makeProvider({ id: 'p1', enabled: false, apiKey: '' });
      const enabledNoKey = makeProvider({
        id: 'enabled-no-key',
        enabled: true,
        apiKey: '',
        sortOrder: 1,
      });
      const usable = makeProvider({
        id: 'usable',
        enabled: true,
        apiKey: 'key',
        models: [{ id: 'usable-m', label: 'UM' }],
        sortOrder: 2,
      });
      const state = makeState(
        [disabledNoKey, enabledNoKey, usable],
        { providerId: 'p1', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      // Should pick `usable`, NOT `enabled-no-key`
      expect(state.activeModel.providerId).toBe('usable');
    });

    it('leaves provider disabled when no fallback exists and provider has no key', () => {
      // New behavior: no force-enable if the active provider has no key.
      // This keeps the first-run banner visible so the user is guided to configure.
      const disabledNoKey = makeProvider({
        id: 'p1',
        enabled: false,
        apiKey: '',
      });
      const otherDisabled = makeProvider({
        id: 'p2',
        enabled: false,
        apiKey: 'key',
        sortOrder: 1,
      });
      const state = makeState(
        [disabledNoKey, otherDisabled],
        { providerId: 'p1', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      // No usable fallback (p2 is disabled) and p1 has no key →
      // leave disabled so the first-run banner keeps showing.
      expect(state.providers[0].enabled).toBe(false);
      expect(state.activeModel).toEqual({ providerId: 'p1', modelId: 'm1' });
      expect(state.providers[1].enabled).toBe(false); // p2 untouched
    });

    it('does not consider self as fallback (the id !== self guard)', () => {
      // Only provider has no key → stays disabled (no force-enable).
      const disabledNoKey = makeProvider({
        id: 'p1',
        enabled: false,
        apiKey: '',
      });
      const state = makeState([disabledNoKey], { providerId: 'p1', modelId: 'm1' });

      reconcileActiveProvider(state);

      expect(state.providers[0].enabled).toBe(false);
    });
  });

  // ─── User-reported scenario: V14 migration aftermath ───
  describe('regression scenarios', () => {
    it('handles "user disabled active, has another usable provider" (the original bug)', () => {
      // User had minimax (active) with key, then toggled it off to switch to didi
      // App restart → onRehydrateStorage runs
      const minimax = makeProvider({
        id: 'minimax',
        enabled: false, // user toggled off
        apiKey: '', // key was cleared at some point
      });
      const didi = makeProvider({
        id: 'didi',
        enabled: true,
        apiKey: 'didi-key',
        models: [{ id: 'glm-5', label: 'GLM 5' }],
      });
      const state = makeState(
        [minimax, didi],
        { providerId: 'minimax', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      // Active should switch to didi (the usable one), minimax stays disabled
      expect(state.activeModel.providerId).toBe('didi');
      expect(state.providers.find(p => p.id === 'minimax')!.enabled).toBe(false);
    });

    it('handles "qiniu placeholder + new minimax" V14 migration aftermath', () => {
      // V14 migration created qiniu (default active, enabled, no key)
      // User then added minimax with key
      // Active is still qiniu — onRehydrate should keep this state stable
      // because qiniu is still enabled, even though it has no key.
      const qiniu = makeProvider({
        id: 'qiniu',
        enabled: true, // default-enabled by V14
        apiKey: '',
      });
      const minimax = makeProvider({
        id: 'minimax',
        enabled: true,
        apiKey: 'mm-key',
        sortOrder: 1,
      });
      const state = makeState(
        [qiniu, minimax],
        { providerId: 'qiniu', modelId: 'm1' },
      );

      reconcileActiveProvider(state);

      // qiniu is enabled → branch 1 hit → no changes
      expect(state.activeModel).toEqual({ providerId: 'qiniu', modelId: 'm1' });
      expect(state.providers[0].enabled).toBe(true);
      // (The needsSetup banner is now correctly suppressed by the new
      // ChatView predicate because minimax has a key — that's tested
      // separately by ChatView, not here.)
    });
  });
});

// ─── Whitespace trimming at the store boundary ──────────────────
// Regression coverage for the trailing-space-in-baseUrl bug:
// users pasting URLs like "http://x.com/ " would hit /%20/v1/... 404s.
describe('settingsStore whitespace trim', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      providers: [],
      auxiliaryServices: {},
    });
  });

  describe('addProvider', () => {
    it('trims whitespace from baseUrl and apiKey on create', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: '  http://x.com/ ',
        apiKey: ' sk-test\n',
        models: [{ id: 'm1', label: 'M1' }],
      });
      const p = useSettingsStore.getState().providers.find((x) => x.id === id);
      expect(p?.baseUrl).toBe('http://x.com/');
      expect(p?.apiKey).toBe('sk-test');
    });
  });

  describe('updateProvider', () => {
    it('trims whitespace from baseUrl patch', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: 'http://x.com',
        apiKey: 'sk-test',
        models: [{ id: 'm1', label: 'M1' }],
      });
      useSettingsStore.getState().updateProvider(id, {
        baseUrl: '  http://y.com/ ',
        apiKey: ' sk-new ',
      });
      const p = useSettingsStore.getState().providers.find((x) => x.id === id);
      expect(p?.baseUrl).toBe('http://y.com/');
      expect(p?.apiKey).toBe('sk-new');
    });

    it('leaves other fields alone when patch omits baseUrl/apiKey', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: 'http://x.com',
        apiKey: 'sk-test',
        models: [{ id: 'm1', label: 'M1' }],
      });
      useSettingsStore.getState().updateProvider(id, { enabled: false });
      const p = useSettingsStore.getState().providers.find((x) => x.id === id);
      expect(p?.enabled).toBe(false);
      expect(p?.baseUrl).toBe('http://x.com');
      expect(p?.apiKey).toBe('sk-test');
    });
  });

  describe('setAuxiliaryWebSearch', () => {
    it('trims whitespace from baseUrl and apiKey', () => {
      useSettingsStore.getState().setAuxiliaryWebSearch({
        provider: 'tavily',
        apiKey: '  key-123 ',
        baseUrl: ' http://search.example.com/ ',
      });
      const cfg = useSettingsStore.getState().auxiliaryServices.webSearch;
      expect(cfg?.apiKey).toBe('key-123');
      expect(cfg?.baseUrl).toBe('http://search.example.com/');
    });
  });

  describe('setAuxiliaryImageGen', () => {
    it('trims whitespace from baseUrl and apiKey', () => {
      useSettingsStore.getState().setAuxiliaryImageGen({
        apiKey: ' imgkey ',
        baseUrl: '  http://img.example.com/ ',
        model: 'dall-e-3',
      });
      const cfg = useSettingsStore.getState().auxiliaryServices.imageGen;
      expect(cfg?.apiKey).toBe('imgkey');
      expect(cfg?.baseUrl).toBe('http://img.example.com/');
    });
  });
});

// ─── Helper function tests ─────────────────────────────────────

describe('settingsStore helper functions', () => {
  describe('getAvailableProviders', () => {
    it('returns array of provider IDs', () => {
      const providers = getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('ollama');
    });
  });

  describe('PROVIDER_CONFIGS', () => {
    it('has configs for all known providers', () => {
      expect(PROVIDER_CONFIGS.anthropic).toBeDefined();
      expect(PROVIDER_CONFIGS.openai).toBeDefined();
      expect(PROVIDER_CONFIGS.deepseek).toBeDefined();
    });

    it('each config has required fields', () => {
      for (const [, config] of Object.entries(PROVIDER_CONFIGS)) {
        expect(typeof config.name).toBe('string');
        expect(typeof config.baseUrl).toBe('string');
        expect(typeof config.format).toBe('string');
        expect(Array.isArray(config.models)).toBe(true);
      }
    });
  });

  describe('getActiveProvider', () => {
    it('returns matching provider', () => {
      const p = makeProvider({ id: 'p1', enabled: true });
      const state = makeState([p], { providerId: 'p1', modelId: 'm1' });
      expect(getActiveProvider(state)).toBe(p);
    });

    it('returns undefined when not found', () => {
      const state = makeState([], { providerId: 'x', modelId: '' });
      expect(getActiveProvider(state)).toBeUndefined();
    });
  });

  describe('getActiveProviderAndModel', () => {
    it('returns provider and modelId when enabled', () => {
      const p = makeProvider({ id: 'p1', enabled: true });
      const state = makeState([p], { providerId: 'p1', modelId: 'm1' });
      const result = getActiveProviderAndModel(state);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe(p);
      expect(result!.modelId).toBe('m1');
    });

    it('returns null when provider is disabled', () => {
      const p = makeProvider({ id: 'p1', enabled: false });
      const state = makeState([p], { providerId: 'p1', modelId: 'm1' });
      expect(getActiveProviderAndModel(state)).toBeNull();
    });
  });

  describe('getActiveApiKey', () => {
    it('returns API key of active provider', () => {
      const p = makeProvider({ id: 'p1', apiKey: 'sk-test' });
      const state = makeState([p], { providerId: 'p1', modelId: '' });
      expect(getActiveApiKey(state)).toBe('sk-test');
    });

    it('returns empty string when not found', () => {
      const state = makeState([], { providerId: 'x', modelId: '' });
      expect(getActiveApiKey(state)).toBe('');
    });
  });

  describe('providerRequiresApiKey', () => {
    it('returns true for anthropic', () => {
      const state = makeState([], { providerId: 'anthropic', modelId: '' });
      expect(providerRequiresApiKey(state)).toBe(true);
    });

    it('returns false for ollama', () => {
      const state = makeState([], { providerId: 'ollama', modelId: '' });
      expect(providerRequiresApiKey(state)).toBe(false);
    });

    it('returns false for lmstudio', () => {
      const state = makeState([], { providerId: 'lmstudio', modelId: '' });
      expect(providerRequiresApiKey(state)).toBe(false);
    });
  });

  describe('getEffectiveModel', () => {
    it('returns active model ID', () => {
      const state = makeState([], { providerId: 'x', modelId: 'claude-sonnet-4-6' });
      expect(getEffectiveModel(state)).toBe('claude-sonnet-4-6');
    });
  });

  describe('resolveAgentModel', () => {
    it('returns global model when agentModel is undefined', () => {
      const state = makeState([], { providerId: 'x', modelId: 'global' });
      expect(resolveAgentModel(undefined, state)).toBe('global');
    });

    it('returns global model when agentModel is "inherit"', () => {
      const state = makeState([], { providerId: 'x', modelId: 'global' });
      expect(resolveAgentModel('inherit', state)).toBe('global');
    });

    it('returns agentModel when found in enabled provider', () => {
      const p = makeProvider({ enabled: true, models: [{ id: 'special', label: 'S' }] });
      const state = makeState([p], { providerId: 'x', modelId: 'global' });
      expect(resolveAgentModel('special', state)).toBe('special');
    });

    it('falls back to global when not found', () => {
      const p = makeProvider({ enabled: true, models: [{ id: 'other', label: 'O' }] });
      const state = makeState([p], { providerId: 'x', modelId: 'global' });
      expect(resolveAgentModel('nonexistent', state)).toBe('global');
    });
  });

  describe('getAllEnabledModels', () => {
    it('returns models from enabled providers only', () => {
      const p1 = makeProvider({ id: 'a', enabled: true, sortOrder: 0 });
      const p2 = makeProvider({ id: 'b', enabled: false, sortOrder: 1 });
      const state = makeState([p1, p2], { providerId: '', modelId: '' });
      expect(getAllEnabledModels(state)).toHaveLength(1);
    });

    it('sorts by sortOrder', () => {
      const p1 = makeProvider({ id: 'a', enabled: true, sortOrder: 1, models: [{ id: 'm1', label: 'M1' }] });
      const p2 = makeProvider({ id: 'b', enabled: true, sortOrder: 0, models: [{ id: 'm2', label: 'M2' }] });
      const state = makeState([p1, p2], { providerId: '', modelId: '' });
      const result = getAllEnabledModels(state);
      expect(result[0].model.id).toBe('m2');
    });

    it('returns empty when no providers enabled', () => {
      const state = makeState([makeProvider({ enabled: false })], { providerId: '', modelId: '' });
      expect(getAllEnabledModels(state)).toEqual([]);
    });
  });
});

// ─── Store action tests ────────────────────────────────────────

describe('settingsStore actions', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      providers: [],
      activeModel: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
      recentModels: [],
      favoriteModels: [],
      auxiliaryServices: {},
    });
  });

  describe('toggleProvider', () => {
    it('toggles enabled state', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: 'http://x.com',
        apiKey: 'key',
        models: [],
      });
      useSettingsStore.getState().toggleProvider(id);
      expect(useSettingsStore.getState().providers.find(p => p.id === id)?.enabled).toBe(false);
      useSettingsStore.getState().toggleProvider(id);
      expect(useSettingsStore.getState().providers.find(p => p.id === id)?.enabled).toBe(true);
    });
  });

  describe('selectModel', () => {
    it('updates activeModel and recentModels', () => {
      useSettingsStore.getState().selectModel('anthropic', 'claude-opus-4-6');
      expect(useSettingsStore.getState().activeModel).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-6',
      });
      expect(useSettingsStore.getState().recentModels[0]).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-6',
      });
    });

    it('deduplicates recentModels', () => {
      useSettingsStore.getState().selectModel('a', 'm1');
      useSettingsStore.getState().selectModel('b', 'm2');
      useSettingsStore.getState().selectModel('a', 'm1');
      expect(useSettingsStore.getState().recentModels[0].modelId).toBe('m1');
      expect(useSettingsStore.getState().recentModels.filter(r => r.modelId === 'm1')).toHaveLength(1);
    });
  });

  describe('toggleFavorite', () => {
    it('adds and removes favorites', () => {
      useSettingsStore.getState().toggleFavorite('a', 'm1');
      expect(useSettingsStore.getState().favoriteModels).toHaveLength(1);
      useSettingsStore.getState().toggleFavorite('a', 'm1');
      expect(useSettingsStore.getState().favoriteModels).toHaveLength(0);
    });
  });

  describe('toggleSkillEnabled', () => {
    it('toggles skill in disabledSkills', () => {
      useSettingsStore.getState().toggleSkillEnabled('test-skill');
      expect(useSettingsStore.getState().disabledSkills).toContain('test-skill');
      useSettingsStore.getState().toggleSkillEnabled('test-skill');
      expect(useSettingsStore.getState().disabledSkills).not.toContain('test-skill');
    });
  });

  describe('toggleAgentEnabled', () => {
    it('toggles agent in disabledAgents', () => {
      useSettingsStore.getState().toggleAgentEnabled('test-agent');
      expect(useSettingsStore.getState().disabledAgents).toContain('test-agent');
      useSettingsStore.getState().toggleAgentEnabled('test-agent');
      expect(useSettingsStore.getState().disabledAgents).not.toContain('test-agent');
    });
  });

  describe('setProactivity', () => {
    it('updates soul proactivity', () => {
      useSettingsStore.getState().setProactivity('butler');
      expect(useSettingsStore.getState().soul.proactivity).toBe('butler');
    });
  });

  describe('setContentGuardEnabled', () => {
    it('toggles content guard', () => {
      useSettingsStore.getState().setContentGuardEnabled(false);
      expect(useSettingsStore.getState().safety.enableContentGuard).toBe(false);
      useSettingsStore.getState().setContentGuardEnabled(true);
      expect(useSettingsStore.getState().safety.enableContentGuard).toBe(true);
    });
  });

  describe('removeProvider', () => {
    it('removes provider and updates activeModel if needed', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: 'http://x.com',
        apiKey: 'key',
        models: [{ id: 'm1', label: 'M1' }],
      });
      useSettingsStore.getState().selectModel(id, 'm1');
      useSettingsStore.getState().removeProvider(id);
      expect(useSettingsStore.getState().providers.find(p => p.id === id)).toBeUndefined();
    });
  });

  describe('addModelToProvider / removeModelFromProvider', () => {
    it('adds and removes models', () => {
      const id = useSettingsStore.getState().addProvider({
        source: 'custom',
        name: 'test',
        enabled: true,
        apiFormat: 'openai-compatible',
        baseUrl: 'http://x.com',
        apiKey: 'key',
        models: [],
      });
      useSettingsStore.getState().addModelToProvider(id, { id: 'new-model', label: 'New' });
      expect(useSettingsStore.getState().providers.find(p => p.id === id)?.models).toHaveLength(1);
      useSettingsStore.getState().removeModelFromProvider(id, 'new-model');
      expect(useSettingsStore.getState().providers.find(p => p.id === id)?.models).toHaveLength(0);
    });
  });

  describe('reorderProviders', () => {
    it('updates sortOrder based on ID array index', () => {
      useSettingsStore.getState().addProvider({ source: 'custom', name: 'first', enabled: true, apiFormat: 'openai-compatible', baseUrl: 'http://a.com', apiKey: 'k', models: [] });
      useSettingsStore.getState().addProvider({ source: 'custom', name: 'second', enabled: true, apiFormat: 'openai-compatible', baseUrl: 'http://b.com', apiKey: 'k', models: [] });
      const ids = useSettingsStore.getState().providers.map(p => p.id);
      const reversed = [...ids].reverse();
      useSettingsStore.getState().reorderProviders(reversed);
      // sortOrder is updated based on position in the ids array
      const providers = useSettingsStore.getState().providers;
      expect(providers.find(p => p.id === reversed[0])?.sortOrder).toBe(0);
      expect(providers.find(p => p.id === reversed[1])?.sortOrder).toBe(1);
    });
  });

  describe('setProviderStatus', () => {
    it('updates provider status and latency', () => {
      const id = useSettingsStore.getState().addProvider({ source: 'custom', name: 'test', enabled: true, apiFormat: 'openai-compatible', baseUrl: 'http://x.com', apiKey: 'k', models: [] });
      useSettingsStore.getState().setProviderStatus(id, 'ok', undefined, 150);
      const p = useSettingsStore.getState().providers.find(x => x.id === id);
      expect(p?.status).toBe('ok');
      expect(p?.statusLatency).toBe(150);
    });

    it('updates provider status with error message', () => {
      const id = useSettingsStore.getState().addProvider({ source: 'custom', name: 'test', enabled: true, apiFormat: 'openai-compatible', baseUrl: 'http://x.com', apiKey: 'k', models: [] });
      useSettingsStore.getState().setProviderStatus(id, 'error', 'Connection failed');
      const p = useSettingsStore.getState().providers.find(x => x.id === id);
      expect(p?.status).toBe('error');
      expect(p?.statusMessage).toBe('Connection failed');
    });
  });

  describe('setProviderModels', () => {
    it('replaces provider models', () => {
      const id = useSettingsStore.getState().addProvider({ source: 'custom', name: 'test', enabled: true, apiFormat: 'openai-compatible', baseUrl: 'http://x.com', apiKey: 'k', models: [{ id: 'old', label: 'Old' }] });
      useSettingsStore.getState().setProviderModels(id, [{ id: 'new1', label: 'New 1' }, { id: 'new2', label: 'New 2' }]);
      const p = useSettingsStore.getState().providers.find(x => x.id === id);
      expect(p?.models).toHaveLength(2);
      expect(p?.models[0].id).toBe('new1');
    });
  });

  describe('setTheme', () => {
    it('updates theme', () => {
      useSettingsStore.getState().setTheme('dark');
      expect(useSettingsStore.getState().theme).toBe('dark');
      useSettingsStore.getState().setTheme('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });
  });

  describe('toggleSettings / toggleSidebar / toggleRightPanel', () => {
    it('toggles settings open/close', () => {
      const before = useSettingsStore.getState().showSettings;
      useSettingsStore.getState().toggleSettings();
      expect(useSettingsStore.getState().showSettings).toBe(!before);
    });

    it('toggles sidebar', () => {
      const before = useSettingsStore.getState().sidebarCollapsed;
      useSettingsStore.getState().toggleSidebar();
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(!before);
    });

    it('toggles right panel', () => {
      const before = useSettingsStore.getState().rightPanelCollapsed;
      useSettingsStore.getState().toggleRightPanel();
      expect(useSettingsStore.getState().rightPanelCollapsed).toBe(!before);
    });
  });

  describe('setViewMode', () => {
    it('updates view mode', () => {
      useSettingsStore.getState().setViewMode('settings');
      expect(useSettingsStore.getState().viewMode).toBe('settings');
      useSettingsStore.getState().setViewMode('chat');
      expect(useSettingsStore.getState().viewMode).toBe('chat');
    });
  });

  describe('setAgentMaxTurns', () => {
    it('sets agent max turns', () => {
      useSettingsStore.getState().setAgentMaxTurns(50);
      expect(useSettingsStore.getState().agentMaxTurns).toBe(50);
    });

    it('sets undefined to clear', () => {
      useSettingsStore.getState().setAgentMaxTurns(50);
      useSettingsStore.getState().setAgentMaxTurns(undefined);
      expect(useSettingsStore.getState().agentMaxTurns).toBeUndefined();
    });
  });

  describe('setSandboxEnabled', () => {
    it('toggles sandbox', () => {
      useSettingsStore.getState().setSandboxEnabled(false);
      expect(useSettingsStore.getState().sandboxEnabled).toBe(false);
      useSettingsStore.getState().setSandboxEnabled(true);
      expect(useSettingsStore.getState().sandboxEnabled).toBe(true);
    });
  });

  describe('autoDisableProjectSkills', () => {
    it('adds skill names to disabledSkills if not already disabled', () => {
      useSettingsStore.getState().autoDisableProjectSkills(['skill-a', 'skill-b']);
      expect(useSettingsStore.getState().disabledSkills).toContain('skill-a');
      expect(useSettingsStore.getState().disabledSkills).toContain('skill-b');
    });

    it('does not duplicate already disabled skills', () => {
      useSettingsStore.getState().toggleSkillEnabled('skill-a');
      useSettingsStore.getState().autoDisableProjectSkills(['skill-a', 'skill-b']);
      const count = useSettingsStore.getState().disabledSkills.filter(s => s === 'skill-a').length;
      expect(count).toBe(1);
    });
  });
});
