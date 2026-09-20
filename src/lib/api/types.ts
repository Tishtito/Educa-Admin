import type { Permission } from '@/lib/permissions'

/**
 * TypeScript mirrors of the Educa_Lara JSON responses. The Laravel resources
 * and controllers are the authority; keep these in step with them.
 */

/** The built-in roles. A school's own roles have slugs of their own, hence `string` on users. */
export type BuiltInRole = 'super_admin' | 'school_admin' | 'class_teacher' | 'examiner'
export type RoleSlug = BuiltInRole | (string & {})

export interface School {
  uuid: string
  name: string
  short_name: string | null
  slug: string
  motto: string | null
  logo_path: string | null
  timezone: string
  status: 'onboarding' | 'active' | 'suspended'
  /** Whether exams, marking, mark lists and report cards are open (Educa_Lara docs/billing.md). */
  subscription?: SubscriptionState
}

export interface SubscriptionState {
  /** overdue: the subscription features are locked (the API answers 402). */
  status: 'trial' | 'active' | 'overdue'
  /** The last day it is paid for, inclusive. */
  paid_until: string | null
  /** Days of use left counting today; 0 once lapsed. */
  days_left: number
  is_trial: boolean
  cycle_months: number | null
  /** Null until Educa sets the school's price. */
  price_kes: number | null
  credit_kes: number
  /** What renewing costs after credit; null when not priced. */
  amount_due_kes: number | null
}

export interface SubscriptionPayment {
  id: number
  method: 'stk' | 'paybill' | 'manual'
  status: 'pending' | 'succeeded' | 'failed' | 'unmatched'
  amount_kes: number
  mpesa_receipt: string | null
  reference: string | null
  /** Masked, e.g. 2547*****678. */
  phone: string | null
  result_desc: string | null
  paid_at: string | null
  paid_until_after: string | null
  cycles_added: number
  created_at: string
}

export interface User {
  id: number
  name: string
  username: string
  email: string | null
  phone: string | null
  staff_no: string | null
  tsc_no: string | null
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  /** Whether Continue with Google signs in to this account. */
  google_connected: boolean
  is_platform_admin: boolean
  roles: RoleSlug[]
  role_names: string[]
  /** What this person may do in the school (docs/permissions.md). The API enforces it regardless. */
  permissions: Permission[]
  school: School | null
}

export interface LoginResponse {
  token: string
  user: User
}

// ---------------------------------------------------------------- reference

export interface Grade {
  id: number
  level_id: number
  code: string
  name: string
  ordinal: number
}

export interface Level {
  id: number
  code: 'lower_primary' | 'upper_primary' | 'junior_secondary'
  name: string
  min_grade: number
  max_grade: number
  grades: Grade[]
}

export interface AcademicYear {
  id: number
  name: string
  starts_on: string | null
  ends_on: string | null
  is_current: boolean
  terms: Term[]
}

export interface Stream {
  id: number
  name: string
  code: string | null
  sort_order: number
  classes_count?: number
}

export interface SchoolClass {
  id: number
  name: string
  grade_id: number
  grade: string | null
  level_id: number | null
  stream_id: number | null
  stream: string | null
  capacity: number | null
  is_active: boolean
  /** Active pupils in the current year; only with ?with_counts=1. */
  students_count?: number
}

export interface Term {
  id: number
  academic_year_id: number
  academic_year?: string | null
  term_number: number
  name: string
  starts_on: string | null
  ends_on: string | null
  feeding_fee: number | null
  is_current: boolean
}

export interface ReportCardSettings {
  head_teacher_name: string | null
  footer: string | null
  default_footer: string
}

// -------------------------------------------------------------------- exams

export type ExamStatus = 'draft' | 'open' | 'marking' | 'locked' | 'published' | 'archived'
export type ExamType = 'opener' | 'midterm' | 'endterm' | 'cat' | 'mock' | 'weekly' | 'other'
export type MeanPolicy = 'all_entered' | 'complete_students_only'
export type TiePolicy = 'competition' | 'dense' | 'legacy_ordinal'

export interface Exam {
  id: number
  name: string
  exam_type: ExamType
  exam_type_label: string
  sequence: number
  status: ExamStatus
  status_label: string
  starts_on: string | null
  ends_on: string | null
  mean_policy: MeanPolicy
  tie_policy: TiePolicy
  is_legacy_import: boolean
  accepts_score_entry: boolean
  results_up_to_date: boolean
  results_computed_at: string | null
  published_at: string | null
  academic_year?: { id: number; name: string }
  term?: { id: number; name: string; term_number: number } | null
  level?: { id: number; code: string; name: string } | null
  classes?: { id: number; name: string; grade_id: number; stream_id: number | null }[]
}

