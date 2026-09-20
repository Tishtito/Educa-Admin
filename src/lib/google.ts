import { clientPlatform } from './device'

/**
 * Continue with Google, on the web and in the Android and iOS apps, through
 * @capgo/capacitor-social-login. All this app needs from Google is an ID token;
 * the API verifies it and finds the account (docs/authentication.md in the API).
 *
 * The web sign-in opens a popup that returns to /auth/google/callback, which
 * must be an authorised redirect URI on the web OAuth client.
 */
const webClientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) || undefined
const iOSClientId = (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined) || undefined

export const GOOGLE_CALLBACK_PATH = '/auth/google/callback'

/** Whether this build has the Google client IDs it needs on this platform. */
export function googleAvailable(): boolean {
  return clientPlatform() === 'ios' ? !!(iOSClientId && webClientId) : !!webClientId
}

let ready: Promise<typeof import('@capgo/capacitor-social-login').SocialLogin> | null = null

function plugin() {
  ready ??= import('@capgo/capacitor-social-login').then(async ({ SocialLogin }) => {
    await SocialLogin.initialize({
      google: {
        webClientId,
        iOSClientId,
        // So the iOS token's audience is the web client too, like Android's.
        iOSServerClientId: webClientId,
        mode: 'online',
        redirectUrl: clientPlatform() === 'web' ? `${window.location.origin}${GOOGLE_CALLBACK_PATH}` : undefined,
      },
    })
    return SocialLogin
  })
  // A failed initialisation must not stick: let the next press try again.
  ready.catch(() => {
    ready = null
  })
  return ready
}

/** Shows Google's account chooser. Resolves to the ID token, or null if the person closed it. */
export async function googleIdToken(): Promise<string | null> {
  const SocialLogin = await plugin()
  try {
    const response = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'], prompt: 'select_account' } })
    const result = response.result
    if ('idToken' in result && result.idToken) return result.idToken
    throw new Error('Google did not return an ID token.')
  } catch (error) {
    if (isCancelled(error)) return null
    throw error
  }
}

function isCancelled(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return e?.code === 'USER_CANCELLED' || /cancel|closed by user|popup.*closed/i.test(e?.message ?? '')
}
