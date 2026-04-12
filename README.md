<p align="center">
  <img src="public/logo.png" alt="OpenOtter" width="120" />
</p>

<h1 align="center">OpenOtter</h1>

<p align="center">
  <strong>The desktop client that makes AI agents accessible to everyone.</strong><br />
  Powered by <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> from Nous Research.
</p>

<p align="center">
  <a href="./README_CN.md">中文文档</a>
</p>

---

## Why OpenOtter?

Running AI agents today means wrestling with Python environments, terminal commands, and config files. **OpenOtter removes all of that.** Download the app, enter your API key, and start chatting with a fully autonomous agent — complete with tool use, memory, and multi-platform deployment.

- **Zero-config setup** — One-click install on macOS and Windows. No Python, no pip, no terminal.
- **Visual agent management** — Create, configure, and monitor multiple agents from a clean GUI.
- **Multi-provider support** — Seamlessly switch between 10+ LLM providers, including Chinese providers.
- **Deploy anywhere** — Connect your agents to Feishu, DingTalk, WeCom, WeChat, QQ Bot, and more.
- **Built for power users too** — Credential pooling, cron scheduling, MCP servers, and session search.

## Features

### Agent Lifecycle

- **Setup Wizard** — Guided first-run experience with automatic Hermes Agent installation
- **Agent Creation** — Template-based wizard with persona (SOUL.md), model selection, and platform binding
- **Dashboard** — Real-time overview of running agents, session stats, and system insights
- **Chat Interface** — Markdown rendering, code highlighting, and streaming responses

### Integrations & Deployment

- **IM Channels** — Deploy agents to Feishu (飞书), DingTalk (钉钉), WeCom (企业微信), WeChat (微信), QQ Bot, Popo, NetEase Bee, NIM
- **Model Providers** — OpenRouter, OpenAI, Anthropic, DeepSeek, Zhipu (GLM), DashScope (Qwen), Kimi, MiniMax, Groq, and custom endpoints
- **Credential Pool** — Manage multiple API keys per provider with rotation support
- **MCP Servers** — Discover and manage Model Context Protocol tool servers

### Advanced

- **Cron Jobs** — Schedule recurring agent tasks
- **Skills Management** — Browse and manage agent skill files
- **Memory & Sessions** — Search through agent conversation history and memory
- **Dark / Light Theme** — Polished UI with system-level theme toggling
- **Auto-update** — Built-in update mechanism for seamless upgrades
- **China Network Detection** — Automatic mirror selection for users behind the GFW

## Supported Providers

| Provider | Models |
|----------|--------|
| **OpenRouter** | 200+ models (GPT, Claude, Llama, Mistral, etc.) |
| **OpenAI** | GPT-4.1, o3, o4-mini |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4 |
| **DeepSeek** | DeepSeek-V3, DeepSeek-R1 |
| **Zhipu AI** | GLM-4, GLM-4-Plus |
| **DashScope** | Qwen-Max, Qwen-Plus |
| **Kimi** | Moonshot-v1 |
| **MiniMax** | abab6.5s |
| **Groq** | Llama 3, Mixtral |
| **Custom** | Any OpenAI-compatible endpoint |

## Quick Start

### Download

> Coming soon — pre-built binaries for macOS (.dmg) and Windows (.exe).

### Build from Source

#### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v22+)

#### Development

```bash
git clone https://github.com/your-org/openotter.git
cd openotter
npm install
npm run sidecar:dev    # Create dev sidecar wrapper
npm run tauri dev      # Start development
```

#### Production Build

```bash
npm run sidecar:build  # Build sidecar binary (requires hermes-agent)
npm run tauri build    # Build production app
```

## Architecture

```
openotter/
├── src/                        # React frontend (TypeScript)
│   ├── components/             # UI: Dashboard, Chat, Agents, Channels, Settings, ...
│   ├── stores/                 # Zustand state management
│   └── lib/                    # Hermes bridge (Tauri IPC bindings)
├── src-tauri/                  # Rust backend
│   ├── src/                    # Tauri commands, sidecar, gateway, installer
│   ├── binaries/               # Sidecar binaries (gitignored)
│   └── capabilities/           # Tauri v2 permissions
├── public/                     # Static assets (logo, platform icons)
├── scripts/                    # Build scripts (PyInstaller sidecar)
└── .github/workflows/          # CI/CD (GitHub Actions)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| State | Zustand |
| Bundler | Vite 7 |
| Agent Engine | Hermes Agent (Python, managed as sidecar) |

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a PR.

## License

[MIT](LICENSE)
