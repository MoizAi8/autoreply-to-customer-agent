import Link from 'next/link'
import { ArrowDown, ArrowRight, BarChart3, Check, ClipboardCheck, Globe2, Inbox, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import { WorkflowPreview } from '@/components/marketing/workflow'
import styles from './marketing.module.css'

const questions = [
  ['How does AI drafting work?', 'The workflow evaluates the review and gathers context from your business profile and knowledge entries. Google Gemini produces a draft for your team to review.'],
  ['How can I import reviews?', 'Add feedback individually or upload a UTF-8 CSV. The import validates rows and checks for duplicate reviews.'],
  ['What happens when I approve a reply?', 'Approval changes the internal response status. You can copy an approved reply and share it through the original review platform.'],
  ['Can I create a workspace?', 'Use a registration invitation from the workspace operator. Sign-in gives each account its own business workspace.'],
  ['How are AI limits enforced?', 'Each account has a daily allowance and the deployment has a shared cap. The workflow screen shows your remaining allowance.'],
  ['Where is business context used?', 'The drafting workflow uses your saved business profile, voice preferences, and relevant knowledge entries.'],
  ['How is data handled?', 'Workspace queries are scoped to your authenticated business. If you enable AI drafting, review content and relevant business context are sent to the configured provider.'],
]
const industries = [
  ['Restaurants', 'Acknowledge timing, service and dietary feedback.'],
  ['E-commerce', 'Keep shipping and returns communication consistent.'],
  ['Hospitality', 'Route sensitive guest concerns for internal review.'],
  ['Local businesses', 'Stay on top of feedback across service locations.'],
  ['Service teams', 'Respond consistently to recurring support themes.'],
  ['Retail', 'Track feedback on products and in-store service.'],
]

export default function Home() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span><MessageSquareText size={20} /></span>AutoReply<span className={styles.brandSuffix}>AI</span></Link>
        <nav aria-label="Primary navigation"><Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link><Link href="/integrations">Integrations</Link></nav>
        <Link className={styles.headerAction} href="/login">Sign in <ArrowRight size={15} /></Link>
      </header>
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i /> REPUTATION OPERATIONS</span>
            <h1><span>Every review</span><span>deserves an</span><span className={styles.accent}>intelligent response.</span></h1>
            <p>Understand customer feedback, write in your business’s voice, and keep your team in control of every response.</p>
            <div className={styles.actions}><Link className={styles.primary} href="/login">Launch workspace <ArrowRight size={18} /></Link><a className={styles.secondary} href="#features">Explore features <ArrowDown size={17} /></a></div>
          </div>
          <div className={styles.heroVisual}><WorkflowPreview /></div>
        </section>
        <div className={styles.signal}><span><Inbox size={16} /> Review intake</span><span><Sparkles size={16} /> Contextual drafts</span><span><ClipboardCheck size={16} /> Human approval</span><span><BarChart3 size={16} /> Real workspace metrics</span></div>
        <section id="features" className={styles.section}>
          <div className={styles.sectionHead}><span className={styles.eyebrow}>THE WORKSPACE</span><h2>From scattered feedback to a clear next action.</h2><p>See what customers are saying, decide what needs attention, and keep a record of how your team responded.</p></div>
          <div className={styles.features}>
            <article className={styles.featureMajor}><Inbox size={24} /><h3>One inbox for the reviews you manage</h3><p>Collect reviews manually or through a CSV. Filter by sentiment, rating, date and response status.</p><div className={styles.example}><span>Inbox controls</span><div><span>Rating</span><span>Sentiment</span><span>Response status</span></div><div>Review detail <ArrowRight size={15} /></div></div></article>
            <article><Sparkles size={23} /><h3>Draft in your own voice</h3><p>Use business context and response preferences. Edit, regenerate, or approve a draft from the studio.</p></article>
            <article><BarChart3 size={23} /><h3>See where attention is needed</h3><p>Track feedback, ratings and completion with metrics calculated from review records.</p></article>
            <article><ShieldCheck size={23} /><h3>Retain review control</h3><p>Tenant-scoped records, bounded AI usage and a human approval step.</p><Link href="/privacy">Read about data handling <ArrowRight size={15} /></Link></article>
          </div>
        </section>
        <section className={styles.process}>
          <div><span className={styles.eyebrow}>THE PIPELINE</span><h2>One review. A traceable workflow.</h2><p>Review and response activity stays available alongside the customer feedback.</p><Link className={styles.secondary} href="/how-it-works">See workflow details <ArrowRight size={16} /></Link></div>
          <ol>{['Collect and validate the review', 'Assess sentiment, intent and risk', 'Retrieve business context and draft', 'Review, edit and approve', 'Track response activity and trends'].map((name, index) => <li key={name}><span>{String(index + 1).padStart(2, '0')}</span>{name}<Check size={16} /></li>)}</ol>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><span className={styles.eyebrow}><Globe2 size={14} /> USE CASES</span><h2>Built around the feedback you receive.</h2></div>
          <div className={styles.industry}>{industries.map(([name, description]) => <article key={name}><h3>{name}</h3><p>{description}</p></article>)}</div>
        </section>
        <section className={styles.faq}><div><span className={styles.eyebrow}>PRODUCT QUESTIONS</span><h2>Good to know.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
        <section className={styles.closing}><h2>Build a better response to every review.</h2><Link className={styles.primary} href="/login">Launch workspace <ArrowRight size={18} /></Link></section>
      </main>
      <footer className={styles.footer}><Link href="/">AutoReply AI</Link><nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link><a href="https://github.com/MoizAi8/autoreply-to-customer-agent">GitHub</a></nav></footer>
    </div>
  )
}
