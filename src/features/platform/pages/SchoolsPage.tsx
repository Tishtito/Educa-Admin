import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2Icon, CheckIcon, CopyIcon, LogInIcon, MailCheckIcon, PlusIcon, SearchIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { SchoolSubscriptionDialog } from '@/features/billing/SchoolSubscriptionDialog'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api/errors'
import { showFormError } from '@/lib/forms'
import { usePlatformSchoolMutations, usePlatformSchools, type CreatedSchool } from '../api'

export function SchoolsPage() {
  const schools = usePlatformSchools()
  const { actAsSchool } = useAuth()
  const navigate = useNavigate()
  const { update } = usePlatformSchoolMutations()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedSchool | null>(null)
  const [billing, setBilling] = useState<{ uuid: string; name: string } | null>(null)

  return (
    <>
      <PageHeader
        title="Schools"
        description="Every school on the platform. Open one to work as its administrator, set its subscription, or suspend it (which signs everyone out)."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New school
          </Button>
        }
      />
      <div className="relative mb-4 w-full max-w-xs">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Name or school code" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <QueryState query={schools}>
        {(data) => {
          const q = search.trim().toLowerCase()
          const rows = data.filter((s) => !q || s.name.toLowerCase().includes(q) || s.slug.includes(q))
          if (rows.length === 0) return <EmptyState icon={<Building2Icon />} title="No schools found" />
          return (
            <Card className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((school) => (
                    <TableRow key={school.uuid}>
                      <TableCell className="font-medium">{school.name}</TableCell>
                      <TableCell className="font-mono text-xs">{school.slug}</TableCell>
                      <TableCell>{school.county ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={school.status === 'active' ? 'secondary' : school.status === 'suspended' ? 'destructive' : 'outline'}>{school.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {school.status === 'onboarding' && (
                          <Button variant="ghost" size="sm" onClick={() => update.mutate({ uuid: school.uuid, status: 'active' }, { onSuccess: () => toast.success(`${school.name} is live.`) })}>
                            <CheckIcon /> Go live
                          </Button>
                        )}
                        {school.status === 'suspended' ? (
                          <Button variant="ghost" size="sm" onClick={() => update.mutate({ uuid: school.uuid, status: 'active' }, { onSuccess: () => toast.success(`${school.name} reactivated.`) })}>
                            Reactivate
                          </Button>
                        ) : (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm">
                                Suspend
                              </Button>
                            }
                            title={`Suspend ${school.name}?`}
                            description="Nobody at the school can sign in or use the API until it is reactivated. Their data is kept."
                            confirmLabel="Suspend"
                            destructive
                            onConfirm={() => update.mutateAsync({ uuid: school.uuid, status: 'suspended' })}
                          />
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setBilling({ uuid: school.uuid, name: school.name })}>
                          <WalletIcon /> Subscription
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={school.status === 'suspended'}
                          onClick={async () => {
                            await actAsSchool({ uuid: school.uuid, slug: school.slug, name: school.name })
                            navigate('/')
                          }}
                        >
                          <LogInIcon /> Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }}
      </QueryState>
      {creating && <CreateSchoolDialog open onOpenChange={setCreating} onCreated={setCreated} />}
      <CreatedDialog result={created} onClose={() => setCreated(null)} />
      {billing && <SchoolSubscriptionDialog school={billing} onClose={() => setBilling(null)} />}
    </>
  )
}

const schema = z
  .object({
    name: z.string().trim().min(3, 'Enter the school’s name').max(190),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(60)
      .regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and dashes'),
    county: z.string().trim().max(80),
    phone: z.string().trim().max(40),
    admin_name: z.string().trim().min(1, 'Who is the first administrator?').max(160),
    admin_username: z.string().trim().toLowerCase().min(3, 'At least 3 characters').max(60).regex(/^[a-z0-9._-]+$/, 'Lowercase letters, numbers, dots or dashes'),
    admin_email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
    send_invitation: z.boolean(),
  })
  .refine((v) => !v.send_invitation || v.admin_email !== '', {
    path: ['admin_email'],
    message: 'Enter their email, or turn off the invitation to get a temporary password',
  })

type Values = z.infer<typeof schema>

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

function CreateSchoolDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (r: CreatedSchool) => void
}) {
  const { create } = usePlatformSchoolMutations()
  const [slugTouched, setSlugTouched] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', county: '', phone: '', admin_name: '', admin_username: 'admin', admin_email: '', send_invitation: true },
  })
  const sendInvitation = useWatch({ control: form.control, name: 'send_invitation' })
  const { errors, isSubmitting } = form.formState

  async function submit(values: Values) {
    try {
      const result = await create.mutateAsync({
        name: values.name,
        slug: values.slug || undefined,
        county: values.county || null,
        phone: values.phone || null,
        admin: {
          name: values.admin_name,
          username: values.admin_username,
          email: values.admin_email || null,
          send_invitation: values.send_invitation,
        },
      })
      onCreated(result)
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['name', 'slug', 'county', 'phone'])
      if (error instanceof ApiError && error.field('admin.email')) form.setError('admin_email', { message: error.field('admin.email') ?? '' })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New school"
      description="Creates the school, its first administrator and the current academic year. The school starts in onboarding until you make it live."
      submitLabel="Create school"
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      <Field label="School name" htmlFor="ns-name" error={errors.name?.message}>
        <Input id="ns-name" {...form.register('name', { onChange: (e) => !slugTouched && form.setValue('slug', slugify(e.target.value)) })} />
      </Field>
      <Field label="School code" htmlFor="ns-slug" error={errors.slug?.message} hint="Identifies the school in reports and links.">
        <Input id="ns-slug" className="font-mono" {...form.register('slug', { onChange: () => setSlugTouched(true) })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="County" htmlFor="ns-county" error={errors.county?.message}>
          <Input id="ns-county" {...form.register('county')} />
        </Field>
        <Field label="Phone" htmlFor="ns-phone" error={errors.phone?.message}>
          <Input id="ns-phone" {...form.register('phone')} />
        </Field>
      </div>
      <div className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
        <Field label="First administrator" htmlFor="ns-admin" error={errors.admin_name?.message}>
          <Input id="ns-admin" placeholder="e.g. the head teacher" {...form.register('admin_name')} />
        </Field>
        <Field label="Their username" htmlFor="ns-admin-user" error={errors.admin_username?.message}>
          <Input id="ns-admin-user" autoCapitalize="none" {...form.register('admin_username')} />
        </Field>
        <Field label="Their email" htmlFor="ns-admin-email" error={errors.admin_email?.message} className="sm:col-span-2">
          <Input id="ns-admin-email" type="email" {...form.register('admin_email')} />
        </Field>
        <label htmlFor="ns-invite" className="flex items-start justify-between gap-3 text-sm sm:col-span-2">
          <span>
            <span className="font-medium">Email them an invitation</span>
            <span className="block text-xs text-muted-foreground">
              {sendInvitation ? 'They choose their own password from the link.' : 'You are shown a temporary password to pass on.'}
            </span>
          </span>
          <Switch id="ns-invite" checked={sendInvitation} onCheckedChange={(checked) => form.setValue('send_invitation', checked, { shouldValidate: form.formState.isSubmitted })} />
        </label>
      </div>
    </FormDialog>
  )
}

function CreatedDialog({ result, onClose }: { result: CreatedSchool | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = result
    ? `Educa sign-in for ${result.school.name}\nUsername: ${result.admin_username}\n${
        result.temporary_password
          ? `Temporary password: ${result.temporary_password}\nYou will be asked to choose your own password.`
          : `An invitation to choose your password was emailed to ${result.invitation_sent_to}.`
      }`
    : ''

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result?.school.name} is ready</DialogTitle>
          <DialogDescription>
            {result?.invitation_sent_to
              ? `An invitation to set up the administrator account was emailed to ${result.invitation_sent_to}.`
              : 'Send these to the school’s first administrator privately. The password is shown only now.'}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[9rem_1fr] gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">{result?.admin_username}</dd>
          {result?.temporary_password ? (
            <>
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd className="font-mono text-base font-semibold tracking-wider">{result.temporary_password}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">Invitation</dt>
              <dd className="flex items-center gap-1.5">
                <MailCheckIcon className="size-4 text-emerald-600" /> Sent
              </dd>
            </>
          )}
        </dl>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy details'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
