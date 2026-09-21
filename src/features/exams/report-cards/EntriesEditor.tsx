import { useEffect, useMemo, useState } from 'react'
import { Loader2Icon, RotateCcwIcon, SaveIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { ReportEntries } from '@/lib/api/types'
import { useSaveReportEntries, type ReportEntryInput } from '../api'

interface Row {
  remarks: string
  fee: string
}

const toRow = (remarks: string | null, fee: number | null): Row => ({ remarks: remarks ?? '', fee: fee === null ? '' : String(fee) })

/** A fee balance as typed: blank is "none", negative means the family is in credit. */
function parseFee(value: string): number | null | typeof Number.NaN {
  const trimmed = value.trim().replace(/,/g, '')
  if (trimmed === '') return null
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN
  return Number(trimmed)
}

function rowError(row: Row): string | null {
  if (row.remarks.length > 1000) return 'Remarks can be at most 1000 characters.'
  const fee = parseFee(row.fee)
  if (Number.isNaN(fee)) return 'Enter the fee balance as a number, e.g. 2500 or -300.'
  return null
}

function sameRow(a: Row, b: Row) {
  return a.remarks.trim() === b.remarks.trim() && parseFee(a.fee) === parseFee(b.fee)
}

/** Class teacher's remarks and fee balances, typed onto every card for this exam. */
export function EntriesEditor({
  examId,
  classId,
  entries,
  onDirtyChange,
}: {
  examId: number
  classId: number
  entries: ReportEntries
  onDirtyChange: (dirty: boolean) => void
}) {
  const initial = useMemo(
    () => Object.fromEntries(entries.students.map((s) => [s.enrolment_id, toRow(s.class_teacher_remarks, s.fee_balance)])),
    [entries],
  )
  const [original, setOriginal] = useState<Record<number, Row>>(initial)
  const [draft, setDraft] = useState<Record<number, Row>>(initial)
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({})
  const save = useSaveReportEntries(examId, classId)

  const changed = entries.students.filter((s) => !sameRow(original[s.enrolment_id], draft[s.enrolment_id])).map((s) => s.enrolment_id)
  const dirty = changed.length > 0
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  const guard = useUnsavedChangesGuard(dirty, 'Remarks and fee balances you typed have not been saved.')

  async function onSave() {
    const invalid = changed.filter((id) => rowError(draft[id]))
    if (invalid.length) {
      toast.error(`Fix ${invalid.length} highlighted row(s) before saving.`)
      return
    }
    const payload: ReportEntryInput[] = changed.map((id) => ({
      enrolment_id: id,
      class_teacher_remarks: draft[id].remarks.trim() || null,
      fee_balance: parseFee(draft[id].fee) as number | null,
    }))
    try {
      const result = await save.mutateAsync(payload)
      setOriginal((current) => {
        const next = { ...current }
        for (const id of changed) next[id] = draft[id]
        return next
      })
      setServerErrors({})
      toast.success(`Saved ${result.saved} pupil${result.saved === 1 ? '' : 's'}.`)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const rows = error.rows('entries')
        setServerErrors(
          Object.fromEntries(
            Object.entries(rows).map(([index, fields]) => [payload[Number(index)]?.enrolment_id, Object.values(fields)[0]]),
          ),
        )
        toast.error('Some rows were refused. Nothing was saved.')
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  if (entries.students.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No pupils are enrolled in this class.</p>
  }

  return (
    <>
      {guard}
      {!entries.editable && (
        <Alert className="mb-3">
          <AlertDescription>Report cards for this exam have been published, so remarks and fee balances are frozen.</AlertDescription>
        </Alert>
      )}
      {entries.editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(original)} disabled={!dirty || save.isPending}>
            <RotateCcwIcon /> Discard
          </Button>
          <Button onClick={() => void onSave()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            Save{dirty ? ` ${changed.length}` : ''}
          </Button>
        </div>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="w-48 px-3 py-2 font-medium">Pupil</th>
              <th className="px-3 py-2 font-medium">Class teacher’s remarks</th>
              <th className="w-36 px-3 py-2 font-medium">Fee balance (KSh)</th>
            </tr>
          </thead>
          <tbody>
            {entries.students.map((student) => {
              const row = draft[student.enrolment_id]
              const isChanged = changed.includes(student.enrolment_id)
              const error = serverErrors[student.enrolment_id] ?? (isChanged ? rowError(row) : null)
              const update = (patch: Partial<Row>) =>
                setDraft((current) => ({ ...current, [student.enrolment_id]: { ...current[student.enrolment_id], ...patch } }))

              return (
                <tr key={student.enrolment_id} className={cn('border-b align-top last:border-0', isChanged && 'bg-primary/5')}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.assessment_no}</div>
                    {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {entries.editable ? (
                      <Textarea
                        aria-label={`Remarks for ${student.name}`}
                        rows={2}
                        maxLength={1000}
                        className="min-h-14"
                        value={row.remarks}
                        onChange={(e) => update({ remarks: e.target.value })}
                      />
                    ) : (
                      <span>{row.remarks || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {entries.editable ? (
                      <Input
                        aria-label={`Fee balance for ${student.name}`}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        aria-invalid={!!error && Number.isNaN(parseFee(row.fee))}
                        value={row.fee}
                        onChange={(e) => update({ fee: e.target.value })}
                      />
                    ) : (
                      <span className="tabular-nums">{row.fee || '—'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">A negative fee balance means the family is in credit.</p>
    </>
  )
}
