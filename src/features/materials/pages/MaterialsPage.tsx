import { useDeferredValue, useRef, useState } from 'react'
import {
  ArchiveRestoreIcon,
  EyeIcon,
  EyeOffIcon,
  FileUpIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLevels } from '@/features/reference/api'
import { errorMessage } from '@/lib/api/errors'
import type { Level, TeachingMaterial } from '@/lib/api/types'
import { formatBytes, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { openMaterial, useMaterialMutations, useMaterials, useMaterialSummary, type MaterialFilters } from '../api'
import { EditMaterialDialog } from '../components/EditMaterialDialog'
import { FileKindIcon } from '../components/FileKindIcon'
import { UploadDialog } from '../components/UploadDialog'
import { MATERIAL_ACCEPT, fileProblem, gradesLabel } from '../model'

type View = 'all' | 'published' | 'draft' | 'deleted'

/** Teaching materials: files the school shares with its teachers, by section and grade. */
export function MaterialsPage() {
  const levels = useLevels()

  return (
    <>
      <PageHeader title="Teaching materials" description="Schemes of work, notes and past papers for your teachers. Teachers see published files in Elimu Pass Portal." />
      <QueryState query={levels}>{(data) => <MaterialsBrowser levels={[...data].sort((a, b) => a.min_grade - b.min_grade)} />}</QueryState>
    </>
  )
}

function MaterialsBrowser({ levels }: { levels: Level[] }) {
  const summary = useMaterialSummary()
  const [levelId, setLevelId] = useState<number>(levels[0]?.id ?? 0)
  const [gradeId, setGradeId] = useState<number | null>(null)
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const q = useDeferredValue(search.trim())

  const filters: MaterialFilters = {
    level_id: levelId,
    grade_id: gradeId ?? undefined,
    q: q || undefined,
    status: view === 'published' || view === 'draft' ? view : undefined,
    deleted: view === 'deleted' || undefined,
    page,
  }
  const materials = useMaterials(filters)
  const levelSummary = summary.data?.levels.find((l) => l.id === levelId)
  const level = levels.find((l) => l.id === levelId)

  const resetPage = () => setPage(1)

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={String(levelId)}
          onValueChange={(v) => {
            setLevelId(Number(v))
            setGradeId(null)
            resetPage()
          }}
        >
          <TabsList className="h-auto max-w-full flex-wrap">
            {levels.map((l) => {
              const count = summary.data?.levels.find((s) => s.id === l.id)?.count
              return (
                <TabsTrigger key={l.id} value={String(l.id)} className="gap-1.5">
                  {l.name}
                  {count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{count}</span>}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <Button onClick={() => setUploading(true)}>
          <UploadIcon /> Upload
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={gradeId === null} onClick={() => (setGradeId(null), resetPage())}>
          All
        </Chip>
        {[...(level?.grades ?? [])]
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((g) => (
            <Chip key={g.id} active={gradeId === g.id} onClick={() => (setGradeId(g.id), resetPage())}>
              {g.name}
              <span className="text-xs opacity-70 tabular-nums">{levelSummary?.grades.find((s) => s.id === g.id)?.count ?? ''}</span>
            </Chip>
          ))}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => (setSearch(e.target.value), resetPage())} placeholder="Search titles" className="pl-8" aria-label="Search materials" />
          </div>
          <Select value={view} onValueChange={(v) => (setView(v as View), resetPage())}>
            <SelectTrigger className="w-36" aria-label="Show">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Drafts{levelSummary?.drafts ? ` (${levelSummary.drafts})` : ''}</SelectItem>
              <SelectItem value="deleted">Recently deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <QueryState query={materials}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState
              icon={<FolderOpenIcon />}
              title={view === 'deleted' ? 'Nothing deleted recently' : q ? 'No materials match' : `No ${level?.name.toLowerCase() ?? ''} materials yet`}
              description={view === 'deleted' ? 'Deleted materials can be restored here for 30 days.' : 'Upload schemes of work, notes or past papers, and teachers will find them in the portal.'}
              action={
                view !== 'deleted' && !q ? (
                  <Button variant="outline" onClick={() => setUploading(true)}>
                    <UploadIcon /> Upload
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="hidden md:table-cell">Grades</TableHead>
                      <TableHead className="hidden lg:table-cell">Subject</TableHead>
                      <TableHead className="hidden sm:table-cell">Added</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.data.map((m) => (
                      <MaterialRow key={m.id} material={m} levels={levels} deletedView={view === 'deleted'} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
              {result.meta.last_page > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  Page {result.meta.current_page} of {result.meta.last_page}
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= result.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        }
      </QueryState>

      {uploading && (
        <UploadDialog
          open
          onOpenChange={setUploading}
          levels={levels}
          defaultLevelId={levelId}
          onUploaded={(uploadedLevelId) => {
            // Show the section the files went into, so the upload is visible.
            setLevelId(uploadedLevelId)
            setGradeId(null)
            setView('all')
            setPage(1)
          }}
        />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function MaterialRow({ material, levels, deletedView }: { material: TeachingMaterial; levels: Level[]; deletedView: boolean }) {
  const { replace, setStatus, remove, restore } = useMaterialMutations()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [opening, setOpening] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const published = material.status === 'published'

  async function preview() {
    setOpening(true)
    try {
      await openMaterial(material)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setOpening(false)
    }
  }

  function replaceWith(file: File | undefined) {
    if (!file) return
    const problem = fileProblem(file)
    if (problem) return void toast.error(problem)
    const pending = toast.loading(`Replacing ${material.title}…`)
    replace.mutate(
      { id: material.id, file },
      {
        onSuccess: (result) => {
          toast.success('File replaced.', { id: pending })
          if (result.duplicate_of) toast.warning(`This file is already uploaded as “${result.duplicate_of.title}”.`)
        },
        onError: () => toast.dismiss(pending),
      },
    )
  }

  // mutateAsync, not mutate: Undo is clicked after the deleted row has left the
  // list, and mutate's per-call callbacks do not run once their component unmounts.
  const undo = () =>
    void restore
      .mutateAsync(material.id)
      .then(() => toast.success(`${material.title} restored.`))
      .catch(() => undefined)

  return (
    <TableRow className={cn(deletedView && 'text-muted-foreground')}>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <FileKindIcon extension={material.extension} />
          <div className="min-w-0">
            <button type="button" className="block max-w-[16rem] truncate text-left font-medium hover:underline sm:max-w-md" onClick={() => void preview()} disabled={opening}>
              {material.title}
            </button>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="uppercase">{material.extension}</span>
              <span>{formatBytes(material.size_bytes)}</span>
              {!published && !deletedView && <Badge variant="outline">Draft</Badge>}
              <span className="md:hidden">· {gradesLabel(material.grades)}</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{gradesLabel(material.grades)}</TableCell>
      <TableCell className="hidden lg:table-cell">{material.subject?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="hidden text-sm sm:table-cell">
        {formatDate(material.created_at)}
        {material.uploaded_by && <div className="text-xs text-muted-foreground">{material.uploaded_by.name}</div>}
      </TableCell>
      <TableCell>
        {deletedView ? (
          <Button variant="outline" size="sm" onClick={undo} disabled={restore.isPending}>
            <ArchiveRestoreIcon /> Restore
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${material.title}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void preview()}>
                <EyeIcon /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                <FileUpIcon /> Replace file
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setStatus.mutate(
                    { id: material.id, status: published ? 'draft' : 'published' },
                    { onSuccess: () => toast.success(published ? 'Hidden from teachers.' : 'Published to teachers.') },
                  )
                }
              >
                {published ? <EyeOffIcon /> : <SendIcon />} {published ? 'Unpublish' : 'Publish'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input ref={fileInput} type="file" accept={MATERIAL_ACCEPT} className="hidden" onChange={(e) => (replaceWith(e.target.files?.[0]), (e.target.value = ''))} />
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${material.title}?`}
          description="Teachers will no longer see it. You can restore it from Recently deleted for 30 days."
          confirmLabel="Delete"
          destructive
          onConfirm={() =>
            remove.mutateAsync(material.id).then(() => toast.success(`${material.title} deleted.`, { action: { label: 'Undo', onClick: undo }, duration: 10_000 }))
          }
        />
        {editing && <EditMaterialDialog material={material} levels={levels} onClose={() => setEditing(false)} />}
      </TableCell>
    </TableRow>
  )
}
