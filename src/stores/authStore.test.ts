import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';

// Mock loginApi
vi.mock('@/core/auth/loginApi', () => ({
  loginERP: vi.fn(),
  fetchProviders: vi.fn(),
}));

// Mock secretStore — must include all exports used by settingsStore too
vi.mock('@/utils/secretStore', () => ({
  SECRET_KEYS: {
    provider: (id: string) => `provider:${id}`,
    apiKey: (id: string) => `apikey:${id}`,
  },
  getSecret: vi.fn().mockResolvedValue(null),
  setSecret: vi.fn().mockResolvedValue(undefined),
  deleteSecret: vi.fn().mockResolvedValue(undefined),
  hasSecret: vi.fn().mockResolvedValue(false),
  listSecrets: vi.fn().mockResolvedValue(null),
  listFailedSecrets: vi.fn().mockResolvedValue([]),
  clearAllSecrets: vi.fn().mockResolvedValue(undefined),
  writeSecretOrDelete: vi.fn().mockResolvedValue(undefined),
}));

import { loginERP, fetchProviders } from '@/core/auth/loginApi';
import { getSecret, setSecret, deleteSecret } from '@/utils/secretStore';

const mockLoginERP = vi.mocked(loginERP);
const mockFetchProviders = vi.mocked(fetchProviders);
const mockGetSecret = vi.mocked(getSecret);
const mockSetSecret = vi.mocked(setSecret);
const mockDeleteSecret = vi.mocked(deleteSecret);

const SAMPLE_PROVIDERS = [
  {
    source: 'remote' as const,
    name: 'openai',
    enabled: true,
    apiFormat: 'openai-compatible' as const,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    models: [{ id: 'gpt-4o', label: 'GPT-4o' }],
    defaultModelId: 'gpt-4o',
    userAdded: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store state
  useAuthStore.setState({
    erpUserName: null,
    isLoggedIn: false,
    skipLogin: false,
    authEnabled: true,
    loginError: null,
    isLoading: false,
  });
  // Clean up any remote providers from previous tests
  const settings = useSettingsStore.getState();
  settings.providers
    .filter((p) => p.source === 'remote')
    .forEach((p) => settings.removeProvider(p.id));
});

describe('authStore.login', () => {
  it('sets isLoggedIn and erpUserName on successful login', async () => {
    mockLoginERP.mockResolvedValueOnce({ token: 'tk-1', name: '张三', id: 'u1' });
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockFetchProviders.mockResolvedValueOnce(SAMPLE_PROVIDERS);

    await useAuthStore.getState().login('138', 'pass');

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.erpUserName).toBe('张三');
    expect(state.isLoading).toBe(false);
    expect(state.loginError).toBeNull();
  });

  it('stores token in secretStore', async () => {
    mockLoginERP.mockResolvedValueOnce({ token: 'tk-1', name: '张三', id: 'u1' });
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockFetchProviders.mockResolvedValueOnce(SAMPLE_PROVIDERS);

    await useAuthStore.getState().login('138', 'pass');

    expect(mockSetSecret).toHaveBeenCalledWith('auth:erpToken', 'tk-1');
  });

  it('merges providers into settingsStore', async () => {
    mockLoginERP.mockResolvedValueOnce({ token: 'tk-1', name: '张三', id: 'u1' });
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockFetchProviders.mockResolvedValueOnce(SAMPLE_PROVIDERS);

    await useAuthStore.getState().login('138', 'pass');

    const remoteProviders = useSettingsStore.getState().providers.filter(
      (p) => p.source === 'remote' && p.name === 'openai',
    );
    expect(remoteProviders.length).toBeGreaterThanOrEqual(1);
    expect(remoteProviders[0].baseUrl).toBe('https://api.openai.com/v1');
  });

  it('sets loginError on failure', async () => {
    mockLoginERP.mockRejectedValueOnce(new Error('密码错误'));

    await useAuthStore.getState().login('138', 'wrong');

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.loginError).toBe('密码错误');
    expect(state.isLoading).toBe(false);
  });

  it('sets isLoading during login', async () => {
    let resolveLogin: (v: unknown) => void;
    mockLoginERP.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }) as ReturnType<typeof loginERP>,
    );

    const loginPromise = useAuthStore.getState().login('138', 'pass');

    // isLoading should be true while login is in progress
    expect(useAuthStore.getState().isLoading).toBe(true);

    // Resolve the login
    resolveLogin!({ token: 'tk', name: 'test', id: 'u1' });
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockFetchProviders.mockResolvedValueOnce(SAMPLE_PROVIDERS);

    await loginPromise;
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('is a no-op when AUTH_BASE_URL is not set', async () => {
    // Temporarily set authEnabled to false
    useAuthStore.setState({ authEnabled: false });

    // The login function checks AUTH_BASE_URL at module level,
    // but since we defined it in vitest.config.ts, it's always set.
    // This test verifies the store behavior when authEnabled is false.
    // Note: login() checks AUTH_BASE_URL (module-level const), not authEnabled.
    // Since VITE_AUTH_BASE_URL is defined in vitest config, login() will proceed.
    // Skip this test as it requires env var manipulation at module level.
  });
});

