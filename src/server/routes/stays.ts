import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s, optS, n, posN } from '../validate'
import { isValidDate, addDays } from '../dates'

const stays = new Hono<AppEnv>()

interface StayRow {
  id: number
  room_id: number
  guest_name: string
  guest_phone: string | null
  guest_count: number
  checkin_date: string
  checkout_date: string | null
  nights: number
  daily_rate: number
  total_amount: number
  deposit: number
  paid_amount: number
  status: 'active' | 'checked_out' | 'cancelled'
  note: string | null
  created_by_name: string | null
  payment_method: 'cash' | 'transfer'
  room_number: string
}

const SELECT_JOIN = `SELECT st.*, r.room_number, u.display_name AS created_by_name
  FROM stays st JOIN rooms r ON r.id = st.room_id LEFT JOIN users u ON u.id = st.created_by`

const NATURAL_ORDER = `ORDER BY r.floor, LENGTH(r.room_number), r.room_number`

// GET /api/stays?date=YYYY-MM-DD  → check-ins on that date
// GET /api/stays?active=1&on=YYYY-MM-DD → currently staying
stays.get('/', async (c) => {
  const date = s(c.req.query('date'))
  const on = s(c.req.query('on'))
  if (date) {
    const { results } = await c.env.DB.prepare(`${SELECT_JOIN} WHERE st.checkin_date = ? AND st.status != 'cancelled' ${NATURAL_ORDER}`)
      .bind(date)
      .all<StayRow>()
    return c.json(results.map(mapStay))
  }
  if (on) {
    const { results } = await c.env.DB.prepare(
      `${SELECT_JOIN} WHERE st.status = 'active' AND st.checkin_date <= ? AND (st.checkout_date IS NULL OR st.checkout_date > ?) ${NATURAL_ORDER}`,
    )
      .bind(on, on)
      .all<StayRow>()
    return c.json(results.map(mapStay))
  }
  return c.json({ error: 'ต้องระบุ date หรือ on' }, 400)
})

function mapStay(r: StayRow) {
  return {
    id: r.id,
    roomId: r.room_id,
    roomNumber: r.room_number,
    guestName: r.guest_name,
    guestPhone: r.guest_phone,
    guestCount: r.guest_count,
    checkinDate: r.checkin_date,
    checkoutDate: r.checkout_date,
    nights: r.nights,
    dailyRate: r.daily_rate,
    totalAmount: r.total_amount,
    deposit: r.deposit,
    paidAmount: r.paid_amount,
    status: r.status,
    note: r.note,
    createdByName: r.created_by_name,
    paymentMethod: r.payment_method,
  }
}

async function roomAllowsDaily(c: AppEnv['Bindings'], roomId: number) {
  const room = await c.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first<{
    id: number
    room_type: 'daily' | 'monthly' | 'both'
    maintenance: number
    room_number: string
    daily_rate: number | null
  }>()
  if (!room) return { error: 'ไม่พบห้องนี้' as const }
  if (room.maintenance) return { error: `ห้อง ${room.room_number} อยู่ระหว่างซ่อมบำรุง` as const }
  if (room.room_type === 'monthly') return { error: `ห้อง ${room.room_number} เป็นห้องรายเดือนเท่านั้น` as const }
  return { room }
}

