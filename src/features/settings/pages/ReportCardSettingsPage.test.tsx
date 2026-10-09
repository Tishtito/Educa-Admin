import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportCardSettingsPage } from './ReportCardSettingsPage'

/**
 * Choosing the design report cards are printed in. The choice is saved with
 * the rest of the form — the API validates the two text fields as `present`,
 * so they must always be sent along.
 */
describe('ReportCardSettingsPage: choosing a template', () => {
  const settings = (overrides: Record<string, unknown> = {}) => ({
    data: {
      head_teacher_name: 'Head Teacher (sample)',
      footer: null,
      default_footer: 'This performance report must reach the parent or guardian.',
      template: 'classic',
      templates: [
        { value: 'classic', label: 'Classic', description: 'The original report card.' },
        { value: 'modern', label: 'Modern', description: 'A contemporary card.' },
        { value: 'formal', label: 'Formal', description: 'A certificate-style card.' },
      ],
      ...overrides,
    },
  })

  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <ReportCardSettingsPage />
      </QueryClientProvider>,
    )
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows every template with the saved one checked and marked current', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(settings({ template: 'modern' })))

    renderPage()

    const group = await screen.findByRole('radiogroup', { name: 'Template' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Modern/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Modern/ })).toHaveTextContent('Current')
    expect(screen.getByRole('radio', { name: /Classic/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Classic/ })).not.toHaveTextContent('Current')
    expect(screen.getByText(/Published report cards keep the design they were issued with/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves the chosen template together with the text fields', async () => {
    const user = userEvent.setup()
    const saved: unknown[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/school/report-card-settings') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)))
        return json(settings({ template: 'formal' }))
      }
      if (url.endsWith('/school/report-card-settings')) return json(settings())
      throw new Error(`unexpected request: ${url}`)
    })

    renderPage()

    await user.click(await screen.findByRole('radio', { name: /Formal/ }))
    expect(screen.getByRole('radio', { name: /Formal/ })).toBeChecked()
    // Not saved yet: Classic is still what the school prints.
    expect(screen.getByRole('radio', { name: /Classic/ })).toHaveTextContent('Current')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(saved).toEqual([{ head_teacher_name: 'Head Teacher (sample)', footer: null, template: 'formal' }]))
    await waitFor(() => expect(screen.getByRole('radio', { name: /Formal/ })).toHaveTextContent('Current'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('moves the choice with the arrow keys and discards it', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(settings()))

    renderPage()

    const classic = await screen.findByRole('radio', { name: /Classic/ })
    classic.focus()
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('radio', { name: /Modern/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Modern/ })).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('radio', { name: /Formal/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('radio', { name: /Classic/ })).toBeChecked()
  })

  it('opens a preview of one template without changing the choice', async () => {
    const user = userEvent.setup()
    const requested: string[] = []
    const opened = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/school/report-card-templates/')) {
        requested.push(url)
        return Promise.resolve(new Response(new Blob(['%PDF-'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
      }
      return json(settings())
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Preview Modern as a PDF' }))

    await waitFor(() => expect(opened).toHaveBeenCalledWith('blob:preview', '_blank', 'noopener'))
    expect(requested).toHaveLength(1)
    expect(requested[0]).toContain('/school/report-card-templates/modern/preview')
    expect(screen.getByRole('radio', { name: /Classic/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
