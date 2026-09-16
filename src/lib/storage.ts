import { Preferences } from '@capacitor/preferences'

/**
 * Persistent key/value storage. Capacitor Preferences uses the platform's
 * native store on Android/iOS and falls back to localStorage on the web, so
 * the same calls work in the PWA and the native shells.
 */
const PREFIX = 'educa.admin.'

export const storage = {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key: PREFIX + key })
    return value
  },
  async set(key: string, value: string | null): Promise<void> {
    if (value === null) {
      await Preferences.remove({ key: PREFIX + key })
    } else {
      await Preferences.set({ key: PREFIX + key, value })
    }
  },
}

export const StorageKeys = {
  token: 'token',
  /** Superadmins only: the school they are acting on (sent as X-School). */
  actingSchool: 'acting_school',
  /** The school slug last typed on the login form. */
} as const
