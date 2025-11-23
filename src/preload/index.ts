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
  // Data access
  getServices: () => ipcRenderer.invoke('service:list'),
  // 2. Use the Service[] type here
  saveServices: (services: Service[]) => ipcRenderer.invoke('service:save', services),

  // System interaction
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Service control
  startService: (id: string, cwd: string, command: string) =>
    ipcRenderer.invoke('service:start', id, cwd, command),
  stopService: (id: string) => ipcRenderer.invoke('service:stop', id),

  // Event listeners
  onLog: (id: string, callback: (data: string) => void) => {
    const channel = `log:${id}`
    // 3. Use IpcRendererEvent for the event object
    const listener = (_event: IpcRendererEvent, data: string): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onExit: (id: string, callback: () => void) => {
    const channel = `exit:${id}`
    // No arguments are used here, so this one is safe, but technically
    // the listener receives (_event: IpcRendererEvent) if you needed it.
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
