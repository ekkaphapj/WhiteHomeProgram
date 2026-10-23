export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('wh:unauthorized'))
    throw new ApiError('หมดเวลาเข้าใช้งาน กรุณาเข้าสู่ระบบใหม่', 401)
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? 'เกิดข้อผิดพลาด', res.status)
  return data as T
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'
}

// ---------- shared API types ----------

export interface AuthStatus {
  needsSetup: boolean
  authenticated: boolean
  user: { userId: number; username: string; displayName: string; role: 'admin' | 'staff' } | null
}

export interface Room {
  id: number
  roomNumber: string
  floor: string | null
  roomType: 'daily' | 'monthly' | 'both'
  maintenance: boolean
  dailyRate: number | null
  monthlyRate: number | null
  note: string | null
  status: 'vacant' | 'occupied' | 'maintenance'
  occupant: { kind: 'daily' | 'monthly'; name: string; until: string | null; refId: number | null } | null
}

export type PaymentMethod = 'cash' | 'transfer'

export interface Stay {
  id: number
  roomId: number
  roomNumber: string
  guestName: string
  guestPhone: string | null
  guestCount: number
  checkinDate: string
  checkoutDate: string | null
  nights: number
  dailyRate: number
  totalAmount: number
  deposit: number
  paidAmount: number
  status: 'active' | 'checked_out' | 'cancelled'
  note: string | null
  createdByName: string | null
  paymentMethod: PaymentMethod
}

export interface Tenant {
  id: number
  roomId: number
  roomNumber: string
  name: string
  phone: string | null
  idCard: string | null
  address: string | null
  contractStart: string
  contractEnd: string | null
  monthlyRent: number
  deposit: number
  status: 'active' | 'ended'
  note: string | null
}

export interface RentBill {
  id: number
  tenantId: number
  period: string
  rentAmount: number
  waterAmount: number
  electricAmount: number
  otherAmount: number
  totalAmount: number
  paidDate: string | null
  status: 'unpaid' | 'paid'
  note: string | null
  paymentMethod: PaymentMethod
  waterUnits: number | null
  electricUnits: number | null
  waterMeterPrev: string | null
  waterMeterCurr: string | null
  electricMeterPrev: string | null
  electricMeterCurr: string | null
  tenantName: string
  collectedByName: string | null
  roomNumber: string
  roomId: number
}

export interface Txn {
  id: number
  txnDate: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string | null
  paymentMethod: PaymentMethod
  refType: 'stay' | 'rent_payment' | null
  refId: number | null
  createdByName: string | null
}

export interface TxnList {
  items: Txn[]
  totals: { income: number; expense: number; profit: number }
  cashBalance: number
}

export interface AuditEntry {
  id: number
  entityType: 'transaction'
  entityId: number
  action: 'edit' | 'delete'
  label: string | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  snapshot: {
    txnDate?: string
    type?: 'income' | 'expense'
    category?: string
    amount?: number
    description?: string | null
    paymentMethod?: PaymentMethod
    createdByName?: string | null
  } | null
  performedByName: string | null
  performedAt: string
}

export interface DashboardData {
  date: string
  period: string
  cashBalance: number
  today: { checkins: number; checkouts: number; staying: number; income: number }
  month: { income: number; expense: number; profit: number; unpaidBills: number; unpaidAmount: number }
  rooms: { total: number; occupied: number; vacant: number; maintenance: number }
  chart: { month: string; income: number; expense: number }[]
}

export interface MonthlyReport {
  period: string
  totals: { income: number; expense: number; profit: number }
  byMethod: { incomeCash: number; incomeTransfer: number; expenseCash: number; expenseTransfer: number }
  incomeByCategory: { category: string; total: number }[]
  expenseByCategory: { category: string; total: number }[]
  daily: { d: string; income: number; expense: number }[]
  stays: { groups: number; nights: number }
  rentBillsPaid: number
}

export interface AppUser {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'staff'
  isActive: number
  createdAt: string
}
