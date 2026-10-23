import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s, optS, n, posN } from '../validate'
import { isValidPeriod, isValidDate, lastDayOfPeriod } from '../dates'

const rent = new Hono<AppEnv>()

interface BillRow {
  id: number
  tenant_id: number
  period: string
  rent_amount: number
  water_amount: number
  electric_amount: number
  other_amount: number
  total_amount: number
  paid_date: string | null
  status: 'unpaid' | 'paid'
  note: string | null
  payment_method: 'cash' | 'transfer'
  water_units: number | null
  electric_units: number | null
  water_meter_prev: string | null
  water_meter_curr: string | null
  electric_meter_prev: string | null
  electric_meter_curr: string | null
  tenant_name: string
  collected_by_name: string | null
  room_number: string
  room_id: number
}

/** ค่าน้ำ/ค่าไฟ คิดหน่วยละ 8 บาท */
export const UTILITY_RATE = 8

const SELECT_JOIN = `SELECT rp.*, t.name AS tenant_name, r.room_number, r.id AS room_id, u.display_name AS collected_by_name
  FROM rent_payments rp
  JOIN tenants t ON t.id = rp.tenant_id
  JOIN rooms r ON r.id = t.room_id
  LEFT JOIN users u ON u.id = rp.collected_by`

function mapBill(r: BillRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    period: r.period,
    rentAmount: r.rent_amount,
    waterAmount: r.water_amount,
    electricAmount: r.electric_amount,
    otherAmount: r.other_amount,
    totalAmount: r.total_amount,
    paidDate: r.paid_date,
    status: r.status,
    note: r.note,
    paymentMethod: r.payment_method,
    waterUnits: r.water_units,
    electricUnits: r.electric_units,
    waterMeterPrev: r.water_meter_prev,
    waterMeterCurr: r.water_meter_curr,
    electricMeterPrev: r.electric_meter_prev,
    electricMeterCurr: r.electric_meter_curr,
    tenantName: r.tenant_name,
    collectedByName: r.collected_by_name,
    roomNumber: r.room_number,
    roomId: r.room_id,
  }
}

/** GET /api/rent/tenant/:tenantId — payment history of one tenant (all periods) */
rent.get('/tenant/:tenantId', async (c) => {
  const tenantId = posN(c.req.param('tenantId'))
  if (!tenantId) return c.json({ error: 'tenantId ไม่ถูกต้อง' }, 400)
  const { results } = await c.env.DB.prepare(`${SELECT_JOIN} WHERE rp.tenant_id = ? ORDER BY rp.period DESC`)
    .bind(tenantId)
    .all<BillRow>()
  return c.json(results.map(mapBill))
})

/** GET /api/rent-payments?period=YYYY-MM&tenantId= */
rent.get('/', async (c) => {
  const period = s(c.req.query('period'))
  const tenantId = posN(c.req.query('tenantId'))
  if (!isValidPeriod(period)) return c.json({ error: 'งวด (period) ไม่ถูกต้อง' }, 400)
  const { results } = await c.env.DB.prepare(
    `${SELECT_JOIN} WHERE rp.period = ? ORDER BY r.floor, LENGTH(r.room_number), r.room_number`,
  )
    .bind(period)
    .all<BillRow>()
  const list = results.map(mapBill)
  return c.json(tenantId ? list.filter((b) => b.tenantId === tenantId) : list)
})

// POST /api/rent-payments/generate { period } — create unpaid bills for every active tenant
rent.post('/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const period = s(body.period)
  if (!isValidPeriod(period)) return c.json({ error: 'งวด (period) ไม่ถูกต้อง' }, 400)
  const end = lastDayOfPeriod(period)
  const { results } = await c.env.DB.prepare(
    `SELECT id, monthly_rent FROM tenants WHERE status = 'active' AND contract_start <= ?`,
  )
    .bind(end)
    .all<{ id: number; monthly_rent: number }>()
  const stmt = c.env.DB.prepare(
    'INSERT OR IGNORE INTO rent_payments (tenant_id, period, rent_amount, total_amount) VALUES (?, ?, ?, ?)',
  )
  const batch = results.map((t) => stmt.bind(t.id, period, t.monthly_rent, t.monthly_rent))
  if (batch.length) await c.env.DB.batch(batch)
  return c.json({ created: batch.length, tenants: results.length })
})

async function syncTransactions(env: AppEnv['Bindings'], bill: BillRow, userId: number, method: 'cash' | 'transfer') {
  const base = `ค่าเช่าเดือน ${bill.period} ห้อง ${bill.room_number} (${bill.tenant_name})`
  const del = env.DB.prepare(`DELETE FROM transactions WHERE ref_type = 'rent_payment' AND ref_id = ?`).bind(bill.id)
  const items: Array<[string, number]> = [
    ['ค่าเช่ารายเดือน', bill.rent_amount],
    ['ค่าน้ำ', bill.water_amount],
    ['ค่าไฟ', bill.electric_amount],
    ['ค่าอื่นๆ', bill.other_amount],
  ]
  const ins = env.DB.prepare(
    `INSERT INTO transactions (txn_date, type, category, amount, description, payment_method, ref_type, ref_id, created_by)
     VALUES (?, 'income', ?, ?, ?, ?, 'rent_payment', ?, ?)`,
  )
  const stmts = [del]
  for (const [category, amount] of items)
    if (amount > 0) stmts.push(ins.bind(bill.paid_date ?? `${bill.period}-01`, category, amount, `${category} ${base}`, method, bill.id, userId))
  await env.DB.batch(stmts)
}

