import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requestEnvelope } from '@/lib/api/client'

// ------------------------------------------------------------------ types

export type PeriodKind = 'lesson' | 'break' | 'lunch'

export interface BellPeriod {
  sequence: number
  kind: PeriodKind
  label: string | null
  starts_at: string
  ends_at: string
}

export interface BellSchedule {
  id: number
  /** null: the school's default, for levels without their own. */
  level_id: number | null
  name: string
  days: number[]
  periods: BellPeriod[]
  lessons_per_day: number
}

export interface BellSchedulesResponse {
  levels: { id: number; code: string; name: string }[]
  schedules: BellSchedule[]
}

export interface RequirementRow {
  level_subject_id: number
  subject_name: string | null
  subject_code: string | null
  lessons_per_week: number
  max_per_day: number
  double_lessons: number
}

export interface GradeRequirements {
  academic_year_id: number
  grade: { id: number; name: string; level_id: number }
  /** Lesson periods in the grade's week, or null without a bell schedule. */
  periods_per_week: number | null
  lessons_per_week: number
  subjects: RequirementRow[]
}

export interface TeachingAssignment {
  id: number
  class_id: number
  class_name: string | null
  level_subject_id: number
  subject_name: string | null
  user_id: number
  user_name: string | null
  user_active: boolean
}

/** The level subjects one teacher can teach this year (they tick subjects; the generator picks their classes). */
export interface TeacherSubjects {
  user_id: number
  name: string
  is_active: boolean
  level_subject_ids: number[]
}

export interface SchoolSubject {
  level_subject_id: number
  level_id: number
  level_name: string | null
  level_code: string | null
  subject_name: string | null
  subject_code: string | null
  /** Active teachers who ticked it. */
  teachers_count: number
}

export interface TeacherSubjectsResponse {
  academic_year_id: number | null
  teachers: TeacherSubjects[]
  subjects: SchoolSubject[]
}

export type ReadinessFix = 'bell_schedules' | 'requirements' | 'teachers' | 'classes' | 'calendar'

export interface ReadinessIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  fix: ReadinessFix
  class_id?: number
  grade_id?: number
  user_id?: number
  level_subject_id?: number
}

export interface Readiness {
  ready: boolean
  issues: ReadinessIssue[]
  summary: { classes: number; lessons: number; teachers: number }
}

export type TimetableStatus = 'queued' | 'generating' | 'draft' | 'failed' | 'published' | 'archived'

export interface UnplacedLesson {
  class_id: number
  class_name: string
  subject_name: string
  /** null when no teacher could be given the class's subject at all. */
  teacher_name: string | null
  lessons: number
  reason: string
  message: string
}

export interface Timetable {
  id: number
  name: string
  status: TimetableStatus
  academic_year: { id: number; name: string | null }
  term: { id: number; name: string } | null
  seed: number
  source_timetable_id: number | null
  stats: { attempts: number; repairs: number; cost: number; lessons: number; milliseconds: number; classes?: number; teachers?: number; allocations?: number } | null
  diagnostics: { message?: string; unplaced?: UnplacedLesson[]; issues?: ReadinessIssue[] } | null
  generated_by: { id: number; name: string } | null
  lessons_count: number
  created_at: string | null
  started_at: string | null
  generated_at: string | null
  published_at: string | null
}

export interface TimetableDetail extends Timetable {
  classes: { id: number; name: string; grade_id: number }[]
  teachers: { id: number; name: string; lessons: number }[]
}

export interface Lesson {
  id: number
  class_id: number
  class_name: string | null
  level_subject_id: number
  subject_name: string | null
  subject_code: string | null
  user_id: number
  teacher_name: string | null
  day: number
  period_sequence: number
  starts_at: string
  ends_at: string
  is_locked: boolean
  double_group: number | null
}

export interface ClassWeek {
  timetable: Timetable
  class: { id: number; name: string }
  schedule: { days: number[]; periods: BellPeriod[] }
  lessons: Lesson[]
}

export interface TeacherWeek {
  timetable: Timetable
  teacher: { id: number; name: string }
  days: number[]
  lessons: Lesson[]
}

export interface MoveOption {
  day: number
  period_sequence: number
  starts_at: string
  ends_at: string
  occupant_id: number | null
  allowed: boolean
  reason: string | null
}

// ------------------------------------------------------------------ keys

