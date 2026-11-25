'use client'

import { useState, type PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, CheckCircle2, CircleDot, Database, Inbox, ScanLine, Sparkles } from 'lucide-react'

const steps = [
  { name: 'Receive', label: 'Review received', icon: Inbox, description: 'A review arrives through the inbox or a CSV import. It belongs to the authenticated business.', excerpt: 'Delivery was quick and the team kept me updated.' },
  { name: 'Analyze', label: 'Sentiment and intent', icon: ScanLine, description: 'The workflow identifies sentiment, intent and concerns that may need attention.', excerpt: 'Positive sentiment · Delivery and communication' },
  { name: 'Ground', label: 'Business context', icon: Database, description: 'The workflow uses the workspace profile, response preferences and relevant knowledge entries.', excerpt: 'Friendly tone · Short response · Personal acknowledgment' },
  { name: 'Draft', label: 'AI response', icon: Sparkles, description: 'An authorized model drafts a contextual response. The application validates the returned text.', excerpt: 'Draft available for inspection and editing' },
  { name: 'Approve', label: 'Human approval', icon: CheckCircle2, description: 'A team member approves or rejects the draft. Approval stays inside the workspace.', excerpt: 'Awaiting approval' },
]

export function WorkflowPreview() {
  const [active, setActive] = useState(0)
  const step = steps[active]
  const reduced = useReducedMotion()
  function move(event: PointerEvent<HTMLElement>) {
    if (reduced || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--pointer-x', (event.clientX - bounds.left) + 'px')
    event.currentTarget.style.setProperty('--pointer-y', (event.clientY - bounds.top) + 'px')
  }
  return (
    <figure className="workflow-console" onPointerMove={move}>
      <figcaption className="workflow-caption"><span><CircleDot size={13} /> Workflow inspector</span><span>Illustration</span></figcaption>
      <div className="workflow-steps" aria-label="Review processing stages">
        {steps.map(({ name, label, icon: Icon }, index) => (
          <button key={name} type="button" onClick={() => setActive(index)} aria-label={label} aria-pressed={active === index} className="workflow-step">
            <Icon size={19} /><span>{name}</span>
          </button>
        ))}
      </div>
      <div className="workflow-progress" aria-hidden="true"><motion.span animate={{ width: (active + 1) * 20 + '%' }} transition={{ duration: reduced ? 0 : 0.45 }} /></div>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key={step.name} className="workflow-output" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.24 }}>
          <span className="workflow-output-label"><step.icon size={14} /> {step.label}</span>
          <p>{step.excerpt}</p>
          <div>{step.description}</div>
        </motion.div>
      </AnimatePresence>
      <button type="button" className="workflow-next" onClick={() => setActive((active + 1) % steps.length)}>Next stage <ArrowDownRight size={16} /></button>
    </figure>
  )
}
