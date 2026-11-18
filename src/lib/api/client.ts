import { ApiError, toApiError } from './errors'
import { session } from './session'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/+$/, '')

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  query?: Query
  body?: unknown
  signal?: AbortSignal
  /** Skip the global 401/403 handling (the login form handles its own errors). */
  raw?: boolean
}

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + (path.startsWith('/') ? path : `/${path}`))
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  return url.toString()
}

function headers(json: boolean): Headers {
  const h = new Headers({ Accept: json ? 'application/json' : 'application/pdf, application/json' })
  if (session.token) h.set('Authorization', `Bearer ${session.token}`)
  // Only meaningful for platform superadmins; the API ignores it for everyone else.
  if (session.actingSchool) h.set('X-School', session.actingSchool.slug)
  return h
}

async function send(method: string, path: string, options: RequestOptions, accept: 'json' | 'blob'): Promise<Response> {
  const h = headers(accept === 'json')
  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    h.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), { method, headers: h, body, signal: options.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (!options.raw) handleGlobally(error)
    throw error
  }

  return response
}

function handleGlobally(error: ApiError): void {
  if (error.status === 401) {
    session.emit('unauthorized')
  } else if (error.status === 403 && (error.body as { password_change_required?: boolean })?.password_change_required) {
    session.emit('password-change-required')
  } else if (error.status === 402 && (error.body as { subscription_required?: boolean })?.subscription_required) {
    // The school's subscription lapsed while this page was open: reload who we
    // are, so the locked pages show the renewal screen instead of errors.
    session.emit('subscription-required')
  }
}

/** A JSON request, unwrapping the API's {success, data} envelope. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(method, path, options, 'json')
  if (response.status === 204) return undefined as T
  const json = (await response.json()) as { data?: T }
  return (json && 'data' in json ? json.data : json) as T
}

/** A JSON request that keeps the envelope's pagination meta. */
export async function requestPage<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const response = await send('GET', path, options, 'json')
  return (await response.json()) as Paginated<T>
}

/** A JSON request returning the whole envelope (for endpoints that put useful text in "message"). */
export async function requestEnvelope<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; message?: string }> {
  const response = await send(method, path, options, 'json')
  return (await response.json()) as { data: T; message?: string }
}

/** A binary download (report card PDFs). Needs the bearer token, so it cannot be a plain link. */
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<{ blob: Blob; filename: string | null }> {
  const response = await send('GET', path, options, 'blob')
  return { blob: await response.blob(), filename: filenameFrom(response.headers.get('Content-Disposition')) }
}

/**
 * A multipart upload that reports progress (0..1). fetch cannot report upload
 * progress, so this goes through XMLHttpRequest, with the same headers and the
 * same error handling as every other request. Resolves with the whole envelope.
 */
export function uploadWithProgress<T, E extends object = object>(
  path: string,
  body: FormData,
  { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<{ data: T } & E> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(path))
    headers(true).forEach((value, key) => xhr.setRequestHeader(key, value))

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onerror = () => reject(new ApiError(0, 'Cannot reach the server. Check your connection and try again.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    xhr.onload = async () => {
      const response = new Response(xhr.responseText || null, { status: xhr.status, headers: { 'Content-Type': 'application/json' } })
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve((await response.json()) as { data: T } & E)
        return
      }
      const error = await toApiError(response)
      handleGlobally(error)
      reject(error)
    }

    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

export function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star?.[1]) return decodeURIComponent(star[1])
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain?.[1] ?? null
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
