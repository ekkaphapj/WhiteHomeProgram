import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s, optS, n, posN } from '../validate'
import { isValidDate } from '../dates'

const tenants = new Hono<AppEnv>()

interface TenantRow {
  id: number
  room_id: number
  name: string
  phone: string | null
  id_card: string | null
  address: string | null
  contract_start: string
  contract_end: string | null
  monthly_rent: number
  deposit: number
  status: 'active' | 'ended'
  note: string | null
  room_number: string
}

function mapTenant(r: TenantRow) {
  return {
    id: r.id,
    roomId: r.room_id,
    roomNumber: r.room_number,
    name: r.name,
    phone: r.phone,
    idCard: r.id_card,
    address: r.address,
    contractStart: r.contract_start,
    contractEnd: r.contract_end,
    monthlyRent: r.monthly_rent,
    deposit: r.deposit,
    status: r.status,
    note: r.note,
  }
}

// GET /api/tenants?status=active|ended|all
tenants.get('/', async (c) => {
  const status = s(c.req.query('status')) || 'active'
  const where = status === 'all' ? '' : 'WHERE t.status = ?'
  const stmt = c.env.DB.prepare(
    `SELECT t.*, r.room_number FROM tenants t JOIN rooms r ON r.id = t.room_id ${where} ORDER BY r.floor, LENGTH(r.room_number), r.room_number`,
  )
  const { results } = status === 'all' ? await stmt.all<TenantRow>() : await stmt.bind(status).all<TenantRow>()
  return c.json(results.map(mapTenant))
})

tenants.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const roomId = posN(body.roomId)
  const name = s(body.name)
  const contractStart = s(body.contractStart)
  const rent = n(body.monthlyRent)
  if (!roomId) return c.json({ error: 'กรุณาเลือกห้อง' }, 400)
  if (!name) return c.json({ error: 'กรุณากรอกชื่อผู้เช่า' }, 400)
  if (!isValidDate(contractStart)) return c.json({ error: 'วันเริ่มสัญญาไม่ถูกต้อง' }, 400)
  if (rent <= 0) return c.json({ error: 'กรุณากรอกค่าเช่ารายเดือน' }, 400)
  if (body.contractEnd && !isValidDate(s(body.contractEnd)))
    return c.json({ error: 'วันสิ้นสุดสัญญาไม่ถูกต้อง' }, 400)

  const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first<{
    room_number: string
    room_type: 'daily' | 'monthly' | 'both'
    maintenance: number
  }>()
  if (!room) return c.json({ error: 'ไม่พบห้องนี้' }, 400)
  if (room.maintenance) return c.json({ error: `ห้อง ${room.room_number} อยู่ระหว่างซ่อมบำรุง` }, 400)
  if (room.room_type === 'daily') return c.json({ error: `ห้อง ${room.room_number} เป็นห้องรายวันเท่านั้น` }, 400)
  const occupied = await c.env.DB.prepare(`SELECT id FROM tenants WHERE room_id = ? AND status = 'active'`)
    .bind(roomId)
    .first()
  if (occupied) return c.json({ error: `ห้อง ${room.room_number} มีผู้เช่าอยู่แล้ว` }, 400)

  const res = await c.env.DB.prepare(
    `INSERT INTO tenants (room_id, name, phone, id_card, address, contract_start, contract_end, monthly_rent, deposit, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  )
    .bind(roomId, name, optS(body.phone), optS(body.idCard), optS(body.address), contractStart, optS(body.contractEnd), rent, n(body.deposit), optS(body.note))
    .run()
  return c.json({ id: Number(res.meta.last_row_id) }, 201)
})

tenants.patch('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const row = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first<TenantRow>()
  if (!row) return c.json({ error: 'ไม่พบผู้เช่า' }, 404)
  const merged = {
    name: body.name !== undefined ? s(body.name) : row.name,
    phone: body.phone !== undefined ? optS(body.phone) : row.phone,
    idCard: body.idCard !== undefined ? optS(body.idCard) : row.id_card,
    address: body.address !== undefined ? optS(body.address) : row.address,
    contractStart: body.contractStart !== undefined ? s(body.contractStart) : row.contract_start,
    contractEnd: body.contractEnd !== undefined ? optS(body.contractEnd) : row.contract_end,
    monthlyRent: body.monthlyRent !== undefined ? n(body.monthlyRent) : row.monthly_rent,
    deposit: body.deposit !== undefined ? n(body.deposit) : row.deposit,
    note: body.note !== undefined ? optS(body.note) : row.note,
  }
  if (!merged.name) return c.json({ error: 'กรุณากรอกชื่อผู้เช่า' }, 400)
  if (!isValidDate(merged.contractStart)) return c.json({ error: 'วันเริ่มสัญญาไม่ถูกต้อง' }, 400)
  if (merged.monthlyRent <= 0) return c.json({ error: 'ค่าเช่าต้องมากกว่า 0' }, 400)
  await c.env.DB.prepare(
    `UPDATE tenants SET name = ?, phone = ?, id_card = ?, address = ?, contract_start = ?, contract_end = ?, monthly_rent = ?, deposit = ?, note = ? WHERE id = ?`,
  )
    .bind(merged.name, merged.phone, merged.idCard, merged.address, merged.contractStart, merged.contractEnd, merged.monthlyRent, merged.deposit, merged.note, id)
    .run()
  return c.json({ ok: true })
})

// POST /api/tenants/:id/end { endDate }
tenants.post('/:id/end', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const endDate = s(body.endDate)
  if (!isValidDate(endDate)) return c.json({ error: 'วันสิ้นสุดสัญญาไม่ถูกต้อง' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first<TenantRow>()
  if (!row) return c.json({ error: 'ไม่พบผู้เช่า' }, 404)
  if (row.status !== 'active') return c.json({ error: 'สัญญานี้ปิดไปแล้ว' }, 400)
  await c.env.DB.prepare(`UPDATE tenants SET status = 'ended', contract_end = ? WHERE id = ?`).bind(endDate, id).run()
  return c.json({ ok: true })
})

export default tenants
