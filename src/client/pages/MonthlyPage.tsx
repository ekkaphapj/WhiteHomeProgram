import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, FileText, FilePlus2, History, Pencil, Plus, XCircle } from 'lucide-react'
import { api, type RentBill, type Room, type Tenant } from '../lib/api'
import { currentPeriod, fmtBaht, fmtNum, fmtThaiDate, METHOD_LABEL, periodLabel, ROOM_TYPE_LABEL, UTILITY_RATE } from '../lib/format'
import { EmptyState, ErrorText, Field, MethodSegmented, Modal, PageSpinner, Segmented } from '../components/ui'
import { InvoiceModal } from '../components/InvoiceModal'

export default function MonthlyPage() {
  const [period, setPeriod] = useState(currentPeriod())
  const [tab, setTab] = useState<'active' | 'ended'>('active')
  const [collectTenant, setCollectTenant] = useState<Tenant | null>(null)
  const [historyTenant, setHistoryTenant] = useState<Tenant | null>(null)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [genError, setGenError] = useState<unknown>(null)
  const [invoice, setInvoice] = useState<{ bill: RentBill; tenant: Tenant } | null>(null)

  const tenantsQ = useQuery({
    queryKey: ['tenants', tab],
    queryFn: () => api<Tenant[]>(`/api/tenants?status=${tab}`),
  })
  const billsQ = useQuery({
    queryKey: ['rent', period],
    queryFn: () => api<RentBill[]>(`/api/rent?period=${period}`),
  })

  const bills = billsQ.data ?? []
  const billByTenant = useMemo(() => new Map(bills.map((b) => [b.tenantId, b])), [bills])
  const paidBills = bills.filter((b) => b.status === 'paid')
  const unpaidBills = bills.filter((b) => b.status === 'unpaid')

  const generate = useMutation({
    mutationFn: () => api<{ created: number }>('/api/rent/generate', { method: 'POST', body: { period } }),
    onSuccess: () => billsQ.refetch(),
    onError: setGenError,
  })

  // เปิดใบวางบิล: ถ้ายังไม่มีบิลของงวดนี้ สร้างให้อัตโนมัติก่อน
  const openInvoice = async (tenant: Tenant, bill?: RentBill) => {
    let target = bill
    if (!target) {
      await api('/api/rent/generate', { method: 'POST', body: { period } })
      const fresh = await api<RentBill[]>(`/api/rent?period=${period}`)
      target = fresh.find((b) => b.tenantId === tenant.id)
      qcRefetchBills()
      if (!target) return
    }
    setInvoice({ bill: target, tenant })
  }
  const qcRefetchBills = () => billsQ.refetch()

  const tenants = tenantsQ.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="month" className="input flex-1 font-semibold" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        <button
          type="button"
          className="btn-secondary shrink-0 !px-3.5"
          onClick={() => {
            if (window.confirm(`สร้างบิลค่าเช่าเดือน ${periodLabel(period)} สำหรับผู้เช่าทุกห้อง?`)) generate.mutate()
          }}
          disabled={generate.isPending}
          title="สร้างบิลทุกห้อง"
        >
          <FilePlus2 size={17} />
          <span className="text-sm">ออกบิล</span>
        </button>
      </div>
      <ErrorText error={genError} />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'กำลังเช่า' },
          { value: 'ended', label: 'หมดสัญญา' },
        ]}
      />

      {tab === 'active' && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card p-3 text-center">
            <p className="text-xs text-neutral-500">จ่ายแล้ว</p>
            <p className="text-lg font-bold text-emerald-600">{paidBills.length}</p>
            <p className="text-[11px] text-neutral-400">{fmtBaht(paidBills.reduce((a, b) => a + b.totalAmount, 0))}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-neutral-500">ค้างชำระ</p>
            <p className="text-lg font-bold text-amber-600">{unpaidBills.length}</p>
            <p className="text-[11px] text-neutral-400">{fmtBaht(unpaidBills.reduce((a, b) => a + b.totalAmount, 0))}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-neutral-500">ผู้เช่าทั้งหมด</p>
            <p className="text-lg font-bold text-ink-900">{tenants.length}</p>
            <p className="text-[11px] text-neutral-400">ห้อง</p>
          </div>
        </div>
      )}

      {tenantsQ.isLoading || billsQ.isLoading ? (
        <PageSpinner />
      ) : tenants.length === 0 ? (
        <EmptyState
          icon={<Plus size={36} />}
          title={tab === 'active' ? 'ยังไม่มีผู้เช่ารายเดือน' : 'ไม่มีสัญญาที่หมดแล้ว'}
          subtitle={tab === 'active' ? 'กดปุ่ม + เพื่อเพิ่มผู้เช่า' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => (
            <TenantCard
              key={t.id}
              tenant={t}
              bill={billByTenant.get(t.id)}
              onCollect={() => setCollectTenant(t)}
              onHistory={() => setHistoryTenant(t)}
              onEdit={() => setEditTenant(t)}
              onInvoice={() => void openInvoice(t, billByTenant.get(t.id))}
            />
          ))}
        </div>
      )}

      <button type="button" className="fab" aria-label="เพิ่มผู้เช่า" onClick={() => setAddOpen(true)}>
        <Plus size={26} />
      </button>

      {collectTenant && (
        <CollectModal
          tenant={collectTenant}
          bill={billByTenant.get(collectTenant.id)}
          period={period}
          onClose={() => setCollectTenant(null)}
          onInvoiced={(bill) => {
            setCollectTenant(null)
            setInvoice({ bill, tenant: collectTenant })
          }}
        />
      )}
      {historyTenant && (
        <HistoryModal
          tenant={historyTenant}
          onClose={() => setHistoryTenant(null)}
          onInvoice={(bill) => {
            setHistoryTenant(null)
            setInvoice({ bill, tenant: historyTenant })
          }}
        />
      )}
      {editTenant && <TenantFormModal edit={editTenant} onClose={() => setEditTenant(null)} />}
      {addOpen && <TenantFormModal onClose={() => setAddOpen(false)} />}
      {invoice && <InvoiceModal bill={invoice.bill} tenant={invoice.tenant} onClose={() => setInvoice(null)} />}
    </div>
  )
}

