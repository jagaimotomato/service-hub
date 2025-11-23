import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

interface TerminalViewProps {
  id: string // 不同的服务对应不同的终端实例
}

// 全局缓存终端实例，防止切换服务时终端内容丢失
// key: serviceId, value: { terminal, fitAddon }
const terminalCache = new Map<string, { term: Terminal; fit: FitAddon }>()

const TerminalView: React.FC<TerminalViewProps> = ({ id }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let termObj = terminalCache.get(id)

    const removeLogListener = window.api.onLog(id, (data) => {
      // 将换行符标准化，确保 xterm 正确换行
      const formatted = data.replace(/\n/g, '\r\n')
      termObj?.term.write(formatted)
    })

    if (!termObj) {
      // 1. 如果缓存里没有，创建一个新的终端实例
      const term = new Terminal({
        theme: {
          background: '#0d1117', // 与背景融合的深色
          foreground: '#c9d1d9',
          cursor: '#58a6ff'
        },
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        convertEol: true // 自动处理换行符
      })

      const fit = new FitAddon()
      term.loadAddon(fit)

      termObj = { term, fit }
      terminalCache.set(id, termObj)

      // 写入一点欢迎语，假装已经连接
      term.write(`\x1b[32m➜\x1b[0m Service Terminal initialized for ID: ${id}\r\n`)
      term.write(`\x1b[90m Waiting for commands...\x1b[0m\r\n`)
    }

    // 2. 将终端挂载到 DOM
    termObj.term.open(containerRef.current)
    termObj.fit.fit()

    // 3. 监听窗口大小变化，自动调整终端大小
    const handleResize = () => termObj?.fit.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      removeLogListener()
      window.removeEventListener('resize', handleResize)
      // 注意：这里我们不 dispose 终端，而是让它留在缓存里，
      // 这样用户切回来时，之前的日志还在！
      // 只有在删除服务时才需要真正清理缓存（后续实现）。
      // 这里只需要把 DOM 拆下来即可，xterm 会自动处理 open 的 detach。
    }
  }, [id])

  return <div className="w-full h-full" ref={containerRef} />
}

export default TerminalView
