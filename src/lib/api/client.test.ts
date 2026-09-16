import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, buildUrl, filenameFrom, requestBlob, requestPage } from './client'
import { ApiError } from './errors'
import { session } from './session'

vi.mock('@/lib/storage', () => ({
  storage: { get: vi.fn(async () => null), set: vi.fn(async () => undefined) },
  StorageKeys: { token: 'token', actingSchool: 'acting_school' },
}))

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

const fetchMock = vi.fn()

beforeEach(async () => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  await session.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: new Headers(init.headers) }
}

describe('api client', () => {
  it('unwraps the data envelope and sends the bearer token', async () => {
    await session.setToken('1|secret')
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { id: 7 } }))

    await expect(api.get('/exams/7')).resolves.toEqual({ id: 7 })

    const { url, headers } = lastRequest()
    expect(url).toMatch(/\/exams\/7$/)
    expect(headers.get('Authorization')).toBe('Bearer 1|secret')
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.has('X-School')).toBe(false)
  })

  it('sends X-School once a superadmin has chosen a school', async () => {
    await session.setActingSchool({ uuid: 'u-1', slug: 'riverside', name: 'Riverside Academy' })
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: [] }))

    await api.get('/classes')

    expect(lastRequest().headers.get('X-School')).toBe('riverside')
  })

  it('sends JSON bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await api.put('/exams/1/marksheet', { class_id: 3 })

    const { init, headers } = lastRequest()
    expect(init.method).toBe('PUT')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"class_id":3}')
  })

  it('keeps pagination meta', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: true, data: [{ id: 1 }], meta: { current_page: 1, last_page: 3, per_page: 25, total: 60 } }),
    )

    const page = await requestPage('/exams', { query: { status: 'locked', page: 1 } })

    expect(page.meta.total).toBe(60)
    expect(lastRequest().url).toContain('status=locked')
  })

  it('turns Laravel validation errors into field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        message: 'The mark must be between 0 and 50.',
        errors: { 'marks.2.raw_score': ['The mark must be between 0 and 50.'], class_id: ['Required.'] },
      }),
    )

    const error = await api.put('/exams/1/marksheet', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.isValidation).toBe(true)
    expect(apiError.field('class_id')).toBe('Required.')
    expect(apiError.rows('marks')).toEqual({ 2: { raw_score: 'The mark must be between 0 and 50.' } })
  })

  it('uses the server message for exam rule conflicts', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { success: false, message: 'Exam "X" cannot move from Draft to Locked.' }),
    )

    const error = (await api.post('/exams/1/transition', { status: 'locked' }).catch((e: unknown) => e)) as ApiError

    expect(error.isConflict).toBe(true)
    expect(error.message).toBe('Exam "X" cannot move from Draft to Locked.')
  })

  it('announces a 401 so the app can sign out', async () => {
    const listener = vi.fn()
    const off = session.on('unauthorized', listener)
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthenticated.' }))

    await expect(api.get('/exams')).rejects.toBeInstanceOf(ApiError)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it('announces a forced password change', async () => {
    const listener = vi.fn()
    const off = session.on('password-change-required', listener)
    fetchMock.mockResolvedValue(
      jsonResponse(403, { success: false, message: 'Please set a new password.', password_change_required: true }),
    )

    await expect(api.get('/exams')).rejects.toBeInstanceOf(ApiError)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it('does not raise global events for raw requests like login', async () => {
    const listener = vi.fn()
    const off = session.on('unauthorized', listener)
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthenticated.' }))

    await expect(api.get('/auth/me', { raw: true })).rejects.toBeInstanceOf(ApiError)
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('reports an unreachable server as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await api.get('/exams').catch((e: unknown) => e)) as ApiError

    expect(error.isNetwork).toBe(true)
  })

  it('downloads blobs and reads the filename', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(['%PDF-1.7']), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="grade-5-blue.pdf"' },
      }),
    )

    const { blob, filename } = await requestBlob('/report-card-batches/5/download')

    expect(filename).toBe('grade-5-blue.pdf')
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('helpers', () => {
  it('builds URLs, skipping empty query values', () => {
    const url = buildUrl('exams', { status: 'open', term_id: undefined, level_id: null, search: '', include_archived: true })
    expect(url).toMatch(/\/exams\?status=open&include_archived=1$/)
  })

  it('parses both Content-Disposition filename forms', () => {
    expect(filenameFrom("attachment; filename*=UTF-8''Grade%205.pdf")).toBe('Grade 5.pdf')
    expect(filenameFrom('attachment; filename=report.pdf')).toBe('report.pdf')
    expect(filenameFrom(null)).toBeNull()
  })
})
