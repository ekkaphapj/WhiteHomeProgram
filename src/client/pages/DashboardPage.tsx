import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BedDouble, DoorOpen, Wallet, KeyRound } from 'lucide-react'
import { api, type DashboardData, type Room } from '../lib/api'
import { currentPeriod, fmtBaht, fmtNum, fmtThaiDateFull, periodShort, todayISO } from '../lib/format'
import { EmptyState, PageSpinner, StatCard } from '../components/ui'
import { RoomMap, RoomMapLegend } from '../components/RoomMap'

export default function DashboardPage() {
  const navigate = useNavigate()
  const today = todayISO()
  const period = currentPeriod()
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', today, period],
    queryFn: () => api<DashboardData>(`/api/reports/dashboard?date=${today}&period=${period}`),
  })
  const roomsQ = useQuery({
    queryKey: ['rooms-dash', today],
    queryFn: () => api<Room[]>(`/api/rooms?on=${today}`),
  })

  if (isLoading) return <PageSpinner />
  if (error || !data)
    return <EmptyState title="โหลดข้อมูลไม่สำเร็จ" subtitle="ลองดึงหน้าใหม่อีกครั้ง" />

  const chart = data.chart.map((c) => ({ ...c, label: periodShort(c.month) }))

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-ink-900">ภาพรวมวันนี้</h1>
        <p className="text-sm text-neutral-400">{fmtThaiDateFull(today)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="เข้าพักวันนี้" value={`${fmtNum(data.today.checkins)} กลุ่ม`} tone="brand" />
        <StatCard label="ออกพักวันนี้" value={`${fmtNum(data.today.checkouts)} กลุ่ม`} />
        <StatCard
          label="ห้องว่าง"
          value={`${fmtNum(data.rooms.vacant)} / ${fmtNum(data.rooms.total)} ห้อง`}
          sub={`มีผู้พัก ${fmtNum(data.rooms.occupied)}${data.rooms.maintenance ? ` · ซ่อม ${data.rooms.maintenance}` : ''}`}
        />
        <StatCard label="รายรับวันนี้" value={fmtBaht(data.today.income)} tone="green" />
      </div>

      <div className="card flex items-center gap-3 border-2 border-sky-200 bg-sky-50 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <Wallet size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-sky-800">เงินสดคงเหลือในลิ้นชัก</p>
          <p className="text-[11px] text-neutral-500">รวมทุกยอดเงินสด (ไม่นับเงินโอน)</p>
        </div>
        <p className={`shrink-0 text-2xl font-bold ${data.cashBalance < 0 ? 'text-red-600' : 'text-sky-700'}`}>{fmtBaht(data.cashBalance)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label={`รายรับ ${periodShort(data.period)}`} value={fmtBaht(data.month.income)} tone="green" />
        <StatCard label={`รายจ่าย ${periodShort(data.period)}`} value={fmtBaht(data.month.expense)} tone="red" />
        <StatCard label="กำไรสุทธิเดือนนี้" value={fmtBaht(data.month.profit)} tone={data.month.profit >= 0 ? 'brand' : 'red'} />
        <StatCard
          label="ค่าเช่าค้างเก็บ"
          value={fmtBaht(data.month.unpaidAmount)}
          sub={`${fmtNum(data.month.unpaidBills)} บิล`}
          tone={data.month.unpaidBills > 0 ? 'amber' : 'default'}
          onClick={data.month.unpaidBills > 0 ? () => navigate('/monthly') : undefined}
        />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-ink-900">ผังห้องวันนี้</p>
          <Link to="/daily" className="text-xs font-semibold text-brand-600">
            จัดการห้อง →
          </Link>
        </div>
        {roomsQ.isLoading ? (
          <PageSpinner />
        ) : (roomsQ.data ?? []).length === 0 ? (
          <EmptyState title="ยังไม่มีข้อมูลห้อง" subtitle="เพิ่มห้องได้ที่หน้าตั้งค่า" />
        ) : (
          <>
            <RoomMap rooms={roomsQ.data ?? []} />
            <div className="mt-3 border-t border-neutral-100 pt-2.5">
              <RoomMapLegend />
            </div>
          </>
        )}
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm font-bold text-ink-900">รายรับ–รายจ่าย 6 เดือนล่าสุด</p>
        {chart.every((c) => c.income === 0 && c.expense === 0) ? (
          <EmptyState icon={<Wallet size={36} />} title="ยังไม่มีข้อมูลรายรับรายจ่าย" />
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8a88' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8a8a88' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(value) => fmtBaht(Number(value))}
                  contentStyle={{ borderRadius: 12, fontSize: 13, border: '1px solid #eee' }}
                />
                <Bar dataKey="income" name="รายรับ" fill="#c8823c" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="รายจ่าย" fill="#b9b9b7" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex justify-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> รายรับ</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-400" /> รายจ่าย</span>
        </div>
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-bold text-ink-900">ทำรายการด่วน</p>
        <div className="grid grid-cols-3 gap-2.5">
          <Link to="/daily" className="card flex flex-col items-center gap-2 p-4 text-center active:bg-neutral-50">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <BedDouble size={22} />
            </span>
            <span className="text-xs font-semibold text-ink-800">เข้าพักรายวัน</span>
          </Link>
          <Link to="/monthly" className="card flex flex-col items-center gap-2 p-4 text-center active:bg-neutral-50">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <KeyRound size={22} />
            </span>
            <span className="text-xs font-semibold text-ink-800">เก็บค่าเช่า</span>
          </Link>
          <Link to="/finance" className="card flex flex-col items-center gap-2 p-4 text-center active:bg-neutral-50">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Wallet size={22} />
            </span>
            <span className="text-xs font-semibold text-ink-800">รายรับ-รายจ่าย</span>
          </Link>
        </div>
      </div>

      {data.rooms.maintenance > 0 && (
        <Link to="/daily" className="card flex items-center gap-3 border border-amber-200 bg-amber-50 p-4">
          <DoorOpen className="text-amber-500" size={20} />
          <p className="text-sm text-amber-700">
            มีห้องอยู่ระหว่างซ่อมบำรุง {data.rooms.maintenance} ห้อง — ดูที่แท็บรายวัน
          </p>
        </Link>
      )}
    </div>
  )
}
