import { describe, expect, it } from 'vitest'
import { normaliseHeader, parseCsv, rowsToRecords, staffHeaderAliases } from './csv'

describe('parseCsv', () => {
  it('reads quoted fields, escaped quotes, CRLF and a BOM', () => {
    const text = '\uFEFFAssessment No,Name,Class\r\nGAT-1,"Otieno, Jane ""JJ""",Grade 4 Blue\r\n\r\nGAT-2,Brian Kemboi,Grade 4 Blue\r\n'
    expect(parseCsv(text)).toEqual([
      ['Assessment No', 'Name', 'Class'],
      ['GAT-1', 'Otieno, Jane "JJ"', 'Grade 4 Blue'],
      ['GAT-2', 'Brian Kemboi', 'Grade 4 Blue'],
    ])
  })

  it('detects semicolon-separated exports', () => {
    expect(parseCsv('assessment;name\nA1;Jane')).toEqual([
      ['assessment', 'name'],
      ['A1', 'Jane'],
    ])
  })
})

describe('headers', () => {
  it('maps the headings schools use', () => {
    expect(normaliseHeader('Assessment Number')).toBe('assessment_no')
    // CBC's word: a file still headed the old way is reported as unmapped, not silently accepted.
    expect(normaliseHeader('Admission No')).toBeNull()
    expect(normaliseHeader(' Surname ')).toBe('last_name')
    expect(normaliseHeader('D.O.B')).toBeNull()
    expect(normaliseHeader('DOB')).toBe('date_of_birth')
    expect(normaliseHeader('Parent Phone')).toBe('guardian_phone')
    expect(normaliseHeader('Status')).toBe('status')
    expect(normaliseHeader('Date Joined')).toBe('started_on')
    expect(normaliseHeader('Joining date')).toBe('started_on')
  })

  it('turns rows into records and reports unmapped columns', () => {
    const { records, mapped } = rowsToRecords([
      ['Assessment No', 'Pupil Name', 'Class', 'Fees'],
      ['A1', 'Jane Otieno', 'Grade 4 Blue', '2000'],
    ])
    expect(records).toEqual([{ assessment_no: 'A1', name: 'Jane Otieno', class: 'Grade 4 Blue' }])
    expect(mapped.Fees).toBeNull()
  })

  it('reads a staff list with the staff headings', () => {
    const { records, mapped } = rowsToRecords(
      [
        ['Full Name', 'User Name', 'Email Address', 'Mobile', 'TSC No', 'Roles', 'Subject'],
        ['Grace Kamau', 'gkamau', 'grace@example.com', '0712000000', '123456', 'Teacher; Examiner', 'Maths'],
      ],
      staffHeaderAliases,
    )
    expect(records).toEqual([
      { name: 'Grace Kamau', username: 'gkamau', email: 'grace@example.com', phone: '0712000000', tsc_no: '123456', role: 'Teacher; Examiner' },
    ])
    expect(mapped.Subject).toBeNull()
    // Pupil headings are unchanged by the staff ones.
    expect(normaliseHeader('Phone')).toBe('guardian_phone')
    expect(normaliseHeader('Phone', staffHeaderAliases)).toBe('phone')
  })
})
