import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestEnvelope } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import type { LoginResponse, RoleSlug } from '@/lib/api/types'
import { deviceFields } from '@/auth/context'

export type AccountLinkKind = 'invitation' | 'reset'

export interface AccountLinkDetails {
  name: string
  username: string
  school: { name: string; slug: string } | null
  expires_at: string
  email?: string
  roles?: RoleSlug[]
}

const paths: Record<AccountLinkKind, (token: string) => string> = {
  invitation: (token) => `/auth/invitations/${encodeURIComponent(token)}`,
  reset: (token) => `/auth/reset-password/${encodeURIComponent(token)}`,
}

/** Who an emailed link is for. A used, expired or replaced link fails with 410 and a reason. */
export function useAccountLink(kind: AccountLinkKind, token: string) {
  return useQuery({
    queryKey: ['auth', kind, token],
    queryFn: ({ signal }) => api.get<AccountLinkDetails>(paths[kind](token), { signal, raw: true }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function completeAccountLink(kind: AccountLinkKind, token: string, password: string, confirmation: string) {
  const path = kind === 'invitation' ? `${paths.invitation(token)}/accept` : paths.reset(token)
  return api.post<LoginResponse>(path, { password, password_confirmation: confirmation, ...deviceFields() }, { raw: true })
}

/** Accepts an invitation with the Google account for the invited address, instead of a password. */
export function acceptInvitationWithGoogle(token: string, idToken: string) {
  return api.post<LoginResponse>(`${paths.invitation(token)}/google`, { id_token: idToken, ...deviceFields() }, { raw: true })
}

export async function requestPasswordReset(input: { identity: string }): Promise<string> {
  const response = await requestEnvelope<null>('POST', '/auth/forgot-password', { body: input, raw: true })
  return response.message ?? 'If that account has an email address, a reset link is on its way.'
}

/** The API's reason a link cannot be used: invalid, expired, used or unavailable. */
export function linkUnavailableReason(error: unknown): string | null {
  return error instanceof ApiError && error.status === 410 ? ((error.body as { reason?: string } | null)?.reason ?? 'invalid') : null
}

// ------------------------------------------------------------- sessions

export interface SignedInSession {
  id: number
  device_name: string
  app: 'admin' | 'portal' | null
  platform: 'web' | 'android' | 'ios' | null
  sign_in_method: 'password' | 'google' | 'invitation' | 'reset' | null
  ip_address: string | null
  user_agent: string | null
  signed_in_at: string
  last_used_at: string | null
  expires_at: string | null
  is_current: boolean
}

const sessionsKey = ['auth', 'sessions'] as const

/** Where this account is signed in, this device first. */
export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: ({ signal }) => api.get<SignedInSession[]>('/auth/sessions', { signal }),
  })
}

export function useSessionMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: sessionsKey })

  return {
    signOutDevice: useMutation({ mutationFn: (id: number) => api.delete(`/auth/sessions/${id}`), onSuccess }),
    signOutOthers: useMutation({
      mutationFn: () => requestEnvelope<null>('DELETE', '/auth/sessions').then((r) => r.message ?? 'Signed out on your other devices.'),
      onSuccess,
    }),
  }
}

export function disconnectGoogle() {
  return api.delete('/auth/google')
}