/** POST /api/rent-payments/:id/pay { paidDate?, rentAmount?, waterAmount?, electricAmount?, otherAmount?, paymentMethod?, note? } */
rent.post('/:id/pay', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const row = await c.env.DB.prepare(`${SELECT_JOIN} WHERE rp.id = ?`).bind(id).first<BillRow>()
  if (!row) return c.json({ error: 'ไม่พบบิล' }, 404)
  const paidDate = s(body.paidDate)
  if (paidDate && !isValidDate(paidDate)) return c.json({ error: 'วันที่ชำระไม่ถูกต้อง' }, 400)
  const method = body.paymentMethod === 'transfer' ? 'transfer' : 'cash'
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : n(v))
  const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : s(v))
  const waterUnits = num(body.waterUnits)
  const electricUnits = num(body.electricUnits)
  // ถ้าไม่กรอกยอดเอง ให้คิดจากหน่วย × 8 บาท
  const waterAmount =
    body.waterAmount !== undefined && body.waterAmount !== ''
      ? n(body.waterAmount)
      : waterUnits != null
        ? waterUnits * UTILITY_RATE
        : row.water_amount
  const electricAmount =
    body.electricAmount !== undefined && body.electricAmount !== ''
      ? n(body.electricAmount)
      : electricUnits != null
        ? electricUnits * UTILITY_RATE
        : row.electric_amount
  const bill: BillRow = {
    ...row,
    rent_amount: body.rentAmount !== undefined ? n(body.rentAmount) : row.rent_amount,
    water_amount: waterAmount,
    electric_amount: electricAmount,
    other_amount: body.otherAmount !== undefined ? n(body.otherAmount) : row.other_amount,
    note: body.note !== undefined ? optS(body.note) : row.note,
    paid_date: paidDate || row.paid_date || new Date().toISOString().slice(0, 10),
    status: 'paid',
    water_units: body.waterUnits !== undefined ? waterUnits : row.water_units,
    electric_units: body.electricUnits !== undefined ? electricUnits : row.electric_units,
    water_meter_prev: body.waterMeterPrev !== undefined ? str(body.waterMeterPrev) : row.water_meter_prev,
    water_meter_curr: body.waterMeterCurr !== undefined ? str(body.waterMeterCurr) : row.water_meter_curr,
    electric_meter_prev: body.electricMeterPrev !== undefined ? str(body.electricMeterPrev) : row.electric_meter_prev,
    electric_meter_curr: body.electricMeterCurr !== undefined ? str(body.electricMeterCurr) : row.electric_meter_curr,
  }
  if (bill.rent_amount < 0 || bill.water_amount < 0 || bill.electric_amount < 0 || bill.other_amount < 0)
    return c.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, 400)
  bill.total_amount = bill.rent_amount + bill.water_amount + bill.electric_amount + bill.other_amount
  await c.env.DB.prepare(
    `UPDATE rent_payments SET rent_amount = ?, water_amount = ?, electric_amount = ?, other_amount = ?, total_amount = ?, paid_date = ?, status = 'paid', note = ?, collected_by = ?, payment_method = ?,
       water_units = ?, electric_units = ?, water_meter_prev = ?, water_meter_curr = ?, electric_meter_prev = ?, electric_meter_curr = ?
     WHERE id = ?`,
  )
    .bind(
      bill.rent_amount,
      bill.water_amount,
      bill.electric_amount,
      bill.other_amount,
      bill.total_amount,
      bill.paid_date,
      bill.note,
      c.get('user').userId,
      method,
      bill.water_units,
      bill.electric_units,
      bill.water_meter_prev,
      bill.water_meter_curr,
      bill.electric_meter_prev,
      bill.electric_meter_curr,
      id,
    )
    .run()
  await syncTransactions(c.env, bill, c.get('user').userId, method)
  const updated = await c.env.DB.prepare(`${SELECT_JOIN} WHERE rp.id = ?`).bind(id).first<BillRow>()
  return c.json(updated ? mapBill(updated) : { ok: true })
})

// POST /api/rent-payments/:id/unpay — revert to unpaid (also removes its income entries)
rent.post('/:id/unpay', async (c) => {
  const id = n(c.req.param('id'))
  const row = await c.env.DB.prepare(`${SELECT_JOIN} WHERE rp.id = ?`).bind(id).first<BillRow>()
  if (!row) return c.json({ error: 'ไม่พบบิล' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE rent_payments SET status = 'unpaid', paid_date = NULL, collected_by = NULL WHERE id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM transactions WHERE ref_type = 'rent_payment' AND ref_id = ?`).bind(id),
  ])
  return c.json({ ok: true })
})

export default rent