export interface ComputeSummary {
  students: number
  complete_students: number
  subject_scores: number
  absent_subjects: number
  pending_subjects: number
  statistics: number
  removed_results: number
  warnings: string[]
}

// ------------------------------------------------------------------ marking

export interface MarkingExamSummary {
  id: number
  name: string
  status: ExamStatus
  accepts_score_entry: boolean
  results_up_to_date: boolean
  results_computed_at: string | null
}

export interface MarkingSheet {
  class_id: number
  class_name: string
  level_subject_id: number
  subject_name: string
  subject_code: string
  papers: { subject_paper_id: number; name: string }[]
  can_enter: boolean
  students: number
  marks_entered: number
  marks_expected: number
  is_complete: boolean
}

export interface MarkingOverview {
  exam: MarkingExamSummary
  sheets: MarkingSheet[]
}

export type AggregationRule = 'single' | 'percentage_of_combined_max' | 'sum' | 'average' | 'weighted_sum'

export interface MarksheetPaper {
  subject_paper_id: number
  sequence: number
  name: string
  max_marks: number | null
}

export interface MarksheetMark {
  subject_paper_id: number
  raw_score: number | null
  is_absent: boolean
  entered_at: string | null
}

export interface MarksheetStudent {
  enrolment_id: number
  student_id: number
  admission_no: string | null
  name: string
  marks: MarksheetMark[]
  subject_score: number | null
  subject_band: string | null
}

export interface Marksheet {
  exam: MarkingExamSummary
  class: { id: number; name: string }
  subject: {
    level_subject_id: number
    name: string
    code: string
    aggregation_rule: AggregationRule
    aggregation_rule_label: string
  }
  papers: MarksheetPaper[]
  students: MarksheetStudent[]
  can_enter: boolean
}

export interface MarkInput {
  enrolment_id: number
  subject_paper_id: number
  raw_score: number | null
  is_absent: boolean
}

export interface SaveMarksResult {
  saved: number
  cleared: number
  unchanged: number
}

// ----------------------------------------------------------------- marklist

export interface MarklistSubject {
  level_subject_id: number
  name: string
  code: string
  scale_max: number
  counts_toward_total: boolean
  aggregation_rule: AggregationRule
  class_mean: number | null
  students_counted: number
}

export interface MarklistScore {
  level_subject_id: number
  score: number | null
  raw_score: number | null
  max_marks: number | null
  band: string | null
  band_label: string | null
  is_absent: boolean
  subject_position: number | null
}

export interface MarklistStudent {
  student_id: number
  admission_no: string | null
  name: string
  total_marks: number | null
  mean_marks: number | null
  mean_band: string | null
  mean_band_label: string | null
  grade_position: number | null
  stream_position: number | null
  grade_cohort_size: number | null
  stream_cohort_size: number | null
  is_complete: boolean
  subjects_expected: number
  subjects_counted: number
  scores: MarklistScore[]
}

export interface Marklist {
  exam: {
    id: number
    name: string
    status: ExamStatus
    tie_policy: TiePolicy
    is_legacy_import: boolean
    results_up_to_date: boolean
    results_computed_at: string | null
  }
  class: { id: number; name: string; grade: string | null; stream: string | null }
  subjects: MarklistSubject[]
  students: MarklistStudent[]
}

// ------------------------------------------------------------- report cards

export type ReportLayout = 'single' | 'term'

export interface ReportCell {
  score: number | null
  max_marks: number | null
  is_absent: boolean
  band: string | null
  band_label: string | null
}

export interface ReportRow {
  kind: 'subject' | 'paper'
  name: string
  code?: string
  subject_name?: string
  counts_toward_total: boolean
  cells: ReportCell[]
}

export interface ReportTotals {
  total_marks: number | null
  mean_marks: number | null
  mean_band: string | null
  mean_band_label: string | null
  is_complete: boolean
}

export interface ReportCard {
  layout: ReportLayout
  school: {
    name: string
    motto: string | null
    address: string | null
    phone: string | null
    email: string | null
    logo_path: string | null
  }
  class: { name: string; grade: string | null; stream: string | null; class_teacher: string | null }
  academic_year: string
  exam: { id: number; name: string; type: ExamType }
  columns: { exam_id: number | null; name: string | null; type: ExamType; type_label: string; available: boolean }[]
  term: { name: string; closing_date: string | null; opening_date: string | null; next_term_feeding_fee: number | null } | null
  head_teacher: string | null
  footer: string | null
  generated_at: string
  student: { student_id: number; enrolment_id: number; admission_no: string | null; name: string }
  rows: ReportRow[]
  totals: ReportTotals[]
  entry: { class_teacher_remarks: string | null; fee_balance: number | null }
  is_snapshot: boolean
  snapshot_intact?: boolean
  published_at?: string
}

