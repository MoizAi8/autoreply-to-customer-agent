'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageTransition } from '@/components/layout/page-transition'
import { useAuthStore } from '@/stores/auth-store'
import * as api from '@/lib/api'

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const change = useMutation({ mutationFn: () => api.changePassword(current, next), onSuccess: () => { setCurrent(''); setNext('') } })
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); change.mutate() }
  return <PageTransition><div className="max-w-2xl space-y-5">
    <header><h1 className="text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage your sign-in credentials and workspace profile.</p></header>
    <Card className="p-5"><h2 className="font-semibold">Account</h2><p className="mt-3 text-sm">{user?.full_name}</p><p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p><Link href="/brand" className="mt-4 inline-block text-sm text-primary">Edit business profile</Link></Card>
    <Card className="p-5"><h2 className="font-semibold">Change password</h2><form className="mt-4 space-y-4" onSubmit={submit}>
      <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
      <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} minLength={8} required />
      <Button type="submit" loading={change.isPending}>Update password</Button>
      {change.isSuccess && <p role="status" className="text-sm text-primary">Password updated.</p>}
      {change.isError && <p role="alert" className="text-sm text-destructive">{api.errorMessage(change.error, 'Could not change the password.')}</p>}
    </form></Card>
  </div></PageTransition>
}
