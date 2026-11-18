import type { Level } from '@/lib/api/types'

/** What the API accepts (Educa_Lara TeachingMaterialRules). Checked here only to fail fast. */
export const MATERIAL_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'] as const
export const MATERIAL_ACCEPT = MATERIAL_EXTENSIONS.map((e) => `.${e}`).join(',')
export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** The title an upload gets when none is typed: the file name without its extension. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '')
  const dot = base.lastIndexOf('.')
  return (dot > 0 ? base.slice(0, dot) : base).replace(/[_]+/g, ' ').trim().slice(0, 190) || 'Untitled'
}

/** Why a picked file will be refused, or null when it can go. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!(MATERIAL_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return 'Only PDF, Word, PowerPoint, Excel, JPEG and PNG files can be uploaded.'
  }
  if (file.size > MAX_MATERIAL_BYTES) return 'Files must be 20 MB or smaller.'
  return null
}

/**
 * Keep only grades from the chosen section. Switching section must not carry
 * grades over: the API refuses a Grade 8 tag on an upper primary material.
 */
export function gradesInSection(levels: Pick<Level, 'id' | 'grades'>[], levelId: number | null, gradeIds: number[]): number[] {
  const allowed = new Set(levels.find((l) => l.id === levelId)?.grades.map((g) => g.id) ?? [])
  return gradeIds.filter((id) => allowed.has(id))
}

/** "Grade 4, Grade 5" or "Whole section". */
export function gradesLabel(grades: { name: string }[] | undefined): string {
  return grades && grades.length > 0 ? grades.map((g) => g.name).join(', ') : 'Whole section'
}

export type FileKind = 'pdf' | 'word' | 'slides' | 'sheet' | 'image' | 'file'

export function fileKind(extension: string): FileKind {
  switch (extension) {
    case 'pdf':
      return 'pdf'
    case 'doc':
    case 'docx':
      return 'word'
    case 'ppt':
    case 'pptx':
      return 'slides'
    case 'xls':
    case 'xlsx':
      return 'sheet'
    case 'jpg':
    case 'jpeg':
    case 'png':
      return 'image'
    default:
      return 'file'
  }
}

/** PDFs and images open in a tab; Office files are saved. */
export const opensInline = (extension: string) => ['pdf', 'jpg', 'jpeg', 'png'].includes(extension)
