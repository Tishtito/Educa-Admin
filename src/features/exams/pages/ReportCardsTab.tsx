import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { DownloadIcon, FileTextIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { saveBlob } from '@/lib/download'
import { errorMessage } from '@/lib/api/errors'
import type { Exam, ReportCard, ReportLayout } from '@/lib/api/types'
import { downloadReportCardPdf, useReportCards, useReportEntries } from '../api'
import { ClassSelect } from '../components/ClassSelect'
import { hasFinalResults } from '../lifecycle'
import { ClassPdfButton } from '../report-cards/ClassPdfButton'
import { EntriesEditor } from '../report-cards/EntriesEditor'
import { ReportCardView } from '../report-cards/ReportCardView'
import { useExamContext, useSelectedClass } from '../useExamContext'

/** The term layout puts a term's Mid-Term and End-Term side by side. */
const supportsTermLayout = (exam: Exam) => !!exam.term && (exam.exam_type === 'midterm' || exam.exam_type === 'endterm')

export function ReportCardsTab() {
  const { exam } = useExamContext()
  const [classId, setClassId] = useSelectedClass(exam)
  const [params, setParams] = useSearchParams()
  const termLayout = supportsTermLayout(exam)
  // Legacy printed End-Term cards with the term's Mid-Term beside them; keep that as the default.
  const requestedLayout = params.get('layout') ?? (exam.exam_type === 'endterm' ? 'term' : 'single')
  const layout: ReportLayout = termLayout && requestedLayout === 'term' ? 'term' : 'single'
  const view = params.get('view') === 'entries' ? 'entries' : 'preview'
  const [entriesDirty, setEntriesDirty] = useState(false)

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(key, value)
        return next
      },
      { replace: true },
    )

  const final = hasFinalResults(exam.status)
  const selectedClass = exam.classes?.find((c) => c.id === classId)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ClassSelect classes={exam.classes ?? []} value={classId} onChange={setClassId} />
        {termLayout && (
          <Select value={layout} onValueChange={(v) => setParam('layout', v)}>
            <SelectTrigger className="w-52" aria-label="Report layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">This exam only</SelectItem>
              <SelectItem value="term">Whole term (Mid-Term + End-Term)</SelectItem>
            </SelectContent>
          </Select>
        )}
        {final && classId !== null && selectedClass && (
          <div className="ml-auto">
            <ClassPdfButton
              examId={exam.id}
              classId={classId}
              layout={layout}
              filename={`${exam.name} ${selectedClass.name} report cards.pdf`}
            />
          </div>
        )}
      </div>

      {classId === null ? (
        <EmptyState icon={<FileTextIcon />} title="Choose a class" description="Pick a class to type remarks and preview its report cards." />
      ) : (
        <Tabs value={view} onValueChange={(v) => !entriesDirty && setParam('view', v)}>
          <TabsList>
            <TabsTrigger value="preview">Preview cards</TabsTrigger>
            <TabsTrigger value="entries" disabled={entriesDirty && view !== 'entries'}>
              Remarks &amp; fees
            </TabsTrigger>
          </TabsList>
          {entriesDirty && <p className="mt-1 text-xs text-muted-foreground">Save or discard your remarks to switch views.</p>}

          <TabsContent value="preview" className="mt-4">
            {final ? (
              <CardsPreview examId={exam.id} classId={classId} layout={layout} examName={exam.name} />
            ) : (
              <Alert>
                <AlertDescription>
                  Report cards are available once marking is locked. You can already type remarks and fee balances.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          <TabsContent value="entries" className="mt-4">
            <EntriesPanel key={classId} examId={exam.id} classId={classId} onDirtyChange={setEntriesDirty} />
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}

function EntriesPanel({ examId, classId, onDirtyChange }: { examId: number; classId: number; onDirtyChange: (d: boolean) => void }) {
  const entries = useReportEntries(examId, classId)
  return (
    <QueryState query={entries}>
      {(data) => <EntriesEditor examId={examId} classId={classId} entries={data} onDirtyChange={onDirtyChange} />}
    </QueryState>
  )
}

function CardsPreview({ examId, classId, layout, examName }: { examId: number; classId: number; layout: ReportLayout; examName: string }) {
  const cards = useReportCards(examId, classId, layout)
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <QueryState query={cards}>
      {(data) => {
        if (data.length === 0) {
          return <EmptyState title="No report cards" description="No pupil in this class has results for this exam." />
        }
        const current = data.find((c) => c.student.enrolment_id === selected) ?? data[0]

        return (
          <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
            {/* Phones: a picker. Larger screens: a list. */}
            <div className="lg:hidden">
              <Select value={String(current.student.enrolment_id)} onValueChange={(v) => setSelected(Number(v))}>
                <SelectTrigger className="w-full" aria-label="Pupil">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.map((card) => (
                    <SelectItem key={card.student.enrolment_id} value={String(card.student.enrolment_id)}>
                      {card.student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Card className="hidden max-h-[70vh] overflow-y-auto p-1 lg:block">
              <ul>
                {data.map((card) => (
                  <li key={card.student.enrolment_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(card.student.enrolment_id)}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                        card === current && 'bg-muted font-medium',
                      )}
                    >
                      <div className="truncate">{card.student.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {card.student.admission_no} · mean {card.totals.at(-1)?.mean_marks ?? '—'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="min-w-0">
              <div className="mb-2 flex justify-end">
                <SinglePdfButton examId={examId} card={current} layout={layout} examName={examName} />
              </div>
              <ReportCardView card={current} />
            </div>
          </div>
        )
      }}
    </QueryState>
  )
}

function SinglePdfButton({ examId, card, layout, examName }: { examId: number; card: ReportCard; layout: ReportLayout; examName: string }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const { blob } = await downloadReportCardPdf(examId, card.student.enrolment_id, layout)
      await saveBlob(blob, `${card.student.name} ${examName}.pdf`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void download()} disabled={busy}>
      {busy ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
      PDF
    </Button>
  )
}
