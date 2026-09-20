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
  WalletIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  SchoolIcon,
  SettingsIcon,
} from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shown to users holding ANY of these. */
  permissions: Permission[]
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

/** Any exam work at all puts Exams in the menu; each exam tab then checks its own. */
export const EXAM_WORK: Permission[] = ['create_exams', 'update_exams', 'change_exam_status', 'compute_exam_results', 'view_marksheets', 'view_marklists', 'view_report_cards', 'view_exam_analysis']

export const navigation: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, permissions: ['view_dashboard'], tenant: true, primary: true, end: true },
      { to: '/exams', label: 'Exams', icon: ClipboardListIcon, permissions: EXAM_WORK, tenant: true, primary: true },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Pupils', icon: UsersIcon, permissions: ['view_students'], tenant: true, primary: true },
      { to: '/staff', label: 'Staff', icon: IdCardIcon, permissions: ['view_staff'], tenant: true },
      { to: '/assignments', label: 'Assignments', icon: ContactIcon, permissions: ['manage_assignments'], tenant: true },
    ],
  },
  {
    label: 'School set-up',
    items: [
      { to: '/setup/calendar', label: 'Calendar', icon: CalendarDaysIcon, permissions: ['manage_academic_calendar'], tenant: true },
      { to: '/setup/classes', label: 'Classes', icon: SchoolIcon, permissions: ['manage_classes'], tenant: true },
      { to: '/setup/subjects', label: 'Subjects', icon: BookOpenIcon, permissions: ['manage_subjects'], tenant: true },
      { to: '/setup/grading', label: 'Grading', icon: GaugeIcon, permissions: ['manage_grading_scales'], tenant: true },
      { to: '/settings', label: 'Settings', icon: SettingsIcon, permissions: [], tenant: false, primary: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/platform/schools', label: 'Schools', icon: Building2Icon, permissions: ['manage_schools'], tenant: false },
      { to: '/platform/billing', label: 'Billing', icon: WalletIcon, permissions: ['manage_subscriptions'], tenant: false },
      { to: '/platform/health', label: 'System health', icon: ActivityIcon, permissions: ['view_system_health'], tenant: false },
    ],
  },
]
