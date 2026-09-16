import type { GradeBand } from '@/lib/api/types'

export const BAND_MIN = 0
export const BAND_MAX = 100

/**
 * Mirrors GradingScaleService::problems() on the server: whole-number bands
 * covering 0-100 exactly, no gaps or overlaps. Keys match the API's error keys
 * (bands.{i}.field) so server and client errors land in the same place.
 */
export function bandProblems(bands: Pick<GradeBand, 'label' | 'min_marks' | 'max_marks'>[]): Record<string, string> {
  if (bands.length === 0) return { bands: 'A scale needs at least one band.' }

  const problems: Record<string, string> = {}
  const indexed = bands.map((band, index) => ({ ...band, index, min: Number(band.min_marks), max: Number(band.max_marks) }))

  for (const band of indexed) {
    if (!Number.isFinite(band.min) || !Number.isFinite(band.max) || !Number.isInteger(band.min) || !Number.isInteger(band.max)) {
      problems[`bands.${band.index}.min_marks`] = 'Band limits are whole numbers.'
    } else if (band.min > band.max) {
      problems[`bands.${band.index}.max_marks`] = 'The top of a band cannot be below its bottom.'
    }
  }
  if (Object.keys(problems).length) return problems

  const sorted = [...indexed].sort((a, b) => a.min - b.min)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (first.min !== BAND_MIN) problems[`bands.${first.index}.min_marks`] = 'The lowest band must start at 0.'
  if (last.max !== BAND_MAX) problems[`bands.${last.index}.max_marks`] = 'The highest band must end at 100.'

  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1]
    const upper = sorted[i]
    const expected = lower.max + 1
    if (upper.min < expected) {
      problems[`bands.${upper.index}.min_marks`] = `Overlaps "${lower.label}", which ends at ${lower.max}.`
    } else if (upper.min > expected) {
      problems[`bands.${upper.index}.min_marks`] = `Leaves a gap after "${lower.label}": start at ${expected}.`
    }
  }

  return problems
}

/** Where the next band should start, so adding a band never opens a gap. */
export function nextBandStart(bands: Pick<GradeBand, 'max_marks'>[]): number {
  if (bands.length === 0) return BAND_MIN
  return Math.min(BAND_MAX, Math.max(...bands.map((b) => Number(b.max_marks) || 0)) + 1)
}
