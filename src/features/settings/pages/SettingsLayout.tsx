import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/data/PageHeader'
import type { Permission } from '@/lib/permissions'

const tabs: { to: string; label: string; end: boolean; tenant: boolean; permissions: Permission[] }[] = [
  { to: '/settings', label: 'School', end: true, tenant: true, permissions: ['manage_school_profile'] },
  { to: '/settings/report-cards', label: 'Report cards', end: false, tenant: true, permissions: ['manage_school_profile'] },
  { to: '/settings/subscription', label: 'Subscription', end: false, tenant: true, permissions: ['manage_billing'] },
  { to: '/settings/roles', label: 'Roles & permissions', end: false, tenant: true, permissions: ['view_roles'] },
  { to: '/settings/account', label: 'My account', end: false, tenant: false, permissions: [] },
]

export function SettingsLayout() {
  const { isPlatformAdmin, school, can } = useAuth()
  const visible = tabs.filter((tab) => (!tab.tenant || !isPlatformAdmin || school) && (tab.permissions.length === 0 || can(...tab.permissions)))

  return (
    <>
      <PageHeader title="Settings" description="Your school’s details, how report cards read, your subscription, who may do what, and your own account." />
      <div className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {visible.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap',
                isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  )
}
