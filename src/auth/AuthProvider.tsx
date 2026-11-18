import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { session, type ActingSchool } from '@/lib/api/session'
import type { LoginResponse, User } from '@/lib/api/types'
import { AuthContext, deviceFields, NotAnAdminError, type AuthContextValue, type AuthStatus, type LoginInput } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [actingSchool, setActingSchool] = useState<ActingSchool | null>(null)

  const becomeGuest = useCallback(async () => {
    await session.clear()
    queryClient.clear()
    setUser(null)
    setActingSchool(null)
    setStatus('guest')
  }, [queryClient])

  const loadMe = useCallback(async () => {
    try {
      const me = await api.get<User>('/auth/me', { raw: true })
      if (!me.permissions.includes('access_admin_app')) {
        await becomeGuest()
        return
      }
      setUser(me)
      setStatus('authenticated')
    } catch (error) {
      if (error instanceof ApiError && error.isNetwork) {
        // Keep the token: the device is offline, not signed out.
        setStatus('offline')
        return
      }
      await becomeGuest()
    }
  }, [becomeGuest])

  // Restore a saved session on start-up.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const restored = await session.restore()
      if (cancelled) return
      setActingSchool(restored.actingSchool)
      if (restored.token) {
        await loadMe()
      } else {
        setStatus('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadMe])

  // Global reactions to API responses, raised by the client.
  useEffect(() => {
    const offUnauthorized = session.on('unauthorized', () => void becomeGuest())
    const offPassword = session.on('password-change-required', () =>
      setUser((current) => (current ? { ...current, must_change_password: true } : current)),
    )
    const offSubscription = session.on('subscription-required', () => void loadMe())
    return () => {
      offUnauthorized()
      offPassword()
      offSubscription()
    }
  }, [becomeGuest, loadMe])

  /** Adopts a token the API has just issued (sign-in, invitation, password reset). */
  const signInWithToken = useCallback<AuthContextValue['signInWithToken']>(
    async (result) => {
      if (!result.user.permissions.includes('access_admin_app')) {
        // Revoke the token we were just given rather than leave it live.
        await session.setToken(result.token)
        await api.post('/auth/logout', undefined, { raw: true }).catch(() => undefined)
        await session.clear()
        throw new NotAnAdminError()
      }

      queryClient.clear()
      await session.setToken(result.token)
      await session.setActingSchool(null)
      setActingSchool(null)
      setUser(result.user)
      setStatus('authenticated')
      return result.user
    },
    [queryClient],
  )

  const login = useCallback(
    async ({ identity, password }: LoginInput) => {
      const result = await api.post<LoginResponse>('/auth/login', { identity, password, ...deviceFields() }, { raw: true })
      return signInWithToken(result)
    },
    [signInWithToken],
  )

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const result = await api.post<LoginResponse>('/auth/google', { id_token: idToken, ...deviceFields() }, { raw: true })
      return signInWithToken(result)
    },
    [signInWithToken],
  )

  const logout = useCallback(async () => {
    // Revoke the session on the server — but never let a failed revoke keep
    // the user signed in on this device.
    await api.post('/auth/logout', undefined, { raw: true }).catch(() => undefined)
    await becomeGuest()
  }, [becomeGuest])

  const changePassword = useCallback<AuthContextValue['changePassword']>(
    async (input) => {
      await api.post('/auth/password', input, { raw: true })
      await loadMe()
    },
    [loadMe],
  )

  const actAsSchool = useCallback(
    async (school: ActingSchool | null) => {
      await session.setActingSchool(school)
      // Every cached response belongs to the previous school.
      queryClient.clear()
      setActingSchool(school)
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(() => {
    const isPlatformAdmin = user?.is_platform_admin ?? false
    return {
      status,
      user,
      school: isPlatformAdmin
        ? actingSchool && { slug: actingSchool.slug, name: actingSchool.name }
        : user?.school
          ? { slug: user.school.slug, name: user.school.name }
          : null,
      isPlatformAdmin,
      mustChangePassword: user?.must_change_password ?? false,
      can: (...permissions) => !!user && permissions.some((p) => user.permissions.includes(p)),
      login,
      loginWithGoogle,
      signInWithToken,
      logout,
      refresh: loadMe,
      changePassword,
      actAsSchool,
    }
  }, [status, user, actingSchool, login, loginWithGoogle, signInWithToken, logout, loadMe, changePassword, actAsSchool])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