export const timetableKeys = {
  all: ['timetable'] as const,
  bellSchedules: ['timetable', 'bell-schedules'] as const,
  requirements: (yearId: number | null, gradeId: number | null) => ['timetable', 'requirements', yearId, gradeId] as const,
  teaching: (yearId: number | null, classId: number | null) => ['timetable', 'teaching', yearId, classId] as const,
  teacherSubjects: (yearId: number | null) => ['timetable', 'teacher-subjects', yearId] as const,
  readiness: (yearId: number | null) => ['timetable', 'readiness', yearId] as const,
  list: (yearId: number | null) => ['timetable', 'list', yearId] as const,
  detail: (id: number) => ['timetable', 'detail', id] as const,
  classWeek: (id: number, classId: number) => ['timetable', 'detail', id, 'class', classId] as const,
  teacherWeek: (id: number, userId: number) => ['timetable', 'detail', id, 'teacher', userId] as const,
  options: (id: number, lessonId: number) => ['timetable', 'detail', id, 'options', lessonId] as const,
}

const silent = { silent: true } as const
const RUNNING: TimetableStatus[] = ['queued', 'generating']

export const isRunning = (status: TimetableStatus) => RUNNING.includes(status)

// --------------------------------------------------------------- queries

export function useBellSchedules() {
  return useQuery({
    queryKey: timetableKeys.bellSchedules,
    queryFn: ({ signal }) => api.get<BellSchedulesResponse>('/timetable/bell-schedules', { signal }),
  })
}

export function useGradeRequirements(yearId: number | null, gradeId: number | null) {
  return useQuery({
    queryKey: timetableKeys.requirements(yearId, gradeId),
    queryFn: ({ signal }) =>
      api.get<GradeRequirements | null>('/timetable/requirements', { query: { academic_year_id: yearId, grade_id: gradeId }, signal }),
    enabled: yearId !== null && gradeId !== null,
  })
}

export function useTeachingAssignments(yearId: number | null, classId: number | null = null) {
  return useQuery({
    queryKey: timetableKeys.teaching(yearId, classId),
    queryFn: ({ signal }) =>
      api.get<{ academic_year_id: number | null; assignments: TeachingAssignment[] }>('/teaching-assignments', {
        query: { academic_year_id: yearId, class_id: classId },
        signal,
      }),
    enabled: yearId !== null,
  })
}

export function useTeacherSubjects(yearId: number | null) {
  return useQuery({
    queryKey: timetableKeys.teacherSubjects(yearId),
    queryFn: ({ signal }) => api.get<TeacherSubjectsResponse>('/teacher-subjects', { query: { academic_year_id: yearId }, signal }),
    enabled: yearId !== null,
  })
}

export function useReadiness(yearId: number | null) {
  return useQuery({
    queryKey: timetableKeys.readiness(yearId),
    queryFn: ({ signal }) => api.get<Readiness>('/timetables/readiness', { query: { academic_year_id: yearId }, signal }),
    enabled: yearId !== null,
  })
}

export function useTimetables(yearId: number | null) {
  return useQuery({
    queryKey: timetableKeys.list(yearId),
    queryFn: ({ signal }) => api.get<Timetable[]>('/timetables', { query: { academic_year_id: yearId }, signal }),
    enabled: yearId !== null,
    // Generation runs on a worker: poll while one is in progress.
    refetchInterval: (query) => (query.state.data?.some((t) => isRunning(t.status)) ? 3000 : false),
  })
}

export function useTimetable(id: number | null) {
  return useQuery({
    queryKey: timetableKeys.detail(id ?? 0),
    queryFn: ({ signal }) => api.get<TimetableDetail>(`/timetables/${id}`, { signal }),
    enabled: id !== null,
  })
}

export function useClassWeek(id: number | null, classId: number | null) {
  return useQuery({
    queryKey: timetableKeys.classWeek(id ?? 0, classId ?? 0),
    queryFn: ({ signal }) => api.get<ClassWeek>(`/timetables/${id}/classes/${classId}`, { signal }),
    enabled: id !== null && classId !== null,
  })
}

export function useTeacherWeek(id: number | null, userId: number | null) {
  return useQuery({
    queryKey: timetableKeys.teacherWeek(id ?? 0, userId ?? 0),
    queryFn: ({ signal }) => api.get<TeacherWeek>(`/timetables/${id}/teachers/${userId}`, { signal }),
    enabled: id !== null && userId !== null,
  })
}

export function useMoveOptions(timetableId: number, lessonId: number | null) {
  return useQuery({
    queryKey: timetableKeys.options(timetableId, lessonId ?? 0),
    queryFn: ({ signal }) => api.get<MoveOption[]>(`/timetables/${timetableId}/lessons/${lessonId}/options`, { signal }),
    enabled: lessonId !== null,
  })
}

// ------------------------------------------------------------- mutations

