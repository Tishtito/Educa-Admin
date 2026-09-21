import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from '@/auth/context'
import type { User } from '@/lib/api/types'
import { BillingPage } from './BillingPage'

/**
 * The "Check your phone" dialog must follow the payment: M-Pesa answers through
 * a webhook seconds later, and the dialog polls until it does.
 */
describe('BillingPage: paying with M-Pesa', () => {
  const overview = (amountDue: number | null = 10) => ({
    data: {
      subscription: {
        status: 'overdue', paid_until: '2026-09-17', days_left: 0, is_trial: false,
        cycle_months: 4, price_kes: 10, credit_kes: 0, amount_due_kes: amountDue,
      },
      paybill: { business_number: '174379', account_number: 'gatimu' },
      mpesa_available: true,
      payments: [],
    },
  })

  const payment = (overrides: Record<string, unknown> = {}) => ({
    data: {
      id: 7, method: 'stk', status: 'pending', amount_kes: 10, mpesa_receipt: null, reference: null,
      phone: '2547*****149', result_desc: null, paid_at: null, paid_until_after: null, cycles_added: 0,
      created_at: '2026-09-21T10:00:00+00:00',
      subscription: { ...overview().data.subscription, status: 'active', paid_until: '2027-01-17' },
      ...overrides,
    },
  })

  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))

  function renderPage() {
    const auth = {
      user: { name: 'Admin', phone: '0712345678', permissions: ['manage_billing'], school: { name: 'Gatimu', slug: 'gatimu' } } as unknown as User,
      can: () => true,
      refresh: () => Promise.resolve(),
    } as unknown as AuthContextValue

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>
          <BillingPage />
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
  }

  it('follows the payment from prompt to receipt', async () => {
    const user = userEvent.setup()
    let polls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/billing')) return json(overview())
      if (url.endsWith('/billing/stk') && init?.method === 'POST') return json(payment())
      if (url.includes('/billing/payments/7')) {
        polls++
        // M-Pesa answers a few seconds after the prompt.
        return json(polls < 2 ? payment() : payment({ status: 'succeeded', mpesa_receipt: 'UII1F76IAB', cycles_added: 1, paid_until_after: '2027-01-17' }))
      }
      throw new Error(`unexpected request: ${url}`)
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Pay KES 10 with M-Pesa/ }))
    await user.click(screen.getByRole('button', { name: 'Send prompt' }))

    expect(await screen.findByText('Check your phone')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Payment received')).toBeInTheDocument(), { timeout: 10_000 })
    expect(screen.getByText(/UII1F76IAB/)).toBeInTheDocument()
    expect(screen.getByText(/paid until 17 Jan 2027/i)).toBeInTheDocument()
  }, 20_000)

  it('shows why a payment failed and offers another try', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/billing')) return json(overview())
      if (url.endsWith('/billing/stk') && init?.method === 'POST') return json(payment())
      if (url.includes('/billing/payments/7')) return json(payment({ status: 'failed', result_desc: 'Request Cancelled by user.' }))
      throw new Error(`unexpected request: ${url}`)
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Pay KES 10 with M-Pesa/ }))
    await user.click(screen.getByRole('button', { name: 'Send prompt' }))

    await waitFor(() => expect(screen.getByText('The payment did not go through')).toBeInTheDocument(), { timeout: 10_000 })
    expect(screen.getByText(/Request Cancelled by user/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  }, 20_000)
})
