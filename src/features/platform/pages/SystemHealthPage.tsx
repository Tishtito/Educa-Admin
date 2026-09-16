import { CheckCircle2Icon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useQueueHealth } from '../api'

export function SystemHealthPage() {
  const health = useQueueHealth()

  return (
    <>
      <PageHeader
        title="System health"
        description="Background workers that compute results and build report card PDFs. Refreshes every 30 seconds."
        actions={
          <Button variant="outline" onClick={() => void health.refetch()} disabled={health.isFetching}>
            <RefreshCwIcon className={cn(health.isFetching && 'animate-spin')} /> Refresh
          </Button>
        }
      />
      <QueryState query={health}>
        {(report) => (
          <div className="grid gap-4">
            <Card className={cn(report.healthy ? 'border-emerald-300 dark:border-emerald-900' : 'border-destructive/50')}>
              <CardHeader className="flex flex-row items-center gap-3">
                {report.healthy ? (
                  <CheckCircle2Icon className="size-8 text-emerald-600" />
                ) : (
                  <TriangleAlertIcon className="size-8 text-destructive" />
                )}
                <div>
                  <CardTitle>{report.healthy ? 'All systems running' : 'Attention needed'}</CardTitle>
                  <CardDescription>
                    Checked {formatRelative(report.checked_at)} · Scheduler seen {formatRelative(report.scheduler.last_seen_at)} ·{' '}
                    {report.failed_jobs} failed job{report.failed_jobs === 1 ? '' : 's'}
                  </CardDescription>
                </div>
              </CardHeader>
              {report.problems.length > 0 && (
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                    {report.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>

            {report.workers.map((worker) => (
              <Card key={worker.name}>
                <CardHeader>
                  <CardTitle className="text-base">{worker.name}</CardTitle>
                  <CardDescription>
                    {worker.connection} · last heartbeat {formatRelative(worker.last_seen_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Queue</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Delayed</TableHead>
                        <TableHead className="text-right">Running</TableHead>
                        <TableHead className="text-right">Oldest waiting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {worker.queues.map((queue) => (
                        <TableRow key={queue.queue}>
                          <TableCell className="font-medium">
                            {queue.queue}
                            {queue.error && <div className="text-xs text-destructive">{queue.error}</div>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{queue.pending}</TableCell>
                          <TableCell className="text-right tabular-nums">{queue.delayed}</TableCell>
                          <TableCell className="text-right tabular-nums">{queue.reserved}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {queue.oldest_pending_age_seconds === null ? '—' : `${queue.oldest_pending_age_seconds}s`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  )
}
