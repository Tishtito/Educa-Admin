import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestBlob, requestEnvelope, requestPage } from '@/lib/api/client'
import type {
  ComputeSummary,
  Exam,
  ExamStatus,
  ExamType,
  MarkInput,
  Marklist,
  Marksheet,
  MarkingOverview,
  MeanPolicy,
  ReportCard,
  ReportCardBatch,
  ReportEntries,
  ReportLayout,
  SaveMarksResult,
  TiePolicy,
} from '@/lib/api/types'

export interface ExamFilters {
  academic_year_id?: number
  term_id?: number
  level_id?: number
  status?: ExamStatus
  include_archived?: boolean
  page?: number
  per_page?: number
}

export const examKeys = {
  all: ['exams'] as const,
  list: (filters: ExamFilters) => ['exams', 'list', filters] as const,
  detail: (id: number) => ['exams', 'detail', id] as const,
  /** Everything derived from one exam's marks: sheets, mark lists, cards. */
  results: (id: number) => ['exams', 'results', id] as const,
  marking: (id: number) => ['exams', 'results', id, 'marking'] as const,
  marksheet: (id: number, classId: number, levelSubjectId: number) =>
    ['exams', 'results', id, 'marksheet', classId, levelSubjectId] as const,
  marklist: (id: number, classId: number) => ['exams', 'results', id, 'marklist', classId] as const,
  reportCards: (id: number, classId: number, layout: ReportLayout) =>
    ['exams', 'results', id, 'report-cards', classId, layout] as const,
  reportEntries: (id: number, classId: number) => ['exams', 'results', id, 'report-entries', classId] as const,
  batch: (batchId: number) => ['report-card-batches', batchId] as const,
}

/** Statuses in which results are computed and may be recalculating in the background. */
const COMPUTING_STATUSES: ExamStatus[] = ['marking', 'locked']

// ---------------------------------------------------------------- exams

export function useExams(filters: ExamFilters = {}) {
  return useQuery({
    queryKey: examKeys.list(filters),
    queryFn: ({ signal }) => requestPage<Exam>('/exams', { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useExam(examId: number) {
  return useQuery({
    queryKey: examKeys.detail(examId),
    queryFn: ({ signal }) => api.get<Exam>(`/exams/${examId}`, { signal }),
    // After a marks save the results queue recomputes; poll until it has.
    refetchInterval: (query) => {
      const exam = query.state.data
      return exam && !exam.results_up_to_date && COMPUTING_STATUSES.includes(exam.status) ? 4000 : false
    },
  })
}

export interface CreateExamInput {
  academic_year_id: number
  term_id: number | null
  level_id: number | null
  name: string
  exam_type: ExamType
  sequence?: number
  starts_on: string | null
  ends_on: string | null
  mean_policy?: MeanPolicy
  tie_policy?: Exclude<TiePolicy, 'legacy_ordinal'>
  class_ids: number[]
}

export function useCreateExam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateExamInput) => api.post<Exam>('/exams', input),
    meta: { silent: true },
    onSuccess: (exam) => {
      queryClient.setQueryData(examKeys.detail(exam.id), exam)
      void queryClient.invalidateQueries({ queryKey: ['exams', 'list'] })
    },
  })
}

export function useTransitionExam(examId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: ExamStatus) => api.post<Exam>(`/exams/${examId}/transition`, { status }),
    onSuccess: async () => {
      // The transition response does not load classes; refetch the full record.
      await queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) })
      void queryClient.invalidateQueries({ queryKey: ['exams', 'list'] })
      void queryClient.invalidateQueries({ queryKey: examKeys.results(examId) })
    },
  })
}

export function useComputeExam(examId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<ComputeSummary>(`/exams/${examId}/compute`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) })
      void queryClient.invalidateQueries({ queryKey: examKeys.results(examId) })
    },
  })
}

// -------------------------------------------------------------- marking

export function useMarking(examId: number) {
  return useQuery({
    queryKey: examKeys.marking(examId),
    queryFn: ({ signal }) => api.get<MarkingOverview>(`/exams/${examId}/marking`, { signal }),
  })
}

