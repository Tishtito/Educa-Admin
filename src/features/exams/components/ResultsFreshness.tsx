import { CheckCircle2Icon, Loader2Icon } from 'lucide-react'
import type { Exam } from '@/lib/api/types'
import { formatRelative } from '@/lib/format'
import { canCompute, hasFinalResults } from '../lifecycle'

/** Whether mark lists and cards reflect the latest marks. */
export function ResultsFreshness({ exam }: { exam: Pick<Exam, 'status' | 'results_up_to_date' | 'results_computed_at'> }) {
  if (!canCompute(exam.status) && !hasFinalResults(exam.status)) return null

  if (!exam.results_up_to_date) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <Loader2Icon className="size-3.5 animate-spin" /> Recalculating results…
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
      {exam.results_computed_at ? `Results computed ${formatRelative(exam.results_computed_at)}` : 'No results yet'}
    </span>
  )
}
