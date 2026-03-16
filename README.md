# OpenClaw Assistant

OpenClaw Assistant 是一个为 OpenClaw 量身定制的本地 Web 控制台。它提供了一个简洁、直观的图形界面，用于管理 OpenClaw 的配置、监控系统状态、管理模型 Token 以及快速执行常用 CLI 命令。

![OpenClaw Assistant 运行截图](OpenClaw-Assistant.png)

## 核心功能

- **🚀 系统管理**：一键执行 OpenClaw 的安装、更新和网关重启。
- **🔑 Token 管理**：可视化管理 Google (Gemini) 和 MiniMax 等模型的 API Keys，支持实时查看与更新。
- **📊 状态监控**：实时获取 OpenClaw 网关的运行状态、版本信息及活跃会话。
- **⚙️ 配置同步**：自动读取并安全更新 `openclaw.json` 和 `auth-profiles.json` 配置文件。
- **💬 快速对话**：集成 OpenClaw Chat 入口，支持带 Token 自动登录。

## 技术栈

- **后端**: Node.js (原生 http 模块，无需额外依赖)
- **前端**: HTML5, CSS3, JavaScript (现代 UI 设计)
- **集成**: OpenClaw CLI & Gateway API

## 快速开始

### 前提条件

1. 已安装 [Node.js](https://nodejs.org/)。
2. 已安装并初始化 [OpenClaw](https://openclaw.ai/)。

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/OpenClaw-Assistant.git
   cd OpenClaw-Assistant
   ```

2. **启动服务**
   ```bash
   npm start
   ```
   或者直接使用 node 运行：
   ```bash
   node server.js
   ```

3. **访问界面**
   打开浏览器并访问：`http://127.0.0.1:8787`

## 配置文件路径

项目默认操作以下路径的 OpenClaw 配置文件：
- 主配置: `~/.openclaw/openclaw.json`
- 验证配置: `~/.openclaw/agents/main/agent/auth-profiles.json`

## 注意事项

- **安全性**: 本工具设计为本地运行。请勿将其部署在公网环境，以防 API Key 泄露。
- **权限**: 确保运行 Node.js 的用户对 `.openclaw` 目录具有读写权限。

## 许可证

MIT License
