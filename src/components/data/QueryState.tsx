import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { AlertCircleIcon, InboxIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/errors'

/** Renders loading and error states for a query, and the children once data is there. */
export function QueryState<T>({
  query,
  children,
  loading,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  loading?: ReactNode
}) {
  if (query.isPending) {
    return (
      loading ?? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )
    )
  }
  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
  return <>{children(query.data)}</>
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>Could not load this</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="text-muted-foreground [&_svg]:size-8">{icon ?? <InboxIcon />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
