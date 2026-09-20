import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { AlertTriangleIcon, LockIcon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SubscriptionState } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { formatKes } from './api'

/**
 * The school's subscription, or null when it does not apply: platform
 * superadmins are never locked (the API lets them through too).
 */
export function useSubscription(): SubscriptionState | null {
  const { user, isPlatformAdmin } = useAuth()
  return isPlatformAdmin ? null : (user?.school?.subscription ?? null)
}

/**
 * Blurs and disables what it wraps while the school's subscription has lapsed,
 * with a renewal card on top. The API refuses these features as well (402);
 * this is so people see why, instead of a page of errors.
 */
export function SubscriptionLock({ children }: { children: ReactNode }) {
  const subscription = useSubscription()
  const locked = subscription?.status === 'overdue'

  return (
    <div className="relative">
      <div
        className={cn(locked && 'pointer-events-none max-h-[70dvh] overflow-hidden blur-sm select-none')}
        aria-hidden={locked || undefined}
        inert={locked || undefined}
      >
        {children}
      </div>
      {locked && subscription && (
        <div className="absolute inset-0 z-10 flex items-start justify-center bg-background/40 p-4 pt-16">
          <LockedCard subscription={subscription} />
        </div>
      )}
    </div>
  )
}

/** A layout route: everything under it is locked while the subscription has lapsed. */
export function SubscriptionLockedRoutes() {
  return (
    <SubscriptionLock>
      <Outlet />
    </SubscriptionLock>
  )
}

function LockedCard({ subscription }: { subscription: SubscriptionState }) {
  const { can, school } = useAuth()
  const what = subscription.is_trial ? 'free trial' : 'subscription'

  return (
    <Card className="w-full max-w-md shadow-lg" role="alertdialog" aria-labelledby="subscription-locked-title">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LockIcon className="size-5" />
        </div>
        <CardTitle id="subscription-locked-title">
          {school?.name ? `${school.name}'s ${what} has ended` : `Your ${what} has ended`}
        </CardTitle>
        <CardDescription>
          {subscription.paid_until ? `It ended on ${formatDate(subscription.paid_until)}. ` : ''}
          Exams, marking, mark lists and report cards are locked until it is renewed. Nothing has been deleted.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {can('manage_billing') ? (
          <>
            <Button asChild size="lg">
              <Link to="/settings/subscription">
                Renew{subscription.amount_due_kes ? ` · ${formatKes(subscription.amount_due_kes)}` : ''} with M-Pesa
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">Pupils, staff and set-up stay available meanwhile.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ask your school administrator to renew it.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** A strip under the header: trial or ending within a week (amber), lapsed (red). */
export function SubscriptionBanner() {
  const subscription = useSubscription()
  const { can } = useAuth()

  if (!subscription) return null

  const overdue = subscription.status === 'overdue'
  const endingSoon = !overdue && subscription.days_left <= 7

  if (!overdue && !endingSoon && !subscription.is_trial) return null

  const what = subscription.is_trial ? 'Free trial' : 'Subscription'
  const message = overdue
    ? `${what} ended on ${formatDate(subscription.paid_until)}. Exams, marking and report cards are locked.`
    : `${what}: ${subscription.days_left === 1 ? 'last day today' : `${subscription.days_left} days left`}, paid until ${formatDate(subscription.paid_until)}.`

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs',
        overdue
          ? 'bg-destructive/10 text-destructive'
          : endingSoon
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
            : 'bg-muted text-muted-foreground',
      )}
      role={overdue ? 'alert' : 'status'}
    >
      <span className="flex items-center gap-1.5">
        {(overdue || endingSoon) && <AlertTriangleIcon className="size-3.5" />}
        {message}
      </span>
      {can('manage_billing') && (
        <Link to="/settings/subscription" className="font-medium underline underline-offset-2">
          {overdue ? 'Renew now' : 'Renew'}
        </Link>
      )}
    </div>
  )
}
