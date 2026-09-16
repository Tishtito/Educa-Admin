import { useState } from 'react'
import { Loader2Icon, PencilIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { MarksheetPaper } from '@/lib/api/types'
import { useSetMaxMarks } from '../api'

/**
 * Sets a paper's marks-out-of for this class, or (admins) every class in the
 * exam. If marks already exist the API refuses until told to rescale them;
 * that is surfaced as an explicit second confirmation.
 */
export function MaxMarksPopover({
  examId,
  classId,
  className,
  paper,
  disabled,
  disabledReason,
}: {
  examId: number
  classId: number
  className: string
  paper: MarksheetPaper
  disabled?: boolean
  disabledReason?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(paper.max_marks === null ? '' : String(paper.max_marks))
  const [scope, setScope] = useState<'class' | 'exam'>('class')
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setMax = useSetMaxMarks(examId)

  const parsed = Number(value)
  const valid = value.trim() !== '' && /^\d+(\.\d{1,2})?$/.test(value.trim()) && parsed > 0 && parsed <= 9999.99

  function reset(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValue(paper.max_marks === null ? '' : String(paper.max_marks))
      setNeedsConfirm(null)
      setError(null)
    }
  }

  async function submit(applyToExisting: boolean) {
    setError(null)
    try {
      const result = await setMax.mutateAsync({
        subject_paper_id: paper.subject_paper_id,
        class_id: scope === 'class' ? classId : null,
        max_marks: parsed,
        apply_to_existing: applyToExisting || undefined,
      })
      toast.success(
        result.updated_marks > 0
          ? `${paper.name} is now out of ${result.max_marks}; ${result.updated_marks} existing marks were rescored.`
          : `${paper.name} is now out of ${result.max_marks}.`,
      )
      setOpen(false)
    } catch (e) {
      if (e instanceof ApiError && e.isConflict && /already been entered/i.test(e.message)) {
        setNeedsConfirm(e.message.replace(/\s*Resend with apply_to_existing.*$/i, ''))
      } else if (e instanceof ApiError && e.isValidation) {
        setError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message)
      } else {
        setError(errorMessage(e))
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={reset}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="h-auto gap-1 px-1 py-0 font-normal text-muted-foreground"
          disabled={disabled}
          title={disabled ? disabledReason : 'Change marks-out-of'}
        >
          {paper.max_marks === null ? <span className="text-destructive">set out of</span> : `/ ${paper.max_marks}`}
          {!disabled && <PencilIcon className="size-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void submit(false)
          }}
        >
          <div className="text-sm font-medium">{paper.name}: marks out of</div>
          <Field label="Out of" htmlFor={`max-${paper.subject_paper_id}`}>
            <Input
              id={`max-${paper.subject_paper_id}`}
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setNeedsConfirm(null)
              }}
            />
          </Field>
          <Field label="Applies to">
            <Select value={scope} onValueChange={(v) => setScope(v as 'class' | 'exam')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">{className} only</SelectItem>
                <SelectItem value="exam">Every class in this exam</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {needsConfirm ? (
            <Alert>
              <AlertDescription className="grid gap-2">
                <span>{needsConfirm} Existing marks keep their raw value and are rescored against the new total.</span>
                <Button type="button" size="sm" onClick={() => void submit(true)} disabled={setMax.isPending}>
                  {setMax.isPending && <Loader2Icon className="animate-spin" />}
                  Change and rescore
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Button type="submit" size="sm" disabled={!valid || setMax.isPending}>
              {setMax.isPending && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  )
}
