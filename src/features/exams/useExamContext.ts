import { useOutletContext, useSearchParams } from 'react-router'
import type { Exam } from '@/lib/api/types'

export interface ExamOutletContext {
  exam: Exam
}

export function useExamContext() {
  return useOutletContext<ExamOutletContext>()
}

/**
 * The class chosen on a tab, kept in the URL (?class=) so a mark list or
 * report card page can be bookmarked or shared, and survives a reload.
 */
export function useSelectedClass(exam: Exam): [number | null, (classId: number) => void] {
  const [params, setParams] = useSearchParams()
  const fromUrl = Number(params.get('class'))
  const classes = exam.classes ?? []
  const selected = classes.some((c) => c.id === fromUrl) ? fromUrl : classes.length === 1 ? classes[0].id : null

  const select = (classId: number) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('class', String(classId))
        return next
      },
      { replace: true },
    )

  return [selected, select]
}
