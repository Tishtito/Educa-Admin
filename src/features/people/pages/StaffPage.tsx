import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckIcon, CopyIcon, KeyRoundIcon, MailIcon, MailXIcon, MoreHorizontalIcon, PencilIcon, SearchIcon, Trash2Icon, UserPlusIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RoleSlug, StaffMember } from '@/lib/api/types'
import { formatDate, formatRelative, roleLabel } from '@/lib/format'
import { showFormError } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { useStaff, useStaffMutations } from '../api'

const grantable: RoleSlug[] = ['school_admin', 'class_teacher', 'examiner']
const ALL = 'all'

export function StaffPage() {
  const staff = useStaff()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string>(ALL)
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null)

  return (
    <>
      <PageHeader
        title="Staff"
        description="Accounts for administrators, class teachers and examiners. Invite people by email to choose their own password, or give them a temporary password to change at first sign-in."
        actions={
          <Button onClick={() => setEditing('new')}>
            <UserPlusIcon /> New account
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Name, username or staff no." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-44" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {grantable.map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryState query={staff}>
        {(data) => {
          const q = search.trim().toLowerCase()
          const rows = data.filter(
            (m) =>
              (role === ALL || m.roles.includes(role as RoleSlug)) &&
              (!q || m.name.toLowerCase().includes(q) || m.username.includes(q) || (m.staff_no ?? '').toLowerCase().includes(q)),
          )
          if (rows.length === 0) return <EmptyState title="No staff found" />
          return (
            <Card className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>This year</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => (
                    <StaffRow key={member.id} member={member} onEdit={() => setEditing(member)} onCredentials={setCredentials} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }}
      </QueryState>

      {editing && (
        <StaffDialog
          open
          onOpenChange={() => setEditing(null)}
          member={editing === 'new' ? undefined : editing}
          onCreated={(created) =>
            created.temporary_password
              ? setCredentials({ name: created.name, username: created.username, password: created.temporary_password })
              : toast.success(`Invitation sent to ${created.invitation?.sent_to ?? created.email}.`, {
                  description: 'The link to set up the account works for 7 days.',
                })
          }
        />
      )}
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}

function StaffRow({
  member,
  onEdit,
  onCredentials,
}: {
  member: StaffMember
  onEdit: () => void
  onCredentials: (c: { name: string; username: string; password: string }) => void
}) {
  const { user } = useAuth()
  const { update, resetPassword, remove, sendInvitation, cancelInvitation } = useStaffMutations()
  const [confirm, setConfirm] = useState<'reset' | 'deactivate' | 'delete' | 'cancel-invite' | null>(null)
  const isSelf = user?.id === member.id
  // Invitations are for accounts nobody has used yet; afterwards it is a password reset.
  const invitable = member.is_active && !member.last_login_at && !!member.email

  function invite() {
    sendInvitation.mutate(member.id, {
      onSuccess: () => toast.success(`Invitation sent to ${member.email}.`),
    })
  }

  return (
    <TableRow className={cn(!member.is_active && 'text-muted-foreground')}>
      <TableCell>
        <div className="font-medium">
          {member.name} {isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          @{member.username}
          {member.staff_no && ` · ${member.staff_no}`}
          {!member.is_active && ' · deactivated'}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {member.roles.map((r) => (
            <Badge key={r} variant={r === 'school_admin' ? 'default' : 'secondary'}>
              {roleLabel(r)}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {[
          member.class_teacher_of.length > 0 && `Class teacher of ${member.class_teacher_of.map((c) => c.class_name).join(', ')}`,
          member.examiner_assignments_count > 0 && `Marks ${member.examiner_assignments_count} subject${member.examiner_assignments_count === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · ') || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {member.invitation ? (
          member.invitation.status === 'pending' ? (
            <Badge variant="outline" title={`Sent to ${member.invitation.sent_to}`}>
              <MailIcon /> Invited · expires {formatDate(member.invitation.expires_at)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400">
              Invitation expired
            </Badge>
          )
        ) : member.must_change_password || !member.last_login_at ? (
          <Badge variant="outline">Awaiting first sign-in</Badge>
        ) : (
          formatRelative(member.last_login_at)
        )}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
            {invitable && (
              <DropdownMenuItem onSelect={invite} disabled={sendInvitation.isPending}>
                <MailIcon /> {member.invitation ? 'Resend invitation' : 'Send invitation'}
              </DropdownMenuItem>
            )}
            {member.invitation && (
              <DropdownMenuItem onSelect={() => setConfirm('cancel-invite')}>
                <MailXIcon /> Cancel invitation
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setConfirm('reset')}>
              <KeyRoundIcon /> Reset password
            </DropdownMenuItem>
            {!isSelf && (
              <DropdownMenuItem
                onSelect={() =>
                  member.is_active
                    ? setConfirm('deactivate')
                    : update.mutate(
                        { id: member.id, is_active: true },
                        { onSuccess: () => toast.success(`${member.name} can sign in again.`), onError: (e) => toast.error(e.message) },
                      )
                }
              >
                {member.is_active ? <UserXIcon /> : <CheckIcon />} {member.is_active ? 'Deactivate' : 'Reactivate'}
              </DropdownMenuItem>
            )}
            {!isSelf && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('delete')}>
                  <Trash2Icon /> Remove account
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ConfirmDialog
          open={confirm === 'reset'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Reset ${member.name}'s password?`}
          description="They are signed out on every device and must choose a new password with the temporary one you are shown next."
          confirmLabel="Reset password"
          onConfirm={async () => {
            const result = await resetPassword.mutateAsync(member.id)
            onCredentials({ name: member.name, username: result.username, password: result.temporary_password })
          }}
        />
        <ConfirmDialog
          open={confirm === 'cancel-invite'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Cancel ${member.name}'s invitation?`}
          description={`The link emailed to ${member.invitation?.sent_to ?? 'them'} stops working. You can send a new one, or reset the password to give them a temporary one instead.`}
          confirmLabel="Cancel invitation"
          destructive
          onConfirm={() => cancelInvitation.mutateAsync(member.id).then(() => toast.success('Invitation cancelled.'))}
        />
        <ConfirmDialog
          open={confirm === 'deactivate'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Deactivate ${member.name}?`}
          description="They are signed out and cannot sign in. Their assignments and the marks they entered are kept. You can reactivate them later."
          confirmLabel="Deactivate"
          destructive
          onConfirm={async () => {
            try {
              await update.mutateAsync({ id: member.id, is_active: false })
              toast.success(`${member.name} deactivated.`)
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not deactivate.')
              throw error
            }
          }}
        />
        <ConfirmDialog
          open={confirm === 'delete'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Remove ${member.name}'s account?`}
          description="The account is closed for good. Marks they entered keep their name. To only stop them signing in, deactivate instead."
          confirmLabel="Remove"
          destructive
          onConfirm={() => remove.mutateAsync(member.id).then(() => toast.success('Account removed.'))}
        />
      </TableCell>
    </TableRow>
  )
}

const staffSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter their name').max(160),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'At least 3 characters')
      .max(60)
      .regex(/^[a-z0-9._-]+$/, 'Lowercase letters, numbers, dots, dashes or underscores'),
    email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
    phone: z.string().trim().max(40),
    staff_no: z.string().trim().max(40),
    tsc_no: z.string().trim().max(40),
    roles: z.array(z.enum(['school_admin', 'class_teacher', 'examiner'])).min(1, 'Choose at least one role'),
    send_invitation: z.boolean(),
  })
  .refine((v) => !v.send_invitation || v.email !== '', { path: ['email'], message: 'Enter the email address to send the invitation to' })

type StaffValues = z.infer<typeof staffSchema>

function suggestUsername(name: string) {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1]}` : parts[0]).replace(/[^a-z0-9]/g, '')
}

function StaffDialog({
  open,
  onOpenChange,
  member,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: StaffMember
  onCreated: (member: StaffMember) => void
}) {
  const { create, update } = useStaffMutations()
  const [usernameTouched, setUsernameTouched] = useState(!!member)
  // The invitation switch follows the email field until someone flips it by hand.
  const [inviteTouched, setInviteTouched] = useState(false)
  const form = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: member?.name ?? '',
      username: member?.username ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      staff_no: member?.staff_no ?? '',
      tsc_no: member?.tsc_no ?? '',
      roles: (member?.roles.filter((r) => r !== 'super_admin') as StaffValues['roles']) ?? ['class_teacher'],
      send_invitation: false,
    },
  })
  const [roles, sendInvitation] = useWatch({ control: form.control, name: ['roles', 'send_invitation'] })
  const { errors, isSubmitting } = form.formState

  async function submit(values: StaffValues) {
    const { send_invitation, ...rest } = values
    const input = {
      ...rest,
      email: values.email || null,
      phone: values.phone || null,
      staff_no: values.staff_no || null,
      tsc_no: values.tsc_no || null,
    }
    try {
      if (member) {
        await update.mutateAsync({ id: member.id, ...input })
        toast.success('Account updated.')
      } else {
        onCreated(await create.mutateAsync({ ...input, send_invitation }))
      }
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['name', 'username', 'email', 'phone', 'staff_no', 'tsc_no', 'roles'])
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Edit ${member.name}` : 'New staff account'}
      submitLabel={member ? 'Save' : sendInvitation ? 'Create and send invitation' : 'Create account'}
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      <Field label="Full name" htmlFor="staff-name" error={errors.name?.message}>
        <Input
          id="staff-name"
          {...form.register('name', {
            onChange: (e) => !usernameTouched && form.setValue('username', suggestUsername(e.target.value)),
          })}
        />
      </Field>
      <Field label="Username" htmlFor="staff-username" error={errors.username?.message} hint="What they type to sign in. It must be free across every school on Educa.">
        <Input id="staff-username" autoCapitalize="none" {...form.register('username', { onChange: () => setUsernameTouched(true) })} />
      </Field>
      <Field label="Roles" error={errors.roles?.message}>
        <div className="grid gap-2 rounded-lg border p-3">
          {grantable.map((role) => (
            <label key={role} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={roles.includes(role as StaffValues['roles'][number])}
                onCheckedChange={(checked) =>
                  form.setValue(
                    'roles',
                    checked ? [...roles, role as StaffValues['roles'][number]] : roles.filter((r) => r !== role),
                    { shouldValidate: form.formState.isSubmitted },
                  )
                }
              />
              <span>
                {roleLabel(role)}
                <span className="block text-xs text-muted-foreground">
                  {role === 'school_admin' && 'Everything in this app: set-up, exams, staff and pupils.'}
                  {role === 'class_teacher' && 'Sees their class’s marks and fills in report card remarks.'}
                  {role === 'examiner' && 'Enters marks for the subjects and classes they are given.'}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="staff-phone" error={errors.phone?.message}>
          <Input id="staff-phone" inputMode="tel" {...form.register('phone')} />
        </Field>
        <Field label="Email" htmlFor="staff-email" error={errors.email?.message}>
          <Input
            id="staff-email"
            type="email"
            {...form.register('email', {
              onChange: (e) => !member && !inviteTouched && form.setValue('send_invitation', e.target.value.trim() !== ''),
            })}
          />
        </Field>
        <Field label="Staff number" htmlFor="staff-no" error={errors.staff_no?.message}>
          <Input id="staff-no" {...form.register('staff_no')} />
        </Field>
        <Field label="TSC number" htmlFor="staff-tsc" error={errors.tsc_no?.message}>
          <Input id="staff-tsc" {...form.register('tsc_no')} />
        </Field>
      </div>
      {!member && (
        <label htmlFor="staff-invite" className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>
            <span className="font-medium">Send an invitation email</span>
            <span className="block text-xs text-muted-foreground">
              {sendInvitation
                ? 'They get a link to choose their own password. Nothing to hand over.'
                : 'Off: you are shown a temporary password to give them yourself.'}
            </span>
          </span>
          <Switch
            id="staff-invite"
            checked={sendInvitation}
            onCheckedChange={(checked) => {
              setInviteTouched(true)
              form.setValue('send_invitation', checked, { shouldValidate: form.formState.isSubmitted })
            }}
          />
        </label>
      )}
      {member?.invitation && (
        <p className="text-xs text-muted-foreground">Changing the email address cancels the invitation sent to {member.invitation.sent_to}.</p>
      )}
    </FormDialog>
  )
}

function CredentialsDialog({ credentials, onClose }: { credentials: { name: string; username: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = credentials
    ? `Educa sign-in for ${credentials.name}\nUsername: ${credentials.username}\nTemporary password: ${credentials.password}\nYou will be asked to choose your own password.`
    : ''

  return (
    <Dialog open={credentials !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign-in details for {credentials?.name}</DialogTitle>
          <DialogDescription>Give these to them privately. The password is shown only now and must be changed when they first sign in.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[9rem_1fr] gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">{credentials?.username}</dd>
          <dt className="text-muted-foreground">Temporary password</dt>
          <dd className="font-mono text-base font-semibold tracking-wider">{credentials?.password}</dd>
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
