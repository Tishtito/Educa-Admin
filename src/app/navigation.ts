import type { LucideIcon } from 'lucide-react'
import {
  ActivityIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ContactIcon,
  IdCardIcon,
  UsersIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  SchoolIcon,
  SettingsIcon,
} from 'lucide-react'
import type { RoleSlug } from '@/lib/api/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: RoleSlug[]
  /** Needs a school (superadmins must have picked one). */
  tenant: boolean
  /** Shown in the phone bottom bar. */
  primary?: boolean
  end?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, roles: ['school_admin'], tenant: true, primary: true, end: true },
      { to: '/exams', label: 'Exams', icon: ClipboardListIcon, roles: ['school_admin'], tenant: true, primary: true },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Pupils', icon: UsersIcon, roles: ['school_admin'], tenant: true, primary: true },
      { to: '/staff', label: 'Staff', icon: IdCardIcon, roles: ['school_admin'], tenant: true },
      { to: '/assignments', label: 'Assignments', icon: ContactIcon, roles: ['school_admin'], tenant: true },
    ],
  },
  {
    label: 'School set-up',
    items: [
      { to: '/setup/calendar', label: 'Calendar', icon: CalendarDaysIcon, roles: ['school_admin'], tenant: true },
      { to: '/setup/classes', label: 'Classes', icon: SchoolIcon, roles: ['school_admin'], tenant: true },
      { to: '/setup/subjects', label: 'Subjects', icon: BookOpenIcon, roles: ['school_admin'], tenant: true },
      { to: '/setup/grading', label: 'Grading', icon: GaugeIcon, roles: ['school_admin'], tenant: true },
      { to: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['school_admin'], tenant: true, primary: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/platform/schools', label: 'Schools', icon: Building2Icon, roles: ['super_admin'], tenant: false },
      { to: '/platform/health', label: 'System health', icon: ActivityIcon, roles: ['super_admin'], tenant: false },
    ],
  },
]
