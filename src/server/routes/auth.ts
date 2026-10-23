import { Hono } from 'hono'
import type { AppEnv } from '../env'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  requireAuth,
  requireAdmin,
} from '../auth'
import { s, optS, n } from '../validate'

const auth = new Hono<AppEnv>()

// ---------- session (public) ----------

auth.get('/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
  const needsSetup = (row?.n ?? 0) === 0
  const user = await getSessionUser(c)
  return c.json({ needsSetup, authenticated: !!user, user: user ?? null })
})

auth.post('/setup', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
  if ((row?.n ?? 0) > 0) return c.json({ error: 'ระบบตั้งค่าแล้ว กรุณาเข้าสู่ระบบ' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const displayName = s(body.displayName)
  const username = s(body.username).toLowerCase()
  const password = s(body.password)
  if (!displayName || !username || password.length < 6)
    return c.json({ error: 'กรุณากรอกชื่อ, ชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 6 ตัว' }, 400)
  const passwordHash = await hashPassword(password)
  const res = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
  )
    .bind(username, passwordHash, displayName, 'admin')
    .run()
  const user = { userId: Number(res.meta.last_row_id), username, displayName, role: 'admin' as const }
  setSessionCookie(c, await createSessionToken(c.env, user))
  return c.json({ user })
})

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const username = s(body.username).toLowerCase()
  const password = s(body.password)
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<{
    id: number
    username: string
    password_hash: string
    display_name: string
    role: 'admin' | 'staff'
    is_active: number
  }>()
  if (!row || !row.is_active || !(await verifyPassword(password, row.password_hash)))
    return c.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401)
  const user = { userId: row.id, username: row.username, displayName: row.display_name, role: row.role }
  setSessionCookie(c, await createSessionToken(c.env, user))
  return c.json({ user })
})

auth.post('/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

auth.get('/me', requireAuth, (c) => c.json(c.get('user')))

// ---------- user management (admin) ----------

auth.get('/users', requireAuth, requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, username, display_name AS displayName, role, is_active AS isActive, created_at AS createdAt FROM users ORDER BY id',
  ).all()
  return c.json(results)
})

auth.post('/users', requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const displayName = s(body.displayName)
  const username = s(body.username).toLowerCase()
  const password = s(body.password)
  const role = body.role === 'admin' ? 'admin' : 'staff'
  if (!displayName || !username || password.length < 6)
    return c.json({ error: 'กรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 6 ตัว' }, 400)
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (exists) return c.json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' }, 400)
  const passwordHash = await hashPassword(password)
  const res = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
  )
    .bind(username, passwordHash, displayName, role)
    .run()
  return c.json({ id: Number(res.meta.last_row_id) }, 201)
})

auth.patch('/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const target = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first()
  if (!target) return c.json({ error: 'ไม่พบผู้ใช้' }, 404)
  const updates: string[] = []
  const values: unknown[] = []
  if (typeof body.displayName === 'string' && s(body.displayName)) {
    updates.push('display_name = ?')
    values.push(s(body.displayName))
  }
  if (typeof body.password === 'string' && body.password.length >= 6) {
    updates.push('password_hash = ?')
    values.push(await hashPassword(body.password))
  }
  if (body.role === 'admin' || body.role === 'staff') {
    if (id === c.get('user').userId && body.role !== 'admin')
      return c.json({ error: 'ไม่สามารถลดสิทธิ์ตัวเองได้' }, 400)
    updates.push('role = ?')
    values.push(body.role)
  }
  if (typeof body.isActive === 'boolean') {
    if (id === c.get('user').userId && !body.isActive) return c.json({ error: 'ไม่สามารถปิดบัญชีตัวเองได้' }, 400)
    updates.push('is_active = ?')
    values.push(body.isActive ? 1 : 0)
  }
  if (!updates.length) return c.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, 400)
  values.push(id)
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  return c.json({ ok: true })
})

auth.delete('/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = n(c.req.param('id'))
  if (id === c.get('user').userId) return c.json({ error: 'ไม่สามารถลบบัญชีตัวเองได้' }, 400)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default auth
