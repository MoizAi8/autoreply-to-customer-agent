import type { ReactNode } from 'react'
import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-background p-5">
    <div className="w-full max-w-md">
      <Link href="/" className="mb-6 flex w-fit items-center gap-3 font-semibold tracking-tight">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><MessageSquareText className="size-5" /></span>
        AutoReply AI
      </Link>
      {children}
    </div>
  </main>
}
