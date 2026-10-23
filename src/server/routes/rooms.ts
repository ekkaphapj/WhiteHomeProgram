import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s, optS, n } from '../validate'

const rooms = new Hono<AppEnv>()

interface RoomRow {
  id: number
  room_number: string
  floor: string | null
  room_type: 'daily' | 'monthly' | 'both'
  maintenance: number
  daily_rate: number | null
  monthly_rate: number | null
  note: string | null
}

interface Occupant {
  roomId: number
  kind: 'daily' | 'monthly'
  name: string
  until: string | null
  refId: number | null
}

/** GET /api/rooms?on=YYYY-MM-DD — all rooms with live occupancy for the given date. */
rooms.get('/', async (c) => {
  const on = s(c.req.query('on'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM rooms ORDER BY floor, LENGTH(room_number), room_number',
  ).all<RoomRow>()

  const stays = await c.env.DB.prepare(
    `SELECT id, room_id, guest_name, checkout_date FROM stays
     WHERE status = 'active' AND checkin_date <= ?
       AND (checkout_date IS NULL OR checkout_date > ?)`,
  )
    .bind(on, on)
    .all<{ id: number; room_id: number; guest_name: string; checkout_date: string | null }>()

  const tenants = await c.env.DB.prepare(
    `SELECT id, room_id, name FROM tenants WHERE status = 'active' AND contract_start <= ?`,
  )
    .bind(on)
    .all<{ id: number; room_id: number; name: string }>()

  const byRoom = new Map<number, Occupant>()
  for (const t of tenants.results) byRoom.set(t.room_id, { roomId: t.room_id, kind: 'monthly', name: t.name, until: null, refId: t.id })
  for (const st of stays.results)
    byRoom.set(st.room_id, { roomId: st.room_id, kind: 'daily', name: st.guest_name, until: st.checkout_date, refId: st.id })

  const list = (results ?? []).map((r) => {
    const occ = byRoom.get(r.id) ?? null
    const status = r.maintenance ? 'maintenance' : occ ? 'occupied' : 'vacant'
    return {
      id: r.id,
      roomNumber: r.room_number,
      floor: r.floor,
      roomType: r.room_type,
      maintenance: !!r.maintenance,
      dailyRate: r.daily_rate,
      monthlyRate: r.monthly_rate,
      note: r.note,
      status,
      occupant: occ,
    }
  })
  return c.json(list)
})

function validateRoomBody(body: Record<string, unknown>) {
  const roomNumber = s(body.roomNumber)
  if (!roomNumber) return { error: 'กรุณากรอกเลขห้อง' as const }
  const roomType = ['daily', 'monthly', 'both'].includes(s(body.roomType)) ? s(body.roomType) : 'both'
  return {
    roomNumber,
    floor: optS(body.floor),
    roomType: roomType as 'daily' | 'monthly' | 'both',
    maintenance: body.maintenance === true || body.maintenance === 1 ? 1 : 0,
    dailyRate: body.dailyRate === null || body.dailyRate === '' ? null : n(body.dailyRate) || null,
    monthlyRate: body.monthlyRate === null || body.monthlyRate === '' ? null : n(body.monthlyRate) || null,
    note: optS(body.note),
  }
}

rooms.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const v = validateRoomBody(body)
  if ('error' in v) return c.json({ error: v.error }, 400)
  const dup = await c.env.DB.prepare('SELECT id FROM rooms WHERE room_number = ?').bind(v.roomNumber).first()
  if (dup) return c.json({ error: `ห้อง ${v.roomNumber} มีอยู่แล้ว` }, 400)
  const res = await c.env.DB.prepare(
    'INSERT INTO rooms (room_number, floor, room_type, maintenance, daily_rate, monthly_rate, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(v.roomNumber, v.floor, v.roomType, v.maintenance, v.dailyRate, v.monthlyRate, v.note)
    .run()
  return c.json({ id: Number(res.meta.last_row_id) }, 201)
})

// POST /api/rooms/bulk — add a range of numbered rooms at once
rooms.post('/bulk', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const from = Math.trunc(n(body.from))
  const to = Math.trunc(n(body.to))
  const prefix = s(body.prefix)
  if (!from || !to || to < from) return c.json({ error: 'ช่วงเลขห้องไม่ถูกต้อง' }, 400)
  if (to - from + 1 > 200) return c.json({ error: 'เพิ่มได้ครั้งละ 200 ห้อง' }, 400)
  const v = validateRoomBody({ ...body, roomNumber: `${prefix}${from}` })
  if ('error' in v) return c.json({ error: v.error }, 400)
  const stmt = c.env.DB.prepare(
    'INSERT OR IGNORE INTO rooms (room_number, floor, room_type, maintenance, daily_rate, monthly_rate, note) VALUES (?, ?, ?, 0, ?, ?, ?)',
  )
  const batch = []
  for (let i = from; i <= to; i++)
    batch.push(stmt.bind(`${prefix}${i}`, v.floor, v.roomType, v.dailyRate, v.monthlyRate, v.note))
  await c.env.DB.batch(batch)
  return c.json({ created: to - from + 1 }, 201)
})

rooms.patch('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>()
  if (!room) return c.json({ error: 'ไม่พบห้องนี้' }, 404)
  const merged = {
    roomNumber: body.roomNumber !== undefined ? body.roomNumber : room.room_number,
    floor: body.floor !== undefined ? body.floor : room.floor,
    roomType: body.roomType !== undefined ? body.roomType : room.room_type,
    maintenance: body.maintenance !== undefined ? body.maintenance : room.maintenance,
    dailyRate: body.dailyRate !== undefined ? body.dailyRate : room.daily_rate,
    monthlyRate: body.monthlyRate !== undefined ? body.monthlyRate : room.monthly_rate,
    note: body.note !== undefined ? body.note : room.note,
  }
  const v = validateRoomBody(merged)
  if ('error' in v) return c.json({ error: v.error }, 400)
  const dup = await c.env.DB.prepare('SELECT id FROM rooms WHERE room_number = ? AND id != ?')
    .bind(v.roomNumber, id)
    .first()
  if (dup) return c.json({ error: `ห้อง ${v.roomNumber} มีอยู่แล้ว` }, 400)
  await c.env.DB.prepare(
    'UPDATE rooms SET room_number = ?, floor = ?, room_type = ?, maintenance = ?, daily_rate = ?, monthly_rate = ?, note = ? WHERE id = ?',
  )
    .bind(v.roomNumber, v.floor, v.roomType, v.maintenance, v.dailyRate, v.monthlyRate, v.note, id)
    .run()
  return c.json({ ok: true })
})

rooms.delete('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const stay = await c.env.DB.prepare('SELECT id FROM stays WHERE room_id = ? LIMIT 1').bind(id).first()
  if (stay) return c.json({ error: 'ห้องนี้มีประวัติการเข้าพัก จึงลบไม่ได้ (ปรับเป็นซ่อมบำรุงแทนได้)' }, 400)
  const tenant = await c.env.DB.prepare('SELECT id FROM tenants WHERE room_id = ? LIMIT 1').bind(id).first()
  if (tenant) return c.json({ error: 'ห้องนี้มีประวัติผู้เช่า จึงลบไม่ได้' }, 400)
  await c.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default rooms
