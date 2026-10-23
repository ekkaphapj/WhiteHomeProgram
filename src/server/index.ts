import { Hono } from 'hono'
import type { AppEnv } from './env'
import { requireAuth } from './auth'
import authRoutes from './routes/auth'
import roomsRoutes from './routes/rooms'
import staysRoutes from './routes/stays'
import tenantsRoutes from './routes/tenants'
import rentRoutes from './routes/rent'
import transactionsRoutes from './routes/transactions'
import reportsRoutes from './routes/reports'
import auditRoutes from './routes/audit'

const app = new Hono<AppEnv>()

app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.path}:`, err)
  return c.json({ error: err.message || 'เกิดข้อผิดพลาดในระบบ' }, 500)
})

app.route('/api/auth', authRoutes)
app.use('/api/*', requireAuth)
app.route('/api/rooms', roomsRoutes)
app.route('/api/stays', staysRoutes)
app.route('/api/tenants', tenantsRoutes)
app.route('/api/rent', rentRoutes)
app.route('/api/transactions', transactionsRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/audit', auditRoutes)

// SPA fallback: everything that is not /api/* and not a static asset
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
