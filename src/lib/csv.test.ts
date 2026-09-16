import { describe, expect, it } from 'vitest'
import { normaliseHeader, parseCsv, rowsToRecords } from './csv'

describe('parseCsv', () => {
  it('reads quoted fields, escaped quotes, CRLF and a BOM', () => {
    const text = '\uFEFFAdm No,Name,Class\r\nGAT-1,"Otieno, Jane ""JJ""",Grade 4 Blue\r\n\r\nGAT-2,Brian Kemboi,Grade 4 Blue\r\n'
    expect(parseCsv(text)).toEqual([
      ['Adm No', 'Name', 'Class'],
      ['GAT-1', 'Otieno, Jane "JJ"', 'Grade 4 Blue'],
      ['GAT-2', 'Brian Kemboi', 'Grade 4 Blue'],
    ])
  })

  it('detects semicolon-separated exports', () => {
    expect(parseCsv('adm;name\nA1;Jane')).toEqual([
      ['adm', 'name'],
      ['A1', 'Jane'],
    ])
  })
})

describe('headers', () => {
  it('maps the headings schools use', () => {
    expect(normaliseHeader('Admission Number')).toBe('admission_no')
    expect(normaliseHeader(' Surname ')).toBe('last_name')
    expect(normaliseHeader('D.O.B')).toBeNull()
    expect(normaliseHeader('DOB')).toBe('date_of_birth')
    expect(normaliseHeader('Parent Phone')).toBe('guardian_phone')
  })

  it('turns rows into records and reports unmapped columns', () => {
    const { records, mapped } = rowsToRecords([
      ['Adm', 'Pupil Name', 'Class', 'Fees'],
      ['A1', 'Jane Otieno', 'Grade 4 Blue', '2000'],
    ])
    expect(records).toEqual([{ admission_no: 'A1', name: 'Jane Otieno', class: 'Grade 4 Blue' }])
    expect(mapped.Fees).toBeNull()
  })
})
