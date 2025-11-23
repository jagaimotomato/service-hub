import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import kill from 'tree-kill'
import Store from 'electron-store' // 导入存储库

// 初始化 Store
// schema 定义数据的类型，保证数据安全
const store = new Store({
  schema: {
    services: {
      type: 'array',
      default: []
    }
  }
})

let mainWindow: BrowserWindow | null = null

// 进程池：用来管理运行中的服务
const processMap = new Map<string, ChildProcess>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117', // 与暗色主题匹配
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

  // IPC: 获取服务列表
  ipcMain.handle('service:list', () => {
    // 从本地存储读取
    const services = store.get('services', [])
    return services
  })

  // IPC: 保存服务列表
  ipcMain.handle('service:save', (_event, services) => {
    // 保存到本地存储
    store.set('services', services)
    return true
  })

  // IPC: 选择文件夹
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) return undefined
    return filePaths[0]
  })

  // IPC: 启动服务
  ipcMain.handle('service:start', (event, id: string, cwd: string, commandStr: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (processMap.has(id)) return false

    try {
      console.log(`[Start] ID:${id} Dir:${cwd} Cmd:${commandStr}`)
      const [cmd, ...args] = commandStr.split(' ')

      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
      })

      processMap.set(id, child)

      const sendLog = (data: Buffer | string) => {
        if (!window || window.isDestroyed()) return
        window.webContents.send(`log:${id}`, data.toString())
      }

      child.stdout?.on('data', sendLog)
      child.stderr?.on('data', sendLog)

      child.on('close', (code) => {
        console.log(`[Exit] ID:${id} Code:${code}`)
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`)
        }
      })

      return true
    } catch (error) {
      console.error(error)
      return false
    }
  })

  // IPC: 停止服务
  ipcMain.handle('service:stop', (_event, id: string) => {
    const child = processMap.get(id)
    if (child && child.pid) {
      kill(child.pid, 'SIGKILL', (err) => {
        if (err) console.error('Kill failed:', err)
        processMap.delete(id)
      })
      return true
    }
    return false
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 退出前杀掉所有子进程
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
