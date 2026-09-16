import { cn } from '@/lib/utils'
import type { ExamStatus } from '@/lib/api/types'
import { examStatusLabel, examStatusTone } from '../status'

export function ExamStatusBadge({ status, className }: { status: ExamStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        examStatusTone[status],
        className,
      )}
    >
      {examStatusLabel[status]}
    </span>
  )
}