export interface BellScheduleInput {
  level_id: number | null
  name: string
  days: number[]
  periods: { kind: PeriodKind; label?: string | null; starts_at: string; ends_at: string }[]
}

export interface GenerateInput {
  academic_year_id: number
  term_id?: number | null
  name?: string | null
  keep_locked_from?: number | null
}

export function useTimetableMutations() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: timetableKeys.all })

  return {
    saveBellSchedule: useMutation({ mutationFn: (input: BellScheduleInput) => api.put<BellSchedule>('/timetable/bell-schedules', input), meta: silent, onSuccess: refresh }),
    applyDefaultSchedules: useMutation({ mutationFn: () => api.post<{ created: number }>('/timetable/bell-schedules/defaults'), onSuccess: refresh }),
    deleteBellSchedule: useMutation({ mutationFn: (id: number) => api.delete(`/timetable/bell-schedules/${id}`), onSuccess: refresh }),
    saveRequirements: useMutation({
      mutationFn: (input: { academic_year_id: number; grade_id: number; requirements: Omit<RequirementRow, 'subject_name' | 'subject_code'>[] }) =>
        api.put<GradeRequirements>('/timetable/requirements', input),
      meta: silent,
      onSuccess: refresh,
    }),
    copyRequirements: useMutation({
      mutationFn: (input: { from_year_id: number; to_year_id: number }) => api.post<{ created: number }>('/timetable/requirements/copy-year', input),
      onSuccess: refresh,
    }),
    setTeachers: useMutation({
      mutationFn: ({ classId, yearId, subjects }: { classId: number; yearId: number; subjects: { level_subject_id: number; user_id: number | null }[] }) =>
        api.put(`/classes/${classId}/teaching-assignments`, { academic_year_id: yearId, subjects }),
      meta: silent,
      onSuccess: refresh,
    }),
    teachersFromExaminers: useMutation({
      mutationFn: (yearId: number) => api.post<{ created: number; skipped: number }>('/teaching-assignments/from-examiners', { academic_year_id: yearId }),
      onSuccess: refresh,
    }),
    copyTeachers: useMutation({
      mutationFn: (input: { from_year_id: number; to_year_id: number }) => api.post<{ created: number }>('/teaching-assignments/copy-year', input),
      onSuccess: refresh,
    }),
    setTeacherSubjects: useMutation({
      mutationFn: ({ userId, yearId, levelSubjectIds }: { userId: number; yearId: number; levelSubjectIds: number[] }) =>
        api.put<TeacherSubjectsResponse>(`/staff/${userId}/teacher-subjects`, { academic_year_id: yearId, level_subject_ids: levelSubjectIds }),
      meta: silent,
      onSuccess: refresh,
    }),
    copyTeacherSubjects: useMutation({
      mutationFn: (input: { from_year_id: number; to_year_id: number }) => api.post<{ created: number }>('/teacher-subjects/copy-year', input),
      onSuccess: refresh,
    }),
    teacherSubjectsFromExaminers: useMutation({
      mutationFn: (yearId: number) => api.post<{ created: number; skipped: number }>('/teacher-subjects/from-examiners', { academic_year_id: yearId }),
      onSuccess: refresh,
    }),
    generate: useMutation({ mutationFn: (input: GenerateInput) => api.post<Timetable>('/timetables', input), meta: silent, onSuccess: refresh }),
    publish: useMutation({ mutationFn: (id: number) => api.post<Timetable>(`/timetables/${id}/publish`), onSuccess: refresh }),
    duplicate: useMutation({ mutationFn: (id: number) => api.post<Timetable>(`/timetables/${id}/duplicate`), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: number) => api.delete(`/timetables/${id}`), onSuccess: refresh }),
    moveLesson: useMutation({
      // The envelope, not just data: a move may succeed with warnings (a daily limit exceeded).
      mutationFn: async ({ timetableId, lessonId, day, period_sequence }: { timetableId: number; lessonId: number; day: number; period_sequence: number }) =>
        (await requestEnvelope<Lesson>('PATCH', `/timetables/${timetableId}/lessons/${lessonId}`, { body: { day, period_sequence } })) as {
          data: Lesson
          warnings?: string[]
        },
      meta: silent,
      onSuccess: refresh,
    }),
    lockLesson: useMutation({
      mutationFn: ({ timetableId, lessonId, is_locked }: { timetableId: number; lessonId: number; is_locked: boolean }) =>
        api.patch<Lesson>(`/timetables/${timetableId}/lessons/${lessonId}`, { is_locked }),
      onSuccess: refresh,
    }),
  }
}
