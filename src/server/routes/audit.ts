import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { n } from '../validate'

const audit = new Hono<AppEnv>()

interface AuditRow {
  id: number
  entity_type: 'transaction'
  entity_id: number
  action: 'edit' | 'delete'
  label: string | null
  changes: string | null
  snapshot: string | null
  performed_by_name: string | null
  performed_at: string
}

function mapAudit(r: AuditRow) {
  return {
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    label: r.label,
    changes: r.changes ? JSON.parse(r.changes) : null,
    snapshot: r.snapshot ? JSON.parse(r.snapshot) : null,
    performedByName: r.performed_by_name,
    performedAt: r.performed_at,
  }
}

const SELECT = `SELECT a.*, u.display_name AS performed_by_name FROM audit_log a LEFT JOIN users u ON u.id = a.performed_by`

// GET /api/audit?limit=50 — recent edits/deletes (all entity types)
audit.get('/', async (c) => {
  const limit = Math.min(Math.max(Math.trunc(n(c.req.query('limit'))) || 50, 1), 200)
  const { results } = await c.env.DB.prepare(`${SELECT} ORDER BY a.id DESC LIMIT ?`).bind(limit).all<AuditRow>()
  return c.json(results.map(mapAudit))
})

// GET /api/audit/transaction/:id — history of one transaction
audit.get('/transaction/:id', async (c) => {
  const id = n(c.req.param('id'))
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE a.entity_type = 'transaction' AND a.entity_id = ? ORDER BY a.id DESC`)
    .bind(id)
    .all<AuditRow>()
  return c.json(results.map(mapAudit))
})

export default audit
