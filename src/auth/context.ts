import { createContext } from 'react'
import type { ActingSchool } from '@/lib/api/session'
import type { LoginResponse, RoleSlug, User } from '@/lib/api/types'

/** Roles allowed into the admin app. Class teachers and examiners use the staff portal. */
export const ADMIN_ROLES: RoleSlug[] = ['school_admin', 'super_admin']

/** The name this app's API tokens carry (visible to the API as the device). */
export const DEVICE_NAME = 'educa-admin'

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
  hasRole: (...roles: RoleSlug[]) => boolean
  login: (input: LoginInput) => Promise<User>
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
    super('This app is for school administrators. Class teachers and examiners should use the Educa staff portal.')
    this.name = 'NotAnAdminError'
  }
}

