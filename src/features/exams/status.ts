import type { ExamStatus } from '@/lib/api/types'

export const examStatusOrder: ExamStatus[] = ['draft', 'open', 'marking', 'locked', 'published', 'archived']

export const examStatusLabel: Record<ExamStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  marking: 'Marking',
  locked: 'Locked',
  published: 'Published',
  archived: 'Archived',
}

/** Mirrors ExamLifecycleService's allowed transitions. The API is the authority. */
export const examTransitions: Record<ExamStatus, ExamStatus[]> = {
  draft: ['open'],
  open: ['draft', 'marking'],
  marking: ['locked'],
  locked: ['marking', 'published'],
  published: ['archived'],
  archived: [],
}

export const examStatusTone: Record<ExamStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  marking: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  locked: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400',
}
