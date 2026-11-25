'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Card } from '@/components/ui/card'
import { getWorkflowStatus } from '@/lib/api'

export default function AgentPage() {
  const status = useQuery({ queryKey: ['workflow'], queryFn: getWorkflowStatus })
  return <PageTransition><div className="space-y-5">
    <header><h1 className="text-3xl font-semibold tracking-tight">AI workflow</h1><p className="mt-2 text-sm text-muted-foreground">Drafts originate in the inbox and require team approval.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Live AI drafting</h2><p className="mt-3 text-xl font-semibold">{status.data ? (status.data.ai_enabled ? 'Enabled' : 'Disabled') : 'Unavailable'}</p></Card>
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Saved AI generations</h2><p className="mt-3 text-xl font-semibold">{status.data?.generated ?? '—'}</p></Card>
      <Card className="p-5"><h2 className="text-sm text-muted-foreground">Drafts awaiting approval</h2><p className="mt-3 text-xl font-semibold">{status.data?.awaiting_approval ?? '—'}</p></Card>
    </div>
    <Card className="p-5"><h2 className="font-semibold">How a draft is created</h2><ol className="ml-5 mt-3 list-decimal space-y-2 text-sm text-muted-foreground"><li>Validate the review and assess sentiment, intent and risk.</li><li>Gather context from your business profile and knowledge base.</li><li>Generate a draft and run safety and quality checks.</li><li>Save the draft for human review before it can be approved.</li></ol><Link href="/reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-primary">Open review inbox <ArrowRight className="size-4" /></Link></Card>
  </div></PageTransition>
}
