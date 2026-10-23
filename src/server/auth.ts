import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import type { Context, MiddlewareHandler } from 'hono'
import type { AuthUser, CloudflareEnv } from './types'

const COOKIE_NAME = 'wh_session'
const SESSION_DAYS = 30

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256)
  return `pbkdf2$${toB64Url(salt)}$${toB64Url(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64Url(saltB64), iterations: 100_000 },
    key,
    256,
  )
  const a = toB64Url(new Uint8Array(bits))
  const b = hashB64
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionToken(env: CloudflareEnv, user: AuthUser): Promise<string> {
  const payload = {
    sub: user.userId,
    username: user.username,
    name: user.displayName,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
  }
  return sign(payload, env.JWT_SECRET, 'HS256')
}

export function setSessionCookie<E extends { Bindings: CloudflareEnv }>(c: Context<E>, token: string) {
  // Browsers reject Secure cookies over plain HTTP, so only set the flag on https
  // (Cloudflare production is always https; local dev runs on http).
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

export function getSessionUser<E extends { Bindings: CloudflareEnv }>(c: Context<E>): Promise<AuthUser | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return Promise.resolve(null)
  return verify(token, c.env.JWT_SECRET, 'HS256')
    .then((p) => ({
      userId: Number(p.sub),
      username: String(p.username),
      displayName: String(p.name),
      role: p.role as AuthUser['role'],
    }))
    .catch(() => null)
}

/** Require a valid session for API routes. Sets the `user` variable. */
export const requireAuth: MiddlewareHandler<{
  Bindings: CloudflareEnv
  Variables: { user: AuthUser }
}> = async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401)
  c.set('user', user)
  await next()
}

export const requireAdmin: MiddlewareHandler<{
  Bindings: CloudflareEnv
  Variables: { user: AuthUser }
}> = async (c, next) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') return c.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, 403)
  await next()
}
