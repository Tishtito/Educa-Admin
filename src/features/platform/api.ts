import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { PlatformSchool, QueueHealth } from '@/lib/api/types'

export const platformKeys = {
  schools: (search?: string) => ['platform', 'schools', search ?? ''] as const,
  queueHealth: ['platform', 'queue-health'] as const,
}

export function usePlatformSchools(search?: string, enabled = true) {
  return useQuery({
    queryKey: platformKeys.schools(search),
    queryFn: ({ signal }) => api.get<PlatformSchool[]>('/platform/schools', { query: { search }, signal }),
    enabled,
  })
}

export function useQueueHealth() {
  return useQuery({
    queryKey: platformKeys.queueHealth,
    queryFn: ({ signal }) => api.get<QueueHealth>('/platform/queue-health', { signal }),
    refetchInterval: 30_000,
  })
}

export interface CreateSchoolInput {
  name: string
  slug?: string
  short_name?: string | null
  county?: string | null
  phone?: string | null
  email?: string | null
  status?: 'onboarding' | 'active'
  admin: { name: string; username: string; email?: string | null; phone?: string | null; send_invitation?: boolean }
}

export interface CreatedSchool {
  school: PlatformSchool
  admin_username: string
  /** Null when the administrator was invited by email instead. */
  temporary_password: string | null
  invitation_sent_to: string | null
}

export function usePlatformSchoolMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] })

  return {
    create: useMutation({
      mutationFn: (input: CreateSchoolInput) =>
        api.post<CreatedSchool>('/platform/schools', input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ uuid, ...input }: Partial<Omit<PlatformSchool, 'uuid' | 'slug'>> & { uuid: string }) =>
        api.patch<PlatformSchool>(`/platform/schools/${uuid}`, input),
      onSuccess: refresh,
    }),
  }
}
