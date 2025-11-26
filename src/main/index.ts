import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
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
  } else if (fixPath && typeof (fixPath as any).default === 'function') {
    ;(fixPath as any).default()
  }
} catch (e) {
  console.error('Failed to run fix-path:', e)
}

const store = new Store({
  // @ts-ignore 修复类型错误
  schema: {
    services: { type: 'array', default: [] }
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const processMap = new Map<string, pty.IPty>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    ...(process.platform === 'linux' ? { icon } : {}),
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
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

  const trayIcon = nativeImage.createFromPath(icon)
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ServiceHub', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('ServiceHub')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
  })

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
        env: process.env as any
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
      } catch (e) {}
    }
  })

  // 🛠️ 核心修复：先杀全家 (tree-kill)，再清理外壳 (pty.kill)
  // 这解决了 Windows 下 node.exe 残留的问题
  ipcMain.handle('terminal:kill', async (_event, id: string) => {
    const ptyProcess = processMap.get(id)
    if (ptyProcess) {
      const pid = ptyProcess.pid

      // 1. 先尝试 Tree Kill (必须异步等待)
      if (pid) {
        await new Promise<void>((resolve) => {
          kill(pid, 'SIGKILL', () => {
            // 忽略错误，因为有时候进程可能已经结束
            resolve()
          })
        })
      }

      // 2. 再杀掉 PTY 外壳
      try {
        ptyProcess.kill()
      } catch (e) {}

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

// 🛠️ 退出逻辑重写：防止僵尸进程
app.on('before-quit', (e) => {
  // 允许正常退出的标记
  isQuitting = true

  // 如果还有运行中的进程，先阻止退出，执行异步清理
  if (processMap.size > 0) {
    e.preventDefault()

    const killPromises = Array.from(processMap.values()).map((proc) => {
      return new Promise<void>((resolve) => {
        if (proc.pid) {
          // 使用 tree-kill 强制杀死进程树 (node.exe 等子进程)
          kill(proc.pid, 'SIGKILL', () => resolve())
        } else {
          resolve()
        }
        // 同时尝试杀死 shell
        try {
          proc.kill()
        } catch (err) {}
      })
    })

    // 等待所有清理完成后，再次调用 quit
    Promise.all(killPromises).finally(() => {
      processMap.clear()
      app.quit()
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
