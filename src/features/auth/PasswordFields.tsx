import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Field } from '@/components/data/Field'
import { Input } from '@/components/ui/input'

export interface NewPasswordValues {
  password: string
  password_confirmation: string
}

/** New password + confirmation, with one show/hide toggle for both. */
export function PasswordFields<T extends NewPasswordValues>({ form }: { form: UseFormReturn<T> }) {
  const [show, setShow] = useState(false)
  const f = form as unknown as UseFormReturn<NewPasswordValues>
  const { errors } = f.formState

  return (
    <>
      <Field label="New password" htmlFor="new-password" error={errors.password?.message} hint="At least 8 characters.">
        <div className="relative">
          <Input
            id="new-password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-9"
            aria-invalid={!!errors.password}
            {...f.register('password')}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      </Field>
      <Field label="Confirm new password" htmlFor="confirm-password" error={errors.password_confirmation?.message}>
        <Input
          id="confirm-password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          aria-invalid={!!errors.password_confirmation}
          {...f.register('password_confirmation')}
        />
      </Field>
    </>
  )
}
