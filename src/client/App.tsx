import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type AuthStatus } from './lib/api'
import Layout from './components/Layout'
import { Splash } from './components/ui'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DailyPage from './pages/DailyPage'
import MonthlyPage from './pages/MonthlyPage'
import FinancePage from './pages/FinancePage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
})

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api<AuthStatus>('/api/auth/status'),
    staleTime: 60_000,
  })
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useAuthStatus()
  const navigate = useNavigate()

  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.clear()
      navigate('/login', { replace: true })
    }
    window.addEventListener('wh:unauthorized', onUnauthorized)
    return () => window.removeEventListener('wh:unauthorized', onUnauthorized)
  }, [navigate])

  if (isLoading) return <Splash />
  if (data?.needsSetup) return <Navigate to="/setup" replace />
  if (!data?.authenticated) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage mode="login" />} />
      <Route path="/setup" element={<LoginPage mode="setup" />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/monthly" element={<MonthlyPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** Layout wrapper that reads the authenticated user. */
function AppShell() {
  const { data } = useAuthStatus()
  return <Layout user={data?.user ?? null} />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
