import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/data/PageHeader'

const tabs = [
  { to: '/settings', label: 'School', end: true, tenant: true },
  { to: '/settings/report-cards', label: 'Report cards', end: false, tenant: true },
  { to: '/settings/account', label: 'My account', end: false, tenant: false },
]

export function SettingsLayout() {
  const { isPlatformAdmin, school } = useAuth()
  const visible = tabs.filter((tab) => !tab.tenant || !isPlatformAdmin || school)

  return (
    <>
      <PageHeader title="Settings" description="Your school’s details, how report cards read, and your own account." />
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
