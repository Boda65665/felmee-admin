import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from '@/components/ui'
import { CooldownDialog } from '@/components'
import { SessionProvider } from '@/lib/auth'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
          {/* Глобальная модалка кулдауна (429) — поверх всего, включая логин */}
          <CooldownDialog />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
