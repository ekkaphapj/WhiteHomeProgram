import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, BedDouble, Home, KeyRound, LogOut, Settings, Wallet } from 'lucide-react'
import { api, type AuthStatus } from '../lib/api'

const TABS = [
  { to: '/', label: 'หน้าแรก', icon: Home, end: true },
  { to: '/daily', label: 'รายวัน', icon: BedDouble },
  { to: '/monthly', label: 'รายเดือน', icon: KeyRound },
  { to: '/finance', label: 'รายรับจ่าย', icon: Wallet },
  { to: '/reports', label: 'รายงาน', icon: BarChart3 },
]

export default function Layout({ user }: { user: AuthStatus['user'] }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-neutral-200/80 bg-white/95 px-4 py-2.5 backdrop-blur">
        <img src="/logo.png" alt="โลโก้" className="h-9 w-auto" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink-900">The White Home</p>
          <p className="truncate text-[11px] text-neutral-400">
            {user?.displayName} · {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="ตั้งค่า"
        >
          <Settings size={21} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('ออกจากระบบ?')) logout.mutate()
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="ออกจากระบบ"
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 px-3 pb-28 pt-3">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-3xl">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                  isActive ? 'text-brand-600' : 'text-neutral-400'
                }`
              }
            >
              <Icon size={22} strokeWidth={2.2} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
