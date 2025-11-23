import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // 数据存取
  getServices: () => ipcRenderer.invoke('service:list'),
  saveServices: (services: any[]) => ipcRenderer.invoke('service:save', services),

  // 系统交互
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // 服务控制
  startService: (id: string, cwd: string, command: string) =>
    ipcRenderer.invoke('service:start', id, cwd, command),
  stopService: (id: string) => ipcRenderer.invoke('service:stop', id),

  // 事件监听
  onLog: (id: string, callback: (data: string) => void) => {
    const channel = `log:${id}`
    const listener = (_event: any, data: string) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onExit: (id: string, callback: () => void) => {
    const channel = `exit:${id}`
    const listener = () => callback()
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
