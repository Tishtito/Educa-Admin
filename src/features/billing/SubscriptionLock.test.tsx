import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/context'
import type { SubscriptionState, User } from '@/lib/api/types'
import type { Permission } from '@/lib/permissions'
import { SubscriptionBanner, SubscriptionLock } from './SubscriptionLock'

const state = (overrides: Partial<SubscriptionState>): SubscriptionState => ({
  status: 'active',
  paid_until: '2026-12-31',
  days_left: 90,
  is_trial: false,
  cycle_months: 4,
  price_kes: 12000,
  credit_kes: 0,
  amount_due_kes: 12000,
  ...overrides,
})

function renderWith(subscription: SubscriptionState, { permissions = [], platform = false }: { permissions?: Permission[]; platform?: boolean } = {}) {
  const user = { name: 'Admin', permissions, school: { name: 'Hilltop', slug: 'hilltop', subscription } } as unknown as User
  const auth = {
    user,
    isPlatformAdmin: platform,
    school: { name: 'Hilltop', slug: 'hilltop' },
    can: (...p: Permission[]) => p.some((x) => permissions.includes(x)),
  } as unknown as AuthContextValue

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <SubscriptionBanner />
        <SubscriptionLock>
          <button type="button">Enter marks</button>
        </SubscriptionLock>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('SubscriptionLock', () => {
  it('leaves an active school alone', () => {
    renderWith(state({}))
    expect(screen.getByRole('button', { name: 'Enter marks' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides and disables the page when the subscription has ended, and offers renewal to whoever may pay', () => {
    renderWith(state({ status: 'overdue', paid_until: '2026-09-18', days_left: 0 }), { permissions: ['manage_billing'] })
    expect(screen.queryByRole('button', { name: 'Enter marks' })).not.toBeInTheDocument()   // aria-hidden
    expect(screen.getByRole('alertdialog')).toHaveTextContent("Hilltop's subscription has ended")
    expect(screen.getByRole('link', { name: /Renew · KES 12,000 with M-Pesa/ })).toHaveAttribute('href', '/settings/subscription')
    expect(screen.getByRole('alert')).toHaveTextContent('Subscription ended on')
  })

  it('tells staff who cannot pay to ask their administrator', () => {
    renderWith(state({ status: 'overdue', days_left: 0 }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Ask your school administrator to renew it.')
    expect(screen.queryByRole('link', { name: /Renew/ })).not.toBeInTheDocument()
  })

  it('never locks a platform superadmin', () => {
    renderWith(state({ status: 'overdue', days_left: 0 }), { platform: true })
    expect(screen.getByRole('button', { name: 'Enter marks' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('warns in the last week', () => {
    renderWith(state({ days_left: 3 }))
    expect(screen.getByRole('status')).toHaveTextContent('Subscription: 3 days left')
  })
})
