'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Inbox, MessageSquareText } from 'lucide-react'

const samples = [
  { name: 'Morgan T.', rating: 3, text: 'The order arrived a day late, but your support team kept me updated.', draft: 'Thanks for your patience, Morgan. We’re sorry your order arrived late and glad our team could keep you informed.' },
  { name: 'Casey R.', rating: 5, text: 'The staff helped me choose the right size. I had a great experience.', draft: 'Thanks, Casey! We’re glad the team could help you find the right fit. We’d love to see you again.' },
  { name: 'Jules M.', rating: 2, text: 'I sent two messages about my return and still haven’t heard back.', draft: 'Jules, we’re sorry we’ve kept you waiting. Please reach out through our support channel so we can follow up on your return.' },
]

export default function DemoPage() {
  const [selected, setSelected] = useState(0)
  const [drafts, setDrafts] = useState(samples.map(({ draft }) => draft))
  const [approved, setApproved] = useState<number[]>([])
  const review = samples[selected]

  return (
    <main className="min-h-screen bg-[#101318] px-5 py-8 text-[#f3f3ee] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#c9f68a]"><ArrowLeft className="size-4" /> AutoReply AI</Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Sample workspace</h1>
        <p className="mt-2 text-sm text-[#acb1ba]">Explore fictional reviews and prewritten drafts. Changes last until you leave or refresh this page.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-[1fr_1.5fr]">
          <section className="rounded-2xl border border-white/10 bg-[#161b22] p-5" aria-label="Sample review inbox">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><Inbox className="size-4 text-[#c9f68a]" /> Review inbox</h2>
            {samples.map((item, index) => (
              <button key={item.name} type="button" aria-pressed={index === selected} onClick={() => setSelected(index)} className="mb-2 block w-full rounded-xl border border-white/10 px-4 py-3 text-left aria-pressed:border-[#c9f68a] hover:bg-white/5">
                <span className="block font-medium">{item.name}</span>
                <span className="text-sm text-[#acb1ba]">{item.rating} / 5 · {approved.includes(index) ? 'Approved' : 'Needs approval'}</span>
              </button>
            ))}
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#161b22] p-5 sm:p-7">
            <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="size-4 text-[#c9f68a]" /> Response studio</h2>
            <blockquote className="my-5 border-l-2 border-[#c9f68a]/50 pl-4 text-sm leading-relaxed">{review.text}</blockquote>
            <label htmlFor="demo-draft" className="text-sm font-medium">Sample response</label>
            <textarea id="demo-draft" rows={5} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101318] p-3 text-sm leading-relaxed" value={drafts[selected]} onChange={(event) => {
              const value = event.target.value
              setDrafts((current) => current.map((draft, index) => index === selected ? value : draft))
              setApproved((current) => current.filter((index) => index !== selected))
            }} />
            <button type="button" disabled={!drafts[selected].trim() || approved.includes(selected)} onClick={() => setApproved((current) => [...current, selected])} className="mt-4 rounded-full bg-[#c9f68a] px-5 py-2.5 text-sm font-semibold text-[#101318] disabled:opacity-60">Approve draft</button>
            <span role="status" className="ml-3 text-sm text-[#c9f68a]">{approved.includes(selected) ? 'Draft approved' : ''}</span>
          </section>
        </div>
      </div>
    </main>
  )
}
