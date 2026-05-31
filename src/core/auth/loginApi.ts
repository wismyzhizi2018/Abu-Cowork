/**
 * Login API — ERP authentication and model center provider fetching
 *
 * AUTH_BASE_URL, ORDER_API_URL, and PROVIDERS_URL are independent services.
 * Enabled only when VITE_AUTH_BASE_URL is set at build time.
 */

import type { ProviderInstance, ModelInfo } from '@/types/provider';
import type { ApiFormat } from '@/types';

export interface ERPLoginResult {
  token: string;
  name: string;
  id: string;
}

interface ERPResponse {
  code: number;
  msg?: string;
  data?: {
    token: string;
    name: string;
    id: string;
  };
}

interface RemoteModelInfo {
  id: string;
  label: string;
}

interface RemoteProvider {
  name: string;
  api_format: string;
  base_url: string;
  api_key: string;
  models: RemoteModelInfo[];
  default_model?: string;
}

interface ProvidersResponse {
  code: number;
  msg?: string;
  data?: {
    providers: RemoteProvider[];
  };
}

function joinUrl(base: string, path: string): string {
  return new URL(path, base.endsWith('/') ? base : base + '/').toString();
}

/**
 * ERP login via mobile + password.
 * GET {baseUrl}/rest/auth/user/login?mobile=xxx&password=xxx
 */
export async function loginERP(
  baseUrl: string,
  mobile: string,
  password: string,
): Promise<ERPLoginResult> {
  const base = joinUrl(baseUrl, 'rest/auth/user/login');
  const url = new URL(base);
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('password', password);

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`网络错误: HTTP ${res.status}`);
  }

  const json: ERPResponse = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || '登录失败');
  }

  return json.data;
}

/** Map remote api_format string to Abu's ApiFormat type */
function mapApiFormat(raw: string): ApiFormat {
  if (raw === 'anthropic') return 'anthropic';
  return 'openai-compatible';
}

/**
 * Fetch current user info (name + avatar) after login.
 * GET /order/base/get_user_info
 * Header: Authorization: <token> (raw, no Bearer prefix)
 */
export async function fetchUserInfo(
  baseUrl: string,
  token: string,
): Promise<{ name: string; avatar: string }> {
  const url = joinUrl(baseUrl, 'order/base/get_user_info');
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: token },
  });
  if (!res.ok) {
    throw new Error(`网络错误: HTTP ${res.status}`);
  }

  const json: { code: number; msg?: string; data?: { name: string; avatar: string } } =
    await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || '获取用户信息失败');
  }

  return json.data;
}

/**
 * Fetch provider configurations from the model center.
 * GET {baseUrl}/api/providers
 * Header: Authorization: Bearer <token>
 *
 * Returns an array of configs ready to be passed to settingsStore.addProvider().
 */
export async function fetchProviders(
  baseUrl: string,
  token: string,
): Promise<Omit<ProviderInstance, 'id' | 'status' | 'sortOrder'>[]> {
  const url = joinUrl(baseUrl, 'api/providers');

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`网络错误: HTTP ${res.status}`);
  }

  const json: ProvidersResponse = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || '获取模型配置失败');
  }

  return json.data.providers.map((p) => ({
    source: 'remote' as const,
    name: p.name,
    enabled: true,
    apiFormat: mapApiFormat(p.api_format),
    baseUrl: p.base_url,
    apiKey: p.api_key,
    models: p.models.map((m): ModelInfo => ({ id: m.id, label: m.label })),
    defaultModelId: p.default_model,
    userAdded: false,
  }));
}
