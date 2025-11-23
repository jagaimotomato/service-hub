import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import kill from 'tree-kill'
import Store from 'electron-store'
import fixPath from 'fix-path'
import * as pty from 'node-pty'
import os from 'os'
import fs from 'fs' // 引入 fs

// 修复环境变量
try {
  if (typeof fixPath === 'function') {
    fixPath()
  } else if (
    fixPath &&
    typeof (fixPath as unknown as { default: () => void }).default === 'function'
  ) {
    ;(fixPath as unknown as { default: () => void }).default()
  }
} catch (e) {
  console.error('Failed to run fix-path:', e)
}

const store = new Store({
  // @ts-ignore fix-path 的类型定义不完整，所以需要忽略
  schema: {
    services: { type: 'array', default: [] }
  }
})

let mainWindow: BrowserWindow | null = null
const processMap = new Map<string, pty.IPty>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // --- 核心逻辑：终端管理器 ---

  // 1. 初始化终端 (只启动 Shell，不跑命令)
  ipcMain.handle('terminal:init', (event, id: string, cwd: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    // 如果已经存在，就不重复创建，直接忽略
    if (processMap.has(id)) return true

    try {
      // 1. 确定 Shell (Mac/Linux用默认Shell，Windows用PowerShell)
      const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'

      // 🛡️ 防御性编程：检查目录是否存在，不存在则回退到 Home
      let targetDir = cwd && cwd.trim() !== '' ? cwd : os.homedir()
      if (targetDir && !fs.existsSync(targetDir)) {
        console.warn(`[Init Shell] Path not found: ${targetDir}, falling back to home.`)
        targetDir = os.homedir()
      }

      console.log(`[Init Shell] ID:${id} Shell:${shell} Dir:${targetDir}`)

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: targetDir,
        env: process.env as unknown as Record<string, string>
      })

      processMap.set(id, ptyProcess)

      // 3. 数据流回传
      ptyProcess.onData((data) => {
        if (!window || window.isDestroyed()) return
        window.webContents.send(`log:${id}`, data)
      })

      ptyProcess.onExit(({ exitCode }) => {
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`)
          // 提示用户 Shell 已关闭
          window.webContents.send(
            `log:${id}`,
            `\r\n\x1b[31mSession ended (Code ${exitCode}). Reload to restart.\x1b[0m\r\n`
          )
        }
      })

      return true
    } catch (error: unknown) {
      console.error(error)
      return false
    }
  })

  // 2. 写入数据 (核心交互接口：打字、执行命令都走这里)
  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    const ptyProcess = processMap.get(id)
    if (ptyProcess) {
      try {
        ptyProcess.write(data)
      } catch (e) {
        console.error(e)
      }
    }
  })

  // 3. 调整大小
  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    const ptyProcess = processMap.get(id)
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows)
      } catch (e: unknown | Error) {
        console.error(`Failed to resize service ${id}:`, e)
      }
    }
  })

  // 4. 彻底销毁 (删除服务时用)
  ipcMain.handle('terminal:kill', (_event, id: string) => {
    const ptyProcess = processMap.get(id)
    if (ptyProcess) {
      try {
        ptyProcess.kill()
        if (ptyProcess.pid) kill(ptyProcess.pid, 'SIGKILL')
      } catch (e: unknown | Error) {
        console.error(`Failed to kill service ${id}:`, e)
      }
      processMap.delete(id)
    }
    return true
  })

  // --- 通用接口 ---
  ipcMain.handle('service:list', () => store.get('services', []))
  ipcMain.handle('service:save', (_event, services) => store.set('services', services))
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? undefined : filePaths[0]
  })

  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  processMap.forEach((proc) => {
    try {
      proc.kill()
      if (proc.pid) kill(proc.pid)
    } catch (e: unknown | Error) {
      console.error('[Before Quit Error]', e)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
