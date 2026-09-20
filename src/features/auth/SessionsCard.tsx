import { useState } from 'react'
import { toast } from 'sonner'
import { GlobeIcon, SmartphoneIcon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api/errors'
import { formatDate, formatRelative } from '@/lib/format'
import { disconnectGoogle, useSessionMutations, useSessions, type SignedInSession } from './api'

const appNames = { admin: 'Educa Admin', portal: 'Educa Staff' } as const

const methodNames = {
  password: 'password',
  google: 'Google',
  invitation: 'invitation link',
  reset: 'password reset link',
} as const

/** Account page: how this person signs in, and every device they are signed in on. */
export function SessionsCard() {
  const { user, refresh } = useAuth()
  const sessions = useSessions()
  const { signOutDevice, signOutOthers } = useSessionMutations()
  const [disconnecting, setDisconnecting] = useState(false)

  if (!user) return null

  async function disconnect() {
    setDisconnecting(true)
    try {
      await disconnectGoogle()
      await refresh()
      toast.success('Google is no longer connected to your account.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in and devices</CardTitle>
        <CardDescription>A device you have not used for a while is signed out automatically.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm">
        <div className="grid gap-2">
          <div className="font-medium">Continue with Google</div>
          {user.google_connected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Connected. You can sign in with Google or your password.</span>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={disconnecting}>
                    Disconnect
                  </Button>
                }
                title="Disconnect Google?"
                description="You will sign in with your username or email and password. Devices already signed in stay signed in."
                confirmLabel="Disconnect"
                onConfirm={disconnect}
              />
            </div>
          ) : (
            <span className="text-muted-foreground">
              {user.email
                ? `Not connected. Choose "Continue with Google" when you sign in, with the Google account for ${user.email}.`
                : 'Not available: your account has no email address. Ask your school administrator to add one.'}
            </span>
          )}
        </div>

        <QueryState query={sessions}>
          {(list) => (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">Signed in on</div>
                {list.length > 1 && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        Sign out everywhere else
                      </Button>
                    }
                    title="Sign out on your other devices?"
                    description={`${list.length - 1} other ${list.length === 2 ? 'device' : 'devices'} will need to sign in again. This one stays signed in.`}
                    confirmLabel="Sign them out"
                    destructive
                    onConfirm={() =>
                      signOutOthers.mutateAsync().then(
                        (message) => toast.success(message),
                        (error: unknown) => {
                          toast.error(errorMessage(error))
                          throw error
                        },
                      )
                    }
                  />
                )}
              </div>
              <ul className="divide-y rounded-lg border">
                {list.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onSignOut={() =>
                      signOutDevice.mutateAsync(session.id).then(
                        () => toast.success(`${session.device_name} is signed out.`),
                        (error: unknown) => {
                          toast.error(errorMessage(error))
                          throw error
                        },
                      )
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  )
}

function SessionRow({ session, onSignOut }: { session: SignedInSession; onSignOut: () => Promise<unknown> }) {
  const Icon = session.platform === 'android' || session.platform === 'ios' ? SmartphoneIcon : GlobeIcon
  const details = [
    session.app ? appNames[session.app] : null,
    session.sign_in_method ? `signed in with ${methodNames[session.sign_in_method]} ${formatDate(session.signed_in_at)}` : `signed in ${formatDate(session.signed_in_at)}`,
    session.ip_address,
  ].filter(Boolean)

  return (
    <li className="flex items-center gap-3 p-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {session.device_name}
          {session.is_current && <Badge variant="secondary">This device</Badge>}
        </div>
        <div className="truncate text-xs text-muted-foreground">{details.join(' · ')}</div>
        {!session.is_current && (
          <div className="text-xs text-muted-foreground">Last active {formatRelative(session.last_used_at ?? session.signed_in_at)}</div>
        )}
      </div>
      {!session.is_current && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              Sign out
            </Button>
          }
          title={`Sign out ${session.device_name}?`}
          description="Whoever is using that device will need to sign in again."
          confirmLabel="Sign out"
          destructive
          onConfirm={onSignOut}
        />
      )}
    </li>
  )
}
