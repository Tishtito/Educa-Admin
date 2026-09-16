import type { StudentStatus } from '@/lib/api/types'

export const studentStatusLabel: Record<StudentStatus, string> = {
  active: 'Active',
  transferred: 'Transferred',
  graduated: 'Graduated',
  inactive: 'Inactive',
}
