import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestBlob } from '@/lib/api/client'
import type { ReportCardSettings, ReportLayout, ReportTemplate, SchoolProfile } from '@/lib/api/types'

export const settingsKeys = {
  reportCard: ['settings', 'report-card'] as const,
}

export function useReportCardSettings() {
  return useQuery({
    queryKey: settingsKeys.reportCard,
    queryFn: ({ signal }) => api.get<ReportCardSettings>('/school/report-card-settings', { signal }),
  })
}

export function useSaveReportCardSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { head_teacher_name: string | null; footer: string | null; template: ReportTemplate }) =>
      api.put<ReportCardSettings>('/school/report-card-settings', input),
    onSuccess: (data) => queryClient.setQueryData(settingsKeys.reportCard, data),
  })
}

/**
 * A sample report card in one template, as a PDF: a made-up pupil under the
 * school's own name and logo. A blob because the endpoint needs the bearer
 * token, so it cannot be a plain link.
 */
export function fetchReportTemplatePreview(template: ReportTemplate, layout: ReportLayout = 'term') {
  return requestBlob(`/school/report-card-templates/${template}/preview`, { query: { layout } })
}

// ------------------------------------------------------------- profile

export const profileKeys = {
  profile: ['settings', 'profile'] as const,
  logo: ['settings', 'logo'] as const,
}

export function useSchoolProfile() {
  return useQuery({ queryKey: profileKeys.profile, queryFn: ({ signal }) => api.get<SchoolProfile>('/school/profile', { signal }) })
}

/** The logo as an object URL: the image needs the bearer token, so an <img src> to the API cannot load it. */
export function useSchoolLogo(enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.logo,
    queryFn: async ({ signal }) => URL.createObjectURL((await requestBlob('/school/logo', { signal })).blob),
    enabled,
    staleTime: Infinity,
  })
}

export function useProfileMutations() {
  const queryClient = useQueryClient()
  const refresh = (profile: SchoolProfile) => {
    queryClient.setQueryData(profileKeys.profile, profile)
    void queryClient.invalidateQueries({ queryKey: profileKeys.logo })
    // The school's name shows in the header; reload the signed-in user.
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return {
    update: useMutation({
      mutationFn: (input: Partial<Omit<SchoolProfile, 'uuid' | 'slug' | 'has_logo' | 'status'>>) => api.patch<SchoolProfile>('/school/profile', input),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    uploadLogo: useMutation({
      mutationFn: (file: File) => {
        const body = new FormData()
        body.append('logo', file)
        return api.post<SchoolProfile>('/school/logo', body)
      },
      meta: { silent: true },
      onSuccess: refresh,
    }),
    removeLogo: useMutation({ mutationFn: () => api.delete<SchoolProfile>('/school/logo'), onSuccess: refresh }),
  }
}
