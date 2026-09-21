/**
 * A small RFC 4180 CSV reader for pupil lists exported from Excel or Google
 * Sheets: quoted fields, escaped quotes, commas or semicolons, CRLF, BOM.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = { ',': firstLine.split(',').length, ';': firstLine.split(';').length, '\t': firstLine.split('\t').length }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',') as ',' | ';' | '\t'
}

/** Column headings people actually use, mapped to the import's field names. */
const headerAliases: Record<string, string> = {
  // CBC's word for the pupil's school identifier. Files headed "Admission No"
  // are refused, with a message naming the column to use.
  assessment_no: 'assessment_no',
  assessment_number: 'assessment_no',
  assessment: 'assessment_no',
  assmt_no: 'assessment_no',
  name: 'name',
  full_name: 'name',
  pupil_name: 'name',
  student_name: 'name',
  first_name: 'first_name',
  firstname: 'first_name',
  middle_name: 'middle_name',
  other_names: 'middle_name',
  last_name: 'last_name',
  surname: 'last_name',
  lastname: 'last_name',
  gender: 'gender',
  sex: 'gender',
  date_of_birth: 'date_of_birth',
  dob: 'date_of_birth',
  birth_date: 'date_of_birth',
  class: 'class',
  class_name: 'class',
  stream: 'class',
  grade: 'class',
  guardian_name: 'guardian_name',
  parent_name: 'guardian_name',
  parent: 'guardian_name',
  guardian: 'guardian_name',
  guardian_phone: 'guardian_phone',
  parent_phone: 'guardian_phone',
  phone: 'guardian_phone',
  phone_number: 'guardian_phone',
  upi: 'upi',
  nemis_upi: 'upi',
}

export const importFields = ['assessment_no', 'name', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'class', 'guardian_name', 'guardian_phone', 'upi'] as const

export function normaliseHeader(header: string): string | null {
  const key = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return headerAliases[key] ?? null
}

/** Rows as objects keyed by import field; unknown columns are dropped. */
export function rowsToRecords(rows: string[][]): { records: Record<string, string>[]; mapped: Record<string, string | null> } {
  const [header = [], ...body] = rows
  const fields = header.map(normaliseHeader)
  const mapped = Object.fromEntries(header.map((h, i) => [h, fields[i]]))
  const records = body.map((cells) => {
    const record: Record<string, string> = {}
    fields.forEach((field, i) => {
      if (field && cells[i] !== undefined && !(field in record && record[field])) record[field] = cells[i].trim()
    })
    return record
  })
  return { records, mapped }
}
