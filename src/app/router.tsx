import { createBrowserRouter } from 'react-router'
import { GuestOnly, RequireAuth, RequirePermission } from '@/auth/guards'
import { RequireSchool } from '@/auth/RequireSchool'
import { AppShell } from '@/components/layout/AppShell'
import { SubscriptionLockedRoutes } from '@/features/billing/SubscriptionLock'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NotFoundPage } from './NotFoundPage'
import { RouteError } from './RouteError'

/** Pages load on demand so the first paint (login) stays small. */
const page = <T extends Record<string, React.ComponentType>>(load: () => Promise<T>, name: keyof T) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', ...page(() => import('@/features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage') },
        ],
      },
      // Google's sign-in popup returns here on the web (lib/google.ts).
      { path: '/auth/google/callback', ...page(() => import('@/features/auth/GoogleCallbackPage'), 'GoogleCallbackPage') },
      // Emailed links. Not GuestOnly: a signed-in browser is asked to sign out first.
      { path: '/invite/:token', ...page(() => import('@/features/auth/AccountLinkPage'), 'InvitationPage') },
      { path: '/reset-password/:token', ...page(() => import('@/features/auth/AccountLinkPage'), 'ResetPasswordPage') },
      {
        element: <RequireAuth />,
        children: [
          { path: '/change-password', element: <ChangePasswordPage /> },
          {
            element: <AppShell />,
            children: [
              {
                path: '/settings',
                ...page(() => import('@/features/settings/pages/SettingsLayout'), 'SettingsLayout'),
                children: [
                  { path: 'account', ...page(() => import('@/features/settings/pages/AccountPage'), 'AccountPage') },
                  {
                    element: <RequireSchool />,
                    children: [
                      {
                        element: <RequirePermission permission="manage_school_profile" fallback="/settings/account" />,
                        children: [
                          { index: true, ...page(() => import('@/features/settings/pages/SchoolProfilePage'), 'SchoolProfilePage') },
                          {
                            path: 'report-cards',
                            ...page(() => import('@/features/settings/pages/ReportCardSettingsPage'), 'ReportCardSettingsPage'),
                          },
                        ],
                      },
                      {
                        path: 'subscription',
                        element: <RequirePermission permission="manage_billing" fallback="/settings/account" />,
                        children: [{ index: true, ...page(() => import('@/features/billing/pages/BillingPage'), 'BillingPage') }],
                      },
                      {
                        path: 'roles',
                        element: <RequirePermission permission="view_roles" fallback="/settings/account" />,
                        children: [{ index: true, ...page(() => import('@/features/roles/pages/RolesPage'), 'RolesPage') }],
                      },
                    ],
                  },
                ],
              },
              {
                path: '/platform',
                children: [
                  { path: 'schools', element: <RequirePermission permission="manage_schools" />, children: [{ index: true, ...page(() => import('@/features/platform/pages/SchoolsPage'), 'SchoolsPage') }] },
                  { path: 'billing', element: <RequirePermission permission="manage_subscriptions" />, children: [{ index: true, ...page(() => import('@/features/billing/pages/PlatformBillingPage'), 'PlatformBillingPage') }] },
                  { path: 'health', element: <RequirePermission permission="view_system_health" />, children: [{ index: true, ...page(() => import('@/features/platform/pages/SystemHealthPage'), 'SystemHealthPage') }] },
                ],
              },
              {
                element: <RequireSchool />,
                children: [
                  { path: '/', ...page(() => import('./StartPage'), 'StartPage') },
                  { element: <RequirePermission permission="manage_academic_calendar" />, children: [{ path: '/setup/calendar', ...page(() => import('@/features/setup/pages/CalendarPage'), 'CalendarPage') }] },
                  { element: <RequirePermission permission="manage_classes" />, children: [{ path: '/setup/classes', ...page(() => import('@/features/setup/pages/ClassesPage'), 'ClassesPage') }] },
                  { element: <RequirePermission permission="manage_subjects" />, children: [{ path: '/setup/subjects', ...page(() => import('@/features/setup/pages/SubjectsPage'), 'SubjectsPage') }] },
                  { element: <RequirePermission permission="manage_grading_scales" />, children: [{ path: '/setup/grading', ...page(() => import('@/features/setup/pages/GradingPage'), 'GradingPage') }] },
                  { element: <RequirePermission permission="view_students" />, children: [{ path: '/students', ...page(() => import('@/features/people/pages/StudentsPage'), 'StudentsPage') }] },
                  { element: <RequirePermission permission="create_students" />, children: [{ path: '/students/import', ...page(() => import('@/features/people/pages/StudentImportPage'), 'StudentImportPage') }] },
                  { element: <RequirePermission permission="promote_students" />, children: [{ path: '/students/promotion', ...page(() => import('@/features/people/pages/PromotionPage'), 'PromotionPage') }] },
                  { element: <RequirePermission permission="view_students" />, children: [{ path: '/students/:studentId', ...page(() => import('@/features/people/pages/StudentDetailPage'), 'StudentDetailPage') }] },
                  { element: <RequirePermission permission="view_staff" />, children: [{ path: '/staff', ...page(() => import('@/features/people/pages/StaffPage'), 'StaffPage') }] },
                  { element: <RequirePermission permission="manage_assignments" />, children: [{ path: '/assignments', ...page(() => import('@/features/people/pages/AssignmentsPage'), 'AssignmentsPage') }] },
                  // Exams and everything in them lock while the subscription has lapsed.
                  {
                    element: <SubscriptionLockedRoutes />,
                    children: [
                      { path: '/exams', ...page(() => import('@/features/exams/pages/ExamsListPage'), 'ExamsListPage') },
                      { element: <RequirePermission permission="create_exams" />, children: [{ path: '/exams/new', ...page(() => import('@/features/exams/pages/ExamCreatePage'), 'ExamCreatePage') }] },
                      {
                        path: '/exams/:examId',
                        ...page(() => import('@/features/exams/pages/ExamLayout'), 'ExamLayout'),
                        children: [
                          { index: true, ...page(() => import('@/features/exams/pages/ExamOverviewTab'), 'ExamOverviewTab') },
                          { path: 'marking', ...page(() => import('@/features/exams/pages/ExamMarkingTab'), 'ExamMarkingTab') },
                          {
                            path: 'marking/:classId/:levelSubjectId',
                            ...page(() => import('@/features/exams/pages/MarksheetPage'), 'MarksheetPage'),
                          },
                          { path: 'marklist', ...page(() => import('@/features/exams/pages/MarklistTab'), 'MarklistTab') },
                          { path: 'report-cards', ...page(() => import('@/features/exams/pages/ReportCardsTab'), 'ReportCardsTab') },
                          { path: 'analysis', ...page(() => import('@/features/exams/pages/ExamAnalysisTab'), 'ExamAnalysisTab') },
                          { path: 'setup', ...page(() => import('@/features/exams/pages/ExamSetupTab'), 'ExamSetupTab') },
                        ],
                      },
                    ],
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
