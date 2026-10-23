import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type AuthStatus } from '../lib/api'
import { ErrorText, Field, Splash } from '../components/ui'

export default function LoginPage({ mode }: { mode: 'login' | 'setup' }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api<AuthStatus>('/api/auth/status'),
  })

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === 'setup')
        return api('/api/auth/setup', { method: 'POST', body: { displayName, username, password } })
      return api('/api/auth/login', { method: 'POST', body: { username, password } })
    },
    onSuccess: () => {
      qc.setQueryData(['auth-status'], {
        needsSetup: false,
        authenticated: true,
        user: { userId: 0, username, displayName: displayName || username, role: 'admin' },
      } satisfies AuthStatus)
      qc.invalidateQueries()
      navigate('/', { replace: true })
    },
    onError: setError,
  })

  useEffect(() => {
    if (isLoading) return
    if (mode === 'setup' && status && !status.needsSetup) navigate('/login', { replace: true })
    if (mode === 'login' && status?.needsSetup) navigate('/setup', { replace: true })
    if (mode === 'login' && status?.authenticated) navigate('/', { replace: true })
  }, [isLoading, status, mode, navigate])

  if (isLoading) return <Splash />

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <img src="/logo.png" alt="The White Home" className="w-72 max-w-full" />
        <p className="text-sm text-neutral-400">
          {mode === 'setup' ? 'ตั้งค่าระบบครั้งแรก — สร้างบัญชีผู้ดูแล' : 'ระบบบริหารที่พัก'}
        </p>
      </div>

      <form
        className="card p-5"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          submit.mutate()
        }}
      >
        <ErrorText error={error} />
        {mode === 'setup' && (
          <Field label="ชื่อผู้ใช้งาน (แสดงในระบบ)">
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น คุณเจ้าของ"
              required
            />
          </Field>
        )}
        <Field label="ชื่อผู้ใช้">
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="username"
            required
          />
        </Field>
        <Field label="รหัสผ่าน" hint={mode === 'setup' ? 'อย่างน้อย 6 ตัวอักษร' : undefined}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={submit.isPending}>
          {submit.isPending ? 'กำลัง…' : mode === 'setup' ? 'สร้างบัญชีผู้ดูแล' : 'เข้าสู่ระบบ'}
        </button>
        {mode === 'login' && (
          <p className="mt-4 text-center text-xs text-neutral-400">The White Home Udon Thani</p>
        )}
      </form>
    </div>
  )
}
