'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, Sparkles, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageTransition } from '@/components/layout/page-transition'
import * as api from '@/lib/api'
import type { Review } from '@/types'

const tones = ['professional', 'friendly', 'formal', 'empathetic', 'concise'] as const
const lengths = ['short', 'medium', 'long'] as const
const actionNames: Record<string, string> = {
  review_added: 'Review added', review_flagged: 'Review flagged', ai_process_review: 'AI draft generated',
  draft_created: 'Draft saved', draft_updated: 'Draft edited', reply_approved: 'Draft approved', reply_rejected: 'Draft rejected',
}
const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function ResponseStudio({ review }: { review: Review }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tone, setTone] = useState<(typeof tones)[number]>('professional')
  const [length, setLength] = useState<(typeof lengths)[number]>('medium')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const workflow = useQuery({ queryKey: ['workflow'], queryFn: api.getWorkflowStatus })
  const history = useQuery({ queryKey: ['review-history', review.id], queryFn: () => api.getReviewHistory(review.id) })
  const reply = review.reply
  const content = draft ?? reply?.content ?? ''
  const dirty = content !== (reply?.content ?? '')
  const locked = reply?.status === 'published'
  const awaiting = reply?.status === 'pending' || reply?.status === 'pending_approval'
  const refresh = async () => {
    await Promise.all(['review', 'review-history', 'reviews', 'dashboard-stats', 'workflow', 'sentiment-trends', 'monthly-activity'].map(
      (key) => client.invalidateQueries({ queryKey: [key] }),
    ))
  }
  const action = useMutation({
    mutationFn: async (operation: 'generate' | 'save' | 'approve' | 'reject') => {
      if (operation === 'generate') {
        if (reply) await api.regenerateReply(reply.id, { tone, length })
        else await api.generateReply(review.id, { tone, length })
        return 'AI draft generated.'
      }
      if (operation === 'save') {
        await api.saveDraft(review.id, content)
        return 'Draft saved.'
      }
      if (!reply) throw new Error('Save the draft first.')
      if (operation === 'approve') {
        await api.approveReply(reply.id)
        return 'Draft approved. You can copy it for manual publishing.'
      }
      await api.rejectReply(reply.id, reason)
      return 'Draft rejected.'
    },
    onMutate: () => { setMessage(''); setError('') },
    onSuccess: async (result) => { await refresh(); setDraft(null); setRejecting(false); setReason(''); setMessage(result) },
    onError: (failure) => setError(api.errorMessage(failure, 'Could not update the response. Please try again.')),
  })

  return (
    <div className="space-y-5">
      <Link href="/reviews" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Review inbox</Link>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <p className="mb-3 text-sm capitalize text-muted-foreground">{review.platform} review</p>
            <h1 className="break-words text-2xl font-semibold tracking-tight">{review.title || review.customer_name}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm"><Star className="size-4 text-amber-500" />{review.rating} / 5 · {review.customer_name}</p>
            <p className="my-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{review.review_text}</p>
            <div className="flex flex-wrap gap-2">
              {review.sentiment && <Badge variant="secondary" className="capitalize">{review.sentiment.replaceAll('_', ' ')}</Badge>}
              {review.risk_level && <Badge variant="outline" className="capitalize">{review.risk_level} risk</Badge>}
              {review.is_flagged && <Badge variant="warning">Flagged</Badge>}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">Review history</h2>
            {history.isError && <p className="mt-2 text-sm text-muted-foreground">History is unavailable.</p>}
            {history.isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading history…</p>}
            {history.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No recorded activity.</p>}
            <ol className="mt-3 divide-y">{history.data?.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-1 py-2 text-sm"><span>{actionNames[event.action] ?? event.action}</span><time className="text-muted-foreground" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></li>
            ))}</ol>
          </Card>
        </div>
        <Card className="h-fit min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Response studio</h2>
            <Badge variant={reply?.status === 'approved' ? 'success' : 'secondary'} className="capitalize">{reply?.status.replaceAll('_', ' ') ?? 'No draft'}</Badge>
          </div>
          {reply?.is_ai_generated && <p className="mt-2 text-sm text-muted-foreground">{reply.human_edited ? 'AI draft edited by your team' : 'Draft generated with OpenAI'}</p>}
          {workflow.data?.ai_enabled && !locked ? (
            <div className="my-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Tone<select className={field + ' mt-1 capitalize'} value={tone} onChange={(event) => setTone(tones.find((value) => value === event.target.value) ?? tones[0])}>{tones.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="text-sm">Length<select className={field + ' mt-1 capitalize'} value={length} onChange={(event) => setLength(lengths.find((value) => value === event.target.value) ?? lengths[1])}>{lengths.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <Button variant="secondary" className="w-fit sm:col-span-2" disabled={dirty || action.isPending} onClick={() => action.mutate('generate')}><Sparkles className="mr-2 size-4" />{reply ? 'Regenerate draft' : 'Generate AI draft'}</Button>
            </div>
          ) : <p className="my-4 text-sm text-muted-foreground">{locked ? 'This response is published.' : 'Live AI drafting is unavailable in this workspace. Write and approve a response manually.'}</p>}
          <label className="block text-sm font-medium">Response<textarea className={field + ' mt-2 resize-y leading-relaxed'} rows={8} maxLength={4000} value={content} disabled={locked || action.isPending} onChange={(event) => setDraft(event.target.value)} placeholder="Write a response to this customer…" /></label>
          <div className="mt-4 flex flex-wrap gap-2">
            {!locked && <Button disabled={!content.trim() || !dirty || action.isPending} onClick={() => action.mutate('save')}>Save draft</Button>}
            {awaiting && <><Button variant="secondary" disabled={dirty || action.isPending} onClick={() => action.mutate('approve')}>Approve</Button><Button variant="outline" disabled={dirty || action.isPending} onClick={() => setRejecting((value) => !value)}>Reject</Button></>}
            <Button variant="outline" disabled={!content.trim()} onClick={async () => {
              try { await navigator.clipboard.writeText(content); setMessage('Response copied.'); setError('') }
              catch { setError('Could not access the clipboard. Select and copy the response manually.') }
            }}><Copy className="mr-2 size-4" /> Copy</Button>
          </div>
          {rejecting && <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); action.mutate('reject') }}><label className="block text-sm">Rejection reason<input className={field} required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><Button type="submit" variant="destructive" disabled={!reason.trim() || action.isPending}>Confirm rejection</Button></form>}
          {action.isPending && <p role="status" className="mt-3 text-sm text-muted-foreground">Updating response…</p>}
          {message && <p role="status" className="mt-3 text-sm text-primary">{message}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {Boolean(reply?.workflow_steps.length) && <details className="mt-5 border-t pt-4 text-sm">
            <summary className="cursor-pointer font-medium">Draft workflow</summary>
            <ul className="mt-3 space-y-2 text-muted-foreground">{reply?.workflow_steps.map((step) => (
              <li key={step.step} className="flex flex-wrap justify-between gap-2 capitalize"><span>{step.step.replaceAll('_', ' ')}</span><span>{step.status} · {step.duration_ms} ms</span></li>
            ))}</ul>
          </details>}
        </Card>
      </div>
    </div>
  )
}

function ReviewDetail() {
  const id = useSearchParams().get('id') ?? ''
  const review = useQuery({ queryKey: ['review', id], queryFn: () => api.getReview(id), enabled: Boolean(id) })
  if (review.isLoading) return <p role="status">Loading review…</p>
  if (!review.data) return <div><p role="alert">{api.errorMessage(review.error, 'No review is available.')}</p><Link href="/reviews" className="text-primary">Back to review inbox</Link></div>
  return <ResponseStudio key={id} review={review.data} />
}

export default function ReviewDetailPage() {
  return <PageTransition><Suspense fallback={<p role="status">Loading review…</p>}><ReviewDetail /></Suspense></PageTransition>
}
