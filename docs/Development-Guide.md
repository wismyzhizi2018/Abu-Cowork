# 开发指南

[English](#english) | **中文**

本文档面向 Abu 的开发者，介绍项目架构、开发流程、测试规范和调试技巧。

---

## 目录

- [架构概览](#架构概览)
- [核心模块](#核心模块)
- [开发环境](#开发环境)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [编码规范](#编码规范)

---

## 架构概览

Abu 基于 **Tauri 2.0** 构建，采用前后端分离架构：

```
┌─────────────────────────────────────────────┐
│                  前端 (React)                │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 组件层   │ │ Store层   │ │  Core逻辑层  │  │
│  │ (React) │ │ (Zustand)│ │ (纯TS模块)   │  │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       └───────────┴──────────────┘          │
│                    │ IPC (Tauri invoke)      │
├────────────────────┼────────────────────────┤
│               后端 (Rust)                    │
│  ┌─────────────┐ ┌────────────┐             │
│  │ Tauri 命令   │ │ 插件系统    │             │
│  └─────────────┘ └────────────┘             │
└─────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端框架 | React 19 + TypeScript | UI 渲染 |
| 状态管理 | Zustand + Immer | 全局状态（settings/chat/mcp 等） |
| 样式 | TailwindCSS v4 | 原子化 CSS |
| 测试 | Vitest + happy-dom | 单元测试 / 集成测试 |
| 后端 | Rust + Tauri 2.0 | 桌面壳、系统 API、安全沙箱 |
| LLM | Anthropic SDK / OpenAI 兼容 | AI 对话 |
| 工具协议 | MCP (Model Context Protocol) | 外部工具集成 |

---

## 核心模块

### `src/stores/` — Zustand Store

全局状态管理，每个 store 用 `create` + `persist` 创建：

| Store | 职责 |
|-------|------|
| `settingsStore` | AI 服务配置、模型选择、主题、安全设置 |
| `chatStore` | 对话列表、消息、当前会话 |
| `mcpStore` | MCP 服务器连接状态、工具列表 |
| `diagnosticStore` | 诊断检查结果 |
| `authStore` | ERP 登录状态、Token 管理、Provider 同步 |

### `src/core/` — 核心业务逻辑

纯 TypeScript 模块，不依赖 React：

| 模块 | 职责 |
|------|------|
| `core/agent/` | Agent 生命周期、执行快照、Hook 系统 |
| `core/llm/` | LLM 调用、费用追踪、模型能力 |
| `core/skill/` | 技能加载、注册、执行 |
| `core/tools/` | 工具注册、路径安全检查 |
| `core/context/` | 上下文压缩、Token 估算 |
| `core/logging/` | 环形缓冲日志 |
| `core/im/` | IM 频道路由、Token 管理 |
| `core/diagnostic/` | 诊断检查、数据脱敏 |
| `core/auth/` | ERP 登录认证、模型中心 Provider 拉取 |

### `src/components/` — React 组件

| 目录 | 职责 |
|------|------|
| `chat/` | 对话界面、消息渲染、输入框 |
| `sidebar/` | 侧边栏导航 |
| `settings/` | 设置面板 |
| `tools/` | 工具箱 UI |
| `auth/` | 登录页 UI |

### `src/utils/` — 工具函数

通用工具，无业务依赖：`pathUtils`、`platform`、`base64`、`validation` 等。

---

## 开发环境

### 前置要求

- Node.js >= 22
- Rust >= 1.75
- Tauri 2.0 系统依赖（[参考文档](https://v2.tauri.app/start/prerequisites/)）

### 启动

```bash
# 安装依赖
npm install

# 前端开发服务器（不需要 Rust）
npm run dev

# 完整桌面应用（dev 隔离配置）
npm run tauri:dev

# 仅 Rust 后端
cd src-tauri && cargo build
```

### 环境变量

| 变量 | 用途 | 必需 |
|------|------|------|
| `VITE_AUTH_BASE_URL` | ERP 登录服务地址，设置后启用登录功能 | 否 |
| `VITE_CONSOLE_URL` | Console 遥测地址 | 否 |

创建 `.env.local` 文件配置本地开发环境变量（不会提交到 git）：

```bash
# .env.local
VITE_AUTH_BASE_URL=https://your-erp-domain.com
```

### 登录功能开发

登录功能通过 `VITE_AUTH_BASE_URL` 环境变量控制开关：

- **未设置** — 直接进入首页，无登录流程
- **已设置** — 启动时弹出登录页，登录成功后自动拉取远程 Provider 配置

相关文件：

| 文件 | 职责 |
|------|------|
| `core/auth/loginApi.ts` | ERP 登录接口 + 模型中心 Provider 拉取 |
| `stores/authStore.ts` | 认证状态管理（Token、登录状态、bootstrap 流程） |
| `components/auth/LoginPage.tsx` | 登录页 UI |

Token 存储在加密的 secretStore 中（`auth:erpToken`），支持跳过登录（永久跳过，persist 到 localStorage）。

### 网络代理（中国大陆）

如果访问 GitHub / crates.io 较慢，配置 SOCKS5 代理：

```bash
# 启动代理隧道
ssh -o StrictHostKeyChecking=no -D 1080 -fN root@<proxy-server>

# Git 代理
git -c http.proxy="socks5h://localhost:1080" clone <repo>

# Cargo 代理 (src-tauri/.cargo/config.toml)
[http]
proxy = "socks5h://localhost:1080"
[net]
git-fetch-with-cli = true
```

---

## CI/CD

项目使用 GitHub Actions 自动构建和测试。

### CI（持续集成）

每次推送到 `main` 或 `dev` 分支，或创建 PR 时自动运行：

- TypeScript 类型检查
- ESLint 代码检查
- Vitest 单元测试

配置文件：`.github/workflows/ci.yml`

### Release（发布构建）

推 `v*` 格式的 tag 时自动触发：

```bash
git tag v0.23.0
git push origin v0.23.0
```

自动在 macOS 和 Windows runner 上构建，产物上传到 GitHub Releases：

| 产物 | 平台 |
|------|------|
| `Abu_x.x.x_aarch64.dmg` | macOS Apple Silicon |
| `Abu_x.x.x_x64.dmg` | macOS Intel |
| `Abu_x.x.x_x64-setup.exe` | Windows x64 |

配置文件：`.github/workflows/release.yml`

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `VITE_AUTH_BASE_URL` | 构建时注入 ERP 登录域名 |
| `VITE_CONSOLE_URL` | Console 遥测地址 |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri 更新签名私钥 |

---

## 测试指南

### 运行测试

```bash
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率报告
```

### 测试文件约定

- 测试文件与源文件同目录，后缀 `.test.ts`
- 例如：`src/core/logging/logger.ts` → `src/core/logging/logger.test.ts`

### 测试模式

#### 1. 纯函数测试（推荐优先）

对于没有外部依赖的纯函数，直接导入测试：

```typescript
import { describe, it, expect } from 'vitest';
import { buildPatternSummary } from './taskLog';
import type { TaskPattern } from './taskLog';

describe('buildPatternSummary', () => {
  it('returns empty string for no patterns', () => {
    expect(buildPatternSummary([])).toBe('');
  });

  it('formats pattern with existing skill', () => {
    const patterns: TaskPattern[] = [
      { category: 'coding', count: 5, recentSummaries: [], hasSkill: true, hasAgent: false },
    ];
    expect(buildPatternSummary(patterns)).toContain('已有技能');
  });
});
```

#### 2. Store 测试

使用 `setState` 直接设置状态，避免 mock：

```typescript
import { useSettingsStore } from './settingsStore';

beforeEach(() => {
  useSettingsStore.setState({
    providers: [],
    activeModel: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
  });
});

it('toggles provider enabled state', () => {
  const id = useSettingsStore.getState().addProvider({ /* ... */ });
  useSettingsStore.getState().toggleProvider(id);
  expect(useSettingsStore.getState().providers.find(p => p.id === id)?.enabled).toBe(false);
});
```

#### 3. Hook / 事件系统测试

使用 `vi.fn()` 监听调用：

```typescript
import { vi } from 'vitest';
import { registerHook, emitHook, clearAllHooks } from './lifecycleHooks';

beforeEach(() => clearAllHooks());

it('calls matching hooks with the event', async () => {
  const handler = vi.fn();
  registerHook('agentStart', handler);
  await emitHook({ type: 'agentStart', agentName: 'test', loopId: 'l1', timestamp: Date.now() });
  expect(handler).toHaveBeenCalled();
});
```

#### 4. 异步测试

对于返回 Promise 的函数，使用 `async/await`：

```typescript
it('returns a promise when hooks are registered', async () => {
  registerHook('turnEnd', () => {});
  const event = { type: 'turnEnd', turnNumber: 1, toolCallCount: 0, timestamp: Date.now() };
  const result = emitHook(event);
  expect(result).toBeInstanceOf(Promise);
  const resolved = await result;
  expect(resolved).toBe(event);
});
```

### 可测试性指南

**适合单元测试的模块：**
- 纯函数（无副作用、无外部依赖）
- Store 的 action 和 selector
- 正则表达式 / 数据转换
- Hook 注册 / 触发系统

**不适合单元测试的模块（需要集成测试或 E2E）：**
- 依赖 Tauri IPC 的模块（`@tauri-apps/plugin-fs`、`@tauri-apps/api/path`）
- 依赖网络请求的模块（`fetch`、WebSocket）
- 依赖 DOM 的复杂 UI 组件

---

## 调试技巧

### 前端调试

1. **Vite DevTools**：`npm run dev` 启动后，浏览器自动集成 React DevTools
2. **日志查看**：应用内日志通过 `core/logging/logger.ts` 的环形缓冲区，可在控制台调用 `getRecentLogs()` 查看
3. **状态检查**：Zustand stores 可在控制台通过 `useXxxStore.getState()` 查看

### Rust 后端调试

1. **Tauri 日志**：`RUST_LOG=debug npm run tauri:dev`
2. **Cargo 编译检查**：`cd src-tauri && cargo check`
3. **IPC 调试**：在 Rust 命令中使用 `println!` 或 `tracing` 输出

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| `npm install` 卡住 | 检查网络代理配置 |
| `cargo build` 报错 | 确认 Rust 版本 >= 1.75，检查 cargo 代理 |
| 测试超时 | 检查是否有未 mock 的异步操作 |
| Tauri IPC 失败 | 确认 `src-tauri/Capabilities.toml` 权限配置 |

---

## 编码规范

### TypeScript

- 严格模式（`strict: true`）
- 使用 `erasableSyntaxOnly`（Tauri 2.0 要求）
- 优先使用 `const` 断言和 `as const`
- 避免 `any`，使用 `unknown` + 类型守卫

### React

- 函数组件 + Hooks
- 使用 `memo` / `useMemo` / `useCallback` 优化性能
- 状态提升到 Zustand store，不在组件间传递复杂状态

### Rust

- 遵循 `clippy` 建议
- 使用 `serde` 进行序列化
- 错误处理使用 `Result`，避免 `unwrap()`

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<详细描述>

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

type 取值：`feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`

---

## English

This document covers Abu's architecture, development workflow, testing conventions, and debugging tips. See the [Chinese version](#目录) above for the full content, or refer to the [User Guide (EN)](User-Guide_EN.md) for product usage.
