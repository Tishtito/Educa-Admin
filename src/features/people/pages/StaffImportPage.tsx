import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2Icon, ChevronLeftIcon, DownloadIcon, FileSpreadsheetIcon, KeyRoundIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/data/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { parseCsv, rowsToRecords, staffHeaderAliases } from '@/lib/csv'
import { saveBlob } from '@/lib/download'
import { errorMessage } from '@/lib/api/errors'
import type { StaffImportResult } from '@/lib/api/types'
import { useStaffMutations } from '../api'

const TEMPLATE =
  'Full Name,Username,Email,Phone,Staff No,TSC No,Role\r\n' +
  'Grace Wanjiku Kamau,gkamau,grace.kamau@example.com,0712345678,ST-014,123456,Teacher\r\n' +
  'Brian Otieno,botieno,,0722000111,ST-015,,Teacher; Examiner\r\n'

const COLUMNS: [string, string][] = [
  ['Full Name', 'required; or First Name and Last Name columns'],
  ['Username', 'what they sign in with; blank suggests one, like gkamau'],
  ['Email', 'optional; needed to email them an invitation'],
  ['Phone, Staff No, TSC No', 'optional'],
  ['Role', 'Teacher, Class Teacher, Examiner, School Administrator or one of your own roles; several separated by “;”. Blank means Teacher'],
]

const fieldLabels: Record<string, string> = {
  name: 'Name',
  username: 'Username',
  email: 'Email',
  phone: 'Phone',
  staff_no: 'Staff no.',
  tsc_no: 'TSC no.',
  role: 'Role',
}

