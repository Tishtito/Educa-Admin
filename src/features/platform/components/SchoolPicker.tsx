import { useState } from 'react'
import { CheckIcon, Loader2Icon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/badge'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { usePlatformSchools } from '../api'

/** Superadmin school chooser: every tenant request is then sent with X-School. */
export function SchoolPicker({ onPicked }: { onPicked?: () => void }) {
  const { school, actAsSchool } = useAuth()
  const [search, setSearch] = useState('')
  const schools = usePlatformSchools()

  return (
    <Command className="rounded-lg border">
      <CommandInput placeholder="Search schools…" value={search} onValueChange={setSearch} />
      <CommandList>
        {schools.isPending && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Loading schools…
          </div>
        )}
        <CommandEmpty>No school found.</CommandEmpty>
        <CommandGroup>
          {schools.data?.map((item) => (
            <CommandItem
              key={item.uuid}
              value={`${item.name} ${item.slug}`}
              disabled={item.status === 'suspended'}
              onSelect={async () => {
                await actAsSchool({ uuid: item.uuid, slug: item.slug, name: item.name })
                onPicked?.()
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.slug}</span>
              </div>
              {item.status !== 'active' && <Badge variant="outline">{item.status}</Badge>}
              {school?.slug === item.slug && <CheckIcon className="size-4" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
