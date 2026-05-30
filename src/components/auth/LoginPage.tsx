import { useState, useCallback, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  const { login, skipLoginForever, loginError, isLoading, clearError } = useAuthStore();

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!mobile.trim() || !password.trim()) return;
      await login(mobile.trim(), password.trim());
      // Check if login succeeded (isLoggedIn is set by login())
      if (useAuthStore.getState().isLoggedIn) {
        onLoginSuccess();
      }
    },
    [mobile, password, login, onLoginSuccess],
  );

  const handleSkip = useCallback(() => {
    skipLoginForever();
    onLoginSuccess();
  }, [skipLoginForever, onLoginSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--abu-bg)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--abu-border)] bg-[var(--abu-bg-card)] p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--abu-text-primary)]">
            登录
          </h1>
          <p className="mt-1 text-sm text-[var(--abu-text-secondary)]">
            使用公司 ERP 账号登录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--abu-text-secondary)]">
              手机号
            </label>
            <Input
              type="tel"
              placeholder="请输入手机号"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                if (loginError) clearError();
              }}
              disabled={isLoading}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--abu-text-secondary)]">
              密码
            </label>
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (loginError) clearError();
              }}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {loginError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {loginError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !mobile.trim() || !password.trim()}
          >
            {isLoading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-[var(--abu-text-placeholder)] hover:text-[var(--abu-text-secondary)] transition-colors"
          >
            跳过，直接使用
          </button>
        </div>
      </div>
    </div>
  );
}
