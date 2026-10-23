import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Plus, Wrench } from 'lucide-react'
import { api, errMsg, type PaymentMethod, type Room, type Stay } from '../lib/api'
import { addDaysISO, fmtBaht, fmtThaiDate, todayISO, ROOM_TYPE_LABEL } from '../lib/format'
import { EmptyState, ErrorText, Field, MethodChip, MethodSegmented, Modal, PageSpinner, PayChip, Segmented } from '../components/ui'

export default function DailyPage() {
  const [date, setDate] = useState(todayISO())
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editStay, setEditStay] = useState<Stay | null>(null)
  const [preselectRoom, setPreselectRoom] = useState<Room | null>(null)
  const [payStay, setPayStay] = useState<Stay | null>(null)
  const [activeStay, setActiveStay] = useState<Stay | null>(null)

  const staysQ = useQuery({
    queryKey: ['stays', date],
    queryFn: () => api<Stay[]>(`/api/stays?date=${date}`),
  })
  const activeQ = useQuery({
    queryKey: ['stays-active', date],
    queryFn: () => api<Stay[]>(`/api/stays?active=1&on=${date}`),
  })
  const roomsQ = useQuery({
    queryKey: ['rooms', date],
    queryFn: () => api<Room[]>(`/api/rooms?on=${date}`),
  })

  const rooms = roomsQ.data ?? []
  const vacantDailyRooms = rooms.filter((r) => r.status === 'vacant' && r.roomType !== 'monthly')

  const openAdd = (room: Room | null) => {
    setEditStay(null)
    setPreselectRoom(room)
    setFormOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
          onClick={() => setDate(addDaysISO(date, -1))}
          aria-label="วันก่อนหน้า"
        >
          <ChevronLeft size={20} />
        </button>
        <input type="date" className="input flex-1 text-center font-semibold" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
          onClick={() => setDate(addDaysISO(date, 1))}
          aria-label="วันถัดไป"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: 'รายการ' },
          { value: 'grid', label: 'ตารางห้อง' },
        ]}
      />

      {staysQ.isLoading || roomsQ.isLoading ? (
        <PageSpinner />
      ) : view === 'list' ? (
        <ListView date={date} stays={staysQ.data ?? []} active={activeQ.data ?? []} onEdit={setEditStay} onPay={setPayStay} onOpenActive={setActiveStay} setFormOpen={setFormOpen} />
      ) : (
        <RoomGrid
          rooms={rooms}
          onVacantTap={(room) => openAdd(room)}
          onStayTap={(stay) => setActiveStay(stay)}
        />
      )}

      {rooms.length === 0 && !roomsQ.isLoading && (
        <div className="card p-4 text-center">
          <p className="text-sm text-neutral-500">ยังไม่มีข้อมูลห้องพัก</p>
          <Link to="/settings" className="btn-primary mt-3 inline-flex">ไปเพิ่มห้องพัก</Link>
        </div>
      )}

      <button type="button" className="fab" aria-label="เพิ่มการเข้าพัก" onClick={() => openAdd(null)}>
        <Plus size={26} />
      </button>

      {formOpen && (
        <StayFormModal
          date={date}
          edit={editStay}
          rooms={vacantDailyRooms}
          preselectRoom={preselectRoom}
          onClose={() => setFormOpen(false)}
        />
      )}
      {payStay && <PaymentModal stay={payStay} onClose={() => setPayStay(null)} />}
      {activeStay && <StayActionsModal stay={activeStay} onClose={() => setActiveStay(null)} onPay={(s) => { setActiveStay(null); setPayStay(s) }} onEdit={(s) => { setActiveStay(null); setEditStay(s); setFormOpen(true) }} />}
    </div>
  )
}

// ---------- list view ----------

