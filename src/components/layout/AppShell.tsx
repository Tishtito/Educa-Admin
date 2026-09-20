import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigation } from 'react-router'
import { useTheme } from 'next-themes'
import {
  Building2Icon,
  ChevronsUpDownIcon,
  GraduationCapIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  WifiOffIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation, type NavItem } from '@/app/navigation'
import { useAuth } from '@/auth/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BottomNav } from '@/components/layout/BottomNav'
import { SchoolPicker } from '@/features/platform/components/SchoolPicker'
import { SubscriptionBanner } from '@/features/billing/SubscriptionLock'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useNativeBackButton } from '@/lib/native'

export function AppShell() {
  const location = useLocation()
  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const drawerOpen = drawerPath === location.pathname
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? location.pathname : null)
  const online = useOnlineStatus()
  // Pages load on demand; show that a tap was taken while the next one loads.
  const navigating = useNavigation().state !== 'idle'
  useNativeBackButton(drawerOpen ? () => setDrawerOpen(false) : undefined)
  const bottomItems = useVisibleNavigation()
    .flatMap((section) => section.items)
    .filter((item) => item.primary)
    .slice(0, 4)

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar md:flex print:hidden">
        <SidebarContent />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 pt-[env(safe-area-inset-top)]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </Button>
            <SchoolIndicator />
            <div className="ml-auto">
              <UserMenu />
            </div>
          </div>
          {navigating && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" role="progressbar" aria-label="Loading page">
              <div className="h-full w-1/3 animate-[educa-progress_1s_ease-in-out_infinite] bg-primary" />
            </div>
          )}
          <SubscriptionBanner />
          {!online && (
            <div className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <WifiOffIcon className="size-3.5" /> You are offline. Changes cannot be saved until you reconnect.
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-6 print:max-w-none print:p-0">
          <Outlet />
        </main>

        {bottomItems.length >= 2 && <BottomNav items={bottomItems} className="md:hidden" />}
      </div>
    </div>
  )
}

export function useVisibleNavigation() {
  const { can, isPlatformAdmin, school } = useAuth()
  return navigation
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => (item.permissions.length === 0 || can(...item.permissions)) && (!item.tenant || !isPlatformAdmin || school !== null || item.to === '/'),
      ),
    }))
    .filter((section) => section.items.length > 0)
}

function SidebarContent() {
  const sections = useVisibleNavigation()
  const { logout } = useAuth()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCapIcon className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Educa Admin</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, index) => (
          <div key={section.label ?? index}>
            {section.label && (
              <div className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {section.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOutIcon className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="size-4" />
      {item.label}
    </NavLink>
  )
}

function SchoolIndicator() {
  const { school, isPlatformAdmin } = useAuth()
  const [open, setOpen] = useState(false)

  if (!isPlatformAdmin) {
    return <div className="min-w-0 truncate text-sm font-medium">{school?.name}</div>
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-w-0 max-w-[60vw] justify-between gap-2" onClick={() => setOpen(true)}>
        <Building2Icon />
        <span className="truncate">{school?.name ?? 'Choose a school'}</span>
        <ChevronsUpDownIcon className="opacity-50" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Act as school</DialogTitle>
            <DialogDescription>Everything you open next is that school&apos;s data.</DialogDescription>
          </DialogHeader>
          <SchoolPicker onPicked={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">{user?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate">{user?.name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">@{user?.username}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to="/settings/account">
            <UserIcon /> My account
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
