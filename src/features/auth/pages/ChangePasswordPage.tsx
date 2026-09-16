import { Navigate, useNavigate } from 'react-router'
import { KeyRoundIcon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '../ChangePasswordForm'

/**
 * Full-screen, outside the app shell: accounts imported from legacy (and any
 * account an admin has reset) must set their own password before the API
 * allows anything else.
 */
export function ChangePasswordPage() {
  const { mustChangePassword, user, logout } = useAuth()
  const navigate = useNavigate()

  if (!mustChangePassword) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRoundIcon className="size-5" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {user?.name ? `Welcome, ${user.name}. ` : ''}
            Before you continue, replace the temporary password on your account with one only you know.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChangePasswordForm onDone={() => navigate('/', { replace: true })} />
          <Button variant="link" className="justify-self-start px-0" onClick={() => void logout()}>
            Sign out instead
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
