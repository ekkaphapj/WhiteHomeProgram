import type { AuthUser, CloudflareEnv } from './types'

export type AppEnv = {
  Bindings: CloudflareEnv
  Variables: { user: AuthUser }
}
