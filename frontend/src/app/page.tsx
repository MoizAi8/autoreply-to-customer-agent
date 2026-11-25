import Link from 'next/link'
import { ArrowRight, BarChart3, Inbox, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'

const features = [
  { title: 'One review inbox', description: 'Collect feedback manually or import a CSV. Find the reviews that need attention with rating, date and response filters.', icon: Inbox },
  { title: 'A response studio', description: 'Use business context to draft a reply, then edit and approve it before sharing it with a customer.', icon: Sparkles },
  { title: 'Feedback you can measure', description: 'Track ratings, sentiment and response completion using reviews from your workspace.', icon: BarChart3 },
]

export default function Home() {
  const demoOnly = process.env.NEXT_PUBLIC_PORTFOLIO_DEMO === 'true'
  return (
    <div className="min-h-screen bg-[#101318] text-[#f3f3ee] selection:bg-[#c9f68a] selection:text-[#101318]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-[#c9f68a] text-[#101318]"><MessageSquareText className="size-5" /></span>
          AutoReply AI
        </Link>
        {demoOnly ? <span className="text-sm text-[#acb1ba]">Portfolio demo</span> : <Link href="/login" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:bg-white/10">Sign in</Link>}
      </header>
      <main className="mx-auto max-w-7xl px-6 lg:px-12">
        <section className="grid items-center gap-12 py-12 md:py-24 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
              Give every review a <span className="text-[#c9f68a]">thoughtful reply.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#acb1ba]">Manage customer feedback, write in your business’s voice and keep your team in control of every response.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {demoOnly ? <Link href="/demo" className="inline-flex items-center gap-3 rounded-full bg-[#c9f68a] px-6 py-3 text-sm font-semibold text-[#101318] hover:bg-[#dbffac]">Try sample workspace <ArrowRight className="size-4" /></Link> : <>
                <Link href="/login" className="inline-flex items-center gap-3 rounded-full bg-[#c9f68a] px-6 py-3 text-sm font-semibold text-[#101318] hover:bg-[#dbffac]">Open workspace <ArrowRight className="size-4" /></Link>
                <Link href="/demo" className="inline-flex items-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">Try sample workspace</Link>
              </>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#161b22] p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-[#c9f68a]" /> Review inbox</div>
              <span className="text-xs text-[#acb1ba]">Sample preview</span>
            </div>
            <div className="pt-5">
              <div className="flex justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#303f30] text-xs font-semibold text-[#c9f68a]">MT</span>
                  <div><p className="text-sm font-medium">Morgan T.</p><p className="text-xs text-[#acb1ba]">Delivery feedback</p></div>
                </div>
                <span className="text-sm tracking-wider text-[#e8c879]" aria-label="3 out of 5 stars">★★★☆☆</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#d9dce0]">The order arrived a day late, but your support team kept me updated.</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#101318] p-4">
                <div className="flex items-center justify-between gap-2 text-xs font-medium"><span className="flex items-center gap-2"><Sparkles className="size-4 text-[#c9f68a]" /> Response draft</span><span className="rounded-full bg-[#303f30] px-2.5 py-1 text-[#c9f68a]">Needs approval</span></div>
                <p className="mt-3 text-sm leading-relaxed text-[#aeb5bd]">Thanks for your patience, Morgan. We’re sorry your order arrived late and glad our team could keep you informed.</p>
              </div>
            </div>
          </div>
        </section>
        <section aria-label="Workspace features" className="grid gap-8 border-y border-white/10 py-10 md:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <div key={title}>
              <Icon className="size-5 text-[#c9f68a]" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#acb1ba]">{description}</p>
            </div>
          ))}
        </section>
        <footer className="flex items-center gap-2 py-8 text-sm text-[#acb1ba]"><ShieldCheck className="size-4" /> Team approval before publishing</footer>
      </main>
    </div>
  )
}