function TenantCard({
  tenant,
  bill,
  onCollect,
  onHistory,
  onEdit,
  onInvoice,
}: {
  tenant: Tenant
  bill?: RentBill
  onCollect: () => void
  onHistory: () => void
  onEdit: () => void
  onInvoice: () => void
}) {
  const qc = useQueryClient()
  const end = useMutation({
    mutationFn: () => api(`/api/tenants/${tenant.id}/end`, { method: 'POST', body: { endDate: new Date().toISOString().slice(0, 10) } }),
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          {tenant.roomNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-ink-900">{tenant.name}</p>
            {tenant.status === 'active' ? (
              bill ? (
                bill.status === 'paid' ? (
                  <span className="chip bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={12} /> จ่ายแล้ว {fmtThaiDate(bill.paidDate)}
                  </span>
                ) : (
                  <span className="chip bg-amber-100 text-amber-700">
                    <Clock size={12} /> ค้างชำระ
                  </span>
                )
              ) : (
                <span className="chip bg-neutral-100 text-neutral-500">ยังไม่ออกบิล</span>
              )
            ) : (
              <span className="chip bg-neutral-100 text-neutral-500">หมดสัญญา {fmtThaiDate(tenant.contractEnd)}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {fmtBaht(tenant.monthlyRent)}/เดือน
            {tenant.phone ? ` · โทร ${tenant.phone}` : ''}
            {` · เข้าอยู่ ${fmtThaiDate(tenant.contractStart)}`}
            {tenant.deposit > 0 ? ` · ประกัน ${fmtBaht(tenant.deposit)}` : ''}
          </p>
          {bill?.status === 'paid' && bill.collectedByName && (
            <p className="mt-0.5 text-xs text-emerald-600/80">
              รับเงินโดย {bill.collectedByName} ({METHOD_LABEL[bill.paymentMethod]})
            </p>
          )}
          {bill && bill.status === 'paid' && (bill.waterAmount > 0 || bill.electricAmount > 0 || bill.otherAmount > 0) && (
            <p className="mt-0.5 text-xs text-neutral-400">
              (เช่า {fmtBaht(bill.rentAmount)} + น้ำ {fmtBaht(bill.waterAmount)} + ไฟ {fmtBaht(bill.electricAmount)}
              {bill.otherAmount > 0 ? ` + อื่นๆ ${fmtBaht(bill.otherAmount)}` : ''} = {fmtBaht(bill.totalAmount)})
            </p>
          )}
        </div>
      </div>
      {tenant.status === 'active' && (
        <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-2.5">
          <button type="button" className="btn-primary btn-sm flex-1" onClick={onCollect}>
            เก็บค่าเช่า
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={onInvoice} title="ออกใบวางบิล">
            <FileText size={15} />
            <span className="hidden sm:inline">ใบวางบิล</span>
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onHistory} title="ประวัติการชำระ">
            <History size={15} />
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onEdit} title="แก้ไขข้อมูล">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm !text-red-500"
            onClick={() => {
              if (window.confirm(`ปิดสัญญาผู้เช่า ${tenant.name} ห้อง ${tenant.roomNumber} โดยสิ้นสุดวันนี้?`)) end.mutate()
            }}
            disabled={end.isPending}
            title="ปิดสัญญา"
          >
            <XCircle size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

function CollectModal({
  tenant,
  bill,
  period,
  onClose,
  onInvoiced,
}: {
  tenant: Tenant
  bill: RentBill | undefined
  period: string
  onClose: () => void
  onInvoiced: (bill: RentBill) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    rentAmount: String(bill?.rentAmount ?? tenant.monthlyRent),
    ePrev: bill?.electricMeterPrev ?? '',
    eCurr: bill?.electricMeterCurr ?? '',
    eUnits: bill?.electricUnits != null ? String(bill.electricUnits) : '',
    eAmount: bill ? String(bill.electricAmount ?? 0) : '',
    wPrev: bill?.waterMeterPrev ?? '',
    wCurr: bill?.waterMeterCurr ?? '',
    wUnits: bill?.waterUnits != null ? String(bill.waterUnits) : '',
    wAmount: bill ? String(bill.waterAmount ?? 0) : '',
    otherAmount: String(bill?.otherAmount ?? ''),
    otherLabel: bill?.note ?? '',
    paidDate: new Date().toISOString().slice(0, 10),
    paymentMethod: (bill?.paymentMethod ?? 'cash') as 'cash' | 'transfer',
  })
  const [error, setError] = useState<unknown>(null)

  // ดึงบิลล่าสุดของผู้เช่ามาเติม "เลขมิเตอร์เดิม" ให้อัตโนมัติ
  const historyQ = useQuery({
    queryKey: ['rent-history', tenant.id],
    queryFn: () => api<RentBill[]>(`/api/rent/tenant/${tenant.id}`),
    enabled: !bill,
  })
  if (historyQ.data && !bill) {
    const lastPaid = historyQ.data.find((b) => b.status === 'paid')
    if (lastPaid) {
      if (lastPaid.electricMeterCurr && !form.ePrev) form.ePrev = lastPaid.electricMeterCurr
      if (lastPaid.waterMeterCurr && !form.wPrev) form.wPrev = lastPaid.waterMeterCurr
    }
  }

  const num = (v: string) => {
    const x = parseFloat(v)
    return Number.isFinite(x) ? x : null
  }
  /** กรอกเลขมิเตอร์เดิม/ปัจจุบัน → หน่วยอัตโนมัติ → ยอด = หน่วย × 8 */
  const setMeter = (kind: 'e' | 'w', field: 'Prev' | 'Curr', value: string) => {
    setForm((f) => {
      const next = { ...f, [`${kind}${field}`]: value }
      const prev = num(String(next[`${kind}Prev`]))
      const curr = num(String(next[`${kind}Curr`]))
      let units = num(String(next[`${kind}Units`]))
      if (prev != null && curr != null && curr >= prev) {
        units = curr - prev
        next[`${kind}Units`] = String(units)
      } else if (field === 'Prev' || field === 'Curr') {
        units = null
      }
      next[`${kind}Amount`] = units != null && units > 0 ? String(units * UTILITY_RATE) : next[`${kind}Amount`]
      return next
    })
  }
  const setUnits = (kind: 'e' | 'w', value: string) => {
    setForm((f) => {
      const units = num(value)
      return {
        ...f,
        [`${kind}Units`]: value,
        [`${kind}Amount`]: units != null && units > 0 ? String(units * UTILITY_RATE) : f[`${kind}Amount`],
      }
    })
  }

  const rent = num(form.rentAmount) ?? 0
  const total = rent + (num(form.eAmount) ?? 0) + (num(form.wAmount) ?? 0) + (num(form.otherAmount) ?? 0)

  const pay = useMutation({
    mutationFn: async () => {
      let target = bill
      if (!target) {
        await api('/api/rent/generate', { method: 'POST', body: { period } })
        const bills = await api<RentBill[]>(`/api/rent?period=${period}`)
        target = bills.find((b) => b.tenantId === tenant.id)
        if (!target) throw new Error('ไม่สามารถสร้างบิลได้ (ผู้เช่าอาจเริ่มสัญญาหลังงวดนี้)')
      }
      return api<RentBill>(`/api/rent/${target.id}/pay`, {
        method: 'POST',
        body: {
          rentAmount: Number(form.rentAmount) || 0,
          waterAmount: Number(form.wAmount) || 0,
          electricAmount: Number(form.eAmount) || 0,
          otherAmount: Number(form.otherAmount) || 0,
          waterUnits: form.wUnits === '' ? null : Number(form.wUnits),
          electricUnits: form.eUnits === '' ? null : Number(form.eUnits),
          waterMeterPrev: form.wPrev,
          waterMeterCurr: form.wCurr,
          electricMeterPrev: form.ePrev,
          electricMeterCurr: form.eCurr,
          paidDate: form.paidDate,
          paymentMethod: form.paymentMethod,
          note: form.otherLabel,
        },
      })
    },
    onSuccess: (bill) => {
      qc.invalidateQueries()
      onInvoiced(bill)
    },
    onError: setError,
  })

  return (
    <Modal title={`เก็บค่าเช่า ห้อง ${tenant.roomNumber}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          pay.mutate()
        }}
      >
        <ErrorText error={error} />
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          {tenant.name} · งวด {periodLabel(period)}
        </p>
        <Field label="ค่าเช่า *">
          <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.rentAmount} onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))} required />
        </Field>

        <div className="mb-2 rounded-xl border border-neutral-200 p-3">
          <p className="mb-2 text-sm font-bold text-ink-800">
            ค่าไฟฟ้า <span className="font-normal text-neutral-400">(หน่วยละ {UTILITY_RATE} บาท)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-2" inputMode="numeric" placeholder="เลขมิเตอร์เดิม" value={form.ePrev} onChange={(e) => setMeter('e', 'Prev', e.target.value)} />
            <input className="input !py-2" inputMode="numeric" placeholder="เลขมิเตอร์ปัจจุบัน" value={form.eCurr} onChange={(e) => setMeter('e', 'Curr', e.target.value)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="input !py-2" type="number" inputMode="decimal" min={0} placeholder="หน่วย" value={form.eUnits} onChange={(e) => setUnits('e', e.target.value)} />
            <input className="input !py-2 font-bold" type="number" inputMode="decimal" min={0} step="0.01" placeholder="จำนวนเงิน" value={form.eAmount} onChange={(e) => setForm((f) => ({ ...f, eAmount: e.target.value }))} />
          </div>
        </div>

        <div className="mb-2 rounded-xl border border-neutral-200 p-3">
          <p className="mb-2 text-sm font-bold text-ink-800">
            ค่าน้ำ <span className="font-normal text-neutral-400">(หน่วยละ {UTILITY_RATE} บาท)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-2" inputMode="numeric" placeholder="เลขมิเตอร์เดิม" value={form.wPrev} onChange={(e) => setMeter('w', 'Prev', e.target.value)} />
            <input className="input !py-2" inputMode="numeric" placeholder="เลขมิเตอร์ปัจจุบัน" value={form.wCurr} onChange={(e) => setMeter('w', 'Curr', e.target.value)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="input !py-2" type="number" inputMode="decimal" min={0} placeholder="หน่วย" value={form.wUnits} onChange={(e) => setUnits('w', e.target.value)} />
            <input className="input !py-2 font-bold" type="number" inputMode="decimal" min={0} step="0.01" placeholder="จำนวนเงิน" value={form.wAmount} onChange={(e) => setForm((f) => ({ ...f, wAmount: e.target.value }))} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Field label="ค่าอื่นๆ (บาท)">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.otherAmount} onChange={(e) => setForm((f) => ({ ...f, otherAmount: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="ชื่อรายการอื่น" hint="เช่น อินเทอร์เน็ต, ส่วนกลาง">
            <input className="input" value={form.otherLabel} onChange={(e) => setForm((f) => ({ ...f, otherLabel: e.target.value }))} placeholder="อินเทอร์เน็ต" />
          </Field>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <span className="text-sm font-semibold text-brand-800">รวมทั้งสิ้น</span>
          <span className="text-lg font-bold text-brand-700">{fmtBaht(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่รับเงิน *">
            <input className="input" type="date" value={form.paidDate} onChange={(e) => setForm((f) => ({ ...f, paidDate: e.target.value }))} required />
          </Field>
          <div>
            <label className="label">วิธีชำระ *</label>
            <MethodSegmented value={form.paymentMethod} onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))} />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={pay.isPending}>
          {pay.isPending ? 'กำลังบันทึก…' : `รับชำระ ${fmtBaht(total)} แล้วออกใบวางบิล`}
        </button>
      </form>
    </Modal>
  )
}

function HistoryModal({ tenant, onClose, onInvoice }: { tenant: Tenant; onClose: () => void; onInvoice: (bill: RentBill) => void }) {
  const qc = useQueryClient()
  const billsQ = useQuery({
    queryKey: ['rent-history', tenant.id],
    queryFn: () => api<RentBill[]>(`/api/rent/tenant/${tenant.id}`),
  })
  const unpay = useMutation({
    mutationFn: (id: number) => api(`/api/rent/${id}/unpay`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <Modal title={`ประวัติการชำระ ห้อง ${tenant.roomNumber}`} onClose={onClose}>
      {billsQ.isLoading ? (
        <PageSpinner />
      ) : (billsQ.data ?? []).length === 0 ? (
        <EmptyState title="ยังไม่มีประวัติการชำระ" />
      ) : (
        <div className="space-y-2">
          {(billsQ.data ?? []).map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">{periodLabel(b.period)}</p>
                <p className="text-xs text-neutral-500">
                  {fmtBaht(b.totalAmount)}
                  {b.status === 'paid'
                    ? ` · จ่าย ${fmtThaiDate(b.paidDate)} · ${METHOD_LABEL[b.paymentMethod]}${b.collectedByName ? ` · โดย ${b.collectedByName}` : ''}`
                    : ' · ค้างชำระ'}
                  {b.waterAmount > 0 || b.electricAmount > 0
                    ? ` (น้ำ ${fmtBaht(b.waterAmount)} ไฟ ${fmtBaht(b.electricAmount)})`
                    : ''}
                </p>
              </div>
              <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => onInvoice(b)} title="ออกใบวางบิล">
                <FileText size={14} />
              </button>
              {b.status === 'paid' ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm shrink-0 !text-red-500"
                  onClick={() => {
                    if (window.confirm(`ยกเลิกรายการชำระงวด ${periodLabel(b.period)}? (รายรับจะถูกลบด้วย)`)) unpay.mutate(b.id)
                  }}
                >
                  ยกเลิก
                </button>
              ) : (
                <span className="chip shrink-0 bg-amber-100 text-amber-700">ค้าง</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function TenantFormModal({ edit, onClose }: { edit?: Tenant; onClose: () => void }) {
  const qc = useQueryClient()
  const roomsQ = useQuery({
    queryKey: ['rooms-tenant-form'],
    queryFn: () => api<Room[]>(`/api/rooms?on=${new Date().toISOString().slice(0, 10)}`),
  })
  const vacantRooms = (roomsQ.data ?? []).filter((r) => !r.maintenance && r.roomType !== 'daily' && (edit ? r.id === edit.roomId : r.status === 'vacant'))

  const [form, setForm] = useState({
    roomId: String(edit?.roomId ?? ''),
    name: edit?.name ?? '',
    phone: edit?.phone ?? '',
    idCard: edit?.idCard ?? '',
    address: edit?.address ?? '',
    contractStart: edit?.contractStart ?? new Date().toISOString().slice(0, 10),
    contractEnd: edit?.contractEnd ?? '',
    monthlyRent: String(edit?.monthlyRent ?? ''),
    deposit: String(edit?.deposit ?? ''),
    note: edit?.note ?? '',
  })
  const [error, setError] = useState<unknown>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const pickRoom = (roomId: string) => {
    const room = vacantRooms.find((r) => String(r.id) === roomId)
    setForm((f) => ({ ...f, roomId, monthlyRent: room?.monthlyRate != null ? String(room.monthlyRate) : f.monthlyRent }))
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        roomId: Number(form.roomId),
        name: form.name,
        phone: form.phone,
        idCard: form.idCard,
        address: form.address,
        contractStart: form.contractStart,
        contractEnd: form.contractEnd,
        monthlyRent: Number(form.monthlyRent),
        deposit: Number(form.deposit) || 0,
        note: form.note,
      }
      return edit ? api(`/api/tenants/${edit.id}`, { method: 'PATCH', body }) : api('/api/tenants', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title={edit ? `แก้ไขผู้เช่า ห้อง ${edit.roomNumber}` : 'เพิ่มผู้เช่ารายเดือน'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        <Field label="ห้อง *" hint={edit ? undefined : 'แสดงเฉพาะห้องว่าง (รายเดือน/ทั้งสองแบบ)'}>
          <select className="input" value={form.roomId} onChange={(e) => pickRoom(e.target.value)} required disabled={!!edit}>
            <option value="" disabled>
              — เลือกห้อง —
            </option>
            {vacantRooms.map((r) => (
              <option key={r.id} value={r.id}>
                ห้อง {r.roomNumber} ({ROOM_TYPE_LABEL[r.roomType]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="ชื่อผู้เช่า *">
          <input className="input" value={form.name} onChange={set('name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เบอร์โทรศัพท์">
            <input className="input" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="เลขบัตรประชาชน">
            <input className="input" inputMode="numeric" value={form.idCard} onChange={set('idCard')} />
          </Field>
        </div>
        <Field label="ที่อยู่ (แสดงบนใบวางบิล)">
          <textarea className="input min-h-16" value={form.address} onChange={set('address')} placeholder="เช่น 220 หมู่ 2 ต.หนองใหน อ.หนองแสง จ.อุดรธานี" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันเริ่มสัญญา *">
            <input className="input" type="date" value={form.contractStart} onChange={set('contractStart')} required />
          </Field>
          <Field label="วันสิ้นสุดสัญญา">
            <input className="input" type="date" value={form.contractEnd} onChange={set('contractEnd')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ค่าเช่า/เดือน *">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.monthlyRent} onChange={set('monthlyRent')} required />
          </Field>
          <Field label="เงินประกัน">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.deposit} onChange={set('deposit')} placeholder="0" />
          </Field>
        </div>
        <Field label="หมายเหตุ">
          <textarea className="input min-h-16" value={form.note} onChange={set('note')} />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </form>
    </Modal>
  )
}
