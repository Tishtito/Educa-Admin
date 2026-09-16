import { createBrowserRouter } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from '@/auth/guards'
import { RequireSchool } from '@/auth/RequireSchool'
import { AppShell } from '@/components/layout/AppShell'
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
                      { index: true, ...page(() => import('@/features/settings/pages/SchoolProfilePage'), 'SchoolProfilePage') },
                      {
                        path: 'report-cards',
                        ...page(() => import('@/features/settings/pages/ReportCardSettingsPage'), 'ReportCardSettingsPage'),
                      },
                    ],
                  },
                ],
              },
              {
                path: '/platform',
                element: <RequireRole roles={['super_admin']} />,
                children: [
                  { path: 'schools', ...page(() => import('@/features/platform/pages/SchoolsPage'), 'SchoolsPage') },
                  { path: 'health', ...page(() => import('@/features/platform/pages/SystemHealthPage'), 'SystemHealthPage') },
                ],
              },
              {
                element: <RequireSchool />,
                children: [
                  { path: '/', ...page(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage') },
                  { path: '/setup/calendar', ...page(() => import('@/features/setup/pages/CalendarPage'), 'CalendarPage') },
                  { path: '/setup/classes', ...page(() => import('@/features/setup/pages/ClassesPage'), 'ClassesPage') },
                  { path: '/setup/subjects', ...page(() => import('@/features/setup/pages/SubjectsPage'), 'SubjectsPage') },
                  { path: '/setup/grading', ...page(() => import('@/features/setup/pages/GradingPage'), 'GradingPage') },
                  { path: '/students', ...page(() => import('@/features/people/pages/StudentsPage'), 'StudentsPage') },
                  { path: '/students/import', ...page(() => import('@/features/people/pages/StudentImportPage'), 'StudentImportPage') },
                  { path: '/students/promotion', ...page(() => import('@/features/people/pages/PromotionPage'), 'PromotionPage') },
                  { path: '/students/:studentId', ...page(() => import('@/features/people/pages/StudentDetailPage'), 'StudentDetailPage') },
                  { path: '/staff', ...page(() => import('@/features/people/pages/StaffPage'), 'StaffPage') },
                  { path: '/assignments', ...page(() => import('@/features/people/pages/AssignmentsPage'), 'AssignmentsPage') },
                  { path: '/exams', ...page(() => import('@/features/exams/pages/ExamsListPage'), 'ExamsListPage') },
                  { path: '/exams/new', ...page(() => import('@/features/exams/pages/ExamCreatePage'), 'ExamCreatePage') },
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
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
