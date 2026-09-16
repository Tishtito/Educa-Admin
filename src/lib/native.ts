import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

export const isNative = () => Capacitor.isNativePlatform()

/**
 * Android hardware back button. With a handler (an open drawer or dialog) it
 * closes that; otherwise it goes back in history, and exits at the root.
 */
export function useNativeBackButton(handler?: () => void) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!isNative()) return
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      if (handlerRef.current) {
        handlerRef.current()
      } else if (canGoBack) {
        window.history.back()
      } else {
        void App.exitApp()
      }
    })
    return () => {
      void listener.then((l) => l.remove())
    }
  }, [])
}