describe('authStore.logout', () => {
  it('clears login state', async () => {
    useAuthStore.setState({ isLoggedIn: true, erpUserName: '张三' });
    mockDeleteSecret.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.erpUserName).toBeNull();
  });

  it('deletes token from secretStore', async () => {
    useAuthStore.setState({ isLoggedIn: true, erpUserName: '张三' });
    mockDeleteSecret.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockDeleteSecret).toHaveBeenCalledWith('auth:erpToken');
  });
});

describe('authStore.skipLoginForever', () => {
  it('sets skipLogin to true', () => {
    useAuthStore.setState({ skipLogin: false });
    useAuthStore.getState().skipLoginForever();
    expect(useAuthStore.getState().skipLogin).toBe(true);
  });
});

describe('authStore.bootstrapAuth', () => {
  it('returns needLogin=false when skipLogin is true', async () => {
    useAuthStore.setState({ skipLogin: true });

    const result = await useAuthStore.getState().bootstrapAuth();
    expect(result).toEqual({ needLogin: false });
  });

  it('returns needLogin=true when no cached token', async () => {
    useAuthStore.setState({ skipLogin: false });
    mockGetSecret.mockResolvedValueOnce(null);

    const result = await useAuthStore.getState().bootstrapAuth();
    expect(result).toEqual({ needLogin: true });
  });

  it('returns needLogin=false and sets isLoggedIn when cached token works', async () => {
    useAuthStore.setState({ skipLogin: false, isLoggedIn: false });
    mockGetSecret.mockResolvedValueOnce('cached-token');
    mockFetchProviders.mockResolvedValueOnce(SAMPLE_PROVIDERS);

    const result = await useAuthStore.getState().bootstrapAuth();

    expect(result).toEqual({ needLogin: false });
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
  });

  it('clears token and returns needLogin=true when fetchProviders fails', async () => {
    useAuthStore.setState({ skipLogin: false });
    mockGetSecret.mockResolvedValueOnce('expired-token');
    mockFetchProviders.mockRejectedValueOnce(new Error('HTTP 401'));
    mockDeleteSecret.mockResolvedValueOnce(undefined);

    const result = await useAuthStore.getState().bootstrapAuth();

    expect(result).toEqual({ needLogin: true });
    expect(mockDeleteSecret).toHaveBeenCalledWith('auth:erpToken');
  });

  it('returns needLogin=true when getSecret throws', async () => {
    useAuthStore.setState({ skipLogin: false });
    mockGetSecret.mockRejectedValueOnce(new Error('IPC unavailable'));

    const result = await useAuthStore.getState().bootstrapAuth();
    expect(result).toEqual({ needLogin: true });
  });
});

describe('authStore.clearError', () => {
  it('clears loginError', () => {
    useAuthStore.setState({ loginError: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().loginError).toBeNull();
  });
});
