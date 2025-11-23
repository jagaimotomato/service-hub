# ⚡️ ServiceHub

> **你的本地微服务管理指挥官。**
> 一个基于 Electron + React 的桌面端工具，用于统一管理、启动和监控多个本地开发服务。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/Electron-30.0-blueviolet)
![React](https://img.shields.io/badge/React-18.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

---

## 📖 简介 (Introduction)

在全栈开发或微服务开发中，我们需要同时启动前端、后端、数据库代理等多个服务。传统的做法是打开多个终端窗口（Terminal Tabs），容易混乱且难以管理。

**ServiceHub** 提供了一个优雅的图形化界面，让你能够：

- 在一个窗口中管理所有项目。
- 一键启动/停止服务。
- 拥有独立的、类似 VSCode 的终端日志窗口。
- 自动保存配置，下次打开即用。

## ✨ 核心功能 (Features)

- **🛠 多服务管理**：无限添加本地项目，独立配置工作目录（CWD）和启动命令。
- **🖥 沉浸式终端**：集成 `xterm.js`，支持颜色高亮、自动换行，提供原生的终端体验。
- **💾 自动持久化**：所有配置通过 `electron-store` 本地保存，重启应用不丢失。
- **🚦 进程守护**：使用 `tree-kill` 确保停止服务时彻底清理子进程，防止端口占用。
- **🌑 深色模式**：基于 Tailwind CSS 设计的现代化 Dark Mode 界面，护眼且极客。
- **📂 原生交互**：调用系统原生文件选择器，安全便捷。

## 📸 截图 (Screenshots)

![App Screenshot](https://via.placeholder.com/800x450.png?text=ServiceHub+Screenshot+PlaceHolder)

## 🛠 技术栈 (Tech Stack)

- **构建工具**: [Electron Vite](https://electron-vite.org/)
- **核心框架**: [Electron](https://www.electronjs.org/) + [React](https://react.dev/)
- **语言**: TypeScript
- **样式**: Tailwind CSS (v3)
- **图标**: Lucide React
- **终端模拟**: xterm.js + xterm-addon-fit
- **数据存储**: electron-store
- **进程管理**: Node.js `spawn` + `tree-kill`

## 🚀 快速开始 (Getting Started)

### 前置要求

- Node.js (建议 v16+)
- pnpm (推荐) 或 npm/yarn

### 安装依赖

```bash
git clone [https://github.com/your-username/service-hub.git](https://github.com/your-username/service-hub.git)
cd service-hub
pnpm install

打包构建 (Build)
Bash

# 构建生产环境包
pnpm build

# 构建 Windows 安装包
pnpm build:win

# 构建 Mac 安装包
pnpm build:mac
📂 目录结构 (Project Structure)
Plaintext

service-hub/
├── src/
│   ├── main/             # 【主进程】Node.js 环境
│   │   ├── index.ts      # 包含进程管理、IPC 通信、Store 逻辑
│   │   └── ...
│   ├── preload/          # 【预加载脚本】
│   │   └── index.ts      # 暴露安全的 window.api 给前端
│   └── renderer/         # 【渲染进程】React 前端
│       ├── src/
│       │   ├── components/
│       │   │   ├── Sidebar.tsx       # 左侧服务列表
│       │   │   ├── ServiceDetail.tsx # 右侧配置页
│       │   │   └── TerminalView.tsx  # xterm 终端封装
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── index.html
├── electron.vite.config.ts
├── tailwind.config.js
└── package.json


📄 License
MIT © 2025 あけ さとし
```
