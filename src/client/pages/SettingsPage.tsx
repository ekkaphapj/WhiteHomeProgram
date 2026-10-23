import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, Trash2, UserPlus, Users, Wrench } from 'lucide-react'
import { api, type AppUser, type Room } from '../lib/api'
import { fmtBaht, ROOM_TYPE_LABEL } from '../lib/format'
import { useAuthStatus } from '../App'
import { EmptyState, ErrorText, Field, Modal, PageSpinner, Segmented } from '../components/ui'

export default function SettingsPage() {
  const [section, setSection] = useState<'rooms' | 'users'>('rooms')
  const { data: status } = useAuthStatus()
  const isAdmin = status?.user?.role === 'admin'

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-lg font-bold text-ink-900">ตั้งค่า</h1>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'rooms', label: 'ห้องพัก' },
          ...(isAdmin ? [{ value: 'users' as const, label: 'ผู้ใช้งาน' }] : []),
        ]}
      />
      {section === 'rooms' ? <RoomsSection /> : isAdmin ? <UsersSection /> : null}
    </div>
  )
}

// ---------- rooms ----------

function RoomsSection() {
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const roomsQ = useQuery({
    queryKey: ['rooms-settings'],
    queryFn: () => api<Room[]>(`/api/rooms?on=${new Date().toISOString().slice(0, 10)}`),
  })
  const rooms = roomsQ.data ?? []

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button type="button" className="btn-primary btn-sm flex-1 !py-2.5" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> เพิ่มห้อง
        </button>
        <button type="button" className="btn-secondary btn-sm flex-1 !py-2.5" onClick={() => setBulkOpen(true)}>
          เพิ่มหลายห้อง
        </button>
      </div>

      {roomsQ.isLoading ? (
        <PageSpinner />
      ) : rooms.length === 0 ? (
        <EmptyState icon={<Building2 size={36} />} title="ยังไม่มีห้องพัก" subtitle="เริ่มจากเพิ่มห้องของคุณ เช่น 101–105" />
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditRoom(r)}
              className="card flex w-full items-center gap-3 p-3.5 text-left active:bg-neutral-50"
            >
              <span
                className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  r.maintenance ? 'bg-neutral-200 text-neutral-500' : r.status === 'occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {r.roomNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  {ROOM_TYPE_LABEL[r.roomType]}
                  {r.dailyRate != null ? ` · ${fmtBaht(r.dailyRate)}/คืน` : ''}
                  {r.monthlyRate != null ? ` · ${fmtBaht(r.monthlyRate)}/เดือน` : ''}
                </span>
                <span className="block text-xs text-neutral-400">
                  {r.maintenance ? 'อยู่ระหว่างซ่อมบำรุง' : r.occupant ? `มีผู้พัก: ${r.occupant.name}` : 'ว่าง'}
                  {r.floor ? ` · ชั้น ${r.floor}` : ''}
                </span>
              </span>
              <Pencil size={16} className="shrink-0 text-neutral-400" />
            </button>
          ))}
        </div>
      )}

      {editRoom && <RoomFormModal edit={editRoom} onClose={() => setEditRoom(null)} />}
      {addOpen && <RoomFormModal onClose={() => setAddOpen(false)} />}
      {bulkOpen && <BulkRoomModal onClose={() => setBulkOpen(false)} />}
    </div>
  )
}

