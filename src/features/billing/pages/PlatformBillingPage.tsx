import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { WalletIcon } from 'lucide-react'
import { formatKes, usePlatformBillingMutations, usePlatformPayments, usePlatformSubscriptions, type PlatformPayment } from '../api'
import { SchoolSubscriptionDialog } from '../SchoolSubscriptionDialog'

/** Platform → Billing: every school's subscription, every payment, and Paybill payments to assign. */
export function PlatformBillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="School subscriptions, M-Pesa and recorded payments, and Paybill payments that named no school." />
      <Tabs defaultValue="schools">
        <TabsList className="mb-4">
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
        </TabsList>
        <TabsContent value="schools">
          <SchoolsTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="unmatched">
          <PaymentsTab unmatched />
        </TabsContent>
      </Tabs>
    </>
  )
}

const filters = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Ended' },
  { value: 'due_soon', label: 'Ending within a week' },
  { value: 'trial', label: 'On trial' },
]

function SchoolsTab() {
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<{ uuid: string; name: string } | null>(null)
  const rows = usePlatformSubscriptions(filter)

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>
      <QueryState query={rows}>
        {(data) =>
          data.length === 0 ? (
            <EmptyState icon={<WalletIcon />} title="No schools here" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid until</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(({ school, subscription }) => (
                    <TableRow key={school.uuid}>
                      <TableCell>
                        <div className="font-medium">{school.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{school.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={subscription.status === 'overdue' ? 'destructive' : subscription.status === 'trial' ? 'outline' : 'secondary'}>
                          {subscription.status === 'overdue' ? 'Ended' : subscription.status === 'trial' ? 'Trial' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(subscription.paid_until)}
                        {subscription.status !== 'overdue' && <div className="text-xs text-muted-foreground">{subscription.days_left} days left</div>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{subscription.price_kes ? formatKes(subscription.price_kes) : <span className="text-muted-foreground">Not set</span>}</TableCell>
                      <TableCell>{subscription.cycle_months ? `${subscription.cycle_months} mo` : '—'}</TableCell>
                      <TableCell className="text-right">{subscription.credit_kes > 0 ? formatKes(subscription.credit_kes) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing({ uuid: school.uuid, name: school.name })}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }
      </QueryState>
      {editing && <SchoolSubscriptionDialog school={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

const methodLabel = { stk: 'M-Pesa prompt', paybill: 'Paybill', manual: 'Recorded' } as const

function PaymentsTab({ unmatched = false }: { unmatched?: boolean }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [assigning, setAssigning] = useState<PlatformPayment | null>(null)
  const payments = usePlatformPayments({ status: unmatched ? 'unmatched' : '', from, to })

  return (
    <>
      {!unmatched && (
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="grid gap-1">
            From <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1">
            To <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      )}
      <QueryState query={payments}>
        {(data) => (
          <div className="grid gap-4">
            {!unmatched && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardDescription>Received{from || to ? ' in this period' : ''}</CardDescription>
                    <CardTitle className="text-2xl">{formatKes(data.totals.received_kes)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Paybill payments waiting to be assigned</CardDescription>
                    <CardTitle className="text-2xl">{data.totals.unmatched_count}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}
            {data.payments.length === 0 ? (
              <EmptyState icon={<WalletIcon />} title={unmatched ? 'Every Paybill payment named a school' : 'No payments'} />
            ) : (
              <Card className="overflow-x-auto p-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>How</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        {unmatched && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap">{formatDateTime(p.paid_at ?? p.created_at)}</TableCell>
                          <TableCell>
                            {p.school ? p.school.name : <span className="text-muted-foreground">Account “{p.account_reference ?? ''}”</span>}
                            {p.payer_name && <div className="text-xs text-muted-foreground">{p.payer_name}</div>}
                          </TableCell>
                          <TableCell>{methodLabel[p.method]}</TableCell>
                          <TableCell className="font-mono text-xs">{p.mpesa_receipt ?? p.reference ?? '—'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatKes(p.amount_kes)}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'succeeded' ? 'secondary' : p.status === 'failed' ? 'destructive' : 'outline'}>{p.status}</Badge>
                          </TableCell>
                          {unmatched && (
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => setAssigning(p)}>
                                Assign to school
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </QueryState>
      {assigning && <AssignDialog payment={assigning} onClose={() => setAssigning(null)} />}
    </>
  )
}

function AssignDialog({ payment, onClose }: { payment: PlatformPayment; onClose: () => void }) {
  const schools = usePlatformSubscriptions('')
  const { assignPayment } = usePlatformBillingMutations()
  const [schoolUuid, setSchoolUuid] = useState('')
  const [reason, setReason] = useState(`Paybill account “${payment.account_reference ?? ''}” mistyped`)
  const [search, setSearch] = useState(payment.account_reference ?? '')

  const matches = (schools.data ?? []).filter(({ school }) => {
    const q = search.trim().toLowerCase()
    return !q || school.name.toLowerCase().includes(q) || school.slug.includes(q) || q.includes(school.slug.slice(0, 4))
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {formatKes(payment.amount_kes)}</DialogTitle>
          <DialogDescription>
            M-Pesa {payment.mpesa_receipt}
            {payment.payer_name && ` from ${payment.payer_name}`}. It is credited to the school you choose, exactly like a Paybill payment with its code.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Search schools" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
            {matches.map(({ school }) => (
              <li key={school.uuid}>
                <button
                  type="button"
                  className={`flex w-full justify-between px-3 py-2 text-left hover:bg-muted ${schoolUuid === school.uuid ? 'bg-muted font-medium' : ''}`}
                  onClick={() => setSchoolUuid(school.uuid)}
                >
                  {school.name} <span className="font-mono text-xs text-muted-foreground">{school.slug}</span>
                </button>
              </li>
            ))}
          </ul>
          <label className="grid gap-1 text-sm">
            Reason
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!schoolUuid || reason.trim().length < 3 || assignPayment.isPending}
            onClick={() =>
              assignPayment.mutate(
                { id: payment.id, school_uuid: schoolUuid, reason },
                {
                  onSuccess: () => {
                    toast.success('Payment assigned and credited.')
                    onClose()
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            Assign and credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
