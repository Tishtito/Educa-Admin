import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { WifiOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FullScreenLoader } from '@/components/data/FullScreenLoader'
import type { Permission } from '@/lib/permissions'
import { useAuth } from './useAuth'

/** Signed-in users only; forced password changes are enforced here too. */
export function RequireAuth() {
  const { status, mustChangePassword, refresh } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'offline') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <WifiOffIcon className="size-10 text-muted-foreground" />
        <div>
          <p className="font-medium">You are offline</p>
          <p className="text-sm text-muted-foreground">Educa needs a connection to load school data.</p>
        </div>
        <Button onClick={() => void refresh()}>Try again</Button>
      </div>
    )
  }
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />

  return <Outlet />
}

export function GuestOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

/** Pages that need a permission (any of those listed). Without it, back to the start page. */
export function RequirePermission({
  permission,
  fallback = '/',
  children,
}: {
  permission: Permission | Permission[]
  /** Where to send someone without it. */
  fallback?: string
  children?: ReactNode
}) {
  const { can } = useAuth()
  if (!can(...(Array.isArray(permission) ? permission : [permission]))) return <Navigate to={fallback} replace />
  return children ?? <Outlet />
}
