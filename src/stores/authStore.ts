/**
 * Auth Store — ERP login state and model center provider sync
 *
 * Enabled only when VITE_AUTH_BASE_URL is set at build time.
 * ERP token is stored in the encrypted secretStore.
 * Skip-login flag is persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loginERP, fetchProviders } from '@/core/auth/loginApi';
import { useSettingsStore } from './settingsStore';
import { getSecret, setSecret, deleteSecret } from '@/utils/secretStore';

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL as string | undefined;
const SECRET_KEY = 'auth:erpToken';

export interface AuthState {
  erpUserName: string | null;
  isLoggedIn: boolean;
  skipLogin: boolean;
  authEnabled: boolean;
  loginError: string | null;
  isLoading: boolean;

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

      login: async (mobile, password) => {
        if (!AUTH_BASE_URL) return;
        set({ isLoading: true, loginError: null });

        try {
          // Step 1: ERP login
          const { token, name } = await loginERP(AUTH_BASE_URL, mobile, password);

          // Step 2: Store token in secretStore
          await setSecret(SECRET_KEY, token);

          // Step 3: Fetch providers from model center
          const providers = await fetchProviders(AUTH_BASE_URL, token);

          // Step 4: Merge providers into settingsStore
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

          // Step 5: Set default model if specified
          const firstProvider = providers[0];
          if (firstProvider?.defaultModelId) {
            const added = settingsState.providers.find(
              (p) => p.source === 'remote' && p.name === firstProvider.name,
            );
            if (added) {
              settingsState.selectModel(added.id, firstProvider.defaultModelId);
            }
          }

          set({
            erpUserName: name,
            isLoggedIn: true,
            isLoading: false,
            skipLogin: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : '登录失败';
          set({ loginError: message, isLoading: false });
        }
      },

      logout: async () => {
        await deleteSecret(SECRET_KEY).catch(() => {});
        set({ erpUserName: null, isLoggedIn: false });
      },

      skipLoginForever: () => {
        set({ skipLogin: true });
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

        // Try to fetch providers with cached token
        try {
          const providers = await fetchProviders(AUTH_BASE_URL, token);
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

          set({ isLoggedIn: true });
          return { needLogin: false };
        } catch {
          // Token expired or network error — clear and require login
          await deleteSecret(SECRET_KEY).catch(() => {});
          return { needLogin: true };
        }
      },

      clearError: () => set({ loginError: null }),
    }),
    {
      name: 'abu-auth',
      partialize: (state) => ({
        skipLogin: state.skipLogin,
        erpUserName: state.erpUserName,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
);
