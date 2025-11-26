import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ServiceDetail from './components/ServiceDetail'
import { Service } from './types'
import { v4 as uuidv4 } from 'uuid'

function App(): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 🌍 判断当前是否为 Windows 系统
  // Windows 的 UserAgent 通常包含 "Windows"
  const isWindows = window.navigator.userAgent.includes('Windows')

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

  // 3. 全局监听服务退出逻辑
  useEffect(() => {
    const unsubs: (() => void)[] = []

    services.forEach((s) => {
      if (s.status === 'running') {
        const unsub = window.api.onExit(s.id, () => {
          console.log(`[App] Service ${s.name} exited.`)
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
      window.api.writeTerminal(id, '\u0003') // Ctrl+C
    } else {
      // === 启动 ===
      if (!service.command) {
        alert('Please enter a command first.')
        return
      }

      await window.api.initTerminal(id, service.cwd)

      setTimeout(() => {
        // 🛠️ 修复核心：Windows 不加 exec，Mac/Linux 加 exec
        const prefix = isWindows ? '' : 'exec '
        const cmd = `${prefix}${service.command}`

        window.api.writeTerminal(id, `${cmd}\r`)

        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))
      }, 500)
    }
  }

  // 重启逻辑
  const handleRestartService = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id)
    if (!service || service.status !== 'running') return

    await window.api.killTerminal(id)
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))

    setTimeout(async () => {
      await window.api.initTerminal(id, service.cwd)

      setTimeout(() => {
        if (service.command) {
          // 🛠️ 修复核心：重启逻辑也做同样的平台判断
          const prefix = isWindows ? '' : 'exec '
          const cmd = `${prefix}${service.command}`

          window.api.writeTerminal(id, `${cmd}\r`)
        }
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))
      }, 800)
    }, 500)
  }

  const activeService = services.find((s) => s.id === activeId)

  if (!loaded) return <div className="h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>

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
