import { Navigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { useVisibleNavigation } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'

/**
 * "/" is the dashboard for whoever may see it. Anyone else — a role with only
 * marking, say — starts at the first page their permissions open.
 */
export function StartPage() {
  const { can } = useAuth()
  const first = useVisibleNavigation()
    .flatMap((section) => section.items)
    .find((item) => item.to !== '/' && item.to !== '/settings')

  if (can('view_dashboard')) return <DashboardPage />
  return <Navigate to={first?.to ?? '/settings/account'} replace />
}
