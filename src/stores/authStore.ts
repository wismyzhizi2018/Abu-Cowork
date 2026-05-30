/**
 * Auth Store — ERP login state and model center provider sync
 *
 * Enabled only when VITE_AUTH_BASE_URL is set at build time.
 * ERP token is stored in the encrypted secretStore.
 * Skip-login flag is persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loginERP, fetchProviders, fetchUserInfo } from '@/core/auth/loginApi';
import { useSettingsStore } from './settingsStore';
import { getSecret, setSecret, deleteSecret } from '@/utils/secretStore';

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL as string | undefined;
const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL as string | undefined;
const PROVIDERS_URL = import.meta.env.VITE_PROVIDERS_URL as string | undefined;
const SECRET_KEY = 'auth:erpToken';

/** Disable all non-remote (local) providers after remote ones are synced */
function disableLocalProviders(): void {
  const settingsState = useSettingsStore.getState();
  for (const p of settingsState.providers) {
    if (p.source !== 'remote' && p.enabled) {
      settingsState.updateProvider(p.id, { enabled: false });
    }
  }
}

export interface AuthState {
  erpUserName: string | null;
  isLoggedIn: boolean;
  skipLogin: boolean;
  authEnabled: boolean;
  loginError: string | null;
  isLoading: boolean;
  savedMobile: string;
  savedPassword: string;

  login: (mobile: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  skipLoginForever: () => void;
  bootstrapAuth: () => Promise<{ needLogin: boolean }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      erpUserName: null,
      isLoggedIn: false,
      skipLogin: false,
      authEnabled: !!AUTH_BASE_URL,
      loginError: null,
      isLoading: false,
      savedMobile: '',
      savedPassword: '',

      login: async (mobile, password) => {
        if (!AUTH_BASE_URL) return;
        set({ isLoading: true, loginError: null });

        try {
          // Step 1: ERP login
          const { token, name } = await loginERP(AUTH_BASE_URL, mobile, password);

          // Step 2: Store token in secretStore
          await setSecret(SECRET_KEY, token);

          // Step 3: Fetch user info (name + avatar) and write to settings
          if (ORDER_API_URL) {
            try {
              const userInfo = await fetchUserInfo(ORDER_API_URL, token);
              const settingsState = useSettingsStore.getState();
              settingsState.setUserNickname(userInfo.name);
              settingsState.setUserAvatar(userInfo.avatar);
            } catch (err) {
              console.warn('[Auth] Failed to fetch user info:', err);
            }
          }

          // Step 4: Fetch providers from model center (non-blocking)
          if (PROVIDERS_URL) {
            try {
              const providers = await fetchProviders(PROVIDERS_URL, token);
              const settingsState = useSettingsStore.getState();
              for (const config of providers) {
                const existing = settingsState.providers.find(
                  (p) => p.source === 'remote' && p.name === config.name,
                );
                if (existing) {
                  settingsState.updateProvider(existing.id, config);
                } else {
                  settingsState.addProvider(config);
                }
              }
              const firstProvider = providers[0];
              if (firstProvider?.defaultModelId) {
                const added = settingsState.providers.find(
                  (p) => p.source === 'remote' && p.name === firstProvider.name,
                );
                if (added) {
                  settingsState.selectModel(added.id, firstProvider.defaultModelId);
                }
              }
              // Only disable local providers when remote actually returned some
              if (providers.length > 0) {
                disableLocalProviders();
              }
            } catch (err) {
            console.warn('[Auth] Failed to fetch providers (skipping):', err);
          }
          }

          set({
            erpUserName: name,
            isLoggedIn: true,
            isLoading: false,
            skipLogin: false,
            savedMobile: mobile,
            savedPassword: password,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : '登录失败';
          set({ loginError: message, isLoading: false });
        }
      },

      logout: async () => {
        await deleteSecret(SECRET_KEY).catch(() => {});
        const settingsState = useSettingsStore.getState();
        settingsState.setUserNickname('');
        settingsState.setUserAvatar('');
        set({ erpUserName: null, isLoggedIn: false });
      },

      skipLoginForever: () => {
        const settingsState = useSettingsStore.getState();
        settingsState.setUserNickname('');
        settingsState.setUserAvatar('');
        settingsState.setGuideShown(false);
        set({ skipLogin: true, erpUserName: null });
      },

      bootstrapAuth: async () => {
        if (!AUTH_BASE_URL) return { needLogin: false };
        if (get().skipLogin) return { needLogin: false };

        // Check for cached token
        let token: string | null = null;
        try {
          token = await getSecret(SECRET_KEY);
        } catch {
          // secretStore unavailable — fall through to login
        }

        if (!token) return { needLogin: true };

        // Validate token by fetching user info
        if (ORDER_API_URL) {
          try {
            const userInfo = await fetchUserInfo(ORDER_API_URL, token);
            const settingsState = useSettingsStore.getState();
            settingsState.setUserNickname(userInfo.name);
            settingsState.setUserAvatar(userInfo.avatar);
          } catch {
            // Token expired or network error — clear and require login
            await deleteSecret(SECRET_KEY).catch(() => {});
            return { needLogin: true };
          }
        }

        // Sync providers from model center (non-blocking, skip on failure)
        if (PROVIDERS_URL) {
          try {
            const providers = await fetchProviders(PROVIDERS_URL, token);
            const settingsState = useSettingsStore.getState();
            for (const config of providers) {
              const existing = settingsState.providers.find(
                (p) => p.source === 'remote' && p.name === config.name,
              );
              if (existing) {
                settingsState.updateProvider(existing.id, config);
              } else {
                settingsState.addProvider(config);
              }
            }
            const firstProvider = providers[0];
            if (firstProvider?.defaultModelId) {
              const added = settingsState.providers.find(
                (p) => p.source === 'remote' && p.name === firstProvider.name,
              );
              if (added) {
                settingsState.selectModel(added.id, firstProvider.defaultModelId);
              }
            }
            if (providers.length > 0) {
              disableLocalProviders();
            }
          } catch (err) {
            console.warn('[Auth] Failed to sync providers (skipping):', err);
          }
        }

        set({ isLoggedIn: true });
        return { needLogin: false };
      },

      clearError: () => set({ loginError: null }),
    }),
    {
      name: 'abu-auth',
      partialize: (state) => ({
        erpUserName: state.erpUserName,
        savedMobile: state.savedMobile,
        savedPassword: state.savedPassword,
      }),
    },
  ),
);