function ListView({
  date,
  stays,
  active,
  onEdit,
  onPay,
  onOpenActive,
  setFormOpen,
}: {
  date: string
  stays: Stay[]
  active: Stay[]
  onEdit: (s: Stay) => void
  onPay: (s: Stay) => void
  onOpenActive: (s: Stay) => void
  setFormOpen: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 px-1 text-sm font-bold text-ink-900">
          เข้าพักวันที่ {fmtThaiDate(date)} · {stays.length} รายการ
        </p>
        {stays.length === 0 ? (
          <EmptyState icon={<BedDouble size={36} />} title="ไม่มีรายการเข้าพักในวันนี้" subtitle="กดปุ่ม + เพื่อบันทึกการเข้าพัก" />
        ) : (
          <div className="space-y-2">
            {stays.map((s) => (
              <StayCard key={s.id} stay={s} onEdit={onEdit} onPay={onPay} />
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 px-1 text-sm font-bold text-ink-900">กำลังพักอยู่ทั้งหมด · {active.length} ห้อง</p>
        {active.length === 0 ? (
          <EmptyState title="ไม่มีผู้เข้าพักค้างคืนอยู่" />
        ) : (
          <div className="space-y-2">
            {active.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenActive(s)}
                className="card flex w-full items-center gap-3 p-3.5 text-left active:bg-neutral-50"
              >
                <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                  {s.roomNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-900">{s.guestName}</span>
                  <span className="block text-xs text-neutral-400">เข้า {fmtThaiDate(s.checkinDate)} · {s.nights} คืน</span>
                </span>
                <PayChip paid={s.paidAmount} total={s.totalAmount} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StayCard({ stay, onEdit, onPay }: { stay: Stay; onEdit: (s: Stay) => void; onPay: (s: Stay) => void }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          {stay.roomNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-ink-900">{stay.guestName}</p>
            <PayChip paid={stay.paidAmount} total={stay.totalAmount} />
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {fmtThaiDate(stay.checkinDate)} · {stay.nights} คืน × {fmtBaht(stay.dailyRate)}
            {stay.guestPhone ? ` · โทร ${stay.guestPhone}` : ''}
            {stay.createdByName ? ` · บันทึกโดย ${stay.createdByName}` : ''}
          </p>
          <p className="mt-1 text-sm font-semibold text-brand-700">
            รวม {fmtBaht(stay.totalAmount)} · รับแล้ว {fmtBaht(stay.paidAmount)}
            {stay.deposit > 0 ? ` · มัดจำ ${fmtBaht(stay.deposit)}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-2.5">
        {stay.paidAmount < stay.totalAmount && (
          <button type="button" className="btn-secondary btn-sm flex-1 !text-brand-700" onClick={() => onPay(stay)}>
            รับเงิน {fmtBaht(stay.totalAmount - stay.paidAmount)}
          </button>
        )}
        {stay.status === 'active' && <CheckoutButton stay={stay} />}
        <button type="button" className="btn-ghost btn-sm" onClick={() => onEdit(stay)}>
          <Pencil size={14} /> แก้ไข
        </button>
        <CancelButton stay={stay} />
      </div>
    </div>
  )
}

function useStayMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries()
  return { invalidate }
}

function CheckoutButton({ stay, className = 'btn-secondary btn-sm flex-1' }: { stay: Stay; className?: string }) {
  const { invalidate } = useStayMutations()
  const [error, setError] = useState<unknown>(null)
  const checkout = useMutation({
    mutationFn: () =>
      api(`/api/stays/${stay.id}/checkout`, {
        method: 'POST',
        body: { checkoutDate: stay.checkinDate > todayISO() ? stay.checkinDate : todayISO() },
      }),
    onSuccess: invalidate,
    onError: setError,
  })
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (window.confirm(`บันทึกออกพักห้อง ${stay.roomNumber} (${stay.guestName}) วันนี้?`)) checkout.mutate()
        }}
        disabled={checkout.isPending}
      >
        ออกพัก
      </button>
      {!!error && <p className="text-xs text-red-600">{errMsg(error)}</p>}
    </>
  )
}

function CancelButton({ stay }: { stay: Stay }) {
  const { invalidate } = useStayMutations()
  const cancel = useMutation({
    mutationFn: () => api(`/api/stays/${stay.id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  })
  if (stay.status !== 'active') return null
  return (
    <button
      type="button"
      className="btn-ghost btn-sm !text-red-500"
      onClick={() => {
        if (window.confirm(`ยกเลิกการเข้าพักห้อง ${stay.roomNumber}? (รายรับที่บันทึกไว้จะถูกลบด้วย)`)) cancel.mutate()
      }}
      disabled={cancel.isPending}
    >
      ยกเลิก
    </button>
  )
}

// ---------- room grid ----------

function RoomGrid({ rooms, onVacantTap, onStayTap }: { rooms: Room[]; onVacantTap: (r: Room) => void; onStayTap: (s: Stay) => void }) {
  const activeStays = useQuery({
    queryKey: ['stays-grid-active'],
    queryFn: () => api<Stay[]>(`/api/stays?active=1&on=${todayISO()}`),
  })
  const stayByRoom = useMemo(() => {
    const m = new Map<number, Stay>()
    for (const s of activeStays.data ?? []) m.set(s.roomId, s)
    return m
  }, [activeStays.data])

  if (rooms.length === 0) return <EmptyState icon={<LayoutGrid size={36} />} title="ไม่มีข้อมูลห้อง" subtitle="เพิ่มห้องได้ที่หน้าตั้งค่า" />

  return (
    <div className="grid grid-cols-3 gap-2">
      {rooms.map((r) => {
        const stay = r.occupant?.kind === 'daily' ? stayByRoom.get(r.id) : undefined
        const base = 'flex min-h-[92px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-2 text-center transition active:scale-[0.97]'
        if (r.maintenance)
          return (
            <div key={r.id} className={`${base} border-neutral-300 bg-neutral-200/60 text-neutral-500`}>
              <Wrench size={16} />
              <span className="text-sm font-bold">{r.roomNumber}</span>
              <span className="text-[10px]">ซ่อมบำรุง</span>
            </div>
          )
        if (r.occupant)
          return (
            <button
              key={r.id}
              type="button"
              className={`${base} ${r.occupant.kind === 'daily' ? 'border-amber-300 bg-amber-50' : 'border-brand-300 bg-brand-50'}`}
              onClick={() => (stay ? onStayTap(stay) : undefined)}
            >
              <span className="text-sm font-bold text-ink-900">{r.roomNumber}</span>
              <span className="line-clamp-1 text-[10px] text-neutral-500">{r.occupant.name}</span>
              <span className={`text-[10px] font-semibold ${r.occupant.kind === 'daily' ? 'text-amber-600' : 'text-brand-600'}`}>
                {r.occupant.kind === 'daily' ? 'รายวัน' : 'รายเดือน'}
              </span>
            </button>
          )
        return (
          <button
            key={r.id}
            type="button"
            className={`${base} border-emerald-200 bg-emerald-50/60`}
            onClick={() => r.roomType !== 'monthly' && onVacantTap(r)}
          >
            <span className="text-sm font-bold text-emerald-700">{r.roomNumber}</span>
            <span className="text-[10px] text-emerald-600/80">ว่าง · {ROOM_TYPE_LABEL[r.roomType]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- modals ----------

function StayFormModal({
  date,
  edit,
  rooms,
  preselectRoom,
  onClose,
}: {
  date: string
  edit: Stay | null
  rooms: Room[]
  preselectRoom: Room | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => ({
    roomId: String(edit?.roomId ?? preselectRoom?.id ?? ''),
    guestName: edit?.guestName ?? '',
    guestPhone: edit?.guestPhone ?? '',
    checkinDate: edit?.checkinDate ?? date,
    nights: String(edit?.nights ?? 1),
    dailyRate: String(edit?.dailyRate ?? preselectRoom?.dailyRate ?? ''),
    deposit: String(edit?.deposit ?? ''),
    paidAmount: '',
    paymentMethod: 'cash' as PaymentMethod,
    note: edit?.note ?? '',
  }))
  const [error, setError] = useState<unknown>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const nights = Math.max(1, Number(form.nights) || 1)
  const rate = Number(form.dailyRate) || 0
  const total = nights * rate

  const pickRoom = (roomId: string) => {
    const room = rooms.find((r) => String(r.id) === roomId)
    setForm((f) => ({
      ...f,
      roomId,
      dailyRate: room?.dailyRate != null ? String(room.dailyRate) : f.dailyRate,
    }))
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        roomId: Number(form.roomId),
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        checkinDate: form.checkinDate,
        nights: nights,
        dailyRate: rate,
        deposit: Number(form.deposit) || 0,
        paidAmount: Number(form.paidAmount) || 0,
        paymentMethod: form.paymentMethod,
        note: form.note,
      }
      if (edit) {
        const { paidAmount: _paid, roomId: _room, ...rest } = body
        void _paid
        void _room
        return api(`/api/stays/${edit.id}`, { method: 'PATCH', body: rest })
      }
      return api('/api/stays', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title={edit ? `แก้ไขการเข้าพัก ห้อง ${edit.roomNumber}` : 'บันทึกเข้าพักรายวัน'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        {!edit && (
          <Field label="ห้อง *">
            <select className="input" value={form.roomId} onChange={(e) => pickRoom(e.target.value)} required>
              <option value="" disabled>
                — เลือกห้องว่าง —
              </option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  ห้อง {r.roomNumber} {r.dailyRate != null ? `(${fmtBaht(r.dailyRate)}/คืน)` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="ชื่อผู้เข้าพัก *">
          <input className="input" value={form.guestName} onChange={set('guestName')} required placeholder="ชื่อ-นามสกุล" />
        </Field>
        <Field label="เบอร์โทรศัพท์">
          <input className="input" type="tel" inputMode="tel" value={form.guestPhone} onChange={set('guestPhone')} placeholder="08x-xxx-xxxx" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่เข้าพัก *">
            <input className="input" type="date" value={form.checkinDate} onChange={set('checkinDate')} required />
          </Field>
          <Field label="จำนวนคืน *">
            <input className="input" type="number" inputMode="numeric" min={1} value={form.nights} onChange={set('nights')} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาต่อคืน *">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.dailyRate} onChange={set('dailyRate')} required />
          </Field>
          <Field label="เงินมัดจำ">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.deposit} onChange={set('deposit')} placeholder="0" />
          </Field>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <span className="text-sm font-semibold text-brand-800">ยอดรวม {nights} คืน</span>
          <span className="text-lg font-bold text-brand-700">{fmtBaht(total)}</span>
        </div>
        {!edit && (
          <>
            <Field label="รับเงินวันนี้" hint="เงินที่รับจะถูกบันทึกเป็นรายรับอัตโนมัติ (เงินมัดจำไม่นับ)">
              <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.paidAmount} onChange={set('paidAmount')} placeholder="0" />
            </Field>
            <div className="mb-4">
              <label className="label">วิธีชำระ *</label>
              <MethodSegmented value={form.paymentMethod} onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))} />
            </div>
          </>
        )}
        <Field label="หมายเหตุ">
          <textarea className="input min-h-20" value={form.note} onChange={set('note')} placeholder="ทะเบียนรถ, ลักษณะเพิ่มเติม ฯลฯ" />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </form>
    </Modal>
  )
}

function PaymentModal({ stay, onClose }: { stay: Stay; onClose: () => void }) {
  const qc = useQueryClient()
  const remaining = Math.max(0, stay.totalAmount - stay.paidAmount)
  const [amount, setAmount] = useState(String(remaining))
  const [paidDate, setPaidDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>(stay.paymentMethod ?? 'cash')
  const [error, setError] = useState<unknown>(null)
  const pay = useMutation({
    mutationFn: () => api(`/api/stays/${stay.id}/payment`, { method: 'POST', body: { amount: Number(amount), paidDate, paymentMethod: method } }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })
  return (
    <Modal title={`รับเงิน ห้อง ${stay.roomNumber}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          pay.mutate()
        }}
      >
        <ErrorText error={error} />
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          {stay.guestName} · รวม {fmtBaht(stay.totalAmount)} · รับแล้ว {fmtBaht(stay.paidAmount)}
        </p>
        <Field label="จำนวนเงินที่รับ *">
          <input className="input text-lg font-bold" type="number" inputMode="decimal" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="วันที่รับเงิน">
          <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </Field>
        <div className="mb-4">
          <label className="label">วิธีชำระ *</label>
          <MethodSegmented value={method} onChange={setMethod} />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={pay.isPending}>
          {pay.isPending ? 'กำลังบันทึก…' : `รับชำระ ${fmtBaht(Number(amount) || 0)}`}
        </button>
      </form>
    </Modal>
  )
}

function StayActionsModal({
  stay,
  onClose,
  onPay,
  onEdit,
}: {
  stay: Stay
  onClose: () => void
  onPay: (s: Stay) => void
  onEdit: (s: Stay) => void
}) {
  return (
    <Modal title={`ห้อง ${stay.roomNumber} · ${stay.guestName}`} onClose={onClose}>
      <div className="mb-4 space-y-1 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
        <p>เข้าพัก {fmtThaiDate(stay.checkinDate)} · {stay.nights} คืน × {fmtBaht(stay.dailyRate)}</p>
        <p className="font-semibold text-ink-900">รวม {fmtBaht(stay.totalAmount)} · รับแล้ว {fmtBaht(stay.paidAmount)}</p>
        {stay.guestPhone && <p>โทร {stay.guestPhone}</p>}
        {stay.createdByName && <p>บันทึกโดย {stay.createdByName}</p>}
        {stay.note && <p className="text-xs text-neutral-400">หมายเหตุ: {stay.note}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stay.paidAmount < stay.totalAmount && (
          <button type="button" className="btn-primary" onClick={() => onPay(stay)}>
            รับเงิน {fmtBaht(stay.totalAmount - stay.paidAmount)}
          </button>
        )}
        <CheckoutButton stay={stay} className="btn-secondary" />
        <button type="button" className="btn-secondary" onClick={() => onEdit(stay)}>
          <Pencil size={15} /> แก้ไข
        </button>
        <div className="flex items-center justify-center">
          <CancelButton stay={stay} />
        </div>
      </div>
    </Modal>
  )
}
