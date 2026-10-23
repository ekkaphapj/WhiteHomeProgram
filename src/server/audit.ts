import type { CloudflareEnv } from './types'

export interface AuditEntry {
  entityType: 'transaction'
  entityId: number
  action: 'edit' | 'delete'
  label: string
  changes?: Record<string, { from: unknown; to: unknown }>
  snapshot?: unknown
  userId: number | null
}

export async function logAudit(env: CloudflareEnv, entry: AuditEntry) {
  await env.DB.prepare(
    `INSERT INTO audit_log (entity_type, entity_id, action, label, changes, snapshot, performed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.label,
      entry.changes ? JSON.stringify(entry.changes) : null,
      entry.snapshot !== undefined ? JSON.stringify(entry.snapshot) : null,
      entry.userId,
    )
    .run()
}