export interface ReportEntryRow {
  enrolment_id: number
  student_id: number
  admission_no: string | null
  name: string
  class_teacher_remarks: string | null
  fee_balance: number | null
  updated_at: string | null
}

export interface ReportEntries {
  editable: boolean
  students: ReportEntryRow[]
}

export interface ReportCardBatch {
  id: number
  exam_id: number
  class_id: number
  layout: ReportLayout
  status: 'queued' | 'running' | 'completed' | 'failed'
  student_count: number | null
  file_size: number | null
  error: string | null
  created_at: string
  finished_at: string | null
  download_url: string | null
}

// ----------------------------------------------------------------- platform

export interface PlatformSchool {
  uuid: string
  name: string
  short_name: string | null
  slug: string
  county: string | null
  status: School['status']
}

export interface QueueHealth {
  healthy: boolean
  problems: string[]
  checked_at: string
  workers: {
    name: string
    connection: string
    last_seen_at: string | null
    heartbeat_age_seconds: number | null
    queues: {
      queue: string
      pending: number
      delayed: number
      reserved: number
      oldest_pending_age_seconds: number | null
      error: string | null
    }[]
  }[]
  scheduler: { last_seen_at: string | null; age_seconds: number | null }
  failed_jobs: number
}

// ------------------------------------------------------------ curriculum

export interface Subject {
  id: number
  code: string
  name: string
  short_name: string | null
  is_active: boolean
  level_ids: number[]
}

export interface SubjectPaper {
  id: number
  sequence: number
  name: string
  code: string | null
  default_max_marks: number | null
  weight: number
}

export interface LevelSubject {
  id: number
  level_id: number
  subject_id: number
  subject: { id: number; code: string; name: string }
  paper_count: number
  aggregation_rule: AggregationRule
  scale_max: number
  counts_toward_total: boolean
  grading_scale_id: number | null
  display_order: number
  is_active: boolean
  papers: SubjectPaper[]
  /** Examined beyond draft: papers, aggregation and scale are frozen. */
  in_use: boolean
}

export interface GradeBand {
  id?: number
  label: string
  abbreviation: string
  points: number | null
  min_marks: number
  max_marks: number
  remark?: string | null
  color?: string | null
  sort_order?: number
}

export interface GradingScale {
  id: number
  name: string
  kind: 'performance_level' | 'grade' | 'points'
  level_id: number | null
  is_default: boolean
  is_platform: boolean
  bands: GradeBand[]
  used_by_subjects: number
}

export interface ExamSetup {
  editable: boolean
  uses_defaults: boolean
  subjects: {
    level_subject_id: number
    level_id: number
    name: string
    code: string
    is_active: boolean
    selected: boolean
    /** How this subject's papers combine. 'single' means an exam sets exactly one of them. */
    aggregation_rule: AggregationRule
    aggregation_rule_label: string
    papers: ExamSetupPaper[]
  }[]
}

export interface ExamSetupPaper {
  subject_paper_id: number
  name: string
  sequence: number
  /** Whether this exam sets the paper. Papers are chosen per exam, not per subject. */
  selected: boolean
  default_max_marks: number | null
  max_marks: number | null
}

// ---------------------------------------------------------------- people

export interface StaffMember {
  id: number
  name: string
  username: string
  email: string | null
  phone: string | null
  staff_no: string | null
  tsc_no: string | null
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  /** The last time any of the account's sessions was used. */
  last_active_at?: string | null
  google_connected: boolean
  roles: RoleSlug[]
  role_names: string[]
  /** What the account may do, used to offer only suitable people for assignments. */
  permissions: Permission[]
  class_teacher_of: { class_id: number; class_name: string | null }[]
  examiner_assignments_count: number
  /** An emailed set-up link not yet used or cancelled. */
  invitation: StaffInvitation | null
  /** Only in the response that created the account without an invitation. */
  temporary_password?: string
}

export interface StaffInvitation {
  status: 'pending' | 'expired'
  sent_to: string
  sent_at: string | null
  expires_at: string
}

export interface ClassTeacherAssignment {
  id: number
  class_id: number
  class_name: string | null
  user_id: number
  user_name: string | null
  is_primary: boolean
}

