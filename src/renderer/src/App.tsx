import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ServiceDetail from './components/ServiceDetail'
import { Service } from './types'
import { v4 as uuidv4 } from 'uuid'

function App(): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 1. 初始化：从本地存储加载配置
  useEffect(() => {
    ;(async () => {
      try {
        const savedServices = await window.api.getServices()
        if (Array.isArray(savedServices)) {
          // 显式指定类型，防止 status 类型推断错误
          const resetServices: Service[] = savedServices.map((s: Service) => ({
            ...s,
            status: 'stopped' // 重启APP默认重置为停止状态
          }))

          setServices(resetServices)

          if (resetServices.length > 0) {
            setActiveId(resetServices[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load services:', err)
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  // 2. 自动保存：当 services 发生变化时，保存到本地
  useEffect(() => {
    if (!loaded) return

    window.api.saveServices(services)
  }, [services, loaded])

  // 3. 全局监听服务意外退出 (Backend 通知 Frontend)
  // 修复：这里之前错误复制了初始化代码，现在放的是正确的监听逻辑
  useEffect(() => {
    const unsubs: (() => void)[] = []
    services.forEach((s) => {
      // 只要服务不是 stopped，就监听它的 exit 事件
      if (s.status !== 'stopped') {
        const unsub = window.api.onExit(s.id, () => {
          console.log(`Service ${s.name} exited unexpected.`)
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
    const service = services.find((s) => s.id === id)
    if (!service) return

    // 1. 检查是否正在运行
    if (service.status === 'running') {
      const confirmed = window.confirm(
        `服务 "${service.name}" 正在运行中。\n\n确定要停止并删除它吗？`
      )
      if (!confirmed) return

      await window.api.stopService(id)
    } else {
      if (!window.confirm(`确定要删除 "${service.name}" 吗？`)) return
    }

    // 2. 从 UI移除
    const newServices = services.filter((s) => s.id !== id)
    setServices(newServices)

    // 3. 修正选中项
    if (activeId === id) {
      setActiveId(newServices.length > 0 ? newServices[0].id : null)
    }
  }

  const handleToggleStatus = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id)
    if (!service) return

    if (service.status === 'running') {
      // === 停止 ===
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))
      await window.api.stopService(id)
    } else {
      // === 启动 ===
      if (!service.cwd || !service.command) {
        alert('Please configure Working Directory and Command first.')
        return
      }

      // 乐观更新
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s)))

      const success = await window.api.startService(id, service.cwd, service.command)
      if (!success) {
        // 失败回滚
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'error' } : s)))
      }
    }
  }

  const activeService = services.find((s) => s.id === activeId)

  // --- Render ---
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
