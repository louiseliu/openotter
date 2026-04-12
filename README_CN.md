<p align="center">
  <img src="public/logo.png" alt="OpenOtter" width="120" />
</p>

<h1 align="center">OpenOtter</h1>

<p align="center">
  <strong>让 AI Agent 触手可及的桌面客户端</strong><br />
  基于 Nous Research 的 <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> 构建
</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

---

## 为什么选择 OpenOtter？

运行 AI Agent 通常意味着折腾 Python 环境、终端命令和一堆配置文件。**OpenOtter 消除了这一切。** 下载应用，输入 API Key，即刻开始与一个完全自主的 Agent 对话——支持工具调用、记忆系统和多平台部署。

- **零配置启动** — 一键安装，支持 macOS 和 Windows。无需 Python，无需终端。
- **可视化 Agent 管理** — 通过简洁的图形界面创建、配置和监控多个 Agent。
- **多模型供应商** — 无缝切换 10+ 大模型供应商，完整支持国内模型。
- **多渠道部署** — 将 Agent 接入飞书、钉钉、企业微信、微信、QQ Bot 等主流 IM。
- **为进阶用户打造** — 凭证池、定时任务、MCP 服务器、会话搜索一应俱全。

## 核心功能

### Agent 全生命周期

- **引导式设置** — 首次运行自动安装 Hermes Agent 引擎，开箱即用
- **Agent 创建向导** — 基于模板的创建流程：人格设定（SOUL.md）→ 模型选择 → 平台绑定
- **总览仪表盘** — 实时查看运行中的 Agent、会话统计和系统洞察
- **对话界面** — Markdown 渲染、代码高亮、流式响应

### 集成与部署

| IM 渠道 | 模型供应商 |
|---------|-----------|
| 飞书 | OpenRouter（200+ 模型） |
| 钉钉 | OpenAI（GPT-4.1, o3, o4-mini） |
| 企业微信 | Anthropic（Claude Sonnet 4, Opus 4） |
| 微信 | DeepSeek（V3, R1） |
| QQ Bot | 智谱 AI（GLM-4） |
| Popo | 通义千问（Qwen-Max） |
| 网易蜂巢 | Kimi（Moonshot-v1） |
| NIM | MiniMax / Groq / 自定义端点 |

### 进阶功能

- **凭证池** — 每个供应商支持多 API Key 管理与轮转
- **MCP 服务器** — 发现和管理 Model Context Protocol 工具服务
- **定时任务** — 为 Agent 配置周期性任务调度
- **技能管理** — 浏览和管理 Agent 技能文件
- **记忆与会话** — 搜索 Agent 对话历史和记忆数据
- **暗色 / 亮色主题** — 精致的 UI 设计，支持主题切换
- **自动更新** — 内置更新机制，无缝升级
- **国内网络适配** — 自动检测网络环境，智能切换镜像源

## 快速开始

### 下载安装

> 预编译安装包即将发布——敬请期待 macOS (.dmg) 和 Windows (.exe) 版本。

### 从源码构建

#### 前置依赖

- [Rust](https://rustup.rs/)（stable 版本）
- [Node.js](https://nodejs.org/)（v22+）

#### 开发模式

```bash
git clone https://github.com/your-org/openotter.git
cd openotter
npm install
npm run sidecar:dev    # 创建开发用 sidecar 包装器
npm run tauri dev      # 启动开发环境
```

#### 生产构建

```bash
npm run sidecar:build  # 构建 sidecar 二进制文件（需要 hermes-agent）
npm run tauri build    # 构建生产应用
```

## 项目架构

```
openotter/
├── src/                        # React 前端（TypeScript）
│   ├── components/             # UI 组件：总览、对话、Agent、渠道、设置……
│   ├── stores/                 # Zustand 状态管理
│   └── lib/                    # Hermes 桥接层（Tauri IPC 绑定）
├── src-tauri/                  # Rust 后端
│   ├── src/                    # Tauri 命令、Sidecar、网关、安装器
│   ├── binaries/               # Sidecar 二进制文件（gitignored）
│   └── capabilities/           # Tauri v2 权限配置
├── public/                     # 静态资源（Logo、平台图标）
├── scripts/                    # 构建脚本（PyInstaller sidecar）
└── .github/workflows/          # CI/CD（GitHub Actions）
```

### 技术栈

| 层级 | 技术 |
|------|-----|
| 桌面壳 | Tauri v2（Rust） |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 状态管理 | Zustand |
| 构建工具 | Vite 7 |
| Agent 引擎 | Hermes Agent（Python，作为 sidecar 管理） |

## 参与贡献

欢迎贡献！请先开 Issue 讨论你的想法，再提交 PR。

## 开源协议

[MIT](LICENSE)
