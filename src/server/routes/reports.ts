import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s } from '../validate'
import { isValidDate, isValidPeriod, monthsBack } from '../dates'

const reports = new Hono<AppEnv>()

async function monthTotals(env: AppEnv['Bindings'], period: string) {
  const rows = await env.DB.prepare(
    `SELECT type, SUM(amount) AS total FROM transactions WHERE txn_date LIKE ? GROUP BY type`,
  )
    .bind(`${period}%`)
    .all<{ type: 'income' | 'expense'; total: number }>()
  const income = rows.results?.find((r) => r.type === 'income')?.total ?? 0
  const expense = rows.results?.find((r) => r.type === 'expense')?.total ?? 0
  return { income, expense, profit: income - expense }
}

// GET /api/reports/dashboard?date=YYYY-MM-DD&period=YYYY-MM
reports.get('/dashboard', async (c) => {
  const date = s(c.req.query('date'))
  const period = s(c.req.query('period'))
  if (!isValidDate(date)) return c.json({ error: 'date ไม่ถูกต้อง' }, 400)
  if (!isValidPeriod(period)) return c.json({ error: 'period ไม่ถูกต้อง' }, 400)
  const db = c.env.DB

  const [checkins, checkouts, staying, roomRows, incomeToday, month, unpaid, activeTenants, cash] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM stays WHERE checkin_date = ? AND status != 'cancelled'`).bind(date).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM stays WHERE checkout_date = ? AND status = 'checked_out'`).bind(date).first<{ n: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS n FROM stays WHERE status = 'active' AND checkin_date <= ? AND (checkout_date IS NULL OR checkout_date > ?)`,
    )
      .bind(date, date)
      .first<{ n: number }>(),
    db.prepare(`SELECT maintenance, id FROM rooms`).all<{ id: number; maintenance: number }>(),
    db.prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM transactions WHERE txn_date = ? AND type = 'income'`).bind(date).first<{ t: number }>(),
    monthTotals(c.env, period),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS t FROM rent_payments WHERE period = ? AND status = 'unpaid'`)
      .bind(period)
      .first<{ n: number; t: number }>(),
    db.prepare(`SELECT room_id FROM tenants WHERE status = 'active' AND contract_start <= ?`).bind(date).all<{ room_id: number }>(),
    db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS bal FROM transactions WHERE payment_method = 'cash'`,
    ).first<{ bal: number }>(),
  ])

  const totalRooms = roomRows.results?.length ?? 0
  const maintenanceRooms = roomRows.results?.filter((r) => r.maintenance).length ?? 0
  const dailyStaying = staying?.n ?? 0
  const monthlyOccupied = new Set((activeTenants.results ?? []).map((t) => t.room_id))
  // rooms occupied by a daily stay that is not also a monthly-tenant room
  const dailyRoomIds = await db
    .prepare(
      `SELECT DISTINCT room_id FROM stays WHERE status = 'active' AND checkin_date <= ? AND (checkout_date IS NULL OR checkout_date > ?)`,
    )
    .bind(date, date)
    .all<{ room_id: number }>()
  for (const r of dailyRoomIds.results ?? []) monthlyOccupied.delete(r.room_id)

  const occupied = new Set([...(dailyRoomIds.results ?? []).map((r) => r.room_id), ...(activeTenants.results ?? []).map((t) => t.room_id)]).size

  // 6-month income/expense chart
  const months = monthsBack(period, 6)
  const chartRows = await db
    .prepare(`SELECT substr(txn_date, 1, 7) AS ym, type, SUM(amount) AS total FROM transactions WHERE txn_date >= ? GROUP BY ym, type`)
    .bind(`${months[0]}-01`)
    .all<{ ym: string; type: 'income' | 'expense'; total: number }>()
  const chart = months.map((m) => ({
    month: m,
    income: chartRows.results?.find((r) => r.ym === m && r.type === 'income')?.total ?? 0,
    expense: chartRows.results?.find((r) => r.ym === m && r.type === 'expense')?.total ?? 0,
  }))

  return c.json({
    date,
    period,
    cashBalance: cash?.bal ?? 0,
    today: { checkins: checkins?.n ?? 0, checkouts: checkouts?.n ?? 0, staying: dailyStaying, income: incomeToday?.t ?? 0 },
    month: {
      income: month.income,
      expense: month.expense,
      profit: month.profit,
      unpaidBills: unpaid?.n ?? 0,
      unpaidAmount: unpaid?.t ?? 0,
    },
    rooms: {
      total: totalRooms,
      occupied,
      vacant: totalRooms - occupied - maintenanceRooms,
      maintenance: maintenanceRooms,
    },
    chart,
  })
})

