import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type {
  AcademicYear,
  AggregationRule,
  ExamSetup,
  GradeBand,
  GradingScale,
  LevelSubject,
  SchoolClass,
  Stream,
  Subject,
  Term,
} from '@/lib/api/types'
import { examKeys } from '@/features/exams/api'
import { referenceKeys } from '@/features/reference/api'

export const setupKeys = {
  subjects: ['setup', 'subjects'] as const,
  levelSubjects: ['setup', 'level-subjects'] as const,
  gradingScales: ['setup', 'grading-scales'] as const,
  classesWithCounts: ['reference', 'classes', 'with-counts'] as const,
  examSetup: (examId: number) => ['exams', 'setup', examId] as const,
}

/** Every mutation here is a form that shows its own errors. */
const silent = { silent: true } as const

// -------------------------------------------------------------- calendar

export interface YearInput {
  name: string
  starts_on: string
  ends_on: string
  make_current?: boolean
  terms?: { term_number: number; name: string; starts_on?: string | null; ends_on?: string | null; feeding_fee?: number | null }[]
}

export function useCalendarMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: referenceKeys.academicYears })
    void queryClient.invalidateQueries({ queryKey: ['exams'] })
  }

  return {
    createYear: useMutation({ mutationFn: (input: YearInput) => api.post<AcademicYear>('/academic-years', input), meta: silent, onSuccess: refresh }),
    updateYear: useMutation({
      mutationFn: ({ id, ...input }: Partial<YearInput> & { id: number }) => api.patch<AcademicYear>(`/academic-years/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    makeYearCurrent: useMutation({ mutationFn: (id: number) => api.post<AcademicYear>(`/academic-years/${id}/make-current`), onSuccess: refresh }),
    deleteYear: useMutation({ mutationFn: (id: number) => api.delete(`/academic-years/${id}`), onSuccess: refresh }),
    createTerm: useMutation({
      mutationFn: (input: Omit<Term, 'id' | 'is_current' | 'academic_year'>) => api.post<Term>('/terms', input),
      meta: silent,
      onSuccess: refresh,
    }),
    updateTerm: useMutation({
      mutationFn: ({ id, ...input }: Partial<Pick<Term, 'name' | 'starts_on' | 'ends_on' | 'feeding_fee'>> & { id: number }) =>
        api.patch<Term>(`/terms/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    makeTermCurrent: useMutation({ mutationFn: (id: number) => api.post<Term>(`/terms/${id}/make-current`), onSuccess: refresh }),
  }
}

// ------------------------------------------------------ streams + classes

export function useClassesWithCounts() {
  return useQuery({
    queryKey: setupKeys.classesWithCounts,
    queryFn: ({ signal }) => api.get<SchoolClass[]>('/classes', { query: { with_counts: true }, signal }),
  })
}

export interface ClassInput {
  grade_id: number
  stream_id: number | null
  name?: string | null
  capacity?: number | null
  is_active?: boolean
}

export function useClassMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['reference', 'classes'] })
    void queryClient.invalidateQueries({ queryKey: referenceKeys.streams })
  }

  return {
    createStream: useMutation({
      mutationFn: (input: { name: string; code?: string | null }) => api.post<Stream>('/streams', input),
      meta: silent,
      onSuccess: refresh,
    }),
    updateStream: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; code?: string | null }) => api.patch<Stream>(`/streams/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    deleteStream: useMutation({ mutationFn: (id: number) => api.delete(`/streams/${id}`), onSuccess: refresh }),
    createClass: useMutation({ mutationFn: (input: ClassInput) => api.post<SchoolClass>('/classes', input), meta: silent, onSuccess: refresh }),
    updateClass: useMutation({
      mutationFn: ({ id, ...input }: Partial<ClassInput> & { id: number }) => api.patch<SchoolClass>(`/classes/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    deleteClass: useMutation({ mutationFn: (id: number) => api.delete(`/classes/${id}`), onSuccess: refresh }),
  }
}

// ------------------------------------------------------------ curriculum

export function useSubjects() {
  return useQuery({ queryKey: setupKeys.subjects, queryFn: ({ signal }) => api.get<Subject[]>('/subjects', { signal }) })
}

export function useLevelSubjects() {
  return useQuery({ queryKey: setupKeys.levelSubjects, queryFn: ({ signal }) => api.get<LevelSubject[]>('/level-subjects', { signal }) })
}

export interface PaperInput {
  id?: number
  name: string
  code?: string | null
  default_max_marks?: number | null
  weight?: number | null
}

