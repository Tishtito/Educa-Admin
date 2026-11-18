import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileTextIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import type { ReportCardSettings, ReportTemplate, ReportTemplateOption } from '@/lib/api/types'
import { openBlob } from '@/lib/download'
import { showFormError } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { fetchReportTemplatePreview, useReportCardSettings, useSaveReportCardSettings } from '../api'

const schema = z.object({
  head_teacher_name: z.string().trim().max(160, 'At most 160 characters'),
  footer: z.string().trim().max(300, 'At most 300 characters'),
  template: z.enum(['classic', 'modern', 'formal']),
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
    defaultValues: valuesOf(settings),
  })

  useEffect(() => {
    form.reset(valuesOf(settings))
  }, [settings, form])

  async function onSubmit(values: Values) {
    try {
      await save.mutateAsync({
        // Blank clears the setting; the card then falls back to the default.
        head_teacher_name: values.head_teacher_name || null,
        footer: values.footer || null,
        template: values.template,
      })
      toast.success('Report card settings saved')
    } catch (error) {
      showFormError(form, error, ['head_teacher_name', 'footer', 'template'])
    }
  }

  const { errors, isSubmitting, isDirty } = form.formState
  const footerLength = useWatch({ control: form.control, name: 'footer' }).length

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle id="report-template-title">Template</CardTitle>
          <CardDescription>
            The design report cards are printed in. Published report cards keep the design they were issued with; a new choice applies to
            report cards published from now on.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Controller
            control={form.control}
            name="template"
            render={({ field }) => (
              <TemplatePicker
                labelledBy="report-template-title"
                options={settings.templates}
                value={field.value}
                current={settings.template}
                disabled={isSubmitting}
                onChange={field.onChange}
              />
            )}
          />
          {errors.template?.message && (
            <p className="text-xs text-destructive" role="alert">
              {errors.template.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
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

function valuesOf(settings: ReportCardSettings): Values {
  return { head_teacher_name: settings.head_teacher_name ?? '', footer: settings.footer ?? '', template: settings.template }
}

/**
 * The template choices as a radio group. Hand-rolled: each option also carries
 * a "Preview PDF" button, which cannot sit inside a radio, so the option is a
 * row holding the radio and the button side by side.
 */
function TemplatePicker({
  labelledBy,
  options,
  value,
  current,
  disabled,
  onChange,
}: {
  labelledBy: string
  options: ReportTemplateOption[]
  value: ReportTemplate
  /** The template saved for the school, as opposed to the one picked in the form. */
  current: ReportTemplate
  disabled: boolean
  onChange: (value: ReportTemplate) => void
}) {
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  const [previewing, setPreviewing] = useState<ReportTemplate | null>(null)

  // As a native radio group: arrows move the selection, and the focus with it.
  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step || disabled) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    radios.current[next]?.focus()
  }

  async function preview(option: ReportTemplateOption) {
    setPreviewing(option.value)
    try {
      const { blob, filename } = await fetchReportTemplatePreview(option.value)
      await openBlob(blob, filename ?? `report-card-${option.value}-sample.pdf`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <div
            key={option.value}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-colors',
              checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
            )}
          >
            <button
              ref={(element) => {
                radios.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-describedby={`report-template-${option.value}-description`}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-primary' : 'border-muted-foreground/50',
                )}
              >
                {checked && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {option.label}
                  {option.value === current && <Badge variant="secondary">Current</Badge>}
                </span>
                <span id={`report-template-${option.value}-description`} className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={previewing !== null}
              aria-label={`Preview ${option.label} as a PDF`}
              onClick={() => void preview(option)}
            >
              {previewing === option.value ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
              Preview PDF
            </Button>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">The preview shows a made-up pupil under your school&rsquo;s name and logo.</p>
    </div>
  )
}
