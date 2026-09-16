import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { ReportCardSettings } from '@/lib/api/types'
import { useReportCardSettings, useSaveReportCardSettings } from '../api'

const schema = z.object({
  head_teacher_name: z.string().trim().max(160, 'At most 160 characters'),
  footer: z.string().trim().max(300, 'At most 300 characters'),
})

type Values = z.infer<typeof schema>

export function ReportCardSettingsPage() {
  const settings = useReportCardSettings()
  return <QueryState query={settings}>{(data) => <SettingsForm settings={data} />}</QueryState>
}

function SettingsForm({ settings }: { settings: ReportCardSettings }) {
  const save = useSaveReportCardSettings()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { head_teacher_name: settings.head_teacher_name ?? '', footer: settings.footer ?? '' },
  })

  useEffect(() => {
    form.reset({ head_teacher_name: settings.head_teacher_name ?? '', footer: settings.footer ?? '' })
  }, [settings, form])

  async function onSubmit(values: Values) {
    try {
      await save.mutateAsync({
        // Blank clears the setting; the card then falls back to the default.
        head_teacher_name: values.head_teacher_name || null,
        footer: values.footer || null,
      })
      toast.success('Report card settings saved')
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const key of ['head_teacher_name', 'footer'] as const) {
          const message = error.field(key)
          if (message) form.setError(key, { message })
        }
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  const { errors, isSubmitting, isDirty } = form.formState
  const footerLength = useWatch({ control: form.control, name: 'footer' }).length

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Report cards</CardTitle>
          <CardDescription>Printed on every report card. Published report cards keep the text they were issued with.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field label="Head teacher's name" htmlFor="head_teacher_name" error={errors.head_teacher_name?.message}>
            <Input id="head_teacher_name" placeholder="e.g. Mary Wanjiku" {...form.register('head_teacher_name')} />
          </Field>
          <Field
            label="Footer note"
            htmlFor="footer"
            error={errors.footer?.message}
            hint={
              <>
                Leave blank to use the default: <em>&ldquo;{settings.default_footer}&rdquo;</em> ({footerLength}/300)
              </>
            }
          >
            <Textarea id="footer" rows={3} placeholder={settings.default_footer} {...form.register('footer')} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => form.reset()}>
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
