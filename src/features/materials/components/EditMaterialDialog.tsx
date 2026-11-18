import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { Level, TeachingMaterial } from '@/lib/api/types'
import { useMaterialMutations } from '../api'
import { MaterialTagFields, type MaterialTags } from './MaterialTagFields'

/** Title, note, section, grades and subject of one material. Mounted per material, so state starts from it. */
export function EditMaterialDialog({ material, levels, onClose }: { material: TeachingMaterial; levels: Level[]; onClose: () => void }) {
  const { update } = useMaterialMutations()
  const [title, setTitle] = useState(material.title)
  const [description, setDescription] = useState(material.description ?? '')
  const [tags, setTags] = useState<MaterialTags>({
    level_id: material.level_id,
    grade_ids: material.grades?.map((g) => g.id) ?? [],
    level_subject_id: material.level_subject_id,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit() {
    if (!title.trim()) {
      setErrors({ title: 'Give the material a title.' })
      return
    }
    update.mutate(
      { id: material.id, title: title.trim(), description: description.trim() || null, level_id: tags.level_id ?? material.level_id, grade_ids: tags.grade_ids, level_subject_id: tags.level_subject_id },
      {
        onSuccess: () => {
          toast.success('Material saved.')
          onClose()
        },
        onError: (error) => {
          if (error instanceof ApiError && error.isValidation) {
            setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k.split('.')[0]!, v[0] ?? ''])))
          } else toast.error(errorMessage(error))
        },
      },
    )
  }

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()} title="Edit material" description={material.original_name} busy={update.isPending} onSubmit={submit}>
      <Field label="Title" htmlFor="material-title" error={errors.title}>
        <Input id="material-title" value={title} maxLength={190} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Note for teachers" htmlFor="material-note" error={errors.description}>
        <Textarea id="material-note" value={description} maxLength={2000} rows={3} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <MaterialTagFields levels={levels} value={tags} onChange={setTags} errors={errors} />
    </FormDialog>
  )
}
