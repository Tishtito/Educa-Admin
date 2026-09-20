import { useAuth } from '@/auth/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm'
import { SessionsCard } from '@/features/auth/SessionsCard'
import { roleLabel } from '@/lib/format'

export function AccountPage() {
  const { user } = useAuth()
  if (!user) return null

  const details: [string, string | null][] = [
    ['Name', user.name],
    ['Username', user.username],
    ['Email', user.email],
    ['Phone', user.phone],
    ['Staff number', user.staff_no],
    ['School', user.school?.name ?? 'Platform'],
  ]

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>Ask another school administrator to change these.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate">{value || '—'}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {user.roles.map((role, i) => (
                  <Badge key={role} variant="secondary">
                    {user.role_names?.[i] ?? roleLabel(role)}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You stay signed in here; your other devices are signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        <SessionsCard />
      </div>
    </div>
  )
}
