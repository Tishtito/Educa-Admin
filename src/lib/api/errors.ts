/**
 * Every failed API call surfaces as an ApiError, whatever shape the server
 * used: Laravel validation (422 {message, errors}), the app's own envelope
 * ({success: false, message}), or no body at all (network failure).
 */
export class ApiError extends Error {
  readonly status: number
  /** Laravel validation errors, keyed by field path ("marks.3.raw_score"). */
  readonly fieldErrors: Record<string, string[]>
  readonly body: unknown

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.body = body
  }

  get isValidation() {
    return this.status === 422
  }

  /** 409: a rule of the exam lifecycle refused the action. The message is written for people. */
  get isConflict() {
    return this.status === 409
  }

  get isNetwork() {
    return this.status === 0
  }

  /** First message for a field, if any. */
  field(name: string): string | undefined {
    return this.fieldErrors[name]?.[0]
  }

  /**
   * Row-level errors for batch payloads. For prefix "marks", maps
   * "marks.3.raw_score" to {3: {raw_score: "..."}}.
   */
  rows(prefix: string): Record<number, Record<string, string>> {
    const out: Record<number, Record<string, string>> = {}
    const pattern = new RegExp(`^${prefix}\\.(\\d+)(?:\\.(.+))?$`)
    for (const [key, messages] of Object.entries(this.fieldErrors)) {
      const match = pattern.exec(key)
      if (!match || !messages[0]) continue
      const index = Number(match[1])
      out[index] ??= {}
      out[index][match[2] ?? '_row'] = messages[0]
    }
    return out
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Non-JSON body (proxy error page, empty 5xx).
  }

  const record = (body ?? {}) as { message?: unknown; errors?: unknown }
  const message =
    typeof record.message === 'string' && record.message !== ''
      ? record.message
      : defaultMessage(response.status)
  const fieldErrors =
    record.errors && typeof record.errors === 'object' ? (record.errors as Record<string, string[]>) : {}

  return new ApiError(response.status, message, fieldErrors, body)
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Please sign in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'That record could not be found.'
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (status >= 500) return 'The server ran into a problem. Please try again.'
  return 'Something went wrong. Please try again.'
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
