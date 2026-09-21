import { cn } from '@/lib/utils'
import type { ReportCard } from '@/lib/api/types'
import { formatDate, formatDateTime, formatMoney, formatScore } from '@/lib/format'

/**
 * On-screen rendering of the card JSON. The PDF from the API is the document
 * of record; this preview exists to check content before printing or publishing.
 */
export function ReportCardView({ card }: { card: ReportCard }) {
  const multi = card.columns.length > 1

  return (
    <article className="rounded-xl border bg-white p-4 text-[13px] text-neutral-900 shadow-sm sm:p-6 dark:bg-neutral-50">
      <header className="border-b border-neutral-300 pb-3 text-center">
        <h3 className="text-lg font-bold tracking-wide uppercase">{card.school.name}</h3>
        {card.school.motto && <p className="text-xs italic">{card.school.motto}</p>}
        {(card.school.address || card.school.phone || card.school.email) && (
          <p className="text-xs text-neutral-600">
            {[card.school.address, card.school.phone, card.school.email].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="mt-2 font-semibold uppercase">
          {card.exam.name} report · {card.academic_year}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-neutral-300 py-3 sm:grid-cols-4">
        <Info label="Name" value={card.student.name} wide />
        <Info label="Assessment no" value={card.student.assessment_no ?? '—'} />
        <Info label="Class" value={card.class.name} />
        <Info label="Class teacher" value={card.class.class_teacher ?? '—'} />
      </dl>

      <div className="overflow-x-auto py-3">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th className="py-1 pr-2 font-semibold">Learning area</th>
              {card.columns.map((column, index) => (
                <th key={index} colSpan={2} className="px-2 py-1 text-center font-semibold">
                  {multi ? column.type_label : 'Score'}
                  {!column.available && <div className="text-[10px] font-normal text-neutral-500">not available</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row, index) => (
              <tr
                key={`${row.kind}-${row.name}-${index}`}
                className={cn('border-b border-neutral-200', row.kind === 'paper' && 'text-neutral-600')}
              >
                <td className={cn('py-1 pr-2', row.kind === 'paper' ? 'pl-4 text-xs' : 'font-medium')}>{row.name}</td>
                {row.cells.map((cell, i) => (
                  <Cells key={i} cell={cell} paper={row.kind === 'paper'} />
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-400 font-semibold">
              <td className="py-1 pr-2">Total</td>
              {card.totals.map((total, i) => (
                <td key={i} colSpan={2} className="px-2 py-1 text-center tabular-nums">
                  {formatScore(total.total_marks)}
                </td>
              ))}
            </tr>
            <tr className="font-semibold">
              <td className="py-1 pr-2">Mean</td>
              {card.totals.map((total, i) => (
                <td key={i} colSpan={2} className="px-2 py-1 text-center tabular-nums">
                  {formatScore(total.mean_marks)} {total.mean_band && <span className="font-normal">({total.mean_band})</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="grid gap-2 border-t border-neutral-300 pt-3">
        <Info label="Class teacher’s remarks" value={card.entry.class_teacher_remarks || '—'} wide />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <Info label="Fee balance" value={formatMoney(card.entry.fee_balance)} />
          {card.term && (
            <>
              <Info label="Closing date" value={formatDate(card.term.closing_date)} />
              <Info label="Next term opens" value={formatDate(card.term.opening_date)} />
              <Info label="Next term feeding" value={formatMoney(card.term.next_term_feeding_fee)} />
            </>
          )}
        </div>
        <Info label="Head teacher" value={card.head_teacher ?? '—'} />
      </section>

      {card.footer && <p className="mt-3 border-t border-neutral-300 pt-2 text-center text-[11px] italic">{card.footer}</p>}
      <p className="mt-2 text-right text-[10px] text-neutral-500">
        {card.is_snapshot
          ? `Issued ${formatDateTime(card.published_at)}${card.snapshot_intact === false ? ' · integrity check failed' : ''}`
          : `Preview generated ${formatDateTime(card.generated_at)}`}
      </p>
    </article>
  )
}

function Cells({ cell, paper }: { cell: ReportCard['rows'][number]['cells'][number]; paper: boolean }) {
  if (cell.is_absent) {
    return (
      <td colSpan={2} className="px-2 py-1 text-center text-xs">
        Absent
      </td>
    )
  }
  return (
    <>
      <td className="px-2 py-1 text-right tabular-nums">
        {formatScore(cell.score)}
        {paper && cell.max_marks !== null && cell.score !== null && <span className="text-[10px]">/{formatScore(cell.max_marks)}</span>}
      </td>
      <td className="px-2 py-1 text-left text-xs" title={cell.band_label ?? undefined}>
        {cell.band ?? ''}
      </td>
    </>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && 'col-span-2')}>
      <dt className="text-[10px] tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
