import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ClassSelect({
  classes,
  value,
  onChange,
  className,
}: {
  classes: { id: number; name: string }[]
  value: number | null
  onChange: (classId: number) => void
  className?: string
}) {
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={className ?? 'w-48'} aria-label="Class">
        <SelectValue placeholder="Choose a class" />
      </SelectTrigger>
      <SelectContent>
        {classes.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
