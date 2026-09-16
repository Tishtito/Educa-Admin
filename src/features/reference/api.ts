import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { AcademicYear, Grade, Level, SchoolClass, Stream } from '@/lib/api/types'

/** Lookup lists change rarely; keep them fresh for a few minutes. */
const STALE = 5 * 60_000

export const referenceKeys = {
  levels: ['reference', 'levels'] as const,
  grades: ['reference', 'grades'] as const,
  academicYears: ['reference', 'academic-years'] as const,
  streams: ['reference', 'streams'] as const,
  classes: (filters: { level_id?: number; grade_id?: number; active?: boolean } = {}) =>
    ['reference', 'classes', filters] as const,
}

export function useLevels() {
  return useQuery({
    queryKey: referenceKeys.levels,
    queryFn: ({ signal }) => api.get<Level[]>('/levels', { signal }),
    staleTime: STALE,
  })
}

export function useGrades() {
  return useQuery({
    queryKey: referenceKeys.grades,
    queryFn: ({ signal }) => api.get<Grade[]>('/grades', { signal }),
    staleTime: STALE,
  })
}

export function useAcademicYears() {
  return useQuery({
    queryKey: referenceKeys.academicYears,
    queryFn: ({ signal }) => api.get<AcademicYear[]>('/academic-years', { signal }),
    staleTime: STALE,
  })
}

export function useCurrentAcademicYear() {
  const years = useAcademicYears()
  const current = years.data?.find((year) => year.is_current) ?? years.data?.[0] ?? null
  return { ...years, current }
}

export function useStreams() {
  return useQuery({
    queryKey: referenceKeys.streams,
    queryFn: ({ signal }) => api.get<Stream[]>('/streams', { signal }),
    staleTime: STALE,
  })
}

export function useClasses(filters: { level_id?: number; grade_id?: number; active?: boolean } = {}) {
  return useQuery({
    queryKey: referenceKeys.classes(filters),
    queryFn: ({ signal }) => api.get<SchoolClass[]>('/classes', { query: filters, signal }),
    staleTime: STALE,
  })
}
