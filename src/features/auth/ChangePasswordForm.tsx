import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { Field } from '@/components/data/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/api/errors'

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The passwords do not match',
  })
  .refine((v) => v.password !== v.current_password, {
    path: ['password'],
    message: 'Choose a password different from the current one',
  })

type Values = z.infer<typeof schema>

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { changePassword } = useAuth()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  async function onSubmit(values: Values) {
    try {
      await changePassword(values)
      form.reset()
      toast.success('Password changed. Other devices have been signed out.')
      onDone?.()
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const key of ['current_password', 'password', 'password_confirmation'] as const) {
          const message = error.field(key)
          if (message) form.setError(key, { message })
        }
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  const { errors, isSubmitting } = form.formState

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field label="Current password" htmlFor="current_password" error={errors.current_password?.message}>
        <Input id="current_password" type="password" autoComplete="current-password" {...form.register('current_password')} />
      </Field>
      <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
        <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
      </Field>
      <Field label="Confirm new password" htmlFor="password_confirmation" error={errors.password_confirmation?.message}>
        <Input
          id="password_confirmation"
          type="password"
          autoComplete="new-password"
          {...form.register('password_confirmation')}
        />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  )
}
