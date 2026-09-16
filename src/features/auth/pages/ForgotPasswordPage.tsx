import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { Loader2Icon, MailCheckIcon } from 'lucide-react'
import { Field } from '@/components/data/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/api/errors'
import { requestPasswordReset } from '../api'
import { AuthLayout } from '../AuthLayout'

const schema = z.object({
  identity: z.string().trim().min(1, 'Enter your username or email address'),
})

type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identity: '' } })
  const { errors, isSubmitting } = form.formState

  async function submit(values: Values) {
    setFormError(null)
    try {
      setSent(await requestPasswordReset(values))
    } catch (error) {
      setFormError(error instanceof ApiError && error.isValidation ? error.message : errorMessage(error))
    }
  }

  return (
    <AuthLayout
      footer={
        <Link to="/login" className="underline">
          Back to sign in
        </Link>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>We will email a link to choose a new one to the address on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="grid gap-4">
              <Alert>
                <MailCheckIcon />
                <AlertDescription>{sent}</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => setSent(null)}>
                Try a different account
              </Button>
            </div>
          ) : (
            <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(submit)}>
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
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2Icon className="animate-spin" />}
                Email me a link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