export function useMarksheet(examId: number, classId: number, levelSubjectId: number) {
  return useQuery({
    queryKey: examKeys.marksheet(examId, classId, levelSubjectId),
    queryFn: ({ signal }) =>
      api.get<Marksheet>(`/exams/${examId}/marksheet`, {
        query: { class_id: classId, level_subject_id: levelSubjectId },
        signal,
      }),
    // Never refetch a sheet under someone who is typing marks into it.
    refetchOnWindowFocus: false,
  })
}

export function useSaveMarksheet(examId: number, classId: number, levelSubjectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (marks: MarkInput[]) =>
      requestEnvelope<SaveMarksResult>('PUT', `/exams/${examId}/marksheet`, {
        body: { class_id: classId, level_subject_id: levelSubjectId, marks },
      }),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) })
      void queryClient.invalidateQueries({ queryKey: examKeys.results(examId) })
    },
  })
}

export interface SetMaxMarksInput {
  subject_paper_id: number
  class_id: number | null
  max_marks: number
  apply_to_existing?: boolean
}

export function useSetMaxMarks(examId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetMaxMarksInput) =>
      api.put<{ max_marks: number; updated_marks: number }>(`/exams/${examId}/max-marks`, input),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) })
      void queryClient.invalidateQueries({ queryKey: examKeys.results(examId) })
    },
  })
}

// ------------------------------------------------------------- marklist

export function useMarklist(examId: number, classId: number | null) {
  return useQuery({
    queryKey: examKeys.marklist(examId, classId ?? 0),
    queryFn: ({ signal }) => api.get<Marklist>(`/exams/${examId}/marklist`, { query: { class_id: classId }, signal }),
    enabled: classId !== null,
  })
}

// --------------------------------------------------------- report cards

export function useReportCards(examId: number, classId: number | null, layout: ReportLayout, enabled = true) {
  return useQuery({
    queryKey: examKeys.reportCards(examId, classId ?? 0, layout),
    queryFn: ({ signal }) =>
      api.get<ReportCard[]>(`/exams/${examId}/report-cards`, { query: { class_id: classId, layout }, signal }),
    enabled: enabled && classId !== null,
  })
}

export function useReportEntries(examId: number, classId: number | null) {
  return useQuery({
    queryKey: examKeys.reportEntries(examId, classId ?? 0),
    queryFn: ({ signal }) =>
      api.get<ReportEntries>(`/exams/${examId}/report-entries`, { query: { class_id: classId }, signal }),
    enabled: classId !== null,
    refetchOnWindowFocus: false,
  })
}

export interface ReportEntryInput {
  enrolment_id: number
  class_teacher_remarks: string | null
  fee_balance: number | null
}

export function useSaveReportEntries(examId: number, classId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: ReportEntryInput[]) =>
      api.put<{ saved: number }>(`/exams/${examId}/report-entries`, { class_id: classId, entries }),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: examKeys.reportEntries(examId, classId) })
      void queryClient.invalidateQueries({ queryKey: ['exams', 'results', examId, 'report-cards', classId] })
    },
  })
}

export function downloadReportCardPdf(examId: number, enrolmentId: number, layout: ReportLayout) {
  return requestBlob(`/exams/${examId}/report-cards/${enrolmentId}/pdf`, { query: { layout } })
}

export function useCreateReportBatch(examId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { class_id: number; layout: ReportLayout }) =>
      api.post<ReportCardBatch>(`/exams/${examId}/report-card-batches`, input),
    onSuccess: (batch) => queryClient.setQueryData(examKeys.batch(batch.id), batch),
  })
}

export function useReportBatch(batchId: number | null) {
  return useQuery({
    queryKey: examKeys.batch(batchId ?? 0),
    queryFn: ({ signal }) => api.get<ReportCardBatch>(`/report-card-batches/${batchId}`, { signal }),
    enabled: batchId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 2500
    },
  })
}

export function downloadReportBatch(batchId: number) {
  return requestBlob(`/report-card-batches/${batchId}/download`)
}
