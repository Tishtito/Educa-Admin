import type { RoleSlug } from './api/types'

const roleLabels: Record<RoleSlug, string> = {
  super_admin: 'Platform admin',
  school_admin: 'School admin',
  class_teacher: 'Class teacher',
  examiner: 'Examiner',
}

export const roleLabel = (role: RoleSlug) => roleLabels[role] ?? role

const dateFormat = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-KE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "2026-04-03" → "3 Apr 2026". Date-only strings are read as local dates, not UTC midnight. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date)
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return 'never'
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (Number.isNaN(seconds)) return '—'
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatDate(value)
}

/** Marks: whole numbers stay whole, otherwise up to two decimals. */
export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

const money = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `KSh ${money.format(value)}`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
