import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ServiceDetail from './components/ServiceDetail'
import { Service } from './types'
import { v4 as uuidv4 } from 'uuid'

function App(): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 1. 初始化：加载数据
  useEffect(() => {
    ;(async () => {
      try {
        const savedServices = await window.api.getServices()
        if (Array.isArray(savedServices)) {
          const resetServices: Service[] = savedServices.map((s: Service) => ({
            ...s,
            status: 'stopped' // 每次重开 App 都重置为停止
          }))
          setServices(resetServices)
          if (resetServices.length > 0) setActiveId(resetServices[0].id)
        }
      } catch (err) {
        console.error('Failed to load services:', err)
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  // 2. 自动保存
  useEffect(() => {
    if (!loaded) return
    window.api.saveServices(services)
  }, [services, loaded])

  // 3. 全局监听服务退出逻辑 (解决命令行退出 UI 不变的问题)
  useEffect(() => {
    const unsubs: (() => void)[] = []

    services.forEach((s) => {
      // 只有当前标记为 running 的服务才需要监听 exit 信号
      if (s.status === 'running') {
        const unsub = window.api.onExit(s.id, () => {
          console.log(`[App] Service ${s.name} exited.`)
          // 收到后端 Shell 退出信号，将状态置为 stopped
          setServices((prev) =>
            prev.map((item) => (item.id === s.id ? { ...item, status: 'stopped' } : item))
          )
        })
        unsubs.push(unsub)
      }
    })

    return () => unsubs.forEach((fn) => fn())
  }, [services])

  // --- Actions ---

  const handleAddService = (): void => {
    const newService: Service = {
      id: uuidv4(),
      name: 'New Service',
      cwd: '',
      command: '',
      status: 'stopped'
    }
    setServices((prev) => [...prev, newService])
    setActiveId(newService.id)
  }

  const handleUpdateService = (id: string, updates: Partial<Service>): void => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleDeleteService = async (id: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete this service?`)) return

    await window.api.killTerminal(id)

    const newServices = services.filter((s) => s.id !== id)
    setServices(newServices)
    if (activeId === id) {
      setActiveId(newServices.length > 0 ? newServices[0].id : null)
    }
  }

  // 启停逻辑
  const handleToggleStatus = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id)
    if (!service) return

    if (service.status === 'running') {
      // === 停止 ===
      // 发送 Ctrl+C (SIGINT)
      window.api.writeTerminal(id, '\u0003')
      // 移除手动的 setServices，完全依赖 onExit 监听器来更新状态
      // 这样只有当进程真的结束时，灯才会变灰
    } else {
      // === 启动 ===
      if (!service.command) {
        alert('Please enter a command first.')
        return
      }

      // 🛠️ 修复：重新启动时，必须先复活终端
      // 因为之前的 exec 导致停止时 Shell 也退出了，现在的终端是死的。
      await window.api.initTerminal(id, service.cwd)

      // 稍等 Shell 初始化完毕
      setTimeout(() => {
        // 🚀 使用 exec 替换当前 Shell，确保 Ctrl+C 能结束整个会话
        const cmd = `exec ${service.command}`
        window.api.writeTerminal(id, `${cmd}\r`)

        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))
      }, 500)
    }
  }

  // 重启逻辑
  const handleRestartService = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id)
    if (!service || service.status !== 'running') return

    // 1. 强制销毁旧终端
    await window.api.killTerminal(id)
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))

    // 2. 稍等片刻，重新初始化并运行
    setTimeout(async () => {
      // 重新初始化 Shell (带上 cwd)
      await window.api.initTerminal(id, service.cwd)

      // 稍等 Shell 加载 prompt，然后发送命令
      setTimeout(() => {
        if (service.command) {
          // 🚀 重启时也加上 'exec '
          const cmd = `exec ${service.command}`
          window.api.writeTerminal(id, `${cmd}\r`)
        }
        // UI 变更为运行
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))
      }, 800)
    }, 500)
  }

  const activeService = services.find((s) => s.id === activeId)

  if (!loaded)
    return (
      <div className="h-screen bg-gray-950 text-white flex items-center justify-center">
        Loading...
      </div>
    )

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar
        services={services}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={handleAddService}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteService}
        onRestart={handleRestartService}
      />

      <div className="flex-1 flex flex-col h-full bg-[#0d1117]">
        {activeService ? (
          <ServiceDetail service={activeService} onUpdate={handleUpdateService} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none">
            <div className="text-4xl mb-4 opacity-20 font-bold">ServiceHub</div>
            <p>Select or create a service to start.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
