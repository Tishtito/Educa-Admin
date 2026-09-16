import type { AggregationRule } from '@/lib/api/types'

export const aggregationLabels: Record<AggregationRule, string> = {
  single: 'Single paper',
  percentage_of_combined_max: 'Percentage of the papers’ combined total',
  sum: 'Sum of the papers',
  average: 'Average of the papers',
  weighted_sum: 'Weighted sum of the papers',
}
