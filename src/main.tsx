import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useErrorPopupStore } from '@/lib/error-popup-store'
import { GlobalErrorPopup } from '@/components/error-popup'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from '@/components/ui'
import { CooldownDialog } from '@/components'
import { SessionProvider } from '@/lib/auth'

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: error => useErrorPopupStore.getState().show(error, 'Не удалось загрузить данные') }),
})

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
          <GlobalErrorPopup />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
