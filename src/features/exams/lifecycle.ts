import type { ExamStatus } from '@/lib/api/types'

export interface TransitionCopy {
  label: string
  title: string
  consequences: string[]
  destructive?: boolean
  /** The main forward step from this status, shown as the primary button. */
  primary?: boolean
}

/** What each move does, in the words an administrator needs before confirming it. */
export const transitionCopy: Partial<Record<`${ExamStatus}->${ExamStatus}`, TransitionCopy>> = {
  'draft->open': {
    label: 'Open exam',
    title: 'Open this exam?',
    primary: true,
    consequences: [
      'Every active subject for the exam’s classes is added, with its default marks-out-of.',
      'The exam’s classes and subjects can no longer be changed.',
      'Marking does not start yet — you can still adjust marks-out-of.',
    ],
  },
  'open->draft': {
    label: 'Back to draft',
    title: 'Move this exam back to draft?',
    consequences: ['Set-up can be changed again.', 'Nobody can enter marks while it is a draft.'],
  },
  'open->marking': {
    label: 'Start marking',
    title: 'Start marking?',
    primary: true,
    consequences: [
      'Examiners assigned to the exam’s classes can enter marks.',
      'Results are recalculated in the background after every save.',
    ],
  },
  'marking->locked': {
    label: 'Lock marking',
    title: 'Lock marking?',
    primary: true,
    consequences: [
      'Nobody can enter or change marks.',
      'Results, positions and statistics are computed now.',
      'Mark lists are final and report cards become available.',
    ],
  },
  'locked->marking': {
    label: 'Reopen marking',
    title: 'Reopen marking?',
    consequences: [
      'Marks can be entered and changed again.',
      'Report cards are unavailable until the exam is locked again.',
    ],
  },
  'locked->published': {
    label: 'Publish report cards',
    title: 'Publish report cards?',
    primary: true,
    destructive: true,
    consequences: [
      'Every report card is frozen exactly as it is now — this is what parents receive.',
      'Remarks and fee balances can no longer be changed.',
      'This cannot be undone.',
    ],
  },
  'published->archived': {
    label: 'Archive',
    title: 'Archive this exam?',
    destructive: true,
    consequences: ['The exam is hidden from the default exam list.', 'Its results and report cards stay readable.', 'This is final.'],
  },
}

export const statusExplanation: Record<ExamStatus, string> = {
  draft: 'Being set up. Nobody can enter marks yet.',
  open: 'Set-up is frozen. Start marking when examiners are ready.',
  marking: 'Examiners are entering marks.',
  locked: 'Marking is closed and results are final. Review mark lists and report cards, then publish.',
  published: 'Report cards have been issued and are frozen.',
  archived: 'Historical. Read-only.',
}

export const hasFinalResults = (status: ExamStatus) => ['locked', 'published', 'archived'].includes(status)
export const canCompute = (status: ExamStatus) => status === 'marking' || status === 'locked'