export interface ExaminerAssignment {
  id: number
  class_id: number
  class_name: string | null
  level_subject_id: number
  subject_name: string | null
  user_id: number
  user_name: string | null
  term_id: number | null
  inferred: boolean
}

export type StudentStatus = 'active' | 'transferred' | 'graduated' | 'inactive'

export interface Student {
  id: number
  admission_no: string
  upi: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  gender: 'male' | 'female' | 'other' | null
  date_of_birth: string | null
  guardian_name: string | null
  guardian_phone: string | null
  status: StudentStatus
  enrolment?: { id: number; academic_year_id: number; class_id: number; class_name: string | null; status: string } | null
  enrolments?: {
    id: number
    academic_year_id: number
    academic_year: string | null
    class_id: number
    class_name: string | null
    status: 'active' | 'left' | 'promoted'
    started_on: string | null
    ended_on: string | null
  }[]
}

export interface StudentResult {
  exam: { id: number; name: string; status: ExamStatus; academic_year: string | null; term: string | null }
  class_name: string | null
  total_marks: number | null
  mean_marks: number | null
  mean_band: string | null
  grade_position: number | null
  grade_cohort_size: number | null
  stream_position: number | null
  stream_cohort_size: number | null
  is_complete: boolean
  subjects: { level_subject_id: number; name: string; code: string; score: number | null; band: string | null; is_absent: boolean; position: number | null }[]
}

export interface ImportResult {
  total: number
  valid: number
  errors: { row: number; field: string; message: string }[]
  preview: Record<string, string | number | null>[]
  created: number
  committed: boolean
}

export interface PromotionPreview {
  from_year: { id: number; name: string }
  to_year: { id: number; name: string }
  classes: {
    class_id: number
    class_name: string
    grade: string | null
    pupils: number
    suggestion: { action: 'promote' | 'graduate'; target_class_id: number | null; target_class_name: string | null }
    already_enrolled_in_target_year: number
  }[]
}

export interface PromotionResult {
  promoted: number
  graduated: number
  already_enrolled: number
  excluded: number
  skipped: number
  dry_run: boolean
}

// ---------------------------------------------------------------- insight

export interface DashboardData {
  academic_year: { id: number; name: string } | null
  term: { id: number; name: string; starts_on: string | null; ends_on: string | null } | null
  counts: { pupils: number; classes: number; staff: number; exams_in_progress: number }
  attention: {
    pupils_without_class: number
    classes_without_teacher: number
    subjects_without_examiner: number
    staff_awaiting_first_sign_in: number
    failed_report_batches: number
  }
  exams: {
    id: number
    name: string
    status: ExamStatus
    term: string | null
    level: string | null
    results_up_to_date: boolean
    marks_entered: number
    marks_expected: number
  }[]
}

export interface StreamList {
  exam: { id: number; name: string; status: ExamStatus; results_up_to_date: boolean }
  grade: { id: number; name: string }
  subjects: { level_subject_id: number; name: string; code: string }[]
  students: {
    student_id: number
    admission_no: string | null
    name: string
    class_id: number
    class_name: string
    total_marks: number | null
    mean_marks: number | null
    mean_band: string | null
    grade_position: number | null
    stream_position: number | null
    is_complete: boolean
    scores: { level_subject_id: number; score: number | null; band: string | null; is_absent: boolean }[]
  }[]
}

export interface ExamStatistics {
  computed_at: string | null
  results_up_to_date: boolean
  scopes: {
    scope: 'school' | 'level' | 'grade' | 'class'
    scope_id: number | null
    name: string
    students_counted: number | null
    mean: number | null
    min: number | null
    max: number | null
    std_dev: number | null
    subjects: { level_subject_id: number; name: string | null; code: string | null; mean: number | null; students_counted: number }[]
  }[]
}

export interface SchoolProfile {
  uuid: string
  slug: string
  name: string
  short_name: string | null
  motto: string | null
  county: string | null
  address: string | null
  phone: string | null
  email: string | null
  has_logo: boolean
  status: School['status']
}

// ---------------------------------------------------------------- roles

export interface RoleSummary {
  id: number
  slug: RoleSlug
  name: string
  description: string | null
  /** Built into Educa (class teacher, examiner, school administrator) rather than made by the school. */
  is_system: boolean
  /** School administrator: always every school permission, not editable. */
  is_fixed: boolean
  /** A built-in role this school has changed from the defaults. */
  is_customised: boolean
  users_count: number
  permissions: Permission[]
}

export interface PermissionGroup {
  group: string
  permissions: { slug: Permission; name: string; description: string }[]
}
