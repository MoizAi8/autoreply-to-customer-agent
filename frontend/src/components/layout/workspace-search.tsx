'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getReviews } from '@/lib/api'

const destinations = [
  ['/dashboard', 'Overview'], ['/reviews', 'Review inbox'], ['/approvals', 'Approval queue'],
  ['/agent', 'Automation and activity'], ['/analytics', 'Analytics and reports'], ['/brand', 'Business profile'], ['/settings', 'Account settings'],
]

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const reviews = useQuery({ queryKey: ['reviews', 'workspace-search', term], queryFn: () => getReviews({ search: term, page_size: 8 }), enabled: open && term.length >= 2 })
  const matches = destinations.filter(([, label]) => label.toLowerCase().includes(input.toLowerCase()))
  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setTerm(input.trim()) }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label="Search workspace"><Search className="size-4" /><span className="ml-2 hidden sm:inline">Search</span></Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>Search workspace</DialogTitle><DialogDescription>Find review records, response text and workspace pages.</DialogDescription>
      <form onSubmit={search} className="flex gap-2"><input aria-label="Search term" value={input} onChange={(event) => setInput(event.target.value)} maxLength={300} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" /><Button type="submit" disabled={input.trim().length < 2}>Search</Button></form>
      {matches.length > 0 && <div className="flex flex-wrap gap-2">{matches.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-md border px-2 py-1 text-xs hover:text-primary">{label}</Link>)}</div>}
      {reviews.isLoading && <p role="status">Searching…</p>}
      {reviews.isError && <p role="alert" className="text-destructive">Could not search reviews.</p>}
      {reviews.data?.total === 0 && <p className="text-sm text-muted-foreground">No matching reviews.</p>}
      <ul className="divide-y">{reviews.data?.items.map((review) => <li key={review.id}><Link className="block py-2 text-sm hover:text-primary" href={'/reviews/detail?id=' + review.id} onClick={() => setOpen(false)}><span className="font-medium">{review.customer_name}</span><span className="block truncate text-muted-foreground">{review.title || review.review_text}</span></Link></li>)}</ul>
    </DialogContent>
  </Dialog>
}
