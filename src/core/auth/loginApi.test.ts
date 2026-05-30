import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginERP, fetchProviders } from './loginApi';

const BASE_URL = 'https://erp.example.com';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('URL construction', () => {
  it('appends path correctly to plain domain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: { token: 't', name: 'n', id: 'i' } }), { status: 200 }),
    );
    await loginERP('https://erp.example.com', '138', 'pass');
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/erp\.example\.com\/rest\/auth\/user\/login\?/);
  });

  it('preserves base path when baseUrl has sub-path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: { providers: [] } }), { status: 200 }),
    );
    await fetchProviders('https://www.example.com/model-center', 'tk');
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://www.example.com/model-center/api/providers');
  });

  it('handles baseUrl with trailing slash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: { providers: [] } }), { status: 200 }),
    );
    await fetchProviders('https://www.example.com/model-center/', 'tk');
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://www.example.com/model-center/api/providers');
  });
});

describe('loginERP', () => {
  it('returns token/name/id on success', async () => {
    const mockData = { code: 0, data: { token: 'tk-123', name: '张三', id: 'u1' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await loginERP(BASE_URL, '13800138000', 'pass123');
    expect(result).toEqual({ token: 'tk-123', name: '张三', id: 'u1' });

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/rest/auth/user/login');
    expect(calledUrl).toContain('mobile=13800138000');
    expect(calledUrl).toContain('password=pass123');
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 500 }),
    );

    await expect(loginERP(BASE_URL, '138', 'pass')).rejects.toThrow('网络错误: HTTP 500');
  });

  it('throws on non-zero code in response', async () => {
    const mockData = { code: 1001, msg: '密码错误' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    await expect(loginERP(BASE_URL, '138', 'wrong')).rejects.toThrow('密码错误');
  });

  it('throws generic message when no msg in error response', async () => {
    const mockData = { code: 1 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    await expect(loginERP(BASE_URL, '138', 'pass')).rejects.toThrow('登录失败');
  });
});

describe('fetchProviders', () => {
  const token = 'tk-abc';

  it('returns mapped provider configs on success', async () => {
    const mockData = {
      code: 0,
      data: {
        providers: [
          {
            name: 'openai',
            api_format: 'openai',
            base_url: 'https://api.openai.com/v1',
            api_key: 'sk-xxx',
            models: [{ id: 'gpt-4o', label: 'GPT-4o' }],
            default_model: 'gpt-4o',
          },
          {
            name: 'claude',
            api_format: 'anthropic',
            base_url: 'https://api.anthropic.com',
            api_key: 'sk-ant-yyy',
            models: [
              { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
              { id: 'claude-opus-4-20250514', label: 'Claude Opus' },
            ],
          },
        ],
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchProviders(BASE_URL, token);
    expect(result).toHaveLength(2);

    // First provider
    expect(result[0].source).toBe('remote');
    expect(result[0].name).toBe('openai');
    expect(result[0].apiFormat).toBe('openai-compatible');
    expect(result[0].baseUrl).toBe('https://api.openai.com/v1');
    expect(result[0].apiKey).toBe('sk-xxx');
    expect(result[0].models).toEqual([{ id: 'gpt-4o', label: 'GPT-4o' }]);
    expect(result[0].defaultModelId).toBe('gpt-4o');
    expect(result[0].enabled).toBe(true);
    expect(result[0].userAdded).toBe(false);

    // Second provider — anthropic format
    expect(result[1].apiFormat).toBe('anthropic');
    expect(result[1].models).toHaveLength(2);

    // Verify Authorization header
    const calledInit = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
  });

  it('maps unknown api_format to openai-compatible', async () => {
    const mockData = {
      code: 0,
      data: {
        providers: [
          {
            name: 'custom',
            api_format: 'some-new-format',
            base_url: 'https://custom.api/v1',
            api_key: 'key-123',
            models: [{ id: 'm1', label: 'Model 1' }],
          },
        ],
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchProviders(BASE_URL, token);
    expect(result[0].apiFormat).toBe('openai-compatible');
  });

  it('handles missing default_model gracefully', async () => {
    const mockData = {
      code: 0,
      data: {
        providers: [
          {
            name: 'test',
            api_format: 'openai',
            base_url: 'https://test.api',
            api_key: 'key',
            models: [{ id: 'm1', label: 'M1' }],
          },
        ],
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchProviders(BASE_URL, token);
    expect(result[0].defaultModelId).toBeUndefined();
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 401 }),
    );

    await expect(fetchProviders(BASE_URL, token)).rejects.toThrow('网络错误: HTTP 401');
  });

  it('throws on non-zero code in response', async () => {
    const mockData = { code: 2001, msg: 'token已过期' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    await expect(fetchProviders(BASE_URL, token)).rejects.toThrow('token已过期');
  });
});
