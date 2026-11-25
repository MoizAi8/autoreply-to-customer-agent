'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageTransition } from '@/components/layout/page-transition'
import * as api from '@/lib/api'

export default function ApprovalsPage() {
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const queue = useQuery({ queryKey: ['reviews', 'approval-queue', page], queryFn: () => api.getReviews({ page, page_size: 15, response_status: 'pending' }) })
  const approve = useMutation({
    mutationFn: api.approveReply,
    onSuccess: async () => {
      for (const key of ['reviews', 'review', 'workflow', 'dashboard-stats', 'review-history']) await client.invalidateQueries({ queryKey: [key] })
    },
  })
  return <PageTransition><div className="space-y-5">
    <header><h1 className="text-3xl font-semibold tracking-tight">Approval queue</h1><p className="mt-2 text-sm text-muted-foreground">Read drafts in context before marking them approved.</p></header>
    {queue.isLoading && <p role="status">Loading drafts…</p>}
    {queue.isError && <p role="alert" className="text-destructive">Could not load the approval queue.</p>}
    {approve.isError && <p role="alert" className="text-destructive">{api.errorMessage(approve.error, 'Could not approve the draft.')}</p>}
    {queue.data?.total === 0 && <Card className="p-6 text-muted-foreground">No responses are awaiting approval.</Card>}
    <div className="grid gap-4">{queue.data?.items.map((review) => {
      const reply = review.reply
      if (!reply) return null
      const needsAttention = review.needs_human_review || review.is_flagged || review.risk_level === 'high'
      return <Card key={review.id} className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-words font-semibold">{review.customer_name} · {review.rating}/5</h2>{needsAttention && <span className="text-sm text-amber-500">Needs close review</span>}</div>
        <blockquote className="break-words border-l-2 pl-3 text-sm text-muted-foreground">{review.review_text}</blockquote>
        <p className="whitespace-pre-wrap break-words text-sm">{reply.content}</p>
        <div className="flex flex-wrap gap-2"><Link className="rounded-lg border px-4 py-2 text-sm hover:bg-accent" href={'/reviews/detail?id=' + review.id}>Open response studio</Link>{!needsAttention && <Button disabled={approve.isPending} onClick={() => approve.mutate(reply.id)}>Approve draft</Button>}</div>
      </Card>
    })}</div>
    {queue.data && queue.data.total_pages > 1 && <nav aria-label="Approval queue pages" className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {queue.data.total_pages}</span><Button variant="outline" disabled={page >= queue.data.total_pages} onClick={() => setPage(page + 1)}>Next</Button></nav>}
  </div></PageTransition>
}
