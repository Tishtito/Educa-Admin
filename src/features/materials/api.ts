import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestBlob, requestPage, uploadWithProgress } from '@/lib/api/client'
import type { MaterialStatus, MaterialSummaryLevel, TeachingMaterial } from '@/lib/api/types'
import { openBlob, saveBlob } from '@/lib/download'
import { opensInline } from './model'

export interface MaterialFilters {
  level_id?: number
  grade_id?: number
  level_subject_id?: number
  status?: MaterialStatus
  q?: string
  deleted?: boolean
  page?: number
}

export interface MaterialInput {
  title?: string
  description?: string | null
  level_id: number
  grade_ids: number[]
  level_subject_id: number | null
  status: MaterialStatus
}

export type Duplicate = { id: number; title: string } | null

export const materialKeys = {
  all: ['materials'] as const,
  list: (filters: MaterialFilters) => ['materials', 'list', filters] as const,
  summary: ['materials', 'summary'] as const,
}

export function useMaterials(filters: MaterialFilters) {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: ({ signal }) => requestPage<TeachingMaterial>('/teaching-materials', { query: { ...filters, per_page: 50 }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useMaterialSummary() {
  return useQuery({
    queryKey: materialKeys.summary,
    queryFn: ({ signal }) => api.get<{ levels: MaterialSummaryLevel[] }>('/teaching-materials/summary', { signal }),
  })
}

function formFor(file: File, input?: MaterialInput): FormData {
  const body = new FormData()
  body.append('file', file)
  if (!input) return body
  if (input.title) body.append('title', input.title)
  if (input.description) body.append('description', input.description)
  body.append('level_id', String(input.level_id))
  input.grade_ids.forEach((id) => body.append('grade_ids[]', String(id)))
  if (input.level_subject_id) body.append('level_subject_id', String(input.level_subject_id))
  body.append('status', input.status)
  return body
}

export function useMaterialMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: materialKeys.all })

  return {
    /** One file. Progress 0..1. Resolves with the material and any earlier copy of the same file. */
    upload: (file: File, input: MaterialInput, onProgress?: (fraction: number) => void) =>
      uploadWithProgress<TeachingMaterial, { duplicate_of: Duplicate }>('/teaching-materials', formFor(file, input), { onProgress }).finally(refresh),

    replace: useMutation({
      mutationFn: ({ id, file }: { id: number; file: File }) =>
        uploadWithProgress<TeachingMaterial, { duplicate_of: Duplicate }>(`/teaching-materials/${id}/file`, formFor(file)),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<MaterialInput> & { id: number }) => api.patch<TeachingMaterial>(`/teaching-materials/${id}`, input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: number; status: MaterialStatus }) => api.patch<TeachingMaterial>(`/teaching-materials/${id}`, { status }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: number) => api.delete<void>(`/teaching-materials/${id}`), onSuccess: refresh }),
    restore: useMutation({ mutationFn: (id: number) => api.post<TeachingMaterial>(`/teaching-materials/${id}/restore`), onSuccess: refresh }),
  }
}

/** Open (PDF, image) or save (Office) a material's file. Needs the bearer token, so it is fetched, not linked. */
export async function openMaterial(material: TeachingMaterial): Promise<void> {
  const { blob, filename } = await requestBlob(`/teaching-materials/${material.id}/download`)
  const name = filename ?? `${material.title}.${material.extension}`
  await (opensInline(material.extension) ? openBlob(blob, name) : saveBlob(blob, name))
}
