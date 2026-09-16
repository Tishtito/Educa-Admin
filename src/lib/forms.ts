import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage } from './api/errors'

/**
 * Shows an API failure on a form: validation messages on their fields (or as
 * a toast for fields the form does not render), anything else as a toast.
 */
export function showFormError<T extends FieldValues>(form: UseFormReturn<T>, error: unknown, fields?: readonly Path<T>[]) {
  if (error instanceof ApiError && error.isValidation) {
    const unplaced: string[] = []
    for (const [key, messages] of Object.entries(error.fieldErrors)) {
      const root = key.split('.')[0] as Path<T>
      const known = fields ? fields.includes(key as Path<T>) || fields.includes(root) : true
      if (known) form.setError((fields?.includes(key as Path<T>) ? key : root) as Path<T>, { message: messages[0] })
      else if (messages[0]) unplaced.push(messages[0])
    }
    if (unplaced.length) toast.error(unplaced.join(' '))
    return
  }
  toast.error(errorMessage(error))
}

/** "" → null, otherwise a number; for optional numeric inputs. */
export function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