/** A CSV cell: quoted when it holds a separator, quote or line break. */
const cell = (value: string) => (/[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

function downloadCredentials(credentials: StaffImportResult['credentials']) {
  const lines = ['Name,Username,Temporary password', ...credentials.map((c) => [c.name, c.username, c.temporary_password].map(cell).join(','))]
  void saveBlob(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' }), 'elimupass-staff-sign-in-details.csv')
}

/**
 * Many staff accounts from a spreadsheet, so every teacher can be put on the
 * timetable without typing them in one by one. Nothing is saved until every row
 * is correct, as with the pupils import.
 */
export function StaffImportPage() {
  const { can } = useAuth()
  const { importRows } = useStaffMutations()
  const input = useRef<HTMLInputElement>(null)
  const canInvite = can('invite_staff')
  const [invite, setInvite] = useState(false)
  const [file, setFile] = useState<{ name: string; records: Record<string, string>[]; mapped: Record<string, string | null> } | null>(null)
  const [check, setCheck] = useState<StaffImportResult | null>(null)
  const [done, setDone] = useState<StaffImportResult | null>(null)

  async function choose(selected: File) {
    setCheck(null)
    setDone(null)
    if (selected.size > 1024 * 1024) {
      toast.error('That file is too large. Split it into smaller lists.')
      return
    }
    const { records, mapped } = rowsToRecords(parseCsv(await selected.text()), staffHeaderAliases)
    if (records.length === 0) {
      toast.error('No staff found in that file. Is the first row the column headings?')
      return
    }
    setFile({ name: selected.name, records, mapped })
    try {
      setCheck(await importRows.mutateAsync({ rows: records, dry_run: true, send_invitation: invite }))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function commit() {
    if (!file) return
    try {
      const result = await importRows.mutateAsync({ rows: file.records, dry_run: false, send_invitation: invite })
      if (result.committed) {
        setDone(result)
        setCheck(null)
        setFile(null)
        toast.success(`${result.created} staff accounts created.`)
      } else {
        setCheck(result)
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const errorsByRow = new Map<number, StaffImportResult['errors']>()
  for (const e of check?.errors ?? []) errorsByRow.set(e.row, [...(errorsByRow.get(e.row) ?? []), e])
  const ignored = file ? Object.entries(file.mapped).filter(([, field]) => field === null).map(([h]) => h) : []

  return (
    <>
      <Link to="/staff" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Staff
      </Link>
      <PageHeader title="Import staff" description="Create accounts for many staff at once from a spreadsheet saved as CSV. They can then be given classes and subjects, and be timetabled." />

      {done && (
        <Card className="mb-4 border-emerald-300 dark:border-emerald-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2Icon className="size-4 text-emerald-600" /> {done.created} accounts created
            </CardTitle>
            <CardDescription>
              {done.invited > 0 && `${done.invited} invited by email to choose their own password. `}
              {done.credentials.length > 0 &&
                `${done.credentials.length} have a temporary password they must change at first sign-in. Download them now: they are not shown again.`}
            </CardDescription>
          </CardHeader>
          {done.credentials.length > 0 && (
            <CardContent className="grid gap-3">
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Temporary password</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {done.credentials.map((c) => (
                      <TableRow key={c.username}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="font-mono">{c.username}</TableCell>
                        <TableCell className="font-mono">{c.temporary_password}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
          <CardFooter className="flex-wrap justify-end gap-2">
            {done.credentials.length > 0 && (
              <Button onClick={() => downloadCredentials(done.credentials)}>
                <KeyRoundIcon /> Download sign-in details (CSV)
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/staff">Back to staff</Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">1. Choose a file</CardTitle>
            <CardDescription>One row per member of staff. Only the name is required; a blank role makes them a Teacher.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) void choose(selected)
                e.target.value = ''
              }}
            />
            {canInvite && (
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Switch
                  checked={invite}
                  onCheckedChange={(on) => {
                    setInvite(on)
                    setCheck(null)
                    setFile(null)
                  }}
                />
                <span>
                  Email an invitation to people with an email address
                  <span className="block text-xs text-muted-foreground">They choose their own password. Everyone else gets a temporary one.</span>
                </span>
              </label>
            )}
            <Button onClick={() => input.current?.click()} disabled={importRows.isPending}>
              <UploadIcon /> Choose CSV file
            </Button>
            <Button variant="outline" onClick={() => void saveBlob(new Blob([TEMPLATE], { type: 'text/csv' }), 'elimupass-staff-template.csv')}>
              <DownloadIcon /> Download a template
            </Button>
            <p className="text-xs text-muted-foreground">In Excel or Google Sheets use File → Save as / Download → CSV.</p>
            <div className="grid gap-1 border-t pt-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Columns</div>
              {COLUMNS.map(([column, hint]) => (
                <div key={column}>
                  <span className="text-foreground">{column}</span> — {hint}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheetIcon className="size-4" /> 2. Check and import
            </CardTitle>
            <CardDescription>{file ? `${file.name} · ${file.records.length} rows` : 'Nothing is saved until every row is correct and you press Import.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {importRows.isPending && !check && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Checking…
              </p>
            )}
            {ignored.length > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {ignored.map((h) => `“${h}”`).join(', ')}</p>}
            {check && check.errors.length === 0 && (
              <Alert>
                <CheckCircle2Icon />
                <AlertTitle>All {check.total} rows look right</AlertTitle>
                <AlertDescription>Check the usernames and roles, then import.</AlertDescription>
              </Alert>
            )}
            {check && check.errors.length > 0 && (
              <>
                <Alert variant="destructive">
                  <AlertTitle>
                    {check.total - check.valid} of {check.total} rows need fixing
                  </AlertTitle>
                  <AlertDescription>Fix them in the spreadsheet and choose the file again. Nothing has been saved.</AlertDescription>
                </Alert>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Problems</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...errorsByRow.entries()].slice(0, 100).map(([row, errors]) => (
                        <TableRow key={row}>
                          {/* +1: the spreadsheet's first row is the headings. */}
                          <TableCell className="tabular-nums">{row + 1}</TableCell>
                          <TableCell className="text-sm">
                            {errors.map((e) => (
                              <div key={e.field + e.message}>
                                <Badge variant="outline" className="mr-1.5">
                                  {fieldLabels[e.field] ?? e.field}
                                </Badge>
                                {e.message}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {check && check.errors.length === 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Sign-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.preview.map((row) => (
                      <TableRow key={row.username}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="font-mono">{row.username}</TableCell>
                        <TableCell>{row.email ?? '—'}</TableCell>
                        <TableCell>{row.phone ?? '—'}</TableCell>
                        <TableCell>{row.role_names.join(', ')}</TableCell>
                        <TableCell>{row.invite ? 'Email invitation' : 'Temporary password'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {check.total > check.preview.length && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">…and {check.total - check.preview.length} more.</p>
                )}
              </div>
            )}
          </CardContent>
          {check && check.errors.length === 0 && (
            <CardFooter className="justify-end">
              <Button onClick={() => void commit()} disabled={importRows.isPending}>
                {importRows.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                Import {check.total} accounts
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </>
  )
}
