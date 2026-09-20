import { storage, StorageKeys } from '@/lib/storage'

/**
 * The credentials the API client attaches to every request. Kept outside React
 * so the client can read them synchronously; AuthProvider keeps React state in
 * step through subscribe().
 */
export interface ActingSchool {
  uuid: string
  slug: string
  name: string
}

interface SessionState {
  token: string | null
  actingSchool: ActingSchool | null
}

type SessionEvent = 'unauthorized' | 'password-change-required' | 'subscription-required'

let state: SessionState = { token: null, actingSchool: null }
const eventListeners = new Map<SessionEvent, Set<() => void>>()

export const session = {
  get token() {
    return state.token
  },
  get actingSchool() {
    return state.actingSchool
  },

  async restore(): Promise<SessionState> {
    const [token, school] = await Promise.all([
      storage.get(StorageKeys.token),
      storage.get(StorageKeys.actingSchool),
    ])
    state = { token, actingSchool: parseSchool(school) }
    return state
  },

  async setToken(token: string | null): Promise<void> {
    state = { ...state, token }
    await storage.set(StorageKeys.token, token)
  },

  async setActingSchool(school: ActingSchool | null): Promise<void> {
    state = { ...state, actingSchool: school }
    await storage.set(StorageKeys.actingSchool, school ? JSON.stringify(school) : null)
  },

  async clear(): Promise<void> {
    state = { token: null, actingSchool: null }
    await Promise.all([
      storage.set(StorageKeys.token, null),
      storage.set(StorageKeys.actingSchool, null),
    ])
  },

  on(event: SessionEvent, listener: () => void): () => void {
    const set = eventListeners.get(event) ?? new Set()
    set.add(listener)
    eventListeners.set(event, set)
    return () => set.delete(listener)
  },

  emit(event: SessionEvent): void {
    eventListeners.get(event)?.forEach((listener) => listener())
  },
}

function parseSchool(raw: string | null): ActingSchool | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ActingSchool
    return parsed?.slug ? parsed : null
  } catch {
    return null
  }
}
