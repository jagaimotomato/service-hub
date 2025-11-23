import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ServiceDetail from './components/ServiceDetail'
import { Service } from './types'
import { v4 as uuidv4 } from 'uuid' // npm install uuid @types/uuid

function App(): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false) // 标记是否加载完成，防止初始空数据覆盖本地存储

  // 1. 初始化：从本地存储加载配置
  useEffect(() => {
    ;(async () => {
      try {
        const savedServices = await window.api.getServices()
        if (Array.isArray(savedServices)) {
          // 重要：每次重启APP，所有服务状态必须重置为 stopped
          const resetServices = savedServices.map((s: Service) => ({
            ...s,
            status: 'stopped'
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
    if (!loaded) return // 如果还没加载完，不要保存空数组

    // 过滤掉 status 字段再保存，或者保存也没关系，因为加载时会重置
    // 这里我们直接保存，因为上面加载逻辑已经处理了重置
    window.api.saveServices(services)
  }, [services, loaded])

  // 3. 全局监听服务意外退出
  useEffect(() => {
    const unsubs: (() => void)[] = []
    services.forEach((s) => {
      if (s.status === 'running') {
        const unsub = window.api.onExit(s.id, () => {
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

  const handleAddService = () => {
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

  const handleUpdateService = (id: string, updates: Partial<Service>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleToggleStatus = async (id: string) => {
    const service = services.find((s) => s.id === id)
    if (!service) return

    if (service.status === 'running') {
      // 执行停止
      await window.api.stopService(id)
      // 状态更新通常依赖 onExit 回调，但为了UI响应快，可以先手动设置
      // 这里我们依赖 onExit 的回调来改变状态，更加准确
    } else {
      // 执行启动
      if (!service.cwd || !service.command) {
        alert('Please configure Working Directory and Command first.')
        return
      }

      // 乐观更新 UI
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
