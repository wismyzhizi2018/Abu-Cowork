import { useState, useCallback, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import abuAvatar from '@/assets/abu-avatar.png';
import { Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const savedMobile = useAuthStore((s) => s.savedMobile);
  const savedPassword = useAuthStore((s) => s.savedPassword);
  const [mobile, setMobile] = useState(savedMobile);
  const [password, setPassword] = useState(savedPassword);

  const { login, skipLoginForever, loginError, isLoading, clearError } = useAuthStore();

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!mobile.trim() || !password.trim()) return;
      await login(mobile.trim(), password.trim());
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

  const handleInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (loginError) clearError();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--abu-bg-base)]">
      <div className="w-full max-w-[420px] rounded-3xl border border-[var(--abu-border)] bg-[var(--abu-bg-muted)] p-10 shadow-2xl">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="h-12 w-12 rounded-[14px] bg-[var(--abu-clay-bg)] overflow-hidden">
            <img src={abuAvatar} alt="Abu" className="h-full w-full object-cover" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-2xl font-bold text-[var(--abu-text-primary)]">
          登录工作台
        </h1>
        <p className="mt-2 mb-8 text-center text-sm text-[var(--abu-text-tertiary)]">
          欢迎回来，请使用你的账号继续
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="text"
            placeholder="请输入手机号"
            value={mobile}
            onChange={handleInput(setMobile)}
            disabled={isLoading}
            autoComplete="username"
            className="h-12 rounded-xl bg-[var(--abu-bg-muted)] border-[var(--abu-border)] focus:border-[var(--abu-clay)] text-[15px] placeholder:text-[var(--abu-text-placeholder)]"
          />
          <Input
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={handleInput(setPassword)}
            disabled={isLoading}
            autoComplete="current-password"
            className="h-12 rounded-xl bg-[var(--abu-bg-muted)] border-[var(--abu-border)] focus:border-[var(--abu-clay)] text-[15px] placeholder:text-[var(--abu-text-placeholder)]"
          />

          {loginError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {loginError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-[15px] font-semibold"
            disabled={isLoading || !mobile.trim() || !password.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              '登 录'
            )}
          </Button>
        </form>

        {/* Skip */}
        <div className="mt-6 text-center">
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
