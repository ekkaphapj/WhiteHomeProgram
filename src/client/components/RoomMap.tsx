import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import type { Room } from '../lib/api'

/**
 * ผังห้องแบบกราฟิก: จัดกลุ่มตามชั้น, สีบอกสถานะ (ว่าง/รายวัน/รายเดือน/ซ่อม)
 * แตะที่ห้องเพื่อไปหน้าจัดการที่เกี่ยวข้อง
 */
export function RoomMap({ rooms }: { rooms: Room[] }) {
  const navigate = useNavigate()
  const groups = useMemo(() => {
    const m = new Map<string, Room[]>()
    for (const r of rooms) {
      const key = r.floor || 'อื่นๆ'
      const list = m.get(key) ?? []
      list.push(r)
      m.set(key, list)
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [rooms])

  return (
    <div className="space-y-3">
      {groups.map(([floor, list]) => (
        <div key={floor}>
          <p className="mb-1.5 text-[11px] font-bold text-neutral-400">
            {floor === 'อื่นๆ' ? 'ห้องอื่นๆ' : `ชั้น ${floor}`}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {list.map((r) => {
              const base =
                'flex h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 text-center transition active:scale-95'
              if (r.maintenance)
                return (
                  <div key={r.id} className={`${base} border-neutral-300 bg-neutral-200/70 text-neutral-500`}>
                    <Wrench size={12} />
                    <span className="text-xs font-bold">{r.roomNumber}</span>
                  </div>
                )
              if (r.occupant)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(r.occupant!.kind === 'daily' ? '/daily' : '/monthly')}
                    className={`${base} ${
                      r.occupant.kind === 'daily' ? 'border-amber-300 bg-amber-50' : 'border-brand-300 bg-brand-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-ink-900">{r.roomNumber}</span>
                    <span className="w-full truncate px-0.5 text-[9px] leading-tight text-neutral-500">
                      {r.occupant.name}
                    </span>
                  </button>
                )
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate('/daily')}
                  className={`${base} border-emerald-200 bg-emerald-50/70`}
                >
                  <span className="text-xs font-bold text-emerald-700">{r.roomNumber}</span>
                  <span className="text-[9px] text-emerald-600/80">ว่าง</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RoomMapLegend() {
  const item = 'flex items-center gap-1'
  const swatch = 'h-2.5 w-2.5 rounded border'
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-500">
      <span className={item}>
        <span className={`${swatch} border-emerald-300 bg-emerald-50`} /> ว่าง
      </span>
      <span className={item}>
        <span className={`${swatch} border-amber-300 bg-amber-50`} /> แขกรายวัน
      </span>
      <span className={item}>
        <span className={`${swatch} border-brand-300 bg-brand-50`} /> ผู้เช่ารายเดือน
      </span>
      <span className={item}>
        <span className={`${swatch} border-neutral-300 bg-neutral-200`} /> ซ่อมบำรุง
      </span>
    </div>
  )
}
