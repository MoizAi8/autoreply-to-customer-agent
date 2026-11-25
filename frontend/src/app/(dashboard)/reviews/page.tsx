'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, FileUp, Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PageTransition } from '@/components/layout/page-transition'
import * as api from '@/lib/api'
import { downloadCsv } from '@/lib/csv'

const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const initialFilters = { search: '', platform: '', rating: '', sentiment: '', response_status: '', date_from: '', date_to: '', sort: 'created_at:desc' }

export default function ReviewsPage() {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [dialog, setDialog] = useState<'manual' | 'csv' | null>(null)
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof api.importReviews>>>()
  const [file, setFile] = useState<File | null>(null)
  const [previewCsv, setPreviewCsv] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [sort_by, sort_order] = filters.sort.split(':')
  const query = useQuery({
    queryKey: ['reviews', page, filters],
    queryFn: () => api.getReviews({
      page, page_size: 15, search: filters.search || undefined, rating: Number(filters.rating) || undefined, platform: filters.platform || undefined,
      sentiment: filters.sentiment || undefined, response_status: filters.response_status || undefined,
      date_from: filters.date_from || undefined, date_to: filters.date_to || undefined, sort_by, sort_order,
    }),
  })

  const changeFilter = (key: keyof typeof initialFilters, value: string) => {
    setSelected([])
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }
  const refresh = () => {
    setSelected([])
    setPage(1)
    for (const key of ['reviews', 'dashboard-stats', 'recent-reviews', 'monthly-activity', 'platform-performance', 'draft-jobs', 'workflow', 'sentiment-trends']) {
      void client.invalidateQueries({ queryKey: [key] })
    }
  }
  const selectedReviews = query.data?.items.filter((review) => selected.includes(review.id)) ?? []
  const manual = useMutation({
    mutationFn: api.createReview,
    onSuccess: () => { refresh(); setDialog(null) },
    onError: (failure) => setError(api.errorMessage(failure, 'Could not add the review. Check the fields and try again.')),
  })
  const preview = useMutation({
    mutationFn: async (file: File) => {
      if (!file.size || file.size > 256000 || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a nonempty CSV of up to 256 KB.')
      const content = await file.text()
      return { content, result: await api.previewReviewImport(content) }
    },
    onSuccess: ({ content }) => setPreviewCsv(content),
    onError: (failure) => setError(api.errorMessage(failure, failure.message)),
  })
  const csv = useMutation({
    mutationFn: api.importReviews,
    onSuccess: (result) => { refresh(); setImportResult(result) },
    onError: (failure) => setError(api.errorMessage(failure, 'Could not import the CSV.')),
  })
  const selectFile = (selected: File | null) => {
    if (preview.isPending || csv.isPending) return
    setFile(selected)
    setError('')
    setPreviewCsv(null)
    setImportResult(undefined)
    preview.reset()
  }
  const openDialog = (kind: typeof dialog) => { selectFile(null); setDialog(kind) }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (dialog === 'manual') {
      manual.mutate({
        customer_name: String(form.get('customer_name')).trim() || undefined,
        rating: Number(form.get('rating')),
        title: String(form.get('title')).trim() || undefined,
        content: String(form.get('content')).trim(),
        review_date: String(form.get('review_date')) || undefined,
      })
    } else {
      if (previewCsv !== null) csv.mutate(previewCsv)
      else if (file) preview.mutate(file)
      else setError('Choose a CSV file.')
    }
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold tracking-tight">Review inbox</h1><p className="mt-2 text-sm text-muted-foreground">{query.data ? query.data.total + ' matching reviews' : 'Collect and triage your customer feedback.'}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openDialog('csv')}><FileUp className="mr-2 size-4" />Import CSV</Button>
            <Button onClick={() => openDialog('manual')}><Plus className="mr-2 size-4" />Add review</Button>
          </div>
        </header>
        <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <form role="search" className="flex items-end gap-2 sm:col-span-2" onSubmit={(event) => {
            event.preventDefault()
            changeFilter('search', String(new FormData(event.currentTarget).get('search')).trim())
          }}>
            <label className="min-w-0 flex-1 text-xs font-medium">Search reviews<input name="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className={'mt-1 ' + field} maxLength={300} placeholder="Reviewer, title or review text" /></label>
            <Button variant="outline" aria-label="Search reviews"><Search className="size-4" /></Button>
          </form>
          <label className="text-xs font-medium">Source<select aria-label="Source" className={'mt-1 ' + field} value={filters.platform} onChange={(event) => changeFilter('platform', event.target.value)}><option value="">All sources</option>{['manual', 'google', 'yelp', 'trustpilot', 'facebook', 'amazon', 'email'].map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
          <label className="text-xs font-medium">Rating<select aria-label="Rating" className={'mt-1 ' + field} value={filters.rating} onChange={(event) => changeFilter('rating', event.target.value)}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
          <label className="text-xs font-medium">Sentiment<select className={'mt-1 ' + field} value={filters.sentiment} onChange={(event) => changeFilter('sentiment', event.target.value)}><option value="">All sentiments</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="very_negative">Very negative</option></select></label>
          <label className="text-xs font-medium">Response status<select className={'mt-1 ' + field} value={filters.response_status} onChange={(event) => changeFilter('response_status', event.target.value)}><option value="">All responses</option><option value="unanswered">Unanswered</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="published">Published</option></select></label>
          <label className="min-w-0 text-xs font-medium">From<input type="date" className={'mt-1 ' + field} value={filters.date_from} onChange={(event) => changeFilter('date_from', event.target.value)} /></label>
          <label className="min-w-0 text-xs font-medium">Through<input type="date" className={'mt-1 ' + field} min={filters.date_from} value={filters.date_to} onChange={(event) => changeFilter('date_to', event.target.value)} /></label>
          <label className="text-xs font-medium">Sort by<select className={'mt-1 ' + field} value={filters.sort} onChange={(event) => changeFilter('sort', event.target.value)}><option value="created_at:desc">Most recently added</option><option value="created_at:asc">Oldest added</option><option value="rating:asc">Lowest rating</option><option value="rating:desc">Highest rating</option></select></label>
        </Card>
        <div className="flex flex-wrap gap-2">
          {filters !== initialFilters && <Button variant="ghost" onClick={() => { setFilters(initialFilters); setSearchInput(''); setSelected([]); setPage(1) }}>Clear filters</Button>}
          {selectedReviews.length > 0 && <Button variant="outline" onClick={() => downloadCsv('autoreply-selected-reviews.csv', [
            ['rating', 'content', 'customer_name', 'title', 'platform', 'review_date'],
            ...selectedReviews.map((review) => [review.rating, review.review_text, review.customer_name, review.title, review.platform, review.review_date]),
          ])}>Export selected reviews ({selectedReviews.length})</Button>}
        </div>
        <Card className="divide-y overflow-hidden">
          {query.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading reviews…</p>}
          {query.isError && <p role="alert" className="p-6 text-sm text-destructive">{api.errorMessage(query.error, 'Could not load reviews.')} <button className="underline" onClick={() => query.refetch()}>Retry</button></p>}
          {query.data?.items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No matching reviews. Add feedback or change your filters.</p>}
          {query.data?.items.map((review) => (
            <div key={review.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center pl-4 hover:bg-muted/50 sm:pl-5">
              <input type="checkbox" aria-label={'Select ' + review.customer_name} checked={selected.includes(review.id)} onChange={(event) => {
                const checked = event.target.checked
                setSelected((ids) => checked ? [...ids, review.id] : ids.filter((id) => id !== review.id))
              }} className="size-4 accent-primary" />
              <Link href={'/reviews/detail?id=' + review.id} className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-4 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="truncate font-medium">{review.customer_name}{review.title ? ' · ' + review.title : ''}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{review.review_text}</p>
                <p className="mt-2 text-xs capitalize text-muted-foreground">{review.platform} · {review.reply?.status.replaceAll('_', ' ') ?? 'Unanswered'}</p>
              </div>
              <div className="flex items-center gap-2 text-sm"><Star className="size-4 text-amber-500" />{review.rating}<ArrowUpRight className="ml-1 size-4 text-muted-foreground" /></div>
              </Link>
            </div>
          ))}
        </Card>
        {query.data && query.data.total_pages > 1 && <nav className="flex items-center justify-between gap-3" aria-label="Review pages"><Button variant="outline" disabled={page <= 1} onClick={() => { setSelected([]); setPage(page - 1) }}>Previous</Button><p className="text-sm">Page {page} of {query.data.total_pages}</p><Button variant="outline" disabled={page >= query.data.total_pages} onClick={() => { setSelected([]); setPage(page + 1) }}>Next</Button></nav>}
      </div>
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !manual.isPending && !csv.isPending && !preview.isPending) openDialog(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{dialog === 'manual' ? 'Add a review' : 'Import a review CSV'}</DialogTitle>
          <DialogDescription>{dialog === 'manual' ? 'Add feedback to this workspace.' : 'Required columns are rating and content. Optional columns are customer_name, title and review_date. Up to 200 rows, 256 KB.'}</DialogDescription>
          <form onSubmit={submit} className="space-y-3">
            {dialog === 'manual' ? <>
              <label className="block text-sm">Reviewer<input name="customer_name" className={field} maxLength={255} placeholder="Anonymous" /></label>
              <label className="block text-sm">Title<input name="title" className={field} maxLength={500} /></label>
              <label className="block text-sm">Rating<select name="rating" className={field} defaultValue="5">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></label>
              <label className="block text-sm">Review date<input type="date" name="review_date" className={field} /></label>
              <label className="block text-sm">Review text<textarea name="content" className={field} rows={4} required minLength={3} maxLength={4000} /></label>
            </> : <label className="block rounded-lg border border-dashed p-4 text-sm" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] ?? null) }}>CSV file
              <span className="my-1 block text-muted-foreground">Drop a CSV here or select a file.</span>
              <input name="file" type="file" accept=".csv,text/csv" className={field} disabled={preview.isPending || csv.isPending} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
              {file && <span className="mt-2 block break-all">{file.name}</span>}
            </label>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {previewCsv && preview.data && !importResult && <div className="rounded-lg border p-3 text-sm">
              <p role="status">{preview.data.result.valid} valid rows · {preview.data.result.errors.length} invalid rows</p>
              <ul className="mt-2 max-h-32 overflow-auto">{preview.data.result.sample.map((row, index) => <li key={index} className="truncate">{row.rating}/5 · {row.customer_name} · {row.content}</li>)}</ul>
              {preview.data.result.errors.length > 0 && <ul className="mt-3 max-h-24 overflow-auto text-muted-foreground">{preview.data.result.errors.map((error) => <li key={error.row}>Row {error.row} — {error.message}</li>)}</ul>}
              <p className="mt-2 text-muted-foreground">Duplicate checks run when you confirm the import.</p>
            </div>}
            {importResult && <div role="status" className="rounded-lg bg-muted p-3 text-sm"><p>{importResult.imported} imported · {importResult.duplicates} duplicates · {importResult.errors.length} invalid rows</p><ul className="mt-2 max-h-32 overflow-auto">{importResult.errors.map(({ row, message }) => <li key={row}>Row {row} — {message}</li>)}</ul></div>}
            <Button type="submit" disabled={Boolean(importResult) || (previewCsv !== null && preview.data?.result.valid === 0)} loading={manual.isPending || csv.isPending || preview.isPending}>{dialog === 'manual' ? 'Save review' : previewCsv === null ? 'Preview import' : 'Import reviews'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
