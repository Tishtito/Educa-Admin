import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle2Icon, ChevronLeftIcon, DownloadIcon, FileSpreadsheetIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/data/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentAcademicYear } from '@/features/reference/api'
import { parseCsv, rowsToRecords } from '@/lib/csv'
import { saveBlob } from '@/lib/download'
import { errorMessage } from '@/lib/api/errors'
import type { ImportResult } from '@/lib/api/types'
import { useStudentMutations } from '../api'

const TEMPLATE = 'Admission No,First Name,Middle Name,Last Name,Gender,Date of Birth,Class,Guardian Name,Guardian Phone,UPI\r\nGAT-101,Achieng,Atieno,Odhiambo,Female,21/03/2016,Grade 4 Blue,Mary Odhiambo,0712000111,\r\n'

const fieldLabels: Record<string, string> = {
  admission_no: 'Admission no.',
  name: 'Name',
  first_name: 'First name',
  middle_name: 'Middle name',
  last_name: 'Last name',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  class: 'Class',
  guardian_name: 'Guardian',
  guardian_phone: 'Guardian phone',
  upi: 'UPI',
}

export function StudentImportPage() {
  const navigate = useNavigate()
  const year = useCurrentAcademicYear()
  const { importRows } = useStudentMutations()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; records: Record<string, string>[]; mapped: Record<string, string | null> } | null>(null)
  const [check, setCheck] = useState<ImportResult | null>(null)

  async function choose(selected: File) {
    setCheck(null)
    if (selected.size > 2 * 1024 * 1024) {
      toast.error('That file is too large. Split it into smaller class lists.')
      return
    }
    const text = await selected.text()
    const { records, mapped } = rowsToRecords(parseCsv(text))
    if (records.length === 0) {
      toast.error('No pupils found in that file. Is the first row the column headings?')
      return
    }
    setFile({ name: selected.name, records, mapped })
    try {
      setCheck(await importRows.mutateAsync({ rows: records, dry_run: true }))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function commit() {
    if (!file) return
    try {
      const result = await importRows.mutateAsync({ rows: file.records, dry_run: false })
      setCheck(result)
      if (result.committed) {
        toast.success(`${result.created} pupils admitted.`)
        navigate('/students', { replace: true })
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const errorsByRow = new Map<number, ImportResult['errors']>()
  for (const e of check?.errors ?? []) errorsByRow.set(e.row, [...(errorsByRow.get(e.row) ?? []), e])
  const ignored = file ? Object.entries(file.mapped).filter(([, field]) => field === null).map(([h]) => h) : []

  return (
    <>
      <Link to="/students" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Pupils
      </Link>
      <PageHeader
        title="Import pupils"
        description={`Admit a class list from a spreadsheet saved as CSV. Pupils are placed in their class for ${year.current?.name ?? 'the current year'}.`}
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">1. Choose a file</CardTitle>
            <CardDescription>
              Needs an admission number, the pupil’s name (one “Name” column or first and last name) and their class, spelled as on the Classes
              page. Gender, date of birth and guardian details are optional.
            </CardDescription>
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
            <Button onClick={() => input.current?.click()} disabled={importRows.isPending || !year.current}>
              <UploadIcon /> Choose CSV file
            </Button>
            <Button variant="outline" onClick={() => void saveBlob(new Blob([TEMPLATE], { type: 'text/csv' }), 'educa-pupils-template.csv')}>
              <DownloadIcon /> Download a template
            </Button>
            <p className="text-xs text-muted-foreground">In Excel or Google Sheets use File → Save as / Download → CSV.</p>
            {!year.current && year.data && <p className="text-sm text-destructive">Set a current academic year first.</p>}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheetIcon className="size-4" /> 2. Check and import
            </CardTitle>
            <CardDescription>
              {file ? `${file.name} · ${file.records.length} rows` : 'Nothing is saved until every row is correct and you press Import.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {importRows.isPending && !check && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Checking…
              </p>
            )}
            {ignored.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ignored columns: {ignored.map((h) => `“${h}”`).join(', ')}
              </p>
            )}
            {check && check.errors.length === 0 && (
              <Alert>
                <CheckCircle2Icon />
                <AlertTitle>All {check.total} rows look right</AlertTitle>
                <AlertDescription>Check the preview, then import.</AlertDescription>
              </Alert>
            )}
            {check && check.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>
                  {check.total - check.valid} of {check.total} rows need fixing
                </AlertTitle>
                <AlertDescription>Fix them in the spreadsheet and choose the file again. Nothing has been saved.</AlertDescription>
              </Alert>
            )}

            {check && check.errors.length > 0 && (
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
            )}

            {check && check.errors.length === 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adm. no.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Born</TableHead>
                      <TableHead>Guardian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.admission_no}</TableCell>
                        <TableCell>{[row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')}</TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell>{row.gender ?? '—'}</TableCell>
                        <TableCell>{row.date_of_birth ?? '—'}</TableCell>
                        <TableCell>{row.guardian_name ?? '—'}</TableCell>
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
                Import {check.total} pupils
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </>
  )
}
