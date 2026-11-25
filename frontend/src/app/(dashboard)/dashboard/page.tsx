'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Inbox, Percent, Sparkles, Star } from 'lucide-react'
import { ActivityChart } from '@/components/analytics/activity-chart'
import { SentimentChart } from '@/components/analytics/sentiment-chart'
import { PageTransition } from '@/components/layout/page-transition'
import { Card } from '@/components/ui/card'
import * as api from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

export default function DashboardPage() {
  const [days, setDays] = useState(30)
  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: api.getDashboardStats })
  const activity = useQuery({ queryKey: ['monthly-activity'], queryFn: () => api.getMonthlyActivity(6) })
  const sentiment = useQuery({ queryKey: ['sentiment-trends', days], queryFn: () => api.getSentimentTrends(days) })
  const workflow = useQuery({ queryKey: ['workflow'], queryFn: api.getWorkflowStatus })
  const recent = useQuery({ queryKey: ['recent-reviews'], queryFn: () => api.getReviews({ page: 1, page_size: 5 }) })
  const data = stats.data
  const tiles = [
    { name: 'Total reviews', value: data?.total_reviews, icon: Inbox },
    { name: 'Pending responses', value: data?.pending_replies, icon: Clock3 },
    { name: 'Approved drafts', value: data?.approved_replies, icon: CheckCircle2 },
    { name: 'Average rating', value: data?.total_reviews ? data.avg_rating.toFixed(2) : undefined, icon: Star },
    { name: 'Generated drafts', value: workflow.data?.generated, icon: Sparkles },
    { name: 'Failed attempts', value: workflow.data?.failed, icon: CircleAlert },
    { name: 'Response completion', value: data ? data.completion_rate + '%' : undefined, icon: Percent },
  ]

  return (
    <PageTransition>
      <div className="space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold tracking-tight">Review overview</h1><p className="mt-2 text-sm text-muted-foreground">Track feedback and see which reviews still need a response.</p></div>
          <Link href="/reviews" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open inbox <ArrowRight className="size-4" /></Link>
        </header>
        {stats.isError && <p role="alert" className="text-sm text-destructive">Dashboard totals are unavailable. <button className="underline" onClick={() => stats.refetch()}>Retry</button></p>}
        {workflow.isError && <p role="alert" className="text-sm text-destructive">Draft activity is unavailable. <button className="underline" onClick={() => workflow.refetch()}>Retry</button></p>}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {tiles.map(({ name, value, icon: Icon }) => (
            <Card key={name} className="min-w-0 p-4 sm:p-5">
              <Icon className="mb-4 size-5 text-primary" />
              <div className="text-2xl font-semibold tabular-nums sm:text-3xl">{value ?? '—'}</div>
              <p className="mt-1 text-sm text-muted-foreground">{name}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <dl className="flex flex-wrap gap-4">{['positive', 'neutral', 'negative'].map((label) => <div key={label} className="flex gap-2"><dt className="capitalize text-muted-foreground">{label}</dt><dd>{data ? (data.sentiments[label] ?? 0) + (label === 'negative' ? data.sentiments.very_negative ?? 0 : 0) : '—'}</dd></div>)}</dl>
          <label className="flex items-center gap-2">Sentiment window<select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded border bg-card px-2 py-1"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {activity.isError ? <Card className="p-5">Review activity is unavailable.</Card> : <ActivityChart data={activity.data ?? []} loading={activity.isLoading} />}
          {sentiment.isError ? <Card className="p-5">Sentiment trends are unavailable.</Card> : <SentimentChart data={sentiment.data ?? []} loading={sentiment.isLoading} />}
        </div>
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-semibold">Recent reviews</h2>
          {recent.isError && <p className="text-sm text-muted-foreground">Recent reviews are unavailable.</p>}
          {recent.isLoading && <p className="text-sm text-muted-foreground">Loading reviews…</p>}
          {recent.data?.items.length === 0 && <p className="text-sm text-muted-foreground">Add a review or import a CSV to see feedback here.</p>}
          {recent.data?.items.map((review) => (
            <Link key={review.id} href={'/reviews/detail?id=' + review.id} className="flex min-w-0 items-center justify-between gap-3 border-t py-3 text-sm hover:text-primary">
              <div className="min-w-0"><p className="truncate font-medium">{review.customer_name}</p><p className="truncate text-muted-foreground">{review.review_text}</p></div>
              <div className="shrink-0 text-right"><p>{review.rating} / 5</p><p className="text-xs text-muted-foreground">{formatRelativeTime(review.created_at)}</p></div>
            </Link>
          ))}
        </Card>
      </div>
    </PageTransition>
  )
}
