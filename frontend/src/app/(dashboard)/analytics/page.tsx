'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ActivityChart } from '@/components/analytics/activity-chart'
import { SentimentChart } from '@/components/analytics/sentiment-chart'
import { PageTransition } from '@/components/layout/page-transition'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { downloadCsv } from '@/lib/csv'

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: api.getDashboardStats })
  const trends = useQuery({ queryKey: ['sentiment-trends', days], queryFn: () => api.getSentimentTrends(days) })
  const activity = useQuery({ queryKey: ['monthly-activity'], queryFn: () => api.getMonthlyActivity(6) })
  const platforms = useQuery({ queryKey: ['platform-performance'], queryFn: api.getPlatformPerformance })
  const data = stats.data

  function downloadReport() {
    if (!trends.data?.length) return
    const rows = trends.data.map(({ date, positive, neutral, negative, very_negative }) =>
      [date, positive, neutral, negative, very_negative],
    )
    downloadCsv(`autoreply-sentiment-${days}-days.csv`, [['date', 'positive', 'neutral', 'negative', 'very_negative'], ...rows])
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-tight">Feedback analytics</h1><p className="mt-2 text-sm text-muted-foreground">See how customer ratings and response activity change over time.</p></div><Button variant="outline" disabled={!trends.data?.length} onClick={downloadReport}>Download sentiment CSV</Button></header>
        {stats.isError && <p role="alert" className="text-sm text-destructive">Workspace totals are unavailable.</p>}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5"><h2 className="font-semibold">Response completion</h2><p className="mt-4 text-3xl font-semibold">{data ? data.completion_rate + '%' : '—'}</p><p className="mt-2 text-sm text-muted-foreground">Reviews with an approved or published response.</p></Card>
          <Card className="p-5"><h2 className="font-semibold">Rating distribution</h2><div className="mt-3 space-y-2">{[5, 4, 3, 2, 1].map((rating) => {
            const count = data?.ratings[String(rating)] ?? 0
            return <div key={rating} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs"><span>{rating} ★</span><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: (data?.total_reviews ? 100 * count / data.total_reviews : 0) + '%' }} /></div><span className="text-right">{data ? count : '—'}</span></div>
          })}</div></Card>
          <Card className="p-5"><h2 className="font-semibold">Sentiment distribution</h2><div className="mt-3 space-y-2">{['positive', 'neutral', 'negative', 'very_negative'].map((sentiment) => <p key={sentiment} className="flex justify-between gap-3 text-sm capitalize"><span>{sentiment.replaceAll('_', ' ')}</span><strong>{data ? (data.sentiments[sentiment] ?? 0) : '—'}</strong></p>)}{data && <p className="flex justify-between gap-3 text-sm text-muted-foreground"><span>Unclassified</span><strong>{data.total_reviews - Object.values(data.sentiments).reduce((sum, count) => sum + count, 0)}</strong></p>}</div></Card>
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-3 text-sm">Sentiment window<select aria-label="Sentiment window" value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded border bg-card px-2 py-1"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
            {trends.isError ? <Card className="p-5">Sentiment trends are unavailable.</Card> : <SentimentChart data={trends.data ?? []} loading={trends.isLoading} />}
          </div>
          <div className="min-w-0 xl:pt-9">{activity.isError ? <Card className="p-5">Review activity is unavailable.</Card> : <ActivityChart data={activity.data ?? []} loading={activity.isLoading} />}</div>
        </div>
        <Card className="p-5"><h2 className="font-semibold">Review sources</h2>
          {platforms.isError && <p className="mt-2 text-sm text-muted-foreground">Source analytics are unavailable.</p>}
          {platforms.isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading sources…</p>}
          {platforms.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Sources appear after you add reviews.</p>}
          <ul className="mt-3 divide-y">{platforms.data?.map((source) => <li className="flex flex-wrap justify-between gap-3 py-2 text-sm" key={source.platform}><span className="capitalize">{source.platform}</span><span>{source.total} reviews · {source.avg_rating} / 5 average</span></li>)}</ul>
        </Card>
      </div>
    </PageTransition>
  )
}
