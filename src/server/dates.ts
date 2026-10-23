const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function isValidPeriod(s: string): boolean {
  return PERIOD_RE.test(s)
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** [start, end) overlap against an existing interval with optional open end. */
export function overlaps(newStart: string, newEnd: string, existingStart: string, existingEnd: string | null): boolean {
  return existingStart < newEnd && (existingEnd === null || newStart < existingEnd)
}

export function periodOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function lastDayOfPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

/** List of n periods ending with `endPeriod` (inclusive), oldest first. */
export function monthsBack(endPeriod: string, count: number): string[] {
  const [y, m] = endPeriod.split('-').map(Number)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}
