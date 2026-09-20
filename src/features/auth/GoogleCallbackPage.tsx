import { useEffect } from 'react'
import { Loader2Icon } from 'lucide-react'

/**
 * /auth/google/callback: where Google's sign-in popup returns on the web.
 * Loading the plugin hands the result back to the window that opened the popup
 * and closes this one.
 */
export function GoogleCallbackPage() {
  useEffect(() => {
    void import('@capgo/capacitor-social-login')
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" /> Finishing sign-in with Google…
    </div>
  )
}
