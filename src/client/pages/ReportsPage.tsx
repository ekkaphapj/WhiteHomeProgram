import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api, type MonthlyReport } from '../lib/api'
import { currentPeriod, fmtBaht, fmtNum, fmtThaiDate, periodLabel } from '../lib/format'
import { EmptyState, PageSpinner, StatCard } from '../components/ui'

export default function ReportsPage() {
  const [period, setPeriod] = useState(currentPeriod())
  const q = useQuery({
    queryKey: ['report', period],
    queryFn: () => api<MonthlyReport>(`/api/reports/monthly?period=${period}`),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="month" className="input flex-1 font-semibold" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        <a href={`/api/reports/export?period=${period}`} className="btn-secondary shrink-0 !px-3.5" title="ดาวน์โหลด CSV เปิดใน Excel ได้">
          <Download size={17} />
          <span className="text-sm">CSV</span>
        </a>
      </div>

      {q.isLoading ? (
        <PageSpinner />
      ) : !q.data ? (
        <EmptyState title="โหลดข้อมูลไม่สำเร็จ" />
      ) : (
        <>
          <div>
            <h1 className="mb-2 px-1 text-lg font-bold text-ink-900">สรุป {periodLabel(period)}</h1>
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard label="รายรับรวม" value={fmtBaht(q.data.totals.income)} tone="green" />
              <StatCard label="รายจ่ายรวม" value={fmtBaht(q.data.totals.expense)} tone="red" />
              <StatCard
                label="กำไรสุทธิ"
                value={fmtBaht(q.data.totals.profit)}
                tone={q.data.totals.profit >= 0 ? 'brand' : 'red'}
              />
            </div>
          </div>

          <div className="card flex flex-wrap gap-x-5 gap-y-1.5 p-4 text-sm">
            <span className="text-neutral-500">
              กลุ่มเข้าพัก <b className="text-ink-900">{fmtNum(q.data.stays.groups)}</b>
            </span>
            <span className="text-neutral-500">
              คืนที่ขายได้ <b className="text-ink-900">{fmtNum(q.data.stays.nights)}</b>
            </span>
            <span className="text-neutral-500">
              บิลค่าเช่าที่ชำระแล้ว <b className="text-ink-900">{fmtNum(q.data.rentBillsPaid)}</b>
            </span>
          </div>

          <div className="card grid grid-cols-2 gap-3 p-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-sky-700">รับเงินสด</p>
              <p className="font-bold text-ink-900">{fmtBaht(q.data.byMethod.incomeCash)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-700">รับเงินโอน</p>
              <p className="font-bold text-ink-900">{fmtBaht(q.data.byMethod.incomeTransfer)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-700">จ่ายเงินสด</p>
              <p className="font-bold text-ink-900">{fmtBaht(q.data.byMethod.expenseCash)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-700">จ่ายเงินโอน</p>
              <p className="font-bold text-ink-900">{fmtBaht(q.data.byMethod.expenseTransfer)}</p>
            </div>
          </div>

          <CategorySection title="รายรับแยกหมวด" items={q.data.incomeByCategory} tone="brand" total={q.data.totals.income} />
          <CategorySection title="รายจ่ายแยกหมวด" items={q.data.expenseByCategory} tone="neutral" total={q.data.totals.expense} />

          {q.data.daily.length > 0 && (
            <div className="card overflow-hidden">
              <p className="border-b border-neutral-100 px-4 py-3 text-sm font-bold text-ink-900">สรุปรายวัน</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-xs text-neutral-500">
                    <th className="px-4 py-2 text-left font-semibold">วันที่</th>
                    <th className="px-2 py-2 text-right font-semibold">รายรับ</th>
                    <th className="px-4 py-2 text-right font-semibold">รายจ่าย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {q.data.daily.map((d) => (
                    <tr key={d.d}>
                      <td className="px-4 py-2 text-neutral-600">{fmtThaiDate(d.d)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-emerald-600">{d.income ? fmtBaht(d.income) : '-'}</td>
                      <td className="px-4 py-2 text-right text-red-500">{d.expense ? fmtBaht(d.expense) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CategorySection({
  title,
  items,
  total,
  tone,
}: {
  title: string
  items: { category: string; total: number }[]
  total: number
  tone: 'brand' | 'neutral'
}) {
  const max = Math.max(...items.map((i) => i.total), 1)
  if (items.length === 0)
    return (
      <div className="card p-4">
        <p className="text-sm font-bold text-ink-900">{title}</p>
        <p className="mt-2 text-sm text-neutral-400">ไม่มีรายการ</p>
      </div>
    )
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-bold text-ink-900">{title}</p>
      <div className="space-y-2.5">
        {items.map((i) => (
          <div key={i.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-neutral-600">{i.category}</span>
              <span className={`font-bold ${tone === 'brand' ? 'text-brand-700' : 'text-ink-800'}`}>{fmtBaht(i.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${tone === 'brand' ? 'bg-brand-400' : 'bg-neutral-400'}`}
                style={{ width: `${Math.round((i.total / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5 text-sm font-bold text-ink-900">
          <span>รวม</span>
          <span>{fmtBaht(total)}</span>
        </div>
      </div>
    </div>
  )
}
