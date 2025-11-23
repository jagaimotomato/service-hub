import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'

interface TerminalViewProps {
  id: string
  cwd: string
}

// 缓存终端实例
const terminalCache = new Map<string, { term: Terminal; fit: FitAddon }>()

const TerminalView: React.FC<TerminalViewProps> = ({ id, cwd }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  // 用 ref 记录当前 ID，防止 useEffect 闭包陷阱
  const currentId = useRef(id)

  useEffect(() => {
    currentId.current = id
    if (!containerRef.current) return

    let termObj = terminalCache.get(id)

    // 1. 如果缓存不存在，创建新终端
    if (!termObj) {
      const term = new Terminal({
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#58a6ff33'
        },
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        allowProposedApi: true
      })

      const fit = new FitAddon()
      term.loadAddon(fit)
      term.loadAddon(new WebLinksAddon())

      termObj = { term, fit }
      terminalCache.set(id, termObj)

      // 监听尺寸变化 -> 后端
      term.onResize((size) => {
        window.api.resizeTerminal(id, size.cols, size.rows)
      })

      // 监听输入 -> 后端
      term.onData((data) => {
        window.api.writeTerminal(id, data)
      })
    }

    // 2. 挂载到 DOM
    // ⚠️ 关键：先清空，防止 React 严格模式导致双重挂载
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }

    termObj.term.open(containerRef.current)

    // 3. 布局调整与聚焦
    setTimeout(() => {
      termObj?.fit.fit()
      termObj?.term.focus() // 🔥 核心修复：挂载后立即聚焦
    }, 50)

    // 4. 监听后端日志
    const removeLogListener = window.api.onLog(id, (data) => {
      // 只有当前显示的 ID 才写入数据，防止后台 Tab 串台（虽然 React 卸载组件不应该发生）
      if (currentId.current === id) {
        termObj?.term.write(data)
      }
    })

    // 5. 初始化后端 Shell (如果还没启动)
    // 延迟一点点，确保前端就绪
    setTimeout(() => {
      window.api.initTerminal(id, cwd)
    }, 100)

    const handleResize = (): void => termObj?.fit.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      removeLogListener()
      // 注意：不要 dispose terminal，只移除窗口 resize 监听
      window.removeEventListener('resize', handleResize)
    }
  }, [id])

  // 6. 监听 cwd 变化自动跳转 (可选)
  useEffect(() => {
    if (cwd && cwd.trim() !== '') {
      // 只有当终端已经存在时才发 cd
      if (terminalCache.has(id)) {
        window.api.writeTerminal(id, `cd "${cwd}"\r`)
        // cd 后也聚焦一下
        setTimeout(() => terminalCache.get(id)?.term.focus(), 100)
      }
    }
  }, [cwd, id])

  // 🔥 核心修复：点击区域强制聚焦
  // 解决点击按钮后焦点丢失的问题
  const handleContainerClick = (): void => {
    const termObj = terminalCache.get(id)
    termObj?.term.focus()
  }

  return (
    <div
      className="w-full h-full"
      ref={containerRef}
      onClick={handleContainerClick} // 点击即聚焦
    />
  )
}

export default TerminalView