function RoomFormModal({ edit, onClose }: { edit?: Room; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    roomNumber: edit?.roomNumber ?? '',
    floor: edit?.floor ?? '',
    roomType: edit?.roomType ?? 'both',
    maintenance: edit?.maintenance ?? false,
    dailyRate: edit?.dailyRate != null ? String(edit.dailyRate) : '',
    monthlyRate: edit?.monthlyRate != null ? String(edit.monthlyRate) : '',
    note: edit?.note ?? '',
  })
  const [error, setError] = useState<unknown>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        roomNumber: form.roomNumber,
        floor: form.floor,
        roomType: form.roomType,
        maintenance: form.maintenance,
        dailyRate: form.dailyRate === '' ? null : Number(form.dailyRate),
        monthlyRate: form.monthlyRate === '' ? null : Number(form.monthlyRate),
        note: form.note,
      }
      return edit ? api(`/api/rooms/${edit.id}`, { method: 'PATCH', body }) : api('/api/rooms', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  const remove = useMutation({
    mutationFn: () => api(`/api/rooms/${edit!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title={edit ? `แก้ไขห้อง ${edit.roomNumber}` : 'เพิ่มห้องพัก'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="เลขห้อง *">
            <input className="input" value={form.roomNumber} onChange={set('roomNumber')} required placeholder="เช่น 101" />
          </Field>
          <Field label="ชั้น">
            <input className="input" value={form.floor} onChange={set('floor')} placeholder="เช่น 1" />
          </Field>
        </div>
        <Field label="ประเภทห้อง *">
          <select className="input" value={form.roomType} onChange={set('roomType')}>
            <option value="daily">รายวันเท่านั้น</option>
            <option value="monthly">รายเดือนเท่านั้น</option>
            <option value="both">ทั้งรายวันและรายเดือน</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคารายวัน (บาท/คืน)">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.dailyRate} onChange={set('dailyRate')} placeholder="เช่น 350" />
          </Field>
          <Field label="ราคารายเดือน (บาท/เดือน)">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.monthlyRate} onChange={set('monthlyRate')} placeholder="เช่น 3500" />
          </Field>
        </div>
        <label className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
          <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={form.maintenance} onChange={(e) => setForm((f) => ({ ...f, maintenance: e.target.checked }))} />
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            <Wrench size={16} className="text-neutral-400" /> อยู่ระหว่างซ่อมบำรุง (ปิดรับผู้เข้าพัก)
          </span>
        </label>
        <Field label="หมายเหตุ">
          <textarea className="input min-h-16" value={form.note} onChange={set('note')} placeholder="แอร์, เฟอร์นิเจอร์ ฯลฯ" />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        {edit && (
          <button
            type="button"
            className="btn-ghost mt-2 w-full !text-red-500"
            onClick={() => {
              if (window.confirm(`ลบห้อง ${edit.roomNumber}? (ลบได้เฉพาะห้องที่ไม่มีประวัติ)`)) remove.mutate()
            }}
            disabled={remove.isPending}
          >
            <Trash2 size={16} /> ลบห้อง
          </button>
        )}
      </form>
    </Modal>
  )
}

function BulkRoomModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ prefix: '', from: '', to: '', floor: '', roomType: 'both', dailyRate: '', monthlyRate: '' })
  const [error, setError] = useState<unknown>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () =>
      api('/api/rooms/bulk', {
        method: 'POST',
        body: {
          prefix: form.prefix,
          from: Number(form.from),
          to: Number(form.to),
          floor: form.floor,
          roomType: form.roomType,
          dailyRate: form.dailyRate === '' ? null : Number(form.dailyRate),
          monthlyRate: form.monthlyRate === '' ? null : Number(form.monthlyRate),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title="เพิ่มหลายห้องพร้อมกัน" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          ตัวอย่าง: หน้าส่วน "1" ช่วง 01–05 จะสร้างห้อง 101 102 103 104 105
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="หน้าเลข">
            <input className="input" value={form.prefix} onChange={set('prefix')} placeholder="(ไม่ใส่ได้)" />
          </Field>
          <Field label="จากเลข *">
            <input className="input" type="number" inputMode="numeric" value={form.from} onChange={set('from')} required placeholder="1" />
          </Field>
          <Field label="ถึงเลข *">
            <input className="input" type="number" inputMode="numeric" value={form.to} onChange={set('to')} required placeholder="10" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ชั้น">
            <input className="input" value={form.floor} onChange={set('floor')} />
          </Field>
          <Field label="ประเภทห้อง *">
            <select className="input" value={form.roomType} onChange={set('roomType')}>
              <option value="daily">รายวันเท่านั้น</option>
              <option value="monthly">รายเดือนเท่านั้น</option>
              <option value="both">ทั้งรายวันและรายเดือน</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคารายวัน">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.dailyRate} onChange={set('dailyRate')} />
          </Field>
          <Field label="ราคารายเดือน">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.monthlyRate} onChange={set('monthlyRate')} />
          </Field>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังสร้าง…' : 'สร้างห้อง'}
        </button>
      </form>
    </Modal>
  )
}

// ---------- users ----------

function UsersSection() {
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api<AppUser[]>('/api/auth/users'),
  })

  return (
    <div>
      <div className="mb-3">
        <button type="button" className="btn-primary btn-sm w-full !py-2.5" onClick={() => setAddOpen(true)}>
          <UserPlus size={16} /> เพิ่มผู้ใช้งาน
        </button>
      </div>
      {usersQ.isLoading ? (
        <PageSpinner />
      ) : (usersQ.data ?? []).length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="ไม่มีผู้ใช้งาน" />
      ) : (
        <div className="space-y-2">
          {(usersQ.data ?? []).map((u) => (
            <button key={u.id} type="button" onClick={() => setEditUser(u)} className="card flex w-full items-center gap-3 p-3.5 text-left active:bg-neutral-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Users size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  {u.displayName}
                  {!u.isActive && <span className="ml-2 chip bg-neutral-100 text-neutral-500">ปิดใช้งาน</span>}
                </span>
                <span className="block text-xs text-neutral-400">
                  {u.username} · {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                </span>
              </span>
              <Pencil size={16} className="shrink-0 text-neutral-400" />
            </button>
          ))}
        </div>
      )}
      {editUser && <UserFormModal edit={editUser} onClose={() => setEditUser(null)} />}
      {addOpen && <UserFormModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function UserFormModal({ edit, onClose }: { edit?: AppUser; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ displayName: edit?.displayName ?? '', username: edit?.username ?? '', password: '', role: edit?.role ?? 'staff', isActive: edit ? !!edit.isActive : true })
  const [error, setError] = useState<unknown>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { displayName: form.displayName, role: form.role, isActive: form.isActive }
      if (form.password) body.password = form.password
      return edit ? api(`/api/auth/users/${edit.id}`, { method: 'PATCH', body }) : api('/api/auth/users', { method: 'POST', body: { ...body, username: form.username } })
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  const remove = useMutation({
    mutationFn: () => api(`/api/auth/users/${edit!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: setError,
  })

  return (
    <Modal title={edit ? `แก้ไขผู้ใช้ ${edit.displayName}` : 'เพิ่มผู้ใช้งาน'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <ErrorText error={error} />
        <Field label="ชื่อแสดง *">
          <input className="input" value={form.displayName} onChange={set('displayName')} required />
        </Field>
        <Field label="ชื่อผู้ใช้ (เข้าสู่ระบบ) *" hint={edit ? 'แก้ไขชื่อผู้ใช้ไม่ได้' : undefined}>
          <input className="input" value={form.username} onChange={set('username')} required disabled={!!edit} autoCapitalize="none" />
        </Field>
        <Field label={edit ? 'ตั้งรหัสผ่านใหม่ (ไม่กรอก = คงเดิม)' : 'รหัสผ่าน *'} hint="อย่างน้อย 6 ตัวอักษร">
          <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!edit} placeholder="••••••" />
        </Field>
        <Field label="สิทธิ์ *">
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="staff">พนักงาน (บันทึกรายการได้)</option>
            <option value="admin">ผู้ดูแลระบบ (จัดการทุกอย่าง)</option>
          </select>
        </Field>
        {edit && (
          <label className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-500"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="text-sm font-semibold text-ink-800">เปิดใช้งานบัญชีนี้</span>
          </label>
        )}
        <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        {edit && (
          <button
            type="button"
            className="btn-ghost mt-2 w-full !text-red-500"
            onClick={() => {
              if (window.confirm(`ลบบัญชี ${edit.displayName}?`)) remove.mutate()
            }}
            disabled={remove.isPending}
          >
            <Trash2 size={16} /> ลบบัญชี
          </button>
        )}
      </form>
    </Modal>
  )
}
