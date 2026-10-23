// Minimal Cloudflare Workers type definitions (kept local to avoid
// conflicts between workers-types and DOM lib in the client code).
export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: { changes?: number; last_row_id?: number; duration?: number }
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  raw<T = unknown[]>(): Promise<T>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<unknown>
}

export interface AssetsFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface CloudflareEnv {
  DB: D1Database
  ASSETS: AssetsFetcher
  JWT_SECRET: string
}

export interface AuthUser {
  userId: number
  username: string
  displayName: string
  role: 'admin' | 'staff'
}

