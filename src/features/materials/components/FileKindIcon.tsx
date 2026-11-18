import { FileIcon, FileImageIcon, FileSpreadsheetIcon, FileTextIcon, PresentationIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileKind } from '../model'

const styles = {
  pdf: 'bg-red-500/10 text-red-600 dark:text-red-400',
  word: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  slides: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  sheet: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  image: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  file: 'bg-muted text-muted-foreground',
} as const

const icons = { pdf: FileTextIcon, word: FileTextIcon, slides: PresentationIcon, sheet: FileSpreadsheetIcon, image: FileImageIcon, file: FileIcon }

export function FileKindIcon({ extension, className }: { extension: string; className?: string }) {
  const kind = fileKind(extension)
  const Icon = icons[kind]
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', styles[kind], className)} title={extension.toUpperCase()}>
      <Icon className="size-4.5" />
    </span>
  )
}
