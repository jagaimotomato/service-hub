import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 1. Define a minimal interface for the Service to replace 'any'
interface Service {
  id: string
  name: string
  cwd: string
  command: string
  status: string
}

const api = {
  getServices: () => ipcRenderer.invoke('service:list'),
  saveServices: (services: Service[]) => ipcRenderer.invoke('service:save', services),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // --- 新的终端控制 API ---
  // 1. 初始化 Shell
  initTerminal: (id: string, cwd: string) => ipcRenderer.invoke('terminal:init', id, cwd),

  // 2. 写入数据 (输入文字、命令、Ctrl+C 都走这个)
  writeTerminal: (id: string, data: string) => ipcRenderer.send('terminal:write', id, data),

  // 3. 调整大小
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', id, cols, rows),

  // 4. 销毁终端
  killTerminal: (id: string) => ipcRenderer.invoke('terminal:kill', id),

  onLog: (id: string, callback: (data: string) => void) => {
    const channel = `log:${id}`
    const listener = (_event: IpcRendererEvent, data: string): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onExit: (id: string, callback: () => void) => {
    const channel = `exit:${id}`
    const listener = (): void => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
