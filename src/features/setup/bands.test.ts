import { describe, expect, it } from 'vitest'
import { bandProblems, nextBandStart } from './bands'

const band = (label: string, min: number, max: number) => ({ label, min_marks: min, max_marks: max })

describe('bandProblems', () => {
  it('accepts contiguous whole-number bands from 0 to 100, in any order', () => {
    expect(bandProblems([band('EE', 76, 100), band('BE', 0, 25), band('AE', 26, 50), band('ME', 51, 75)])).toEqual({})
  })

  it('reports a gap and an overlap against the right band', () => {
    expect(bandProblems([band('A', 0, 39), band('B', 41, 100)])).toEqual({
      'bands.1.min_marks': 'Leaves a gap after "A": start at 40.',
    })
    expect(bandProblems([band('A', 0, 50), band('B', 50, 100)])).toEqual({
      'bands.1.min_marks': 'Overlaps "A", which ends at 50.',
    })
  })

  it('requires the scale to cover 0 and 100', () => {
    expect(bandProblems([band('A', 1, 50), band('B', 51, 99)])).toEqual({
      'bands.0.min_marks': 'The lowest band must start at 0.',
      'bands.1.max_marks': 'The highest band must end at 100.',
    })
  })

  it('rejects decimals, inverted bands and empty scales', () => {
    expect(bandProblems([band('A', 0, 49.5), band('B', 50, 100)])).toHaveProperty(['bands.0.min_marks'])
    expect(bandProblems([band('A', 60, 10)])).toHaveProperty(['bands.0.max_marks'])
    expect(bandProblems([])).toEqual({ bands: 'A scale needs at least one band.' })
  })

  it('suggests where the next band starts', () => {
    expect(nextBandStart([])).toBe(0)
    expect(nextBandStart([{ max_marks: 39 }, { max_marks: 59 }])).toBe(60)
  })
})
