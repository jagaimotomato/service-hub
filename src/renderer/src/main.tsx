// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// 👇👇👇 确保这两行在最上面
import './index.css' // 引入 Tailwind
import 'xterm/css/xterm.css' // 引入 xterm 样式

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
