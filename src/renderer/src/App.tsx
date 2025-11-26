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
  // 用于后续区分启动命令(exec)和停止逻辑(Ctrl+C vs Kill)
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

  // 3. 全局监听服务退出逻辑 (主要用于 Mac/Linux 优雅退出后的状态更新)
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

    // 删除前强制销毁终端
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
      // === 停止逻辑 ===
      if (isWindows) {
        // 🪟 Windows 修复：
        // 直接强制销毁，不发送 Ctrl+C。
        // 这样可以绕过 CMD/PowerShell 的 "Terminate batch job (Y/N)?" 询问，
        // 配合后端的 tree-kill 逻辑，能彻底清除 node.exe 僵尸进程。
        await window.api.killTerminal(id)

        // 强制停止通常不会触发 graceful exit 事件，所以手动更新 UI 为停止
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))
      } else {
        // 🍎 Mac/Linux：
        // 保持优雅退出：发送 Ctrl+C -> 触发进程退出 -> 触发 onExit -> 更新 UI
        window.api.writeTerminal(id, '\u0003')
      }
    } else {
      // === 启动逻辑 ===
      if (!service.command) {
        alert('Please enter a command first.')
        return
      }

      // 每次启动前先初始化终端（如果已存在后端会忽略，如果已死会复活）
      await window.api.initTerminal(id, service.cwd)

      setTimeout(() => {
        // 🛠️ 启动命令修复：
        // Windows 不加 exec (因为不支持)，Mac/Linux 加 exec (支持 Ctrl+C 退出 Shell)
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

    // 1. 强制销毁旧终端
    await window.api.killTerminal(id)
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)))

    // 2. 稍等片刻，重新初始化并运行
    setTimeout(async () => {
      await window.api.initTerminal(id, service.cwd)

      setTimeout(() => {
        if (service.command) {
          // 🛠️ 重启命令修复：同样需要判断系统
          const prefix = isWindows ? '' : 'exec '
          const cmd = `${prefix}${service.command}`
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
