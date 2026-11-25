import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/providers'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'AutoReply AI - AI-Powered Review Responses',
  description: 'Automate your customer review replies with AI. Intelligent, personalized responses for all platforms.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}
