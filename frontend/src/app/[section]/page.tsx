import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const pages: Record<string, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
  features: { title: 'Reputation operations', intro: 'A workspace for managing customer feedback and approving the replies you send.', sections: [
    { heading: 'Review inbox', body: 'Add reviews or upload a CSV. Search feedback and filter by rating, date, sentiment and response status.' },
    { heading: 'Response studio', body: 'Draft from business context, edit or regenerate a reply, and approve it before sharing.' },
    { heading: 'Workspace analytics', body: 'Review volume, ratings and completion are calculated from stored review data.' },
  ] },
  'how-it-works': { title: 'How a review becomes a response', intro: 'Follow the steps that connect intake, analysis, drafting and approval.', sections: [
    { heading: 'Collect and validate', body: 'Add customer feedback to your workspace. The application validates inputs and detects duplicates.' },
    { heading: 'Assess and draft', body: 'The workflow uses sentiment, intent, business preferences and relevant knowledge entries when it requests a draft.' },
    { heading: 'Review and approve', body: 'Review the proposed wording and the operational events before approving the draft.' },
  ] },
  integrations: { title: 'Bring your reviews', intro: 'Import feedback you have permission to use.', sections: [
    { heading: 'Manual entry', body: 'Enter the review text, customer name, rating and date directly in the inbox.' },
    { heading: 'CSV', body: 'Use the import preview to check rows before saving. Include rating and content columns, with optional customer_name, title and review_date.' },
    { heading: 'External platforms', body: 'Direct platform synchronization and external publishing are currently unavailable. Copy approved responses and share them through the platform you use.' },
  ] },
  about: { title: 'About AutoReply AI', intro: 'A customer-feedback workspace built around the operator’s review and approval process.', sections: [
    { heading: 'Project', body: 'AutoReply AI is an MIT-licensed project that builds on the original Moldrivo repository and its contributors.' },
    { heading: 'Approach', body: 'The application retains a history of response changes and uses review data for dashboard reporting.' },
  ] },
  support: { title: 'Workspace support', intro: 'Find help with access and review imports.', sections: [
    { heading: 'Account access', body: 'Ask the workspace operator for a registration invitation or help recovering access.' },
    { heading: 'Import troubleshooting', body: 'Check the required rating and content columns and use the preview to find invalid rows.' },
    { heading: 'Project issues', body: 'Use the linked source repository to report reproducible software issues. Keep customer records and credentials out of the report.' },
  ] },
  privacy: { title: 'Workspace data and privacy', intro: 'Understand what is stored and where it is used.', sections: [
    { heading: 'Workspace scope', body: 'Reviews, drafts and business settings are stored in your workspace. The API checks workspace ownership for each authenticated request.' },
    { heading: 'Model processing', body: 'When drafting is enabled, the configured model provider receives review text and context needed to draft a reply. Avoid including payment information or other sensitive personal data in reviews you send for drafting.' },
    { heading: 'Access and retention', body: 'Contact the workspace operator about account access or stored records. Response versions may remain in review history while the review is retained.' },
  ] },
}

export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }))
}

export default async function MarketingSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const page = pages[section]
  if (!page) notFound()
  return <main className="min-h-screen bg-[#090c10] px-6 py-10 text-[#f5f7fa]">
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#c7fa80]"><ArrowLeft size={16} /> AutoReply AI</Link>
      <h1 className="mt-12 text-4xl font-semibold tracking-tight sm:text-6xl">{page.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-[#a5afbd]">{page.intro}</p>
      <div className="my-8 divide-y divide-[#252d38] border-y border-[#252d38]">
        {page.sections.map(({ heading, body }) => <article className="py-5" key={heading}><h2 className="text-lg font-semibold">{heading}</h2><p className="mt-2 max-w-2xl leading-relaxed text-[#a5afbd]">{body}</p></article>)}
      </div>
      {['about', 'support'].includes(section) && <a className="mr-5 text-sm text-[#c7fa80]" href="https://github.com/MoizAi8/autoreply-to-customer-agent">Project on GitHub</a>}
      <Link href="/login" className="inline-flex items-center gap-2 rounded bg-[#c7fa80] px-4 py-2 text-sm font-semibold text-[#090c10]">Launch workspace <ArrowRight size={16} /></Link>
    </div>
  </main>
}