// GET /api/reports/monthly?period=YYYY-MM
reports.get('/monthly', async (c) => {
  const period = s(c.req.query('period'))
  if (!isValidPeriod(period)) return c.json({ error: 'period ไม่ถูกต้อง' }, 400)
  const db = c.env.DB
  const [byCat, byMethod, daily, stayStats, rentStats] = await Promise.all([
    db.prepare(`SELECT type, category, SUM(amount) AS total FROM transactions WHERE txn_date LIKE ? GROUP BY type, category ORDER BY total DESC`)
      .bind(`${period}%`)
      .all<{ type: 'income' | 'expense'; category: string; total: number }>(),
    db.prepare(`SELECT type, payment_method AS pm, SUM(amount) AS total FROM transactions WHERE txn_date LIKE ? GROUP BY type, payment_method`)
      .bind(`${period}%`)
      .all<{ type: 'income' | 'expense'; pm: 'cash' | 'transfer'; total: number }>(),
    db.prepare(
      `SELECT txn_date AS d,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions WHERE txn_date LIKE ? GROUP BY txn_date ORDER BY txn_date`,
    )
      .bind(`${period}%`)
      .all<{ d: string; income: number; expense: number }>(),
    db.prepare(`SELECT COUNT(*) AS groups, COALESCE(SUM(nights), 0) AS nights FROM stays WHERE checkin_date LIKE ? AND status != 'cancelled'`)
      .bind(`${period}%`)
      .first<{ groups: number; nights: number }>(),
    db.prepare(`SELECT COUNT(*) AS paid FROM rent_payments WHERE period = ? AND status = 'paid'`).bind(period).first<{ paid: number }>(),
  ])
  const totals = await monthTotals(c.env, period)
  const pick = (type: 'income' | 'expense', pm: 'cash' | 'transfer') =>
    byMethod.results?.find((r) => r.type === type && r.pm === pm)?.total ?? 0
  const incomeByCategory = (byCat.results ?? []).filter((r) => r.type === 'income').map((r) => ({ category: r.category, total: r.total }))
  const expenseByCategory = (byCat.results ?? []).filter((r) => r.type === 'expense').map((r) => ({ category: r.category, total: r.total }))
  return c.json({
    period,
    totals,
    byMethod: {
      incomeCash: pick('income', 'cash'),
      incomeTransfer: pick('income', 'transfer'),
      expenseCash: pick('expense', 'cash'),
      expenseTransfer: pick('expense', 'transfer'),
    },
    incomeByCategory,
    expenseByCategory,
    daily: daily.results,
    stays: { groups: stayStats?.groups ?? 0, nights: stayStats?.nights ?? 0 },
    rentBillsPaid: rentStats?.paid ?? 0,
  })
})

// GET /api/reports/export?period=YYYY-MM — CSV for Excel
reports.get('/export', async (c) => {
  const period = s(c.req.query('period'))
  if (!isValidPeriod(period)) return c.json({ error: 'period ไม่ถูกต้อง' }, 400)
  const { results } = await c.env.DB.prepare(
    `SELECT txn_date, type, category, amount, description, payment_method FROM transactions WHERE txn_date LIKE ? ORDER BY txn_date, id`,
  )
    .bind(`${period}%`)
    .all<{ txn_date: string; type: 'income' | 'expense'; category: string; amount: number; description: string | null; payment_method: 'cash' | 'transfer' }>()
  const esc = (v: string | number) => {
    const str = String(v ?? '')
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = ['วันที่,ประเภท,หมวดหมู่,จำนวนเงิน,วิธีชำระ,รายละเอียด']
  for (const r of results ?? [])
    lines.push(
      [r.txn_date, r.type === 'income' ? 'รายรับ' : 'รายจ่าย', esc(r.category), String(r.amount), r.payment_method === 'cash' ? 'เงินสด' : 'โอน', esc(r.description ?? '')].join(','),
    )
  const totals = await monthTotals(c.env, period)
  lines.push('')
  lines.push(`รวมรายรับ,,,${totals.income},`)
  lines.push(`รวมรายจ่าย,,,${totals.expense},`)
  lines.push(`กำไรสุทธิ,,,${totals.profit},`)
  const csv = '\uFEFF' + lines.join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="whitehome-report-${period}.csv"`,
    },
  })
})

export default reports
