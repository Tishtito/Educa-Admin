import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './native'

/** Status bar and splash screen set-up for the Android/iOS shells. */
export async function setupNativeShell() {
  if (!isNative()) return
  try {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch {
    // Not every platform supports every status bar call.
  }
  await SplashScreen.hide().catch(() => undefined)
}
