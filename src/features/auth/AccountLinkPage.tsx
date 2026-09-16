import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router'
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react'
import { NotAnAdminError } from '@/auth/context'
import { useAuth } from '@/auth/useAuth'
import { FullScreenLoader } from '@/components/data/FullScreenLoader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, errorMessage } from '@/lib/api/errors'
import { formatDateTime } from '@/lib/format'
import { AuthLayout } from './AuthLayout'
import { completeAccountLink, linkUnavailableReason, useAccountLink, type AccountLinkDetails, type AccountLinkKind } from './api'
import { PasswordFields } from './PasswordFields'

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'The passwords do not match' })

type Values = z.infer<typeof schema>

const roleWords: Record<string, string> = {
  school_admin: 'School administrator',
  class_teacher: 'Class teacher',
  examiner: 'Examiner',
  super_admin: 'Platform administrator',
}

export const InvitationPage = () => <AccountLinkPage kind="invitation" />
export const ResetPasswordPage = () => <AccountLinkPage kind="reset" />

/** /invite/:token and /reset-password/:token — choose a password from an emailed link. */
function AccountLinkPage({ kind }: { kind: AccountLinkKind }) {
  const { status, user, logout } = useAuth()
  const token = useParams().token ?? ''

  if (status === 'loading') return <FullScreenLoader />

  // Someone else's link opened in a browser that is signed in: finishing it
  // would silently swap accounts, so ask for a sign-out first.
  if (status === 'authenticated' && user) {
    return (
      <AuthLayout>
        <Card>
          <CardHeader>
            <CardTitle>You are signed in as {user.name}</CardTitle>
            <CardDescription>
              Sign out to {kind === 'invitation' ? 'set up the invited account' : 'reset this password'} on this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button onClick={() => void logout()}>Sign out and continue</Button>
            <Button variant="outline" asChild>
              <Link to="/">Stay signed in</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return <LinkForm key={token} kind={kind} token={token} />
}

function LinkForm({ kind, token }: { kind: AccountLinkKind; token: string }) {
  const link = useAccountLink(kind, token)

  if (link.isPending) return <FullScreenLoader />
  if (link.isError) return <Unavailable kind={kind} error={link.error} onRetry={() => void link.refetch()} />
  return <ChoosePassword kind={kind} token={token} details={link.data} />
}

function ChoosePassword({ kind, token, details }: { kind: AccountLinkKind; token: string; details: AccountLinkDetails }) {
  const { signInWithToken } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [gone, setGone] = useState<unknown>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', password_confirmation: '' } })
  const { isSubmitting } = form.formState

  async function submit(values: Values) {
    setFormError(null)
    try {
      const result = await completeAccountLink(kind, token, values.password, values.password_confirmation)
      await signInWithToken(result)
      navigate('/', { replace: true })
    } catch (error) {
      if (linkUnavailableReason(error)) {
        setGone(error)
      } else if (error instanceof ApiError && error.isValidation) {
        const message = error.field('password')
        if (message) form.setError('password', { message })
        else setFormError(error.message)
      } else if (error instanceof NotAnAdminError) {
        setFormError(`${kind === 'invitation' ? 'Your account is set up' : 'Your password is changed'}, but ${error.message.charAt(0).toLowerCase()}${error.message.slice(1)}`)
      } else {
        setFormError(errorMessage(error))
      }
    }
  }

  if (gone) return <Unavailable kind={kind} error={gone} />

  const invitation = kind === 'invitation'

  return (
    <AuthLayout footer={<Link to="/login" className="underline">Back to sign in</Link>}>
      <Card>
        <CardHeader>
          <CardTitle>{invitation ? `Welcome, ${details.name.split(' ')[0]}` : 'Choose a new password'}</CardTitle>
          <CardDescription>
            {invitation
              ? `Set a password for your ${details.school?.name ?? 'Educa'} account.`
              : `For ${details.name}${details.school ? ` at ${details.school.name}` : ''}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-3 text-sm">
            {details.school && (
              <>
                <dt className="text-muted-foreground">School</dt>
                <dd className="font-medium">{details.school.name}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Username</dt>
            <dd className="font-medium">{details.username}</dd>
            {invitation && details.roles && details.roles.length > 0 && (
              <>
                <dt className="text-muted-foreground">Role</dt>
                <dd>{details.roles.map((r) => roleWords[r] ?? r).join(', ')}</dd>
              </>
            )}
          </dl>
          <p className="-mt-2 mb-4 text-xs text-muted-foreground">
            Sign in with that username{details.email ? ' or your email address' : ''} from now on.
          </p>

          <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(submit)}>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <PasswordFields form={form} />
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {invitation ? 'Set password and sign in' : 'Change password and sign in'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">This link expires {formatDateTime(details.expires_at)}.</p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

function Unavailable({ kind, error, onRetry }: { kind: AccountLinkKind; error: unknown; onRetry?: () => void }) {
  const reason = linkUnavailableReason(error)
  const title =
    reason === 'used'
      ? kind === 'invitation'
        ? 'This invitation has been used'
        : 'This link has been used'
      : reason === 'expired'
        ? 'This link has expired'
        : reason
          ? 'This link cannot be used'
          : 'Could not open this link'

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-amber-600" /> {title}
          </CardTitle>
          <CardDescription>{errorMessage(error)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!reason && onRetry && <Button onClick={onRetry}>Try again</Button>}
          {kind === 'reset' && reason !== 'used' && reason !== 'unavailable' && (
            <Button asChild>
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          )}
          <Button variant={kind === 'reset' && reason !== 'used' ? 'outline' : 'default'} asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
