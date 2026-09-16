import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { StaffMember } from '@/lib/api/types'

/** Pick staff for a duty. Order matters for class teachers: the first chosen is the primary one. */
export function StaffMultiSelect({
  staff,
  value,
  onChange,
  placeholder = 'Nobody',
  disabled,
  label,
}: {
  staff: StaffMember[]
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  disabled?: boolean
  label: string
}) {
  const [open, setOpen] = useState(false)
  const byId = new Map(staff.map((s) => [s.id, s]))
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-auto min-h-8 w-full justify-between gap-1 py-1 font-normal" disabled={disabled} aria-label={label}>
          <span className="flex min-w-0 flex-wrap gap-1">
            {value.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {value.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1">
                {byId.get(id)?.name ?? `#${id}`}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${byId.get(id)?.name}`}
                  className="rounded-full hover:bg-foreground/10"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggle(id)
                  }}
                >
                  <XIcon />
                </span>
              </Badge>
            ))}
          </span>
          <ChevronsUpDownIcon className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search staff…" />
          <CommandList>
            <CommandEmpty>No staff with this role.</CommandEmpty>
            <CommandGroup>
              {staff.map((member) => (
                <CommandItem key={member.id} value={`${member.name} ${member.username}`} onSelect={() => toggle(member.id)}>
                  <CheckIcon className={cn('size-4', value.includes(member.id) ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{member.name}</span>
                  <span className="text-xs text-muted-foreground">@{member.username}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
