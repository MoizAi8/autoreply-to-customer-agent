'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import { errorMessage } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { login, completeMfa } = useAuthStore()
  const [challenge, setChallenge] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUPS === 'true'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      if (challenge) await completeMfa(challenge, String(fields.get('code')))
      else {
        const token = await login(String(fields.get('email')), String(fields.get('password')))
        if (token) { setChallenge(token); return }
      }
      router.replace('/dashboard')
    } catch (failure) {
      setError(errorMessage(failure, 'Sign-in failed. Check your credentials and try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{challenge ? 'Enter your authentication code' : 'Sign in'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{challenge ? 'Use the current code from your authenticator.' : 'Open your AutoReply AI workspace.'}</p>
      <form key={challenge ? 'challenge' : 'credentials'} className="mt-6 space-y-4" onSubmit={submit}>
        {challenge ? <Input label="Authentication code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /> : <>
          <Input label="Email" type="email" name="email" autoComplete="username" required />
          <Input label="Password" type="password" name="password" autoComplete="current-password" minLength={8} required />
          <Link className="inline-block text-sm text-primary" href="/forgot-password">Forgot password?</Link>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" loading={pending} className="w-full">{challenge ? 'Verify code' : 'Sign in'}</Button>
        {challenge && <Button type="button" variant="ghost" onClick={() => { setChallenge(''); setError('') }}>Back to sign-in</Button>}
      </form>
      {signupEnabled && <p className="mt-5 text-sm text-muted-foreground">Need a workspace? <Link className="text-primary" href="/signup">Create an account</Link></p>}
      <Link className="mt-4 inline-block text-sm text-primary" href="/demo">Explore sample workspace</Link>
    </div>
  )
}
