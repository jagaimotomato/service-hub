import React from 'react'
import { Service } from '../types'
import { FolderOpen, Terminal as TerminalIcon, Settings2 } from 'lucide-react'
import TerminalView from './TerminalView'

interface ServiceDetailProps {
  service: Service
  onUpdate: (id: string, updates: Partial<Service>) => void
}

// 定义一个通用的输入框样式
const inputClass =
  'w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:bg-[#161b22] transition-colors font-mono'
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase mb-1.5 tracking-wider'

const ServiceDetail: React.FC<ServiceDetailProps> = ({ service, onUpdate }) => {
  const handleChange = (field: keyof Service, value: string) => {
    onUpdate(service.id, { [field]: value })
  }

  const handleSelectDir = async () => {
    const path = await window.api.selectDirectory()
    if (path) {
      handleChange('cwd', path)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1117]">
      {/* --- 上半部分：配置表单 --- */}
      <div className="bg-[#161b22] border-b border-[#30363d]">
        {/* 标题栏 */}
        <div className="px-6 py-3 border-b border-[#30363d] flex items-center gap-2 text-gray-200 select-none">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <span className="font-medium">Configuration</span>
        </div>

        <div className="p-6 max-w-4xl space-y-5">
          {/* Project Name */}
          <div>
            <label className={labelClass}>Service Name</label>
            <input
              type="text"
              value={service.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={inputClass}
              placeholder="e.g., My Backend API"
              spellCheck={false}
            />
          </div>

          {/* Working Directory */}
          <div>
            <label className={labelClass}>Working Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={service.cwd}
                readOnly // 通常设为只读，强制用按钮选择，防止手输错
                className={`${inputClass} opacity-75 cursor-not-allowed truncate`}
                placeholder="Path to project folder..."
              />
              <button
                onClick={handleSelectDir}
                className="px-3 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md text-gray-300 transition-colors shrink-0 flex items-center gap-2 text-sm font-medium"
                title="Browse Folder"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          {/* Run Command */}
          <div>
            <label className={labelClass}>Command</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 font-mono select-none">
                ❯
              </span>
              <input
                type="text"
                value={service.command}
                onChange={(e) => handleChange('command', e.target.value)}
                className={`${inputClass} pl-8 !text-green-400`}
                placeholder="e.g., npm run dev"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- 下半部分：终端显示 --- */}
      {/* flex-1 让它占据剩余所有空间，min-h-0 对于嵌套 flex scroll 容器很重要 */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117]">
        {/* 终端标题栏 */}
        <div className="px-4 py-1.5 bg-[#21262d] border-b border-t border-[#30363d] flex items-center gap-2 text-xs font-mono text-gray-400 select-none">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span>Terminal Output</span>
        </div>

        {/* 终端容器 (去掉 padding，让 xterm 贴边显示更像专业终端) */}
        <div className="flex-1 relative">
          <TerminalView id={service.id} />
        </div>
      </div>
    </div>
  )
}

export default ServiceDetail
