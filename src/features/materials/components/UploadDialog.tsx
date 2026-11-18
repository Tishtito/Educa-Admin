import { useRef, useState } from 'react'
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, UploadIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { Level } from '@/lib/api/types'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMaterialMutations, type Duplicate } from '../api'
import { MATERIAL_ACCEPT, fileProblem, titleFromFileName } from '../model'
import { MaterialTagFields, type MaterialTags } from './MaterialTagFields'

interface Pending {
  key: string
  file: File
  title: string
  state: 'waiting' | 'uploading' | 'done' | 'failed'
  progress: number
  error?: string
  duplicate?: Duplicate
}

/**
 * Upload one or more files with the same section, grades and subject. Files go
 * one at a time so each shows its own progress, and a failure keeps the rest.
 */
export function UploadDialog({
  open,
  onOpenChange,
  levels,
  defaultLevelId,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  levels: Level[]
  defaultLevelId: number | null
  /** Called with the section once at least one file went up. */
  onUploaded?: (levelId: number) => void
}) {
  const { upload } = useMaterialMutations()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<Pending[]>([])
  const [tags, setTags] = useState<MaterialTags>({ level_id: defaultLevelId, grade_ids: [], level_subject_id: null })
  const [description, setDescription] = useState('')
  const [publish, setPublish] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [tagErrors, setTagErrors] = useState<Partial<Record<keyof MaterialTags, string>>>({})

  function reset() {
    setFiles([])
    setTags({ level_id: defaultLevelId, grade_ids: [], level_subject_id: null })
    setDescription('')
    setPublish(true)
    setTagErrors({})
  }

  function close(next: boolean) {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  function add(list: FileList | null) {
    if (!list) return
    const added: Pending[] = []
    const refused: string[] = []
    for (const file of Array.from(list)) {
      const problem = fileProblem(file)
      if (problem) refused.push(`${file.name}: ${problem}`)
      else added.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, title: titleFromFileName(file.name), state: 'waiting', progress: 0 })
    }
    if (refused.length) toast.error(refused.join('\n'))
    setFiles((current) => [...current, ...added])
  }

  const patch = (key: string, change: Partial<Pending>) => setFiles((current) => current.map((p) => (p.key === key ? { ...p, ...change } : p)))

  async function submit() {
    if (!tags.level_id) {
      setTagErrors({ level_id: 'Choose the section these files are for.' })
      return
    }
    setTagErrors({})
    setBusy(true)
    let uploaded = 0
    const duplicates: string[] = []

    for (const pending of files.filter((p) => p.state !== 'done')) {
      patch(pending.key, { state: 'uploading', progress: 0, error: undefined })
      try {
        const result = await upload(
          pending.file,
          { title: pending.title.trim(), description: description.trim() || null, level_id: tags.level_id, grade_ids: tags.grade_ids, level_subject_id: tags.level_subject_id, status: publish ? 'published' : 'draft' },
          (progress) => patch(pending.key, { progress }),
        )
        uploaded++
        patch(pending.key, { state: 'done', progress: 1, duplicate: result.duplicate_of })
        if (result.duplicate_of) duplicates.push(`${pending.title} is the same file as “${result.duplicate_of.title}”.`)
      } catch (error) {
        if (error instanceof ApiError && error.isValidation) {
          const field = (Object.keys(error.fieldErrors)[0] ?? '').split('.')[0] as keyof MaterialTags
          if (field === 'level_id' || field === 'grade_ids' || field === 'level_subject_id') setTagErrors({ [field]: error.fieldErrors[Object.keys(error.fieldErrors)[0]!]?.[0] })
        }
        patch(pending.key, { state: 'failed', error: errorMessage(error) })
      }
    }

    setBusy(false)
    if (uploaded > 0) onUploaded?.(tags.level_id)
    if (uploaded > 0) toast.success(`${uploaded} ${uploaded === 1 ? 'file' : 'files'} uploaded${publish ? '' : ' as drafts'}.`)
    if (duplicates.length) toast.warning(`Already uploaded: ${duplicates.join(' ')}`, { duration: 10_000 })

    setFiles((current) => {
      const left = current.filter((p) => p.state !== 'done')
      if (left.length === 0) {
        reset()
        onOpenChange(false)
      }
      return left
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <form
          noValidate
          className="grid max-h-[85dvh] gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (files.length > 0) void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Upload teaching materials</DialogTitle>
            <DialogDescription>PDF, Word, PowerPoint, Excel, JPEG or PNG, up to 20 MB each.</DialogDescription>
          </DialogHeader>

          <div className="-mx-1 grid min-w-0 gap-4 overflow-y-auto px-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                add(e.dataTransfer.files)
              }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50',
                dragging && 'border-primary bg-primary/5',
              )}
            >
              <UploadIcon className="size-6" />
              <span>
                <span className="font-medium text-foreground">Choose files</span> or drop them here
              </span>
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={MATERIAL_ACCEPT}
              className="hidden"
              onChange={(e) => {
                add(e.target.files)
                e.target.value = ''
              }}
            />

            {files.length > 0 && (
              <ul className="grid gap-2">
                {files.map((p) => (
                  <li key={p.key} className="grid gap-1.5 rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Title for ${p.file.name}`}
                        value={p.title}
                        maxLength={190}
                        disabled={busy || p.state === 'done'}
                        onChange={(e) => patch(p.key, { title: e.target.value })}
                        className="h-8"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(p.file.size)}</span>
                      {p.state === 'done' ? (
                        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                      ) : p.state === 'uploading' ? (
                        <Loader2Icon className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={busy} aria-label={`Remove ${p.file.name}`} onClick={() => setFiles((c) => c.filter((x) => x.key !== p.key))}>
                          <XIcon />
                        </Button>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{p.file.name}</p>
                    {p.state === 'uploading' && <Progress value={Math.round(p.progress * 100)} className="h-1.5" />}
                    {p.state === 'failed' && (
                      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                        <AlertTriangleIcon className="size-3.5" /> {p.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <MaterialTagFields levels={levels} value={tags} onChange={setTags} errors={tagErrors} />

            <Field label="Note for teachers" hint="Optional. Shown under every file in this upload.">
              <Textarea value={description} maxLength={2000} rows={2} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
            </Field>

            <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
              <span>
                <span className="font-medium">Publish now</span>
                <span className="block text-xs text-muted-foreground">Off saves drafts that teachers cannot see yet.</span>
              </span>
              <Switch checked={publish} onCheckedChange={setPublish} disabled={busy} />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || files.length === 0}>
              {busy && <Loader2Icon className="animate-spin" />}
              {files.some((p) => p.state === 'failed') ? 'Retry' : files.length > 1 ? `Upload ${files.length} files` : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
