'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Navbar } from './navbar'
import { useAuthStore } from '@/stores/auth-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const router = useRouter()
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore()
  useEffect(() => { if (!isAuthenticated) void checkAuth() }, [checkAuth, isAuthenticated])
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login')
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !isAuthenticated) {
    return <main className="grid min-h-screen place-items-center"><p role="status">Opening workspace…</p></main>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main key={pathname} className="mx-auto w-full max-w-screen-2xl min-w-0 flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  )
}
