import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ServiceDetail from './components/ServiceDetail'
import { Service } from './types'
import { v4 as uuidv4 } from 'uuid'

function App(): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const savedServices = await window.api.getServices()
        if (Array.isArray(savedServices)) {
          const resetServices: Service[] = savedServices.map((s: Service) => ({
            ...s,
            // 重启后默认全部视为 Stopped，虽然 Shell 可能还没启动，但任务没跑
            status: 'stopped'
          }))
          setServices(resetServices)
          if (resetServices.length > 0) setActiveId(resetServices[0].id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!loaded) return
    window.api.saveServices(services)
  }, [services, loaded])

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
    if (!window.confirm(`Are you sure?`)) return

    // 彻底杀掉 Shell 进程
    await window.api.killTerminal(id)

    const newServices = services.filter((s) => s.id !== id)
    setServices(newServices)
    if (activeId === id) setActiveId(newServices.length > 0 ? newServices[0].id : null)
  }

  const handleToggleStatus = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id)
    if (!service) return

    if (service.status === 'running') {
      // === 停止 ===
      // 发送 Ctrl+C 中断命令
      window.api.writeTerminal(id, '\u0003')
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))
    } else {
      // === 启动 ===
      if (!service.command) {
        alert('Please enter a command first.')
        return
      }
      // 发送命令 + 回车
      window.api.writeTerminal(id, `${service.command}\r`)
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))
    }
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
      />

      <div className="flex-1 flex flex-col h-full bg-[#0d1117]">
        {activeService ? (
          // 这里不需要再传 onUpdate 里的 cwd 了，TerminalView 会自己监听 props 变化
          <ServiceDetail service={activeService} onUpdate={handleUpdateService} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <p>Select a service.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
