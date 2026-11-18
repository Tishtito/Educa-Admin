import { describe, expect, it } from 'vitest'
import { fileKind, fileProblem, gradesInSection, gradesLabel, titleFromFileName } from './model'

const levels = [
  { id: 1, grades: [{ id: 11 }, { id: 12 }, { id: 13 }] },
  { id: 2, grades: [{ id: 14 }, { id: 15 }, { id: 16 }] },
] as never

describe('gradesInSection', () => {
  it('keeps only grades of the chosen section', () => {
    expect(gradesInSection(levels, 2, [11, 15, 16])).toEqual([15, 16])
  })

  it('drops everything when no section is chosen', () => {
    expect(gradesInSection(levels, null, [11])).toEqual([])
  })
})

describe('titleFromFileName', () => {
  it('drops the extension and any path', () => {
    expect(titleFromFileName('C:\\docs\\Grade_5 Maths scheme.pdf')).toBe('Grade 5 Maths scheme')
    expect(titleFromFileName('notes')).toBe('notes')
    expect(titleFromFileName('.pdf')).toBe('.pdf')
  })
})

describe('fileProblem', () => {
  it('accepts allowed types under 20 MB', () => {
    expect(fileProblem({ name: 'a.PDF', size: 1024 })).toBeNull()
    expect(fileProblem({ name: 'b.pptx', size: 20 * 1024 * 1024 })).toBeNull()
  })

  it('refuses other types and big files', () => {
    expect(fileProblem({ name: 'clip.mp4', size: 10 })).toMatch(/Only PDF/)
    expect(fileProblem({ name: 'big.pdf', size: 20 * 1024 * 1024 + 1 })).toMatch(/20 MB/)
  })
})

describe('labels', () => {
  it('names grades or the whole section', () => {
    expect(gradesLabel([])).toBe('Whole section')
    expect(gradesLabel([{ name: 'Grade 4' }, { name: 'Grade 5' }])).toBe('Grade 4, Grade 5')
  })

  it('groups extensions into kinds', () => {
    expect(fileKind('docx')).toBe('word')
    expect(fileKind('jpeg')).toBe('image')
    expect(fileKind('zip')).toBe('file')
  })
})
