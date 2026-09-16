import { Outlet } from 'react-router'
import { Building2Icon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SchoolPicker } from '@/features/platform/components/SchoolPicker'
import { useAuth } from './useAuth'

/**
 * School data needs a tenant. School admins always have one; a superadmin must
 * pick a school first, or the API's fail-closed tenant scope returns nothing.
 */
export function RequireSchool() {
  const { school, isPlatformAdmin } = useAuth()

  if (school || !isPlatformAdmin) return <Outlet />

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2Icon className="size-5" />
          </div>
          <CardTitle>Choose a school</CardTitle>
          <CardDescription>
            You are signed in as a platform administrator. Pick the school whose data you want to work with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolPicker />
        </CardContent>
      </Card>
    </div>
  )
}
