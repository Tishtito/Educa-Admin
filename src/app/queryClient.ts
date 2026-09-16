import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Client errors will not fix themselves on retry.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Mutations that render their own errors (forms) opt out with meta.silent.
        if (mutation.meta?.silent) return
        if (error instanceof ApiError && (error.status === 401 || error.isValidation)) return
        if (error instanceof ApiError && error.status === 429) {
          toast.error('Too many attempts. Wait a minute and try again.')
          return
        }
        toast.error(error instanceof Error ? error.message : 'Something went wrong.')
      },
    }),
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}