stays.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const roomId = posN(body.roomId)
  const guestName = s(body.guestName)
  const checkin = s(body.checkinDate)
  const nights = Math.trunc(n(body.nights))
  const rate = n(body.dailyRate)
  const paid = n(body.paidAmount)
  const deposit = n(body.deposit)
  if (!roomId) return c.json({ error: 'กรุณาเลือกห้อง' }, 400)
  if (!guestName) return c.json({ error: 'กรุณากรอกชื่อผู้เข้าพัก' }, 400)
  if (!isValidDate(checkin)) return c.json({ error: 'วันที่เข้าพักไม่ถูกต้อง' }, 400)
  if (nights < 1) return c.json({ error: 'จำนวนคืนต้องไม่น้อยกว่า 1' }, 400)
  if (rate < 0 || paid < 0 || deposit < 0) return c.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, 400)

  const check = await roomAllowsDaily(c.env, roomId)
  if ('error' in check) return c.json({ error: check.error }, 400)
  const newEnd = addDays(checkin, nights)
  const clash = await c.env.DB.prepare(
    `SELECT id FROM stays WHERE room_id = ? AND status = 'active'
       AND checkin_date < ? AND (checkout_date IS NULL OR ? < checkout_date)`,
  )
    .bind(roomId, newEnd, checkin)
    .first()
  if (clash) return c.json({ error: 'ห้องนี้มีผู้เข้าพักในช่วงวันดังกล่าวแล้ว' }, 400)
  const tenant = await c.env.DB.prepare(
    `SELECT id FROM tenants WHERE room_id = ? AND status = 'active' AND contract_start <= ?`,
  )
    .bind(roomId, newEnd)
    .first()
  if (tenant) return c.json({ error: 'ห้องนี้มีผู้เช่ารายเดือนอยู่' }, 400)

  const total = nights * rate
  const method = body.paymentMethod === 'transfer' ? 'transfer' : 'cash'
  const res = await c.env.DB.prepare(
    `INSERT INTO stays (room_id, guest_name, guest_phone, guest_count, checkin_date, nights, daily_rate, total_amount, deposit, paid_amount, payment_method, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  )
    .bind(
      roomId,
      guestName,
      optS(body.guestPhone),
      Math.max(1, Math.trunc(n(body.guestCount))) || 1,
      checkin,
      nights,
      rate,
      total,
      deposit,
      paid,
      method,
      c.get('user').userId,
    )
    .run()
  const stayId = Number(res.meta.last_row_id)
  if (paid > 0) {
    await c.env.DB.prepare(
      `INSERT INTO transactions (txn_date, type, category, amount, description, payment_method, ref_type, ref_id, created_by)
       VALUES (?, 'income', 'ค่าเข้าพักรายวัน', ?, ?, ?, 'stay', ?, ?)`,
    )
      .bind(
        checkin,
        paid,
        `ค่าเข้าพักห้อง ${check.room!.room_number} ${guestName} (${nights} คืน)`,
        method,
        stayId,
        c.get('user').userId,
      )
      .run()
  }
  return c.json({ id: stayId }, 201)
})

stays.patch('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const row = await c.env.DB.prepare(`${SELECT_JOIN} WHERE st.id = ?`).bind(id).first<StayRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 400)
  if (row.status === 'cancelled') return c.json({ error: 'รายการนี้ถูกยกเลิกแล้ว' }, 400)
  const merged = {
    guestName: body.guestName !== undefined ? s(body.guestName) : row.guest_name,
    guestPhone: body.guestPhone !== undefined ? optS(body.guestPhone) : row.guest_phone,
    guestCount: body.guestCount !== undefined ? Math.max(1, Math.trunc(n(body.guestCount))) : row.guest_count,
    checkinDate: body.checkinDate !== undefined ? s(body.checkinDate) : row.checkin_date,
    nights: body.nights !== undefined ? Math.trunc(n(body.nights)) : row.nights,
    dailyRate: body.dailyRate !== undefined ? n(body.dailyRate) : row.daily_rate,
    deposit: body.deposit !== undefined ? n(body.deposit) : row.deposit,
    note: body.note !== undefined ? optS(body.note) : row.note,
  }
  if (!merged.guestName) return c.json({ error: 'กรุณากรอกชื่อผู้เข้าพัก' }, 400)
  if (!isValidDate(merged.checkinDate)) return c.json({ error: 'วันที่เข้าพักไม่ถูกต้อง' }, 400)
  if (merged.nights < 1) return c.json({ error: 'จำนวนคืนต้องไม่น้อยกว่า 1' }, 400)
  const total = merged.nights * merged.dailyRate
  await c.env.DB.prepare(
    `UPDATE stays SET guest_name = ?, guest_phone = ?, guest_count = ?, checkin_date = ?, nights = ?, daily_rate = ?, total_amount = ?, deposit = ?, note = ? WHERE id = ?`,
  )
    .bind(
      merged.guestName,
      merged.guestPhone,
      merged.guestCount,
      merged.checkinDate,
      merged.nights,
      merged.dailyRate,
      total,
      merged.deposit,
      merged.note,
      id,
    )
    .run()
  return c.json({ ok: true })
})

// POST /api/stays/:id/checkout { checkoutDate }
stays.post('/:id/checkout', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const checkout = s(body.checkoutDate)
  if (!isValidDate(checkout)) return c.json({ error: 'วันที่ออกไม่ถูกต้อง' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM stays WHERE id = ?').bind(id).first<StayRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 400)
  if (row.status !== 'active') return c.json({ error: 'รายการนี้ปิดแล้ว' }, 400)
  if (checkout < row.checkin_date) return c.json({ error: 'วันที่ออกต้องไม่ก่อนวันเข้าพัก' }, 400)
  const nights = Math.max(row.nights, Math.round((Date.parse(checkout) - Date.parse(row.checkin_date)) / 86400000))
  await c.env.DB.prepare(`UPDATE stays SET status = 'checked_out', checkout_date = ?, nights = ?, total_amount = nights * daily_rate WHERE id = ?`)
    .bind(checkout, nights, id)
    .run()
  return c.json({ ok: true })
})

// POST /api/stays/:id/payment { amount, paidDate?, paymentMethod? }
stays.post('/:id/payment', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const amount = n(body.amount)
  const paidDate = s(body.paidDate)
  const method = body.paymentMethod === 'transfer' ? 'transfer' : 'cash'
  if (amount <= 0) return c.json({ error: 'จำนวนเงินต้องมากกว่า 0' }, 400)
  if (paidDate && !isValidDate(paidDate)) return c.json({ error: 'วันที่ไม่ถูกต้อง' }, 400)
  const row = await c.env.DB.prepare(`${SELECT_JOIN} WHERE st.id = ?`).bind(id).first<StayRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 400)
  if (row.status === 'cancelled') return c.json({ error: 'รายการนี้ถูกยกเลิกแล้ว' }, 400)
  await c.env.DB.prepare('UPDATE stays SET paid_amount = paid_amount + ?, payment_method = ? WHERE id = ?')
    .bind(amount, method, id)
    .run()
  await c.env.DB.prepare(
    `INSERT INTO transactions (txn_date, type, category, amount, description, payment_method, ref_type, ref_id, created_by)
     VALUES (?, 'income', 'ค่าเข้าพักรายวัน', ?, ?, ?, 'stay', ?, ?)`,
  )
    .bind(
      paidDate || row.checkin_date,
      amount,
      `รับชำระค่าเข้าพักห้อง ${row.room_number} ${row.guest_name}`,
      method,
      id,
      c.get('user').userId,
    )
    .run()
  return c.json({ ok: true })
})

// POST /api/stays/:id/cancel
stays.post('/:id/cancel', async (c) => {
  const id = n(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM stays WHERE id = ?').bind(id).first<StayRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 400)
  if (row.status !== 'active') return c.json({ error: 'ยกเลิกได้เฉพาะรายการที่ยังเข้าพักอยู่' }, 400)
  const batch = [
    c.env.DB.prepare(`UPDATE stays SET status = 'cancelled' WHERE id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM transactions WHERE ref_type = 'stay' AND ref_id = ?`).bind(id),
  ]
  await c.env.DB.batch(batch)
  return c.json({ ok: true })
})

export default stays
