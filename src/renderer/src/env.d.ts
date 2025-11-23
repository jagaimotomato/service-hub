/// <reference types="vite/client" />

interface Window {
  api: {
    getServices: () => Promise<any[]>
    saveServices: (services: any[]) => Promise<boolean>
    selectDirectory: () => Promise<string | undefined>

    // 新 API 定义
    initTerminal: (id: string, cwd: string) => Promise<boolean>
    writeTerminal: (id: string, data: string) => void
    resizeTerminal: (id: string, cols: number, rows: number) => void
    killTerminal: (id: string) => Promise<boolean>

    onLog: (id: string, callback: (data: string) => void) => () => void
    onExit: (id: string, callback: () => void) => () => void
  }
}
