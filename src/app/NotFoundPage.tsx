import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/data/QueryState'
import { CompassIcon } from 'lucide-react'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<CompassIcon />}
      title="Page not found"
      description="The page you were looking for does not exist or has moved."
      action={
        <Button asChild>
          <Link to="/">Go to dashboard</Link>
        </Button>
      }
    />
  )
}
