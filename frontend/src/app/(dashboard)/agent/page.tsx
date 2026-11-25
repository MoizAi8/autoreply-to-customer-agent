'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageTransition } from '@/components/layout/page-transition'
import * as api from '@/lib/api'

const languages: { value: api.DraftLanguage; label: string }[] = [
  { value: 'en', label: 'English' }, { value: 'ur', label: 'Urdu' }, { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' }, { value: 'de', label: 'German' },
]
const selectStyle = 'mt-1 block w-full rounded-lg border bg-background px-3 py-2'
const states = ['processing', 'completed', 'failed'] as const

export default function AgentPage() {
  const client = useQueryClient()
  const [filter, setFilter] = useState<api.DraftJob['state'] | ''>('')
  const status = useQuery({ queryKey: ['workflow'], queryFn: api.getWorkflowStatus })
  const rule = useQuery({ queryKey: ['automation-rule'], queryFn: api.getAutomation })
  const jobs = useQuery({ queryKey: ['draft-jobs', filter], queryFn: () => api.getDraftJobs(filter || undefined), refetchInterval: 8000 })
  const save = useMutation({
    mutationFn: api.saveAutomation,
    onSuccess: (result) => client.setQueryData(['automation-rule'], result),
  })
  const retry = useMutation({
    mutationFn: api.retryDraftJob,
    onSettled: async () => {
      for (const key of ['draft-jobs', 'workflow', 'reviews', 'dashboard-stats']) await client.invalidateQueries({ queryKey: [key] })
    },
  })
  const metrics = status.data
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const selected = languages.find(({ value }) => value === form.get('language'))
    save.mutate({
      enabled: form.has('enabled'), min_rating: Number(form.get('min_rating')),
      max_rating: Number(form.get('max_rating')), language: selected?.value ?? null,
    })
  }

  return <PageTransition><div className="space-y-6">
    <header><h1 className="text-3xl font-semibold tracking-tight">Automation and activity</h1><p className="mt-2 text-sm text-muted-foreground">Set a drafting rule, monitor processing and view your current usage.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Inference</h2><p className="mt-2 break-words text-lg font-semibold">{metrics?.ai_enabled ? metrics.model : 'Unavailable'}</p></Card>
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Draft attempts remaining today</h2><p className="mt-2 text-lg font-semibold">{metrics ? metrics.remaining_today + ' / ' + metrics.daily_limit : '—'}</p></Card>
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Drafts awaiting approval</h2><p className="mt-2 text-lg font-semibold">{metrics?.awaiting_approval ?? '—'}</p></Card>
    </div>
    <Card className="space-y-4 p-5">
      <div><h2 className="text-lg font-semibold">Automatic drafting rule</h2><p className="mt-2 text-sm text-muted-foreground">Draft a reply when a new manual review matches this rating range. Every draft requires approval.</p></div>
      {rule.isError && <p role="alert" className="text-sm text-destructive">Could not load the automation rule.</p>}
      {rule.data && <form onSubmit={submit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={rule.data.enabled} /> Enable automatic drafting</label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Minimum rating<input className={selectStyle} name="min_rating" type="number" min={1} max={5} required defaultValue={rule.data.min_rating} /></label>
          <label className="text-sm">Maximum rating<input className={selectStyle} name="max_rating" type="number" min={1} max={5} required defaultValue={rule.data.max_rating} /></label>
          <label className="text-sm">Response language<select className={selectStyle} name="language" defaultValue={rule.data.language ?? ''}><option value="">Detect from review</option>{languages.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <Button type="submit" loading={save.isPending}>Save rule</Button>
        {save.isSuccess && <p role="status" className="text-sm text-primary">Rule saved.</p>}
        {save.isError && <p role="alert" className="text-sm text-destructive">{api.errorMessage(save.error, 'Check the rating range and try again.')}</p>}
      </form>}
    </Card>
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Processing history</h2><select aria-label="Job status" className="rounded-lg border bg-background px-2 py-1 text-sm" value={filter} onChange={(event) => setFilter(states.find((state) => state === event.target.value) ?? '')}><option value="">All statuses</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
      {jobs.isLoading && <p className="text-sm text-muted-foreground">Loading processing history…</p>}
      {jobs.isError && <p role="alert" className="text-sm text-destructive">Could not load processing history.</p>}
      {retry.isError && <p role="alert" className="text-sm text-destructive">{api.errorMessage(retry.error, 'Retry failed.')}</p>}
      {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">No matching drafting attempts.</p>}
      <ul className="divide-y">{jobs.data?.map((job) => <li key={job.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
        <div className="min-w-0"><Link className="font-medium hover:text-primary" href={'/reviews/detail?id=' + job.review_id}>Open review</Link><span className="ml-2 capitalize text-primary">{job.state}</span><p className="mt-1 break-all text-xs text-muted-foreground">{job.trigger} · {new Date(job.created_at).toLocaleString()} · {job.id}</p>{job.error && <p className="mt-2 text-xs text-muted-foreground">{job.error}</p>}</div>
        {job.state === 'failed' && <Button size="sm" variant="outline" disabled={!metrics?.ai_enabled || retry.isPending} onClick={() => retry.mutate(job.id)}>Retry</Button>}
      </li>)}</ul>
    </Card>
  </div></PageTransition>
}
