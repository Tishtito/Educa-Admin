import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExamStatus } from '@/lib/api/types'
import { examStatusLabel, examStatusOrder } from '../status'

export function LifecycleStepper({ status }: { status: ExamStatus }) {
  const current = examStatusOrder.indexOf(status)

  return (
    <ol className="flex w-full items-center gap-1 overflow-x-auto pb-1" aria-label="Exam progress">
      {examStatusOrder.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-1" aria-current={active ? 'step' : undefined}>
            <div className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary ring-3 ring-primary/20',
                  !done && !active && 'text-muted-foreground',
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              <span className={cn('text-[11px] whitespace-nowrap', active ? 'font-medium' : 'text-muted-foreground')}>
                {examStatusLabel[step]}
              </span>
            </div>
            {index < examStatusOrder.length - 1 && (
              <div className={cn('mb-5 h-px min-w-3 flex-1', index < current ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
