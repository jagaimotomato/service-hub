import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import kill from 'tree-kill'
import Store from 'electron-store' // 导入存储库
import fixPath from 'fix-path' // 引入库

fixPath()

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
  ipcMain.handle('service:start', (event, id: string, cwd: string, commandStr: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (processMap.has(id)) return false

    try {
      console.log(`[Start] ID:${id} Dir:${cwd} Cmd:${commandStr}`)
      const [cmd, ...args] = commandStr.split(' ')

      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        // 解决 Mac/Linux GUI 环境变量缺失的关键：
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          FORCE_COLOR: '1'
        }
      })

      processMap.set(id, child)

      const sendLog = (data: Buffer | string): void => {
        if (!window || window.isDestroyed()) return
        window.webContents.send(`log:${id}`, data.toString())
      }

      // 1. 监听标准输出
      child.stdout?.on('data', sendLog)
      child.stderr?.on('data', sendLog)

      // 2.【新增】监听启动错误 (比如 spawn 直接失败)
      child.on('error', (err) => {
        console.error(`[Error] ID:${id}`, err)
        sendLog(`\x1b[31m[System Error] Failed to spawn process: ${err.message}\x1b[0m\r\n`)
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`) // 通知前端已退出
        }
      })

      // 3. 监听退出
      child.on('close', (code) => {
        console.log(`[Exit] ID:${id} Code:${code}`)
        processMap.delete(id)
        if (window && !window.isDestroyed()) {
          window.webContents.send(`exit:${id}`) // 通知前端已退出
        }
      })

      return true
    } catch (error: unknown) {
      console.error(error)
      // 如果同步代码报错，直接发日志给前端
      if (window && !window.isDestroyed()) {
        window.webContents.send(`log:${id}`, `\x1b[31m[System Error] ${error.message}\x1b[0m\r\n`)
      }
      return false
    }
  })

  // 停止服务 (健壮性修复)
  ipcMain.handle('service:stop', (_event, id: string) => {
    const child = processMap.get(id)

    // 【关键修复】如果 map 里找不到这个 id，说明进程早就挂了
    // 这时候直接返回 true，让前端把状态改成 stopped
    if (!child) {
      console.log(`[Stop] Process ${id} not found, assuming stopped.`)
      return true
    }

    if (child.pid) {
      try {
        kill(child.pid, 'SIGKILL', (err) => {
          if (err) {
            console.error('[Stop] Kill failed (maybe already dead):', err)
            // 杀进程失败通常是因为它已经不在了，也可以视为成功
          }
          processMap.delete(id)
        })
      } catch (e) {
        console.error('[Stop] Exception during kill:', e)
        processMap.delete(id)
      }
    } else {
      processMap.delete(id)
    }

    return true // 总是返回成功
  })
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
