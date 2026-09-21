import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestEnvelope } from '@/lib/api/client'
import type { SubscriptionPayment, SubscriptionState } from '@/lib/api/types'

export interface BillingOverview {
  subscription: SubscriptionState
  paybill: { business_number: string | null; account_number: string }
  /** False until Educa has set up M-Pesa on the server. */
  mpesa_available: boolean
  payments: SubscriptionPayment[]
}

export const billingKeys = {
  // Separate branches: refreshing the overview must not also invalidate the
  // payment being polled, which would refetch it, settle it, refresh the
  // overview again — a loop that locks the page up mid-payment.
  overview: ['billing', 'overview'] as const,
  payment: (id: number) => ['billing', 'payment', id] as const,
}

export function useBilling() {
  return useQuery({
    queryKey: billingKeys.overview,
    queryFn: ({ signal }) => api.get<BillingOverview>('/billing', { signal }),
  })
}

/** Sends the M-Pesa PIN prompt; resolves with the pending payment and the API's instruction. */
export function useStartMpesaPayment() {
  return useMutation({
    mutationFn: (phone: string) => requestEnvelope<SubscriptionPayment>('POST', '/billing/stk', { body: { phone } }),
    meta: { silent: true },
  })
}

/** Watches one payment every 3 seconds until M-Pesa settles it. */
export function usePaymentStatus(id: number | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: billingKeys.payment(id ?? 0),
    queryFn: async ({ signal }) => {
      const payment = await api.get<SubscriptionPayment & { subscription: SubscriptionState }>(`/billing/payments/${id}`, { signal })
      // Settled: the status card, amount due and payment list are all stale now.
      if (payment.status !== 'pending') void queryClient.invalidateQueries({ queryKey: billingKeys.overview, exact: true })
      return payment
    },
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'pending' ? false : 3000),
  })
}

// --------------------------------------------------------------- platform

export interface PlatformSubscriptionRow {
  school: { uuid: string; name: string; slug: string; status: string }
  subscription: SubscriptionState
}

export interface SubscriptionHistoryEntry {
  id: number
  action: 'terms' | 'paid_until' | 'manual_payment' | 'assign_payment'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string
  by: string | null
  created_at: string
}

export interface PlatformPayment extends SubscriptionPayment {
  school: { uuid: string; name: string; slug: string } | null
  account_reference: string | null
  payer_name: string | null
}

export function usePlatformSubscriptions(filter = '') {
  return useQuery({
    queryKey: ['platform', 'subscriptions', filter],
    queryFn: ({ signal }) => api.get<PlatformSubscriptionRow[]>('/platform/subscriptions', { query: { filter: filter || undefined }, signal }),
  })
}

export function useSchoolSubscription(uuid: string | null) {
  return useQuery({
    queryKey: ['platform', 'subscription', uuid],
    queryFn: ({ signal }) =>
      api.get<{ subscription: SubscriptionState; history: SubscriptionHistoryEntry[] }>(`/platform/schools/${uuid}/subscription`, { signal }),
    enabled: uuid !== null,
  })
}

export function usePlatformPayments(filters: { status?: string; school?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['platform', 'payments', filters],
    queryFn: ({ signal }) =>
      api.get<{ totals: { received_kes: number; unmatched_count: number }; payments: PlatformPayment[] }>('/platform/payments', {
        query: { status: filters.status || undefined, school: filters.school || undefined, from: filters.from || undefined, to: filters.to || undefined },
        signal,
      }),
  })
}

export function usePlatformBillingMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['platform'] })

  return {
    updateSubscription: useMutation({
      mutationFn: ({ uuid, ...input }: { uuid: string; cycle_months?: number; price_kes?: number | null; paid_until?: string; is_trial?: boolean; reason: string }) =>
        api.patch(`/platform/schools/${uuid}/subscription`, input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    recordPayment: useMutation({
      mutationFn: ({ uuid, ...input }: { uuid: string; amount_kes: number; reference: string; paid_at?: string; reason: string }) =>
        api.post(`/platform/schools/${uuid}/subscription/payments`, input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    assignPayment: useMutation({
      mutationFn: ({ id, ...input }: { id: number; school_uuid: string; reason: string }) => api.post(`/platform/payments/${id}/assign`, input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
  }
}

export const formatKes = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `KES ${value.toLocaleString('en-KE')}`)
