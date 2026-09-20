import { createContext } from 'react'
import type { ActingSchool } from '@/lib/api/session'
import type { LoginResponse, User } from '@/lib/api/types'
import { clientPlatform, describeDevice } from '@/lib/device'
import type { Permission } from '@/lib/permissions'


/** Which app a session belongs to, on the signed-in devices list. */
export const APP_ID = 'admin'

/** What this device says about itself when it signs in (the API records it on the session). */
export const deviceFields = () => ({ device_name: describeDevice(), app: APP_ID, platform: clientPlatform() })

export type AuthStatus = 'loading' | 'guest' | 'authenticated' | 'offline'

export interface LoginInput {
  /** Username or email address. There is no school code: both are unique platform-wide. */
  identity: string
  password: string
}

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** For superadmins: the school chosen with the switcher. For everyone else: their own school. */
  school: { slug: string; name: string } | null
  isPlatformAdmin: boolean
  mustChangePassword: boolean
  /** Whether the user holds ANY of these permissions (the API's `can:`). Prefer this to role checks. */
  can: (...permissions: Permission[]) => boolean
  login: (input: LoginInput) => Promise<User>
  /** Signs in with an ID token from Google. The API finds the account; it never creates one. */
  loginWithGoogle: (idToken: string) => Promise<User>
  /** Adopts a token from an invitation or password reset. Throws NotAnAdminError for staff-only accounts. */
  signInWithToken: (result: LoginResponse) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  changePassword: (input: { current_password: string; password: string; password_confirmation: string }) => Promise<void>
  actAsSchool: (school: ActingSchool | null) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export class NotAnAdminError extends Error {
  constructor() {
    super('Your account cannot use Educa Admin. Class teachers and examiners should use the Educa staff portal.')
    this.name = 'NotAnAdminError'
  }
}

