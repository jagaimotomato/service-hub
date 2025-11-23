import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import kill from 'tree-kill'
import Store from 'electron-store'
import fixPath from 'fix-path'

// === 修复 fixPath 兼容性问题 ===
// fix-path 新版可能是 ESM，导入后可能在 .default 属性上，也可能直接就是函数
try {
  if (typeof fixPath === 'function') {
    fixPath()
  } else if (fixPath && typeof (fixPath as any).default === 'function') {
    ;(fixPath as any).default()
  }
} catch (e) {
  console.error('Failed to run fix-path:', e)
}

// 初始化 Store
const store = new Store({
  // @ts-ignore
  schema: {
    services: {
      type: 'array',
      default: []
    }
  }
})

let mainWindow: BrowserWindow | null = null
const processMap = new Map<string, ChildProcess>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// === APP 生命周期 ===
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // --- IPC Handlers ---

  // 1. 启动服务
  ipcMain.handle('service:start', (event, id: string, cwd: string, commandStr: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (processMap.has(id)) return false

    try {
      console.log(`[Start] ID:${id} Dir:${cwd} Cmd:${commandStr}`)
      const [cmd, ...args] = commandStr.split(' ')

      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          // 确保基础 PATH 存在，防止 fixPath 失败时完全无法运行
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          FORCE_COLOR: '1'
        }
      })

      processMap.set(id, child)

      const sendLog = (data: Buffer | string): void => {
        if (!window || window.isDestroyed()) return
        window.webContents.send(`log:${id}`, data.toString())
      }

      // 监听输出
      child.stdout?.on('data', sendLog)
      child.stderr?.on('data', sendLog)

      // 监听启动错误
      child.on('error', (err) => {
        console.error(`[Error] ID:${id}`, err)
        sendLog(`\x1b[31m[System Error] Failed to spawn process: ${err.message}\x1b[0m\r\n`)
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`)
        }
      })

      // 监听退出
      child.on('close', (code) => {
        console.log(`[Exit] ID:${id} Code:${code}`)
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`)
        }
      })

      return true
    } catch (error: unknown) {
      console.error(error)
      if (window && !window.isDestroyed()) {
        window.webContents.send(
          `log:${id}`,
          `\x1b[31m[System Error] ${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`
        )
      }
      return false
    }
  })

  // 2. 停止服务
  ipcMain.handle('service:stop', (_event, id: string) => {
    const child = processMap.get(id)

    if (!child) {
      console.log(`[Stop] Process ${id} not found, assuming stopped.`)
      return true
    }

    if (child.pid) {
      try {
        kill(child.pid, 'SIGKILL', (err) => {
          if (err) console.error('[Stop] Kill failed (maybe already dead):', err)
          processMap.delete(id)
        })
      } catch (e) {
        console.error('[Stop] Exception during kill:', e)
        processMap.delete(id)
      }
    } else {
      processMap.delete(id)
    }
    return true
  })

  // 3. 获取列表
  ipcMain.handle('service:list', () => {
    return store.get('services', [])
  })

  // 4. 保存列表
  ipcMain.handle('service:save', (_event, services) => {
    store.set('services', services)
    return true
  })

  // 5. 选择文件夹
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) return undefined
    return filePaths[0]
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  processMap.forEach((child) => {
    if (child.pid) kill(child.pid)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
