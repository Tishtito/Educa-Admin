import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { PermissionGroup, RoleSummary } from '@/lib/api/types'
import type { Permission } from '@/lib/permissions'

export const roleKeys = {
  roles: ['roles'] as const,
  permissions: ['roles', 'permissions'] as const,
}

/** Staff-portal duties an administrator does not hold but may still give (RoleService). */
export const PORTAL_ONLY: Permission[] = ['access_staff_portal', 'view_class_pupils', 'admit_class_pupils', 'move_class_pupils']

export function useRoles(enabled = true) {
  return useQuery({ queryKey: roleKeys.roles, queryFn: ({ signal }) => api.get<RoleSummary[]>('/roles', { signal }), enabled })
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: roleKeys.permissions,
    queryFn: ({ signal }) => api.get<PermissionGroup[]>('/permissions', { signal }),
    staleTime: Infinity,
  })
}

export function useRoleMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: roleKeys.roles })
    // Staff lists show role names and what people may do.
    void queryClient.invalidateQueries({ queryKey: ['people'] })
  }
  const silent = { silent: true } as const

  return {
    create: useMutation({
      mutationFn: (input: { name: string; description?: string | null; permissions?: Permission[] }) => api.post<RoleSummary>('/roles', input),
      meta: silent,
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; description?: string | null }) => api.patch<RoleSummary>(`/roles/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    setPermissions: useMutation({
      mutationFn: ({ id, permissions }: { id: number; permissions: Permission[] }) => api.put<RoleSummary>(`/roles/${id}/permissions`, { permissions }),
      meta: silent,
      onSuccess: refresh,
    }),
    reset: useMutation({ mutationFn: (id: number) => api.post<RoleSummary>(`/roles/${id}/reset`), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: number) => api.delete(`/roles/${id}`), onSuccess: refresh }),
  }
}
