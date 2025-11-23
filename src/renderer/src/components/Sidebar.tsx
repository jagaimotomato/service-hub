import React from 'react'
import { Play, Square, Plus, TerminalSquare, Box } from 'lucide-react'
import { Service } from '../types'

interface SidebarProps {
  services: Service[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onToggleStatus: (id: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({
  services,
  activeId,
  onSelect,
  onAdd,
  onToggleStatus
}) => {
  return (
    <div className="w-64 h-full bg-[#161b22] flex flex-col border-r border-[#30363d]">
      {/* 顶部标题栏 */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[#30363d] select-none draggable-region">
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          <TerminalSquare className="w-5 h-5 text-blue-400" />
          <span>ServiceHub</span>
        </div>
        <button
          onClick={onAdd}
          className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors no-drag"
          title="Create New Service"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {services.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-10">
            No services yet.
            <br />
            Click '+' to add one.
          </div>
        )}
        {services.map((service) => {
          const isActive = activeId === service.id
          const isRunning = service.status === 'running'
          return (
            <div
              key={service.id}
              onClick={() => onSelect(service.id)}
              className={`
                group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all select-none
                ${isActive ? 'bg-[#1f242c] text-white' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}
              `}
            >
              {/* 左侧：名字和状态点 */}
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                    isRunning
                      ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                      : isActive
                        ? 'bg-gray-400'
                        : 'bg-gray-600 group-hover:bg-gray-500'
                  }`}
                />
                <span className="truncate font-medium text-sm">
                  {service.name || 'Unnamed Service'}
                </span>
              </div>

              {/* 右侧：快捷操作按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus(service.id)
                }}
                className={`
                  p-1 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0
                  ${isRunning ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-green-500/20 text-green-400'}
                `}
              >
                {isRunning ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* 底部简要信息 */}
      <div className="px-4 py-2 text-xs text-gray-500 border-t border-[#30363d] flex items-center gap-2 select-none">
        <Box className="w-3 h-3" />
        <span>{services.length} Services stored</span>
      </div>
    </div>
  )
}

export default Sidebar
