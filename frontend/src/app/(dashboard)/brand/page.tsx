'use client'

import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageTransition } from '@/components/layout/page-transition'
import * as api from '@/lib/api'

const field = 'mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function BrandPage() {
  const client = useQueryClient()
  const profile = useQuery({ queryKey: ['brand-voice'], queryFn: api.getBrandVoice })
  const save = useMutation({ mutationFn: api.updateBrandVoice, onSuccess: () => client.invalidateQueries({ queryKey: ['brand-voice'] }) })
  const voice = profile.data
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    save.mutate({ company_name: value('company_name'), industry: value('industry'), business_description: value('business_description'),
      support_contact: value('support_contact'), tone: value('tone'), reply_length: value('reply_length'),
      custom_instructions: value('custom_instructions'), escalation_rules: value('escalation_rules') })
  }

  return <PageTransition><div className="max-w-3xl space-y-5">
    <header><h1 className="text-3xl font-semibold tracking-tight">Business profile</h1><p className="mt-2 text-sm text-muted-foreground">Set the business context and preferences used when drafting replies.</p></header>
    {profile.isLoading && <p role="status">Loading profile…</p>}
    {profile.isError && <p role="alert" className="text-destructive">Could not load the business profile.</p>}
    {voice && <Card className="p-5 sm:p-6"><form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Business name<input className={field} name="company_name" defaultValue={voice.company_name} required maxLength={255} /></label>
        <label className="text-sm">Industry<input className={field} name="industry" defaultValue={voice.industry} maxLength={255} /></label>
      </div>
      <label className="block text-sm">Business description<textarea className={field} name="business_description" defaultValue={voice.business_description} rows={3} maxLength={3000} /></label>
      <label className="block text-sm">Public customer support contact<input className={field} name="support_contact" defaultValue={voice.support_contact} maxLength={500} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Default tone<select className={field} name="tone" defaultValue={voice.tone}>{Array.from(new Set([voice.tone, 'professional', 'friendly', 'formal', 'empathetic', 'concise'])).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Default response length<select className={field} name="reply_length" defaultValue={voice.reply_length}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label>
      </div>
      <label className="block text-sm">Response preferences<textarea className={field} name="custom_instructions" defaultValue={voice.custom_instructions} rows={3} maxLength={2000} /></label>
      <label className="block text-sm">Escalation guidance<textarea className={field} name="escalation_rules" defaultValue={voice.escalation_rules} rows={3} maxLength={2000} /></label>
      <Button type="submit" loading={save.isPending}>Save profile</Button>
      {save.isSuccess && <p role="status" className="text-sm text-primary">Business profile saved.</p>}
      {save.isError && <p role="alert" className="text-sm text-destructive">{api.errorMessage(save.error, 'Could not save the profile.')}</p>}
    </form></Card>}
  </div></PageTransition>
}
