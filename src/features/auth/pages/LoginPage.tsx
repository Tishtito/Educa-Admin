import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router'
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { NotAnAdminError } from '@/auth/context'
import { useAuth } from '@/auth/useAuth'
import { Field } from '@/components/data/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/api/errors'
import { googleAvailable } from '@/lib/google'
import { AuthLayout } from '../AuthLayout'
import { GoogleButton, OrDivider } from '../GoogleButton'

const schema = z.object({
  identity: z.string().trim().min(1, 'Enter your username or email address'),
  password: z.string().min(1, 'Enter your password'),
})

type Values = z.infer<typeof schema>

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identity: '', password: '' } })

  async function onSubmit(values: Values) {
    setFormError(null)
    try {
      await login(values)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        // The API answers the same way for an unknown account and a wrong
        // password, so the message belongs above the form, not on a field.
        setFormError(error.field('identity') ?? error.message)
      } else if (error instanceof NotAnAdminError) {
        setFormError(error.message)
      } else {
        setFormError(errorMessage(error))
      }
      form.setValue('password', '')
    }
  }

  async function onGoogle(idToken: string) {
    setFormError(null)
    try {
      await loginWithGoogle(idToken)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setFormError(error.field('id_token') ?? error.message)
      } else {
        setFormError(errorMessage(error))
      }
    }
  }

  const { errors, isSubmitting } = form.formState

  return (
    <AuthLayout
      footer={
        <Link to="/forgot-password" className="underline underline-offset-2 hover:text-foreground">
          Forgot your password?
        </Link>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the username or email address your school administrator gave you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Field label="Username or email" htmlFor="identity" error={errors.identity?.message}>
              <Input
                id="identity"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                aria-invalid={!!errors.identity}
                {...form.register('identity')}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-9"
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Sign in
            </Button>

            {googleAvailable() && (
              <>
                <OrDivider />
                <GoogleButton disabled={isSubmitting} onIdToken={onGoogle} onError={setFormError} />
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
