import type { ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** A dialog wrapping a form: header, scrollable body, cancel and submit. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Save',
  busy,
  onSubmit,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  submitLabel?: string
  busy?: boolean
  onSubmit: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className={wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
          className="grid max-h-[85dvh] gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="-mx-1 grid min-w-0 gap-4 overflow-x-hidden overflow-y-auto px-1">{children}</div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
