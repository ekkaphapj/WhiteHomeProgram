export function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function optS(v: unknown): string | null {
  const t = s(v)
  return t === '' ? null : t
}

export function n(v: unknown): number {
  const num = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(num) ? num : 0
}

export function posN(v: unknown): number | null {
  const num = n(v)
  return num > 0 ? num : null
}
