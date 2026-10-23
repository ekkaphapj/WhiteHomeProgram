import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { s, optS, n } from '../validate'
import { isValidDate, isValidPeriod } from '../dates'
import { logAudit } from '../audit'

const transactions = new Hono<AppEnv>()

interface TxnRow {
  id: number
  txn_date: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string | null
  payment_method: 'cash' | 'transfer'
  ref_type: 'stay' | 'rent_payment' | null
  ref_id: number | null
  created_by: number | null
  created_by_name: string | null
}

function mapTxn(r: TxnRow) {
  return {
    id: r.id,
    txnDate: r.txn_date,
    type: r.type,
    category: r.category,
    amount: r.amount,
    description: r.description,
    paymentMethod: r.payment_method,
    refType: r.ref_type,
    refId: r.ref_id,
    createdByName: r.created_by_name,
  }
}

function parseMethod(v: unknown): 'cash' | 'transfer' {
  return v === 'transfer' ? 'transfer' : 'cash'
}

// GET /api/transactions?month=YYYY-MM&type=income|expense
transactions.get('/', async (c) => {
  const month = s(c.req.query('month'))
  const type = s(c.req.query('type'))
  if (!isValidPeriod(month)) return c.json({ error: 'เดือน (month) ไม่ถูกต้อง' }, 400)
  const clauses = ['t.txn_date LIKE ?']
  const values: unknown[] = [`${month}%`]
  if (type === 'income' || type === 'expense') {
    clauses.push('t.type = ?')
    values.push(type)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.display_name AS created_by_name FROM transactions t
     LEFT JOIN users u ON u.id = t.created_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY t.txn_date DESC, t.id DESC`,
  )
    .bind(...values)
    .all<TxnRow>()
  const totals = await c.env.DB.prepare(
    `SELECT type, SUM(amount) AS total, COUNT(*) AS cnt FROM transactions WHERE txn_date LIKE ? GROUP BY type`,
  )
    .bind(`${month}%`)
    .all<{ type: 'income' | 'expense'; total: number; cnt: number }>()
  const income = totals.results.find((r) => r.type === 'income')?.total ?? 0
  const expense = totals.results.find((r) => r.type === 'expense')?.total ?? 0
  // cash on hand from every cash movement ever recorded
  const cash = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS bal
     FROM transactions WHERE payment_method = 'cash'`,
  ).first<{ bal: number }>()
  return c.json({
    items: results.map(mapTxn),
    totals: { income, expense, profit: income - expense },
    cashBalance: cash?.bal ?? 0,
  })
})

transactions.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const txnDate = s(body.txnDate)
  const type = body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : null
  const category = s(body.category)
  const amount = n(body.amount)
  const method = parseMethod(body.paymentMethod)
  if (!isValidDate(txnDate)) return c.json({ error: 'วันที่ไม่ถูกต้อง' }, 400)
  if (!type) return c.json({ error: 'เลือกประเภทรายรับ/รายจ่าย' }, 400)
  if (!category) return c.json({ error: 'กรุณาระบุหมวดหมู่' }, 400)
  if (amount <= 0) return c.json({ error: 'จำนวนเงินต้องมากกว่า 0' }, 400)
  const res = await c.env.DB.prepare(
    `INSERT INTO transactions (txn_date, type, category, amount, description, payment_method, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(txnDate, type, category, amount, optS(body.description), method, c.get('user').userId)
    .run()
  return c.json({ id: Number(res.meta.last_row_id) }, 201)
})

transactions.patch('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const row = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first<TxnRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 404)
  if (row.ref_type) return c.json({ error: 'รายการนี้มาจากระบบเข้าพัก/ค่าเช่า แก้ไขที่ต้นทางแทน' }, 400)
  const merged = {
    txnDate: body.txnDate !== undefined ? s(body.txnDate) : row.txn_date,
    type: body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : row.type,
    category: body.category !== undefined ? s(body.category) : row.category,
    amount: body.amount !== undefined ? n(body.amount) : row.amount,
    description: body.description !== undefined ? optS(body.description) : row.description,
    paymentMethod: body.paymentMethod !== undefined ? parseMethod(body.paymentMethod) : row.payment_method,
  }
  if (!isValidDate(merged.txnDate)) return c.json({ error: 'วันที่ไม่ถูกต้อง' }, 400)
  if (!merged.category) return c.json({ error: 'กรุณาระบุหมวดหมู่' }, 400)
  if (merged.amount <= 0) return c.json({ error: 'จำนวนเงินต้องมากกว่า 0' }, 400)

  // record what changed, by whom
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  if (row.txn_date !== merged.txnDate) changes['วันที่'] = { from: row.txn_date, to: merged.txnDate }
  if (row.type !== merged.type) changes['ประเภท'] = { from: row.type === 'income' ? 'รายรับ' : 'รายจ่าย', to: merged.type === 'income' ? 'รายรับ' : 'รายจ่าย' }
  if (row.category !== merged.category) changes['หมวดหมู่'] = { from: row.category, to: merged.category }
  if (row.amount !== merged.amount) changes['จำนวนเงิน'] = { from: row.amount, to: merged.amount }
  if ((row.description ?? '') !== (merged.description ?? '')) changes['รายละเอียด'] = { from: row.description ?? '', to: merged.description ?? '' }
  if (row.payment_method !== merged.paymentMethod) changes['วิธีชำระ'] = { from: row.payment_method === 'cash' ? 'เงินสด' : 'โอน', to: merged.paymentMethod === 'cash' ? 'เงินสด' : 'โอน' }

  await c.env.DB.prepare(`UPDATE transactions SET txn_date = ?, type = ?, category = ?, amount = ?, description = ?, payment_method = ? WHERE id = ?`)
    .bind(merged.txnDate, merged.type, merged.category, merged.amount, merged.description, merged.paymentMethod, id)
    .run()
  if (Object.keys(changes).length > 0) {
    await logAudit(c.env, {
      entityType: 'transaction',
      entityId: id,
      action: 'edit',
      label: `${merged.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${merged.category} ฿${merged.amount}`,
      changes,
      userId: c.get('user').userId,
    })
  }
  return c.json({ ok: true })
})

transactions.delete('/:id', async (c) => {
  const id = n(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first<TxnRow>()
  if (!row) return c.json({ error: 'ไม่พบรายการ' }, 404)
  if (row.ref_type) return c.json({ error: 'รายการนี้มาจากระบบเข้าพัก/ค่าเช่า ลบที่ต้นทางแทน' }, 400)
  await logAudit(c.env, {
    entityType: 'transaction',
    entityId: id,
    action: 'delete',
    label: `${row.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${row.category} ฿${row.amount}`,
    snapshot: {
      txnDate: row.txn_date,
      type: row.type,
      category: row.category,
      amount: row.amount,
      description: row.description,
      paymentMethod: row.payment_method,
      createdByName: row.created_by_name,
    },
    userId: c.get('user').userId,
  })
  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default transactions
