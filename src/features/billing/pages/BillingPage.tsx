import { useEffect, useState } from 'react'
import { CheckCircle2Icon, Loader2Icon, SmartphoneIcon, XCircleIcon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Field } from '@/components/data/Field'
import { QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { SubscriptionPayment, SubscriptionState } from '@/lib/api/types'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatKes, useBilling, usePaymentStatus, useStartMpesaPayment, type BillingOverview } from '../api'

/** Settings → Subscription: what the school owes, paying with M-Pesa, and its payments. */
export function BillingPage() {
  const billing = useBilling()

  return (
    <QueryState query={billing}>
      {(data) => (
        <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
          <StatusCard data={data} />
          <PaybillCard data={data} />
          <div className="lg:col-span-2">
            <PaymentsCard payments={data.payments} />
          </div>
        </div>
      )}
    </QueryState>
  )
}

const statusBadge: Record<SubscriptionState['status'], { label: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Free trial', variant: 'outline' },
  active: { label: 'Active', variant: 'secondary' },
  overdue: { label: 'Ended', variant: 'destructive' },
}

function StatusCard({ data }: { data: BillingOverview }) {
  const { subscription } = data
  const [paying, setPaying] = useState(false)
  const priced = subscription.amount_due_kes !== null
  const badge = statusBadge[subscription.status]

  const rows: [string, string][] = [
    ['Paid until', formatDate(subscription.paid_until)],
    ['Days left', subscription.status === 'overdue' ? 'None: exams, marking and report cards are locked' : String(subscription.days_left)],
    ['Renews for', subscription.cycle_months ? `${subscription.cycle_months} ${subscription.cycle_months === 1 ? 'month' : 'months'}` : '—'],
    ['Price', priced ? formatKes(subscription.price_kes) : 'Not set yet'],
  ]
  if (subscription.credit_kes > 0) rows.push(['Credit', formatKes(subscription.credit_kes)])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Educa subscription <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardTitle>
        <CardDescription>
          Exams, marking, mark lists and report cards need an active subscription. Pupils, staff and set-up are always available.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7rem_1fr] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {!priced ? (
          <Alert>
            <AlertDescription>Educa has not set your school’s price yet. Contact Educa to set up your subscription.</AlertDescription>
          </Alert>
        ) : !data.mpesa_available ? (
          <Alert>
            <AlertDescription>M-Pesa payments are not switched on yet. Contact Educa to renew.</AlertDescription>
          </Alert>
        ) : subscription.amount_due_kes === 0 ? (
          <p className="text-sm text-muted-foreground">Your credit already covers the next renewal.</p>
        ) : (
          <Button size="lg" onClick={() => setPaying(true)}>
            <SmartphoneIcon /> Pay {formatKes(subscription.amount_due_kes)} with M-Pesa
          </Button>
        )}
      </CardContent>
      {paying && <PayDialog amount={subscription.amount_due_kes ?? 0} onClose={() => setPaying(false)} />}
    </Card>
  )
}

function PaybillCard({ data }: { data: BillingOverview }) {
  if (!data.paybill.business_number) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Or pay at the Paybill</CardTitle>
        <CardDescription>From any phone, for example by the bursar. Part payments are kept as credit.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
          <li>M-Pesa → Lipa na M-Pesa → Pay Bill</li>
          <li>
            Business number: <span className="font-mono font-semibold">{data.paybill.business_number}</span>
          </li>
          <li>
            Account number: <span className="font-mono font-semibold">{data.paybill.account_number}</span>
          </li>
          <li>Amount: {formatKes(data.subscription.amount_due_kes)}</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          The account number is your school code. Payments show up here within a minute and a receipt is emailed.
        </p>
      </CardContent>
    </Card>
  )
}

