⚡️ ServiceHub

你的本地服务管理。
一个基于 Electron + React 的桌面端工具，用于统一管理、启动和监控多个本地开发服务。

📖 简介 (Introduction)

在全栈开发或微服务开发中，我们需要同时启动前端、后端、数据库代理等多个服务。传统的做法是打开多个终端窗口（Terminal Tabs），容易混乱且难以管理。

ServiceHub 提供了一个优雅的图形化界面，让你能够：

在一个窗口中管理所有项目。

体验真正的 Shell 交互：不仅仅是运行命令，更是一个随时待命的终端。

一键启动/停止服务。

拥有独立的、类似 VSCode 的终端日志窗口。

自动保存配置，下次打开即用。

✨ 核心功能 (Features)

🛠 多服务管理：无限添加本地项目，独立配置工作目录（CWD）和启动命令。

🖥 真·沉浸式终端：

集成 xterm.js + node-pty。

完整交互能力：支持 vim、htop、Ctrl+C 中断、Tab 补全、方向键历史记录等。

彩色输出：自动识别 TTY 环境，完美渲染 CLI 工具的彩色日志。

🐚 Shell 模式：每个服务都是一个独立的 Shell 会话（zsh/bash/powershell），启动即就绪，自动执行预设命令。

💾 自动持久化：所有配置通过 electron-store 本地保存，重启应用不丢失。

🚦 进程守护：使用 tree-kill 确保停止服务时彻底清理子进程树，防止端口占用。

🌑 深色模式：基于 Tailwind CSS 设计的现代化 Dark Mode 界面，护眼且极客。

📸 截图 (Screenshots)

🛠 技术栈 (Tech Stack)

构建工具: Electron Vite

核心框架: Electron + React

语言: TypeScript

样式: Tailwind CSS (v3)

图标: Lucide React

终端内核: node-pty (后端伪终端) + xterm.js (前端渲染)

数据存储: electron-store

环境修复: fix-path (解决 GUI 环境 PATH 缺失问题)

🚀 快速开始 (Getting Started)

前置要求

Node.js (建议 v16+)

pnpm (推荐) 或 npm/yarn

构建工具链 (因为 node-pty 是 C++ 原生模块，Windows 需要 Visual Studio Build Tools，Mac 需要 Xcode Command Line Tools)

安装依赖

git clone [https://github.com/jagaimotomato/service-hub.git](https://github.com/jagaimotomato/service-hub.git)
cd service-hub
pnpm install

⚠️ 重要：编译原生模块

由于项目使用了 node-pty，Electron 的 Node 版本与本地 Node 版本不一致会导致二进制不兼容（表现为启动后界面无响应）。请务必执行以下命令重构依赖：

# 自动为当前 Electron 版本编译原生模块

npx electron-rebuild -f -w node-pty

开发模式启动 (Development)

pnpm dev

📦 打包构建 (Build)

# 构建生产环境包 (自动识别当前系统)

pnpm build

# 构建 Windows 安装包 (.exe)

pnpm build:win

# 构建 Mac 安装包 (.dmg)

pnpm build:mac

📂 目录结构 (Project Structure)

service-hub/
├── src/
│ ├── main/ # 【主进程】Node.js 环境
│ │ ├── index.ts # 核心逻辑：node-pty 终端管理、IPC 通信
│ │ └── ...
│ ├── preload/ # 【预加载脚本】
│ │ └── index.ts # 暴露安全的 window.api 给前端
│ └── renderer/ # 【渲染进程】React 前端
│ ├── src/
│ │ ├── components/
│ │ │ ├── Sidebar.tsx # 左侧服务列表
│ │ │ ├── ServiceDetail.tsx # 右侧配置页
│ │ │ └── TerminalView.tsx # xterm 终端封装
│ │ ├── App.tsx
│ │ └── main.tsx
│ └── index.html
├── electron.vite.config.ts
├── tailwind.config.js
└── package.json

📄 License

MIT © 2025 あけ さとし
