import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { errMsg } from '../lib/api'
import type { PaymentMethod } from '../lib/api'

export function Splash({ text = 'กำลังโหลด…' }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white">
      <img src="/logo.png" alt="The White Home" className="w-56" />
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500 ${className}`}
      role="status"
      aria-label="กำลังโหลด"
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

/** Bottom sheet on mobile, centered dialog on desktop. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">{errMsg(error)}</p>
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
  onClick,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'brand' | 'green' | 'red' | 'amber'
  onClick?: () => void
}) {
  const tones: Record<string, string> = {
    default: 'text-ink-900',
    brand: 'text-brand-600',
    green: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  }
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper onClick={onClick} className={`card p-3.5 text-left ${onClick ? 'active:bg-neutral-50' : ''} w-full`}>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold leading-tight ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </Wrapper>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-neutral-200/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      {icon && <div className="text-neutral-300">{icon}</div>}
      <p className="font-semibold text-neutral-500">{title}</p>
      {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
    </div>
  )
}

export function PayChip({ paid, total }: { paid: number; total: number }) {
  if (total <= 0 || paid >= total)
    return <span className="chip bg-emerald-100 text-emerald-700">ชำระครบแล้ว</span>
  if (paid > 0) return <span className="chip bg-amber-100 text-amber-700">ชำระบางส่วน</span>
  return <span className="chip bg-red-100 text-red-600">ยังไม่ชำระ</span>
}

export function MethodSegmented({
  value,
  onChange,
}: {
  value: PaymentMethod
  onChange: (v: PaymentMethod) => void
}) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'cash', label: 'เงินสด' },
        { value: 'transfer', label: 'โอนเงิน' },
      ]}
    />
  )
}

export function MethodChip({ method }: { method: PaymentMethod }) {
  return (
    <span className={`chip ${method === 'cash' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
      {method === 'cash' ? 'เงินสด' : 'โอน'}
    </span>
  )
}