export interface LevelSubjectInput {
  level_id: number
  subject_id: number
  aggregation_rule: AggregationRule
  scale_max?: number
  counts_toward_total?: boolean
  grading_scale_id?: number | null
  display_order?: number
  is_active?: boolean
  papers: PaperInput[]
}

export function useCurriculumMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: setupKeys.subjects })
    void queryClient.invalidateQueries({ queryKey: setupKeys.levelSubjects })
  }

  return {
    createSubject: useMutation({
      mutationFn: (input: { code: string; name: string; short_name?: string | null }) => api.post<Subject>('/subjects', input),
      meta: silent,
      onSuccess: refresh,
    }),
    updateSubject: useMutation({
      mutationFn: ({ id, ...input }: { id: number; code?: string; name?: string; short_name?: string | null; is_active?: boolean }) =>
        api.patch<Subject>(`/subjects/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    deleteSubject: useMutation({ mutationFn: (id: number) => api.delete(`/subjects/${id}`), onSuccess: refresh }),
    createLevelSubject: useMutation({
      mutationFn: (input: LevelSubjectInput) => api.post<LevelSubject>('/level-subjects', input),
      meta: silent,
      onSuccess: refresh,
    }),
    updateLevelSubject: useMutation({
      mutationFn: ({ id, ...input }: Partial<Omit<LevelSubjectInput, 'level_id' | 'subject_id'>> & { id: number }) =>
        api.patch<LevelSubject>(`/level-subjects/${id}`, input),
      meta: silent,
      onSuccess: () => {
        refresh()
        void queryClient.invalidateQueries({ queryKey: ['exams'] })
      },
    }),
    deleteLevelSubject: useMutation({ mutationFn: (id: number) => api.delete(`/level-subjects/${id}`), onSuccess: refresh }),
  }
}

// --------------------------------------------------------------- grading

export function useGradingScales() {
  return useQuery({ queryKey: setupKeys.gradingScales, queryFn: ({ signal }) => api.get<GradingScale[]>('/grading-scales', { signal }) })
}

export interface ScaleInput {
  name: string
  kind?: GradingScale['kind']
  level_id?: number | null
  is_default?: boolean
  bands: GradeBand[]
}

export function useGradingMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: setupKeys.gradingScales })
    // Grading changes recompute live exams.
    void queryClient.invalidateQueries({ queryKey: ['exams'] })
  }

  return {
    createScale: useMutation({ mutationFn: (input: ScaleInput) => api.post<GradingScale>('/grading-scales', input), meta: silent, onSuccess: refresh }),
    renameScale: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; kind?: GradingScale['kind'] }) => api.patch<GradingScale>(`/grading-scales/${id}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    replaceBands: useMutation({
      mutationFn: ({ id, bands }: { id: number; bands: GradeBand[] }) => api.put<GradingScale>(`/grading-scales/${id}/bands`, { bands }),
      meta: silent,
      onSuccess: refresh,
    }),
    makeDefault: useMutation({ mutationFn: (id: number) => api.post<GradingScale>(`/grading-scales/${id}/make-default`), onSuccess: refresh }),
    deleteScale: useMutation({ mutationFn: (id: number) => api.delete(`/grading-scales/${id}`), onSuccess: refresh }),
  }
}

// ------------------------------------------------------------ exam set-up

export function useExamSetup(examId: number) {
  return useQuery({
    queryKey: setupKeys.examSetup(examId),
    queryFn: ({ signal }) => api.get<ExamSetup>(`/exams/${examId}/setup`, { signal }),
  })
}

export function useExamSetupMutations(examId: number) {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) })
    void queryClient.invalidateQueries({ queryKey: setupKeys.examSetup(examId) })
    void queryClient.invalidateQueries({ queryKey: ['exams', 'list'] })
  }

  return {
    updateExam: useMutation({
      mutationFn: (input: Record<string, unknown>) => api.patch(`/exams/${examId}`, input),
      meta: silent,
      onSuccess: refresh,
    }),
    chooseSubjects: useMutation({
      mutationFn: (levelSubjectIds: number[]) => api.put<ExamSetup>(`/exams/${examId}/subjects`, { level_subject_ids: levelSubjectIds }),
      meta: silent,
      onSuccess: (data) => {
        queryClient.setQueryData(setupKeys.examSetup(examId), data)
      },
    }),
    deleteExam: useMutation({
      mutationFn: () => api.delete(`/exams/${examId}`),
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: examKeys.detail(examId) })
        void queryClient.invalidateQueries({ queryKey: ['exams', 'list'] })
      },
    }),
  }
}