/** Sends the prompt, then waits for M-Pesa's answer (callback, or the API's status query). */
function PayDialog({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { user, refresh } = useAuth()
  const start = useStartMpesaPayment()
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<number | null>(null)
  const [slow, setSlow] = useState(false)
  const status = usePaymentStatus(paymentId)
  const payment = status.data
  const waiting = paymentId !== null && (!payment || payment.status === 'pending')
  const timedOut = waiting && slow

  // M-Pesa gives the payer about a minute; after two and a half, stop promising.
  useEffect(() => {
    if (paymentId === null) return
    const timer = window.setTimeout(() => setSlow(true), 150_000)
    return () => window.clearTimeout(timer)
  }, [paymentId])

  async function send() {
    setError(null)
    try {
      const response = await start.mutateAsync(phone)
      setSlow(false)
      setPaymentId(response.data.id)
    } catch (e) {
      setError(e instanceof ApiError && e.isValidation ? (e.field('phone') ?? e.message) : errorMessage(e))
    }
  }

  async function close() {
    if (payment?.status === 'succeeded') await refresh()   // unlock the app straight away
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && void close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {formatKes(amount)} with M-Pesa</DialogTitle>
          <DialogDescription>We send a prompt to the phone. Enter your M-Pesa PIN there to pay.</DialogDescription>
        </DialogHeader>

        {paymentId === null ? (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field label="Safaricom number" htmlFor="mpesa-phone">
              <Input id="mpesa-phone" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={start.isPending || phone.trim() === ''}>
                {start.isPending && <Loader2Icon className="animate-spin" />} Send prompt
              </Button>
            </DialogFooter>
          </form>
        ) : payment?.status === 'succeeded' ? (
          <Outcome icon={<CheckCircle2Icon className="size-10 text-emerald-600" />} title="Payment received">
            {payment.cycles_added > 0
              ? `Your subscription is paid until ${formatDate(payment.subscription.paid_until)}.`
              : 'The payment is held as credit towards your next renewal.'}{' '}
            {payment.mpesa_receipt && `M-Pesa receipt ${payment.mpesa_receipt}. `}A receipt is on its way by email.
            <DialogFooter className="mt-4">
              <Button onClick={() => void close()}>Done</Button>
            </DialogFooter>
          </Outcome>
        ) : payment?.status === 'failed' ? (
          <Outcome icon={<XCircleIcon className="size-10 text-destructive" />} title="The payment did not go through">
            {payment.result_desc ?? 'M-Pesa did not complete the payment.'} Nothing was charged.
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setPaymentId(null)
                  setError(null)
                }}
              >
                Try again
              </Button>
            </DialogFooter>
          </Outcome>
        ) : (
          <Outcome icon={<Loader2Icon className="size-10 animate-spin text-primary" />} title="Check your phone">
            {timedOut
              ? 'Still waiting for M-Pesa. If you paid, it will show here shortly. You can close this window.'
              : `Enter your M-Pesa PIN on ${phone} to pay ${formatKes(amount)}. This updates as soon as M-Pesa confirms.`}
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </Outcome>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Outcome({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 text-center" role="status" aria-live="polite">
      {icon}
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

const methodLabel: Record<SubscriptionPayment['method'], string> = { stk: 'M-Pesa prompt', paybill: 'Paybill', manual: 'Recorded by Educa' }

function PaymentsCard({ payments }: { payments: SubscriptionPayment[] }) {
  return (
    <Card className="overflow-x-auto">
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>How</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(p.paid_at ?? p.created_at)}</TableCell>
                  <TableCell>
                    {methodLabel[p.method]}
                    {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.mpesa_receipt ?? p.reference ?? '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatKes(p.amount_kes)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'succeeded' ? 'secondary' : p.status === 'failed' ? 'destructive' : 'outline'}>
                      {p.status === 'succeeded' ? 'Paid' : p.status === 'failed' ? 'Failed' : 'Waiting'}
                    </Badge>
                    {p.status === 'failed' && p.result_desc && <div className="mt-1 max-w-48 text-xs text-muted-foreground">{p.result_desc}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.cycles_added > 0 ? formatDate(p.paid_until_after) : p.status === 'succeeded' ? 'Credit' : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
