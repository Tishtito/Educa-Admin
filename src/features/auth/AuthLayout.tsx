import type { ReactNode } from 'react'
import { GraduationCapIcon } from 'lucide-react'

/** The centred logo-and-card frame shared by sign-in, invitation and password pages. */
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm py-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCapIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Educa Admin</h1>
        </div>
        {children}
        {footer && <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
