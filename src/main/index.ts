import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset' // 这是构建工具处理过的图标路径
import kill from 'tree-kill'
import Store from 'electron-store'
import fixPath from 'fix-path'
import * as pty from 'node-pty'
import os from 'os'
import fs from 'fs'

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
let tray: Tray | null = null
let isQuitting = false // 标记是否正在进行真正的退出流程

const processMap = new Map<string, pty.IPty>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    ...(process.platform === 'linux' ? { icon } : {}),
    // Windows 这里的 icon 设置只影响左上角和任务栏，不影响 Tray
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // ⚡️ 核心：拦截关闭事件，改为隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      return false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // --- 1. 创建系统托盘 (Tray) ---
  const trayIcon = nativeImage.createFromPath(icon) // 使用引入的图标路径
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ServiceHub', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true // 标记为真退出
        app.quit()
      }
    }
  ])

  tray.setToolTip('ServiceHub')
  tray.setContextMenu(contextMenu)

  // 双击托盘图标打开窗口
  tray.on('double-click', () => {
    mainWindow?.show()
  })

  // --- End Tray ---

  // --- 终端管理器逻辑 ---

  ipcMain.handle('terminal:init', (event, id: string, cwd: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (processMap.has(id)) return true

    try {
      const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
      let targetDir = cwd && cwd.trim() !== '' ? cwd : os.homedir()

      if (!fs.existsSync(targetDir)) {
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

      ptyProcess.onData((data) => {
        if (!window || window.isDestroyed()) return
        window.webContents.send(`log:${id}`, data)
      })

      ptyProcess.onExit(({ exitCode }) => {
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`)
          window.webContents.send(
            `log:${id}`,
            `\r\n\x1b[31mSession ended (Code ${exitCode}).\x1b[0m\r\n`
          )
        }
      })

      return true
    } catch (error: unknown) {
      console.error(error)
      return false
    }
  })

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
  isQuitting = true // 确保 Cmd+Q 或其他退出方式能正常退出
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
