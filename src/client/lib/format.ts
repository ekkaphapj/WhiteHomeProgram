const THAI_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })

export function fmtBaht(v: number | null | undefined): string {
  return `฿${baht.format(v ?? 0)}`
}

export function fmtNum(v: number | null | undefined): string {
  return int.format(v ?? 0)
}

/** UTC '2026-10-22 07:30:00' → '22 ต.ค. 2569 14:30 น.' (เวลาไทย UTC+7) */
export function fmtThaiDateTimeUtc(utc: string | null | undefined): string {
  if (!utc) return '-'
  const iso = utc.includes('T') ? utc : utc.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return utc
  const th = new Date(d.getTime() + 7 * 3600_000)
  const day = th.getUTCDate()
  const mon = THAI_MONTHS_ABBR[th.getUTCMonth()]
  const year = th.getUTCFullYear() + 543
  const hh = String(th.getUTCHours()).padStart(2, '0')
  const mm = String(th.getUTCMinutes()).padStart(2, '0')
  return `${day} ${mon} ${year} ${hh}:${mm} น.`
}

export const METHOD_LABEL: Record<string, string> = { cash: 'เงินสด', transfer: 'โอน' }

/** ค่าน้ำ/ค่าไฟ คิดหน่วยละ 8 บาท */
export const UTILITY_RATE = 8

/** '2026-09-30' → '30/09/2569' (แบบในใบวางบิล) */
export function fmtThaiDateSlash(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`
}

/** '2026-10-22' → '22 ต.ค. 2569' */export function fmtThaiDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${THAI_MONTHS_ABBR[m - 1]} ${y + 543}`
}

/** '2026-10-22' → '22 ตุลาคม 2569' */
export function fmtThaiDateFull(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${THAI_MONTHS_FULL[m - 1]} ${y + 543}`
}

/** '2026-10' → 'ตุลาคม 2569' */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return `${THAI_MONTHS_FULL[m - 1]} ${y + 543}`
}

/** '2026-10' → 'ต.ค. 69' (for chart axis) */
export function periodShort(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return `${THAI_MONTHS_ABBR[m - 1]} ${String(y + 543).slice(-2)}`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7)
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ROOM_TYPE_LABEL: Record<string, string> = {
  daily: 'รายวัน',
  monthly: 'รายเดือน',
  both: 'รายวัน+รายเดือน',
}

export const INCOME_CATEGORIES = ['ค่าเข้าพักรายวัน', 'ค่าเช่ารายเดือน', 'ค่าน้ำ', 'ค่าไฟ', 'อื่นๆ (ระบุ)']
export const EXPENSE_CATEGORIES = [
  'ค่าน้ำ-ค่าไฟ',
  'เงินเดือน',
  'ค่าซ่อมบำรุง',
  'ของใช้ในห้อง',
  'ค่าโฆษณา',
  'ค่าเน็ต/โทรศัพท์',
  'อื่นๆ (ระบุ)',
]
