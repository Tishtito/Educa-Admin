import { describe, expect, it } from 'vitest'
import { formatDate, formatScore } from './format'
import { sanitizeFilename } from './download'

describe('formatters', () => {
  it('formats date-only strings without shifting the day', () => {
    expect(formatDate('2026-04-03')).toBe('3 Apr 2026')
    expect(formatDate(null)).toBe('—')
  })

  it('trims trailing zeros from scores', () => {
    expect(formatScore(71)).toBe('71')
    expect(formatScore(71.5)).toBe('71.5')
    expect(formatScore(71.25)).toBe('71.25')
    expect(formatScore(null)).toBe('—')
  })

  it('makes safe filenames', () => {
    expect(sanitizeFilename('Grade 5 Blue / Term 1: End-Term.pdf')).toBe('Grade-5-Blue-Term-1-End-Term.pdf')
  })
})
