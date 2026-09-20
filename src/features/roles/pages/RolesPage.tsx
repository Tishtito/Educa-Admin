import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LockIcon, PencilIcon, PlusIcon, RotateCcwIcon, SaveIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import type { PermissionGroup, RoleSummary } from '@/lib/api/types'
import { showFormError } from '@/lib/forms'
import type { Permission } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { PORTAL_ONLY, usePermissionGroups, useRoleMutations, useRoles } from '../api'

/**
 * Settings → Roles & permissions. What each role may do in this school: the
 * built-in class teacher and examiner (editable), the fixed school
 * administrator, and roles the school makes for itself.
 */
export function RolesPage() {
  const roles = useRoles()
  const groups = usePermissionGroups()
  const { can } = useAuth()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <QueryState query={roles}>
      {(data) => {
        const selected = data.find((r) => r.id === selectedId) ?? data[0]

        return (
          <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
            <Card className="self-start p-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-3">
                <CardTitle className="text-base">Roles</CardTitle>
                {can('manage_roles') && (
                  <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                    <PlusIcon /> New role
                  </Button>
                )}
              </CardHeader>
              <ul className="p-1">
                {data.map((role) => (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(role.id)}
                      className={cn('grid w-full gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted', role.id === selected?.id && 'bg-muted')}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        {role.is_fixed && <LockIcon className="size-3.5 text-muted-foreground" />}
                        {role.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {role.users_count} {role.users_count === 1 ? 'person' : 'people'} · {role.is_system ? (role.is_customised ? 'built in, changed' : 'built in') : 'this school’s role'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            {selected && (
              <QueryState query={groups}>
                {(permissionGroups) => <RoleEditor key={`${selected.id}:${selected.permissions.join(',')}`} role={selected} groups={permissionGroups} onDeleted={() => setSelectedId(null)} />}
              </QueryState>
            )}

            {creating && <CreateRoleDialog onClose={() => setCreating(false)} onCreated={(role) => setSelectedId(role.id)} />}
          </div>
        )
      }}
    </QueryState>
  )
}

function RoleEditor({ role, groups, onDeleted }: { role: RoleSummary; groups: PermissionGroup[]; onDeleted: () => void }) {
  const { can, user } = useAuth()
  const { setPermissions, reset, remove } = useRoleMutations()
  const [chosen, setChosen] = useState<Permission[]>(role.permissions)
  const [renaming, setRenaming] = useState(false)

  const editable = can('manage_roles') && !role.is_fixed
  const dirty = chosen.length !== role.permissions.length || chosen.some((p) => !role.permissions.includes(p))
  // Nobody may give a permission they do not hold themselves (the API refuses it too).
  const mayGrant = (permission: Permission) => role.permissions.includes(permission) || PORTAL_ONLY.includes(permission) || !!user?.permissions.includes(permission)

  async function save() {
    try {
      await setPermissions.mutateAsync({ id: role.id, permissions: chosen })
      toast.success(`${role.name} updated.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ShieldCheckIcon className="size-4 text-muted-foreground" /> {role.name}
          {role.is_fixed && <Badge variant="secondary">Fixed</Badge>}
          {role.is_customised && <Badge variant="outline">Changed for this school</Badge>}
        </CardTitle>
        <CardDescription>
          {role.is_fixed
            ? 'School administrators can always do everything in the school, so nobody can be locked out.'
            : (role.description ?? (role.is_system ? 'A built-in role. Changes apply to this school only.' : 'A role this school made.'))}
        </CardDescription>
        {editable && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!role.is_system && (
              <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                <PencilIcon /> Rename
              </Button>
            )}
            {role.is_system && role.is_customised && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <RotateCcwIcon /> Back to defaults
                  </Button>
                }
                title={`Put ${role.name} back to the defaults?`}
                description="It gets Educa’s standard permissions for this role again. Your changes are lost."
                confirmLabel="Reset"
                onConfirm={() => reset.mutateAsync(role.id).then(() => toast.success(`${role.name} is back to the defaults.`))}
              />
            )}
            {!role.is_system && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" disabled={role.users_count > 0} title={role.users_count > 0 ? 'Give its people another role first.' : undefined}>
                    <Trash2Icon /> Delete
                  </Button>
                }
                title={`Delete ${role.name}?`}
                description="The role and its permissions are removed. Nobody holds it."
                confirmLabel="Delete"
                destructive
                onConfirm={() => remove.mutateAsync(role.id).then(() => (toast.success('Role deleted.'), onDeleted()))}
              />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        {!can('manage_roles') && (
          <Alert>
            <AlertDescription>You can see what each role may do. Changing it needs permission to manage roles.</AlertDescription>
          </Alert>
        )}
        {groups.map((group) => (
          <fieldset key={group.group} className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{group.group}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map((permission) => {
                const checked = role.is_fixed ? !PORTAL_ONLY.includes(permission.slug) : chosen.includes(permission.slug)
                const locked = !editable || (!checked && !mayGrant(permission.slug))

                return (
                  <label
                    key={permission.slug}
                    className={cn('flex items-start gap-2 rounded-lg border p-2.5 text-sm', locked && 'opacity-70')}
                    title={editable && locked ? 'You can only give permissions you have yourself.' : undefined}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={(on) =>
                        setChosen((current) => (on ? [...current, permission.slug] : current.filter((p) => p !== permission.slug)))
                      }
                    />
                    <span>
                      {permission.name}
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </CardContent>
      {editable && (
        <CardFooter className="sticky bottom-0 justify-end gap-2 border-t bg-card">
          <Button variant="ghost" disabled={!dirty || setPermissions.isPending} onClick={() => setChosen(role.permissions)}>
            Discard
          </Button>
          <Button disabled={!dirty || setPermissions.isPending} onClick={() => void save()}>
            <SaveIcon /> Save permissions
          </Button>
        </CardFooter>
      )}

      {renaming && <RenameRoleDialog role={role} onClose={() => setRenaming(false)} />}
    </Card>
  )
}

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Name the role').max(80),
  description: z.string().trim().max(255),
})

type RoleValues = z.infer<typeof roleSchema>

function CreateRoleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (role: RoleSummary) => void }) {
  const { create } = useRoleMutations()
  const form = useForm<RoleValues>({ resolver: zodResolver(roleSchema), defaultValues: { name: '', description: '' } })
  const { errors, isSubmitting } = form.formState

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New role"
      description="Name it after the job — Deputy Head, Bursar, Head of Department. You choose what it may do next."
      submitLabel="Create role"
      busy={isSubmitting}
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const role = await create.mutateAsync({ name: values.name, description: values.description || null, permissions: [] })
          toast.success(`${role.name} created. Now choose what it may do.`)
          onCreated(role)
          onClose()
        } catch (error) {
          showFormError(form, error, ['name', 'description'])
        }
      })}
    >
      <Field label="Name" htmlFor="role-name" error={errors.name?.message}>
        <Input id="role-name" autoFocus {...form.register('name')} />
      </Field>
      <Field label="Description" htmlFor="role-description" error={errors.description?.message} hint="Optional. Shown to administrators.">
        <Textarea id="role-description" rows={2} {...form.register('description')} />
      </Field>
    </FormDialog>
  )
}

function RenameRoleDialog({ role, onClose }: { role: RoleSummary; onClose: () => void }) {
  const { update } = useRoleMutations()
  const form = useForm<RoleValues>({ resolver: zodResolver(roleSchema), defaultValues: { name: role.name, description: role.description ?? '' } })
  const { errors, isSubmitting } = form.formState

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Rename ${role.name}`}
      busy={isSubmitting}
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await update.mutateAsync({ id: role.id, name: values.name, description: values.description || null })
          toast.success('Role saved.')
          onClose()
        } catch (error) {
          showFormError(form, error, ['name', 'description'])
        }
      })}
    >
      <Field label="Name" htmlFor="role-name" error={errors.name?.message}>
        <Input id="role-name" autoFocus {...form.register('name')} />
      </Field>
      <Field label="Description" htmlFor="role-description" error={errors.description?.message}>
        <Textarea id="role-description" rows={2} {...form.register('description')} />
      </Field>
    </FormDialog>
  )
}

export function NoRolesAccess() {
  return <EmptyState title="Roles are managed by your school administrator" />
}
