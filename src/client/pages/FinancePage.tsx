import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Plus, ReceiptText, Wallet } from 'lucide-react'
import { api, type AuditEntry, type PaymentMethod, type Txn, type TxnList } from '../lib/api'
import {
  currentPeriod,
  EXPENSE_CATEGORIES,
  fmtBaht,
  fmtNum,
  fmtThaiDate,
  fmtThaiDateTimeUtc,
  INCOME_CATEGORIES,
  METHOD_LABEL,
  periodLabel,
  todayISO,
} from '../lib/format'
import { EmptyState, ErrorText, Field, MethodChip, MethodSegmented, Modal, PageSpinner, Segmented, StatCard } from '../components/ui'

export default function FinancePage() {
  const [month, setMonth] = useState(currentPeriod())
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editTxn, setEditTxn] = useState<Txn | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)

  const q = useQuery({
    queryKey: ['txns', month, type],
    queryFn: () => api<TxnList>(`/api/transactions?month=${month}${type === 'all' ? '' : `&type=${type}`}`),
  })

  const grouped = useMemo(() => {
    const m = new Map<string, Txn[]>()
    for (const t of q.data?.items ?? []) {
      const list = m.get(t.txnDate) ?? []
      list.push(t)
      m.set(t.txnDate, list)
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [q.data])

  return (
    <div className="space-y-3">
      <input type="month" className="input font-semibold" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'all', label: 'ทั้งหมด' },
          { value: 'income', label: 'รายรับ' },
          { value: 'expense', label: 'รายจ่าย' },
        ]}
      />

      <div className="card flex items-center gap-3 border-2 border-sky-200 bg-sky-50 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <Wallet size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-sky-800">เงินสดคงเหลือในลิ้นชัก</p>
          <p className="text-[11px] text-neutral-500">รวมทุกยอดเงินสดตั้งแต่เริ่มใช้ระบบ (ไม่นับเงินโอน)</p>
        </div>
        <p className={`shrink-0 text-2xl font-bold ${(q.data?.cashBalance ?? 0) < 0 ? 'text-red-600' : 'text-sky-700'}`}>
          {fmtBaht(q.data?.cashBalance ?? 0)}
        </p>
      </div>

      {type === 'all' && (
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard label="รายรับ" value={fmtBaht(q.data?.totals.income ?? 0)} tone="green" />
          <StatCard label="รายจ่าย" value={fmtBaht(q.data?.totals.expense ?? 0)} tone="red" />
          <StatCard label="สุทธิ" value={fmtBaht(q.data?.totals.profit ?? 0)} tone={(q.data?.totals.profit ?? 0) >= 0 ? 'brand' : 'red'} />
        </div>
      )}

      <button type="button" className="btn-secondary btn-sm w-full !py-2.5" onClick={() => setAuditOpen(true)}>
        <History size={16} /> ประวัติการแก้ไข/ลบรายการ
      </button>

      {q.isLoading ? (
        <PageSpinner />
      ) : grouped.length === 0 ? (
        <EmptyState icon={<ReceiptText size={36} />} title={`ไม่มีรายการในเดือน ${periodLabel(month)}`} subtitle="กดปุ่ม + เพื่อบันทึกรายรับรายจ่าย" />
      ) : (
        <div className="space-y-3">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="mb-1.5 px-1 text-xs font-bold text-neutral-400">{fmtThaiDate(date)}</p>
              <div className="card divide-y divide-neutral-100">
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center gap-2 p-3.5 text-left active:bg-neutral-50"
                    onClick={() => (t.refType ? undefined : setEditTxn(t))}
                  >
                    <span
                      className={`chip shrink-0 ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
                    >
                      {t.type === 'income' ? 'รับ' : 'จ่าย'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">{t.category}</span>
                      <span className="block truncate text-xs text-neutral-400">
                        {t.description || '—'}
                        {t.refType ? ' · บันทึกอัตโนมัติ' : ''}
                        {t.createdByName ? ` · โดย ${t.createdByName}` : ''}
                      </span>
                    </span>
                    <MethodChip method={t.paymentMethod} />
                    <span className={`shrink-0 text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '−'}
                      {fmtBaht(t.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="fab" aria-label="เพิ่มรายรับรายจ่าย" onClick={() => setFormOpen(true)}>
        <Plus size={26} />
      </button>

      {formOpen && <TxnFormModal onClose={() => setFormOpen(false)} />}
      {editTxn && <TxnFormModal edit={editTxn} onClose={() => setEditTxn(null)} />}
      {auditOpen && <AuditModal onClose={() => setAuditOpen(false)} />}
    </div>
  )
}

function TxnFormModal({ edit, onClose }: { edit?: Txn; onClose: () => void }) {
  const qc = useQueryClient()
  const initialType: 'income' | 'expense' = edit?.type ?? 'expense'
  const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]
  const [type, setType] = useState<'income' | 'expense'>(initialType)
  const [form, setForm] = useState({
    txnDate: edit?.txnDate ?? todayISO(),
    category:
      edit?.category && allCategories.includes(edit.category)
        ? edit.category
        : initialType === 'income'
          ? INCOME_CATEGORIES[0]
          : EXPENSE_CATEGORIES[0],
    customCategory: edit?.category && !allCategories.includes(edit.category) ? edit.category : '',
    amount: edit ? String(edit.amount) : '',
    description: edit?.description ?? '',
    paymentMethod: (edit?.paymentMethod ?? 'cash') as PaymentMethod,
  })
  const [error, setError] = useState<unknown>(null)
  const [showHistory, setShowHistory] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const changeType = (v: 'income' | 'expense') => {
    setType(v)
    setForm((f) => ({ ...f, category: (v === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] }))
  }
  const finalCategory = form.category === 'อื่นๆ (ระบุ)' ? form.customCategory.trim() : form.category

  const save = useMutation({
    mutationFn: () => {
      const body = {
        txnDate: form.txnDate,
        type,
        category: finalCategory,
        amount: Number(form.amount),
        description: form.description,
        paymentMethod: form.paymentMethod,
      }
      return edit ? api(`/api/transactions/${edit.id}`, { method: 'PATCH', body }) : api('/api/transactions', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  const remove = useMutation({
    mutationFn: () => api(`/api/transactions/${edit!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title={edit ? 'แก้ไขรายการ' : 'บันทึกรายรับ–รายจ่าย'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        <div className="mb-4">
          <Segmented
            value={type}
            onChange={changeType}
            options={[
              { value: 'income', label: 'รายรับ' },
              { value: 'expense', label: 'รายจ่าย' },
            ]}
          />
        </div>
        <Field label="วันที่ *">
          <input className="input" type="date" value={form.txnDate} onChange={set('txnDate')} required />
        </Field>
        <Field label="หมวดหมู่ *">
          <select className="input" value={form.category} onChange={set('category')}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {form.category === 'อื่นๆ (ระบุ)' && (
          <Field label="ระบุหมวดหมู่ *">
            <input className="input" value={form.customCategory} onChange={set('customCategory')} required placeholder="เช่น ค่าจอดรถ" />
          </Field>
        )}
        <Field label="จำนวนเงิน *">
          <input
            className="input text-lg font-bold"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={form.amount}
            onChange={set('amount')}
            required
            placeholder="0.00"
          />
        </Field>
        <div className="mb-4">
          <label className="label">วิธีชำระ *</label>
          <MethodSegmented value={form.paymentMethod} onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))} />
        </div>
        <Field label="รายละเอียด">
          <textarea className="input min-h-16" value={form.description} onChange={set('description')} placeholder="เช่น ซ่อมแอร์ห้อง 102" />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึกรายการ'}
        </button>
        {edit && (
          <>
            <button type="button" className="btn-ghost mt-2 w-full !text-sky-700" onClick={() => setShowHistory((v) => !v)}>
              <History size={16} /> {showHistory ? 'ซ่อนประวัติรายการนี้' : 'ดูประวัติการแก้ไขรายการนี้'}
            </button>
            {showHistory && <TxnHistory txnId={edit.id} />}
            <button
              type="button"
              className="btn-ghost w-full !text-red-500"
              onClick={() => {
                if (window.confirm('ลบรายการนี้? (เก็บประวัติการลบไว้ให้ดูย้อนหลังได้)')) remove.mutate()
              }}
              disabled={remove.isPending}
            >
              ลบรายการ
            </button>
          </>
        )}
      </form>
    </Modal>
  )
}

function TxnHistory({ txnId }: { txnId: number }) {
  const q = useQuery({
    queryKey: ['txn-audit', txnId],
    queryFn: () => api<AuditEntry[]>(`/api/audit/transaction/${txnId}`),
  })
  if (q.isLoading) return <PageSpinner />
  const items = q.data ?? []
  if (items.length === 0) return <p className="mb-3 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-500">ยังไม่มีประวัติการแก้ไข</p>
  return (
    <div className="mb-3 space-y-2 rounded-xl bg-neutral-50 p-3">
      {items.map((a) => (
        <div key={a.id} className="text-xs">
          <p className="font-semibold text-ink-800">
            {a.action === 'edit' ? '✏️ แก้ไข' : '🗑️ ลบ'} · โดย {a.performedByName ?? '-'} · {fmtThaiDateTimeUtc(a.performedAt)}
          </p>
          {a.action === 'edit' && a.changes && (
            <ul className="mt-0.5 space-y-0.5 text-neutral-500">
              {Object.entries(a.changes).map(([field, ch]) => (
                <li key={field}>
                  {field}: <b className="text-red-500 line-through">{formatValue(field, ch.from)}</b> →{' '}
                  <b className="text-emerald-600">{formatValue(field, ch.to)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function formatValue(field: string, v: unknown): string {
  if (field === 'จำนวนเงิน') return fmtBaht(Number(v))
  if (field === 'ประเภท' || field === 'วิธีชำระ') return String(v)
  if (field === 'วันที่') return fmtThaiDate(String(v))
  return String(v ?? '') || '(ว่าง)'
}

function AuditModal({ onClose }: { onClose: () => void }) {
  const q = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<AuditEntry[]>('/api/audit?limit=100'),
  })
  return (
    <Modal title="ประวัติการแก้ไข/ลบรายการ" onClose={onClose}>
      {q.isLoading ? (
        <PageSpinner />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<History size={36} />} title="ยังไม่มีรายการถูกแก้ไขหรือลบ" />
      ) : (
        <div className="space-y-2.5">
          {(q.data ?? []).map((a) => (
            <div key={a.id} className={`rounded-xl border p-3 ${a.action === 'delete' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className="text-sm font-bold text-ink-900">
                {a.action === 'edit' ? '✏️ แก้ไข' : '🗑️ ลบ'} {a.label}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                โดย {a.performedByName ?? '-'} · {fmtThaiDateTimeUtc(a.performedAt)}
              </p>
              {a.action === 'edit' && a.changes && (
                <ul className="mt-1.5 space-y-1 text-xs text-neutral-600">
                  {Object.entries(a.changes).map(([field, ch]) => (
                    <li key={field}>
                      {field}: <b className="text-red-500 line-through">{formatValue(field, ch.from)}</b> →{' '}
                      <b className="text-emerald-600">{formatValue(field, ch.to)}</b>
                    </li>
                  ))}
                </ul>
              )}
              {a.action === 'delete' && a.snapshot && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
                  <li>วันที่: {fmtThaiDate(String(a.snapshot.txnDate ?? ''))}</li>
                  <li>
                    ประเภท: {a.snapshot.type === 'income' ? 'รายรับ' : 'รายจ่าย'} · หมวดหมู่: {a.snapshot.category} · จำนวน:{' '}
                    {fmtBaht(Number(a.snapshot.amount ?? 0))} · วิธีชำระ: {METHOD_LABEL[a.snapshot.paymentMethod ?? 'cash']}
                  </li>
                  {a.snapshot.description ? <li>รายละเอียด: {a.snapshot.description}</li> : null}
                  {a.snapshot.createdByName ? <li>บันทึกเดิมโดย: {a.snapshot.createdByName}</li> : null}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
