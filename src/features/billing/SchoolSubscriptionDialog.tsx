import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { SubscriptionState } from '@/lib/api/types'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatKes, usePlatformBillingMutations, useSchoolSubscription, type SubscriptionHistoryEntry } from './api'

/**
 * Superadmin only: a school's price, cycle and paid-until date, recording a
 * cash or bank payment, and the history of every change with its reason.
 */
export function SchoolSubscriptionDialog({ school, onClose }: { school: { uuid: string; name: string }; onClose: () => void }) {
  const query = useSchoolSubscription(school.uuid)

  return (
    <QueryState query={query} loading={null}>
      {(data) => <Editor key={JSON.stringify(data.subscription)} school={school} subscription={data.subscription} history={data.history} onClose={onClose} />}
    </QueryState>
  )
}

function Editor({
  school,
  subscription,
  history,
  onClose,
}: {
  school: { uuid: string; name: string }
  subscription: SubscriptionState
  history: SubscriptionHistoryEntry[]
  onClose: () => void
}) {
  const { updateSubscription, recordPayment } = usePlatformBillingMutations()
  const [tab, setTab] = useState<'terms' | 'payment' | 'history'>('terms')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [price, setPrice] = useState(subscription.price_kes?.toString() ?? '')
  const [cycle, setCycle] = useState(subscription.cycle_months?.toString() ?? '4')
  const [paidUntil, setPaidUntil] = useState(subscription.paid_until ?? '')
  const [isTrial, setIsTrial] = useState(subscription.is_trial)
  const [amount, setAmount] = useState(subscription.amount_due_kes?.toString() ?? '')
  const [reference, setReference] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [reason, setReason] = useState('')

  const busy = updateSubscription.isPending || recordPayment.isPending

  function fail(error: unknown) {
    if (error instanceof ApiError && error.isValidation) {
      const fields = ['price_kes', 'cycle_months', 'paid_until', 'reason', 'amount_kes', 'reference', 'paid_at']
      setErrors(Object.fromEntries(fields.map((f) => [f, error.field(f)]).filter(([, v]) => v)) as Record<string, string>)
    } else {
      toast.error(errorMessage(error))
    }
  }

  async function submit() {
    setErrors({})
    try {
      if (tab === 'payment') {
        await recordPayment.mutateAsync({ uuid: school.uuid, amount_kes: Number(amount), reference, paid_at: paidAt || undefined, reason })
        toast.success(`Payment of ${formatKes(Number(amount))} recorded for ${school.name}.`)
      } else {
        await updateSubscription.mutateAsync({
          uuid: school.uuid,
          price_kes: price === '' ? null : Number(price),
          cycle_months: Number(cycle),
          paid_until: paidUntil,
          is_trial: isTrial,
          reason,
        })
        toast.success(`${school.name}'s subscription updated.`)
      }
      onClose()
    } catch (error) {
      fail(error)
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${school.name}: subscription`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={subscription.status === 'overdue' ? 'destructive' : subscription.status === 'trial' ? 'outline' : 'secondary'}>{subscription.status}</Badge>
          Paid until {formatDate(subscription.paid_until)}
          {subscription.credit_kes > 0 && ` · credit ${formatKes(subscription.credit_kes)}`}
        </span>
      }
      submitLabel={tab === 'payment' ? 'Record payment' : 'Save'}
      busy={busy}
      onSubmit={() => (tab === 'history' ? onClose() : void submit())}
      wide
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="terms">Price and dates</TabsTrigger>
          <TabsTrigger value="payment">Record a payment</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="terms" className="grid gap-4 pt-2 sm:grid-cols-2">
          <Field label="Price per cycle (KES)" htmlFor="sub-price" error={errors.price_kes} hint="Leave empty until agreed: the school cannot pay until it is set.">
            <Input id="sub-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Cycle length (months)" htmlFor="sub-cycle" error={errors.cycle_months} hint="4 is about a term; 12 a year.">
            <Input id="sub-cycle" inputMode="numeric" value={cycle} onChange={(e) => setCycle(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Paid until" htmlFor="sub-until" error={errors.paid_until} hint="The last day the school may use exams. Change it to extend a trial or give time.">
            <Input id="sub-until" type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
          </Field>
          <Field label="Free trial" htmlFor="sub-trial" hint="Shown to the school as a trial until its first payment.">
            <Switch id="sub-trial" checked={isTrial} onCheckedChange={setIsTrial} />
          </Field>
        </TabsContent>

        <TabsContent value="payment" className="grid gap-4 pt-2 sm:grid-cols-2">
          <Field label="Amount (KES)" htmlFor="pay-amount" error={errors.amount_kes} hint="Credited like an M-Pesa payment: each full price adds a cycle.">
            <Input id="pay-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Reference" htmlFor="pay-ref" error={errors.reference} hint="Bank reference, cheque number or receipt.">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Paid on" htmlFor="pay-date" error={errors.paid_at}>
            <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </TabsContent>

        <TabsContent value="history" className="pt-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ul className="grid max-h-80 gap-3 overflow-y-auto text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{actionLabel[entry.action]}{entry.by && ` by ${entry.by}`}</span>
                    <span>{formatDateTime(entry.created_at)}</span>
                  </div>
                  <div className="mt-1">{entry.reason}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{describeChange(entry)}</div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {tab !== 'history' && (
        <Field label="Reason" htmlFor="sub-reason" error={errors.reason} hint="Kept in the history, for example “Signed the annual plan” or “Cash at the office”.">
          <Input id="sub-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
    </FormDialog>
  )
}

const actionLabel: Record<SubscriptionHistoryEntry['action'], string> = {
  terms: 'Price or cycle changed',
  paid_until: 'Dates changed',
  manual_payment: 'Payment recorded',
  assign_payment: 'Paybill payment assigned',
}

function describeChange({ before, after }: SubscriptionHistoryEntry): string {
  if (!before || !after) return ''
  return (['price_kes', 'cycle_months', 'paid_until', 'is_trial', 'credit_kes'] as const)
    .filter((key) => before[key] !== after[key])
    .map((key) => `${key.replace('_kes', '').replace('_', ' ')}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`)
    .join(' · ')
}
