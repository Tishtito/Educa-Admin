import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
import { isNative } from '@/lib/native'

/**
 * The service worker precaches the app shell only; API responses are never
 * cached (see vite.config.ts). Native builds bundle the app, so they skip it.
 */
export function registerServiceWorker() {
  if (isNative() || !('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version of Educa Admin is available.', {
        duration: Infinity,
        action: { label: 'Reload', onClick: () => void updateSW(true) },
      })
    },
  })
}
