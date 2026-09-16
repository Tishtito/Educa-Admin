import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { SchoolProfile } from '@/lib/api/types'
import { showFormError } from '@/lib/forms'
import { useProfileMutations, useSchoolLogo, useSchoolProfile } from '../api'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the school’s name').max(190),
  short_name: z.string().trim().max(60),
  motto: z.string().trim().max(190),
  county: z.string().trim().max(80),
  address: z.string().trim().max(255),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
})

type Values = z.infer<typeof schema>

export function SchoolProfilePage() {
  const profile = useSchoolProfile()
  return <QueryState query={profile}>{(data) => <ProfileForms profile={data} />}</QueryState>
}

function ProfileForms({ profile }: { profile: SchoolProfile }) {
  const { refresh } = useAuth()
  const { update } = useProfileMutations()
  const values = {
    name: profile.name,
    short_name: profile.short_name ?? '',
    motto: profile.motto ?? '',
    county: profile.county ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
  }
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: values })
  const { errors, isSubmitting, isDirty } = form.formState

  async function submit(data: Values) {
    try {
      const saved = await update.mutateAsync(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' && k !== 'name' ? null : v])))
      form.reset({ ...data })
      toast.success('School details saved. New report cards use them; published ones keep what was issued.')
      if (saved.name !== profile.name) void refresh()
    } catch (error) {
      showFormError(form, error, ['name', 'short_name', 'motto', 'county', 'address', 'phone', 'email'])
    }
  }

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-[1fr_18rem]">
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>School details</CardTitle>
            <CardDescription>Printed at the top of every report card. School code: {profile.slug}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="sp-name" error={errors.name?.message} className="grid gap-1.5 sm:col-span-2">
              <Input id="sp-name" {...form.register('name')} />
            </Field>
            <Field label="Short name" htmlFor="sp-short" error={errors.short_name?.message}>
              <Input id="sp-short" {...form.register('short_name')} />
            </Field>
            <Field label="County" htmlFor="sp-county" error={errors.county?.message}>
              <Input id="sp-county" {...form.register('county')} />
            </Field>
            <Field label="Motto" htmlFor="sp-motto" error={errors.motto?.message} className="grid gap-1.5 sm:col-span-2">
              <Input id="sp-motto" {...form.register('motto')} />
            </Field>
            <Field label="Postal address" htmlFor="sp-address" error={errors.address?.message} className="grid gap-1.5 sm:col-span-2">
              <Input id="sp-address" placeholder="P.O. Box 194-10100, Nyeri" {...form.register('address')} />
            </Field>
            <Field label="Phone" htmlFor="sp-phone" error={errors.phone?.message}>
              <Input id="sp-phone" inputMode="tel" {...form.register('phone')} />
            </Field>
            <Field label="Email" htmlFor="sp-email" error={errors.email?.message}>
              <Input id="sp-email" type="email" {...form.register('email')} />
            </Field>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => form.reset(values)}>
              Discard
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </CardFooter>
        </Card>
      </form>
      <LogoCard profile={profile} />
    </div>
  )
}

function LogoCard({ profile }: { profile: SchoolProfile }) {
  const input = useRef<HTMLInputElement>(null)
  const logo = useSchoolLogo(profile.has_logo)
  const { uploadLogo, removeLogo } = useProfileMutations()

  async function upload(file: File) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast.error('Choose a PNG or JPEG image.')
    if (file.size > 512 * 1024) return toast.error('The logo must be smaller than 512 KB.')
    try {
      await uploadLogo.mutateAsync(file)
      toast.success('Logo updated.')
    } catch (error) {
      toast.error(error instanceof ApiError && error.isValidation ? (error.field('logo') ?? error.message) : errorMessage(error))
    }
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-base">Logo</CardTitle>
        <CardDescription>PNG or JPEG, square works best, under 512 KB.</CardDescription>
      </CardHeader>
      <CardContent className="grid justify-items-center gap-3">
        <div className="flex size-36 items-center justify-center overflow-hidden rounded-xl border bg-white">
          {profile.has_logo && logo.data ? (
            <img src={logo.data} alt={`${profile.name} logo`} className="max-h-full max-w-full object-contain" />
          ) : logo.isFetching ? (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="size-10 text-muted-foreground" />
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => input.current?.click()} disabled={uploadLogo.isPending}>
            {uploadLogo.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {profile.has_logo ? 'Replace' : 'Upload'}
          </Button>
          {profile.has_logo && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost">
                  <Trash2Icon /> Remove
                </Button>
              }
              title="Remove the logo?"
              description="Report cards are printed without a logo until you upload one."
              confirmLabel="Remove"
              destructive
              onConfirm={() => removeLogo.mutateAsync()}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
