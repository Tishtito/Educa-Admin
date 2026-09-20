import { matchPath, NavLink, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BottomNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const slide = 'transition-transform duration-300 ease-[cubic-bezier(.34,1.3,.64,1)] motion-reduce:transition-none'

/**
 * Phone tab bar: the active tab's icon pops out into a circle that sits in a
 * notch in the bar, and circle and notch slide together to the tapped tab.
 *
 * Everything is sized from --c (the circle diameter), and positions are
 * percentages of the tab track, so nothing is measured in JS.
 */
export function BottomNav({ items, className }: { items: BottomNavItem[]; className?: string }) {
  const { pathname } = useLocation()
  const active = items.findIndex((item) => matchPath({ path: item.to, end: item.end ?? false }, pathname))
  const n = items.length
  const at = Math.max(active, 0)
  const ActiveIcon = active >= 0 ? items[active].icon : null

  return (
    <nav
      className={cn(
        'fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 [--c:clamp(2.5rem,12.5vw,3.25rem)] sm:inset-x-4 print:hidden',
        '[@media(max-height:560px)]:[--c:2.25rem]',
        className,
      )}
    >
      <div className="relative h-[max(3rem,calc(var(--c)*1.25))]">
        {/* The bar surface: a strip three tracks wide with the notch at its centre, slid under the active tab. */}
        <div className="absolute inset-0 [filter:drop-shadow(0_0_1px_color-mix(in_oklch,var(--foreground)_30%,transparent))_drop-shadow(0_6px_16px_oklch(0_0_0/0.18))]">
          <div className="absolute inset-0 overflow-hidden rounded-[calc(var(--c)*0.4)]">
            <div className="absolute inset-y-0 inset-x-[calc(var(--c)*0.15)]">
              <div
                className={cn('absolute inset-y-0 left-0 flex w-[300%] items-start', slide)}
                style={{ transform: `translateX(${(((at + 0.5) / n - 1.5) / 3) * 100}%)` }}
              >
                <div className="h-full flex-1 bg-card" />
                <svg
                  viewBox="0 0 200 200"
                  preserveAspectRatio="none"
                  aria-hidden
                  className={cn(
                    '-mx-px h-[calc(var(--c)*2)] w-[calc(var(--c)*2)] shrink-0 text-card',
                    active < 0 && 'hidden',
                  )}
                >
                  <path
                    fill="currentColor"
                    d="M0 0H26Q38 0 40.5 20A60 60 0 0 0 159.5 20Q162 0 174 0H200V200H0Z"
                  />
                </svg>
                {active < 0 && <div className="h-full w-[calc(var(--c)*2)] shrink-0 bg-card" />}
                <div className="h-full flex-1 bg-card" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-y-0 inset-x-[calc(var(--c)*0.15)]">
          {/* The floating circle, one tab wide, moved a whole tab at a time. */}
          <div
            aria-hidden
            className={cn('pointer-events-none absolute top-0 left-0 flex justify-center', slide)}
            style={{ width: `${100 / n}%`, transform: `translateX(${at * 100}%)` }}
          >
            <div
              className={cn(
                'absolute top-[calc(var(--c)*-0.38)] flex size-(--c) items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform duration-300 motion-reduce:transition-none',
                active < 0 && 'scale-0',
              )}
            >
              {ActiveIcon && (
                <ActiveIcon
                  key={items[active].to}
                  className="size-[calc(var(--c)*0.46)] animate-[educa-pop_320ms_ease-out] motion-reduce:animate-none"
                />
              )}
            </div>
          </div>

          <ul className="relative grid h-full" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {items.map((item, index) => {
              const isActive = index === active
              return (
                <li key={item.to} className="@container">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    aria-label={item.label}
                    className="flex h-full min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        'size-[calc(var(--c)*0.44)] shrink-0 text-muted-foreground transition-[opacity,transform] duration-300 motion-reduce:transition-none',
                        isActive && '-translate-y-2 scale-50 opacity-0',
                      )}
                    />
                    <span
                      className={cn(
                        'max-w-full truncate text-[11px] leading-tight @max-[4.25rem]:text-[10px]',
                        isActive
                          ? 'font-medium text-primary'
                          : 'text-muted-foreground @max-[3.25rem]:sr-only',
                      )}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
