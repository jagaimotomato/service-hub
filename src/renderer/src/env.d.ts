/// <reference types="vite/client" />

/// <reference types="vite/client" />

interface Window {
  api: {
    getServices: () => Promise<any[]>
    saveServices: (services: any[]) => Promise<boolean>
    selectDirectory: () => Promise<string | undefined>
    startService: (id: string, cwd: string, command: string) => Promise<boolean>
    stopService: (id: string) => Promise<boolean>
    onLog: (id: string, callback: (data: string) => void) => () => void
    onExit: (id: string, callback: () => void) => () => void
  }
}
