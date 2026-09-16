import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestPage } from '@/lib/api/client'
import type {
  ClassTeacherAssignment,
  ExaminerAssignment,
  ImportResult,
  PromotionPreview,
  PromotionResult,
  RoleSlug,
  StaffMember,
  Student,
  StudentResult,
  StudentStatus,
} from '@/lib/api/types'

export const peopleKeys = {
  staff: ['people', 'staff'] as const,
  classTeachers: (yearId: number | null) => ['people', 'class-teachers', yearId] as const,
  examiners: (yearId: number | null, classId: number | null) => ['people', 'examiners', yearId, classId] as const,
  students: (filters: StudentFilters) => ['people', 'students', filters] as const,
  student: (id: number) => ['people', 'student', id] as const,
  studentResults: (id: number) => ['people', 'student', id, 'results'] as const,
  promotion: (from: number | null, to: number | null) => ['people', 'promotion', from, to] as const,
}

const silent = { silent: true } as const

// ------------------------------------------------------------------ staff

export function useStaff() {
  return useQuery({ queryKey: peopleKeys.staff, queryFn: ({ signal }) => api.get<StaffMember[]>('/staff', { signal }) })
}

export interface StaffInput {
  name: string
  username: string
  email?: string | null
  phone?: string | null
  staff_no?: string | null
  tsc_no?: string | null
  roles: RoleSlug[]
  is_active?: boolean
  /** New accounts only: email a set-up link instead of issuing a temporary password. */
  send_invitation?: boolean
}

export function useStaffMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['people'] })

  return {
    create: useMutation({ mutationFn: (input: StaffInput) => api.post<StaffMember>('/staff', input), meta: silent, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<StaffInput> & { id: number }) => api.patch<StaffMember>(`/staff/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    resetPassword: useMutation({
      mutationFn: (id: number) => api.post<{ temporary_password: string; username: string }>(`/staff/${id}/reset-password`),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: number) => api.delete(`/staff/${id}`), onSuccess: refresh }),
    sendInvitation: useMutation({ mutationFn: (id: number) => api.post<StaffMember>(`/staff/${id}/invitation`), onSuccess: refresh }),
    cancelInvitation: useMutation({ mutationFn: (id: number) => api.delete<StaffMember>(`/staff/${id}/invitation`), onSuccess: refresh }),
  }
}

// ------------------------------------------------------------ assignments

export function useClassTeachers(yearId: number | null) {
  return useQuery({
    queryKey: peopleKeys.classTeachers(yearId),
    queryFn: ({ signal }) =>
      api.get<{ academic_year_id: number | null; assignments: ClassTeacherAssignment[] }>('/class-teacher-assignments', {
        query: { academic_year_id: yearId },
        signal,
      }),
    enabled: yearId !== null,
  })
}

export function useExaminers(yearId: number | null, classId: number | null) {
  return useQuery({
    queryKey: peopleKeys.examiners(yearId, classId),
    queryFn: ({ signal }) =>
      api.get<{ academic_year_id: number | null; assignments: ExaminerAssignment[] }>('/examiner-assignments', {
        query: { academic_year_id: yearId, class_id: classId },
        signal,
      }),
    enabled: yearId !== null && classId !== null,
  })
}

export function useAssignmentMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['people'] })

  return {
    setClassTeachers: useMutation({
      mutationFn: ({ classId, yearId, userIds }: { classId: number; yearId: number; userIds: number[] }) =>
        api.put(`/classes/${classId}/class-teachers`, { academic_year_id: yearId, user_ids: userIds }),
      onSuccess: refresh,
    }),
    setExaminers: useMutation({
      mutationFn: ({ classId, yearId, subjects }: { classId: number; yearId: number; subjects: { level_subject_id: number; user_ids: number[] }[] }) =>
        api.put(`/classes/${classId}/examiners`, { academic_year_id: yearId, subjects }),
      meta: silent,
      onSuccess: refresh,
    }),
    copyYear: useMutation({
      mutationFn: (input: { from_year_id: number; to_year_id: number }) =>
        api.post<{ class_teachers: number; examiners: number }>('/assignments/copy-year', input),
      onSuccess: refresh,
    }),
  }
}

// --------------------------------------------------------------- students

export interface StudentFilters {
  search?: string
  status?: StudentStatus
  class_id?: number
  academic_year_id?: number
  unenrolled?: boolean
  page?: number
  per_page?: number
}

export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: peopleKeys.students(filters),
    queryFn: ({ signal }) => requestPage<Student>('/students', { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useStudent(id: number) {
  return useQuery({ queryKey: peopleKeys.student(id), queryFn: ({ signal }) => api.get<Student>(`/students/${id}`, { signal }) })
}

export function useStudentResults(id: number) {
  return useQuery({
    queryKey: peopleKeys.studentResults(id),
    queryFn: ({ signal }) => api.get<StudentResult[]>(`/students/${id}/results`, { signal }),
  })
}

export type StudentInput = Pick<Student, 'admission_no' | 'first_name' | 'last_name'> &
  Partial<Pick<Student, 'middle_name' | 'upi' | 'gender' | 'date_of_birth' | 'guardian_name' | 'guardian_phone'>> & {
    class_id?: number
    academic_year_id?: number
  }

export function useStudentMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['people'] })

  return {
    create: useMutation({ mutationFn: (input: StudentInput) => api.post<Student>('/students', input), meta: silent, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<StudentInput> & { id: number }) => api.patch<Student>(`/students/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    move: useMutation({
      mutationFn: ({ id, class_id, academic_year_id }: { id: number; class_id: number; academic_year_id?: number }) =>
        api.post<Student>(`/students/${id}/move`, { class_id, academic_year_id }),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status, ended_on }: { id: number; status: StudentStatus; ended_on?: string | null }) =>
        api.post<Student>(`/students/${id}/status`, { status, ended_on }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: number) => api.delete(`/students/${id}`), onSuccess: refresh }),
    importRows: useMutation({
      mutationFn: (input: { rows: Record<string, string>[]; dry_run: boolean; academic_year_id?: number }) =>
        api.post<ImportResult>('/students/import', input),
      onSuccess: (result) => {
        if (result.committed) refresh()
      },
    }),
  }
}

// -------------------------------------------------------------- promotion

export function usePromotionPreview(fromYearId: number | null, toYearId: number | null) {
  return useQuery({
    queryKey: peopleKeys.promotion(fromYearId, toYearId),
    queryFn: ({ signal }) =>
      api.get<PromotionPreview>('/promotions/preview', { query: { from_year_id: fromYearId, to_year_id: toYearId }, signal }),
    enabled: fromYearId !== null && toYearId !== null && fromYearId !== toYearId,
  })
}

export interface PromotionInput {
  from_year_id: number
  to_year_id: number
  dry_run: boolean
  mappings: { class_id: number; action: 'promote' | 'graduate' | 'skip'; target_class_id: number | null }[]
  excluded_student_ids: number[]
}

export function usePromote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PromotionInput) => api.post<PromotionResult>('/promotions', input),
    onSuccess: (result) => {
      if (!result.dry_run) void queryClient.invalidateQueries({ queryKey: ['people'] })
    },
  })
}
