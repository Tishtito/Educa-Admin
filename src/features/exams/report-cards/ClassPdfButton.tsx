import { useState } from 'react'
import { CheckCircle2Icon, DownloadIcon, FileStackIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { saveBlob } from '@/lib/download'
import { errorMessage } from '@/lib/api/errors'
import type { ReportLayout } from '@/lib/api/types'
import { formatBytes } from '@/lib/format'
import { downloadReportBatch, useCreateReportBatch, useReportBatch } from '../api'

/**
 * One PDF for the whole class, built by a queue worker (it can take a minute
 * for a large class). Starts the batch, polls it, then offers the download.
 */
export function ClassPdfButton({
  examId,
  classId,
  layout,
  filename,
}: {
  examId: number
  classId: number
  layout: ReportLayout
  filename: string
}) {
  const [batchId, setBatchId] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const create = useCreateReportBatch(examId)
  const batch = useReportBatch(batchId)
  const status = batch.data?.status

  // A batch belongs to the class and layout it was made for.
  const [batchFor, setBatchFor] = useState(`${classId}:${layout}`)
  if (batchFor !== `${classId}:${layout}`) {
    setBatchFor(`${classId}:${layout}`)
    setBatchId(null)
  }

  async function start() {
    const created = await create.mutateAsync({ class_id: classId, layout })
    setBatchId(created.id)
  }

  async function download() {
    if (!batchId) return
    setDownloading(true)
    try {
      const { blob } = await downloadReportBatch(batchId)
      await saveBlob(blob, filename)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
          {batch.data?.student_count} cards · {formatBytes(batch.data?.file_size)}
        </span>
        <Button onClick={() => void download()} disabled={downloading}>
          {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          Download class PDF
        </Button>
      </div>
    )
  }

  if (status === 'queued' || status === 'running' || create.isPending) {
    return (
      <Button disabled>
        <Loader2Icon className="animate-spin" />
        {status === 'running' ? 'Building PDF…' : 'Queued…'}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'failed' && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={batch.data?.error ?? undefined}>
          <TriangleAlertIcon className="size-3.5" /> {batch.data?.error ?? 'Failed'}
        </span>
      )}
      <Button variant="outline" onClick={() => void start().catch(() => undefined)}>
        <FileStackIcon /> {status === 'failed' ? 'Try again' : 'Class PDF'}
      </Button>
    </div>
  )
}
