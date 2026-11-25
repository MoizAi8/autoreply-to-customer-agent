'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getInitials } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const labels: Record<string, string> = { dashboard: 'Overview', reviews: 'Review inbox', brand: 'Business profile', agent: 'AI workflow', analytics: 'Analytics', admin: 'Administration', settings: 'Settings' }

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const client = useQueryClient()
  const { user, logout } = useAuthStore()

  return <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6 xl:px-8">
    <button aria-label="Open navigation" className="rounded-lg p-2 hover:bg-accent lg:hidden" onClick={onMenuClick}><Menu className="size-5" /></button>
    <span className="text-sm font-medium text-muted-foreground">{labels[pathname.split('/')[1]] ?? 'Workspace'}</span>
    <div className="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label="Account menu" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent"><Avatar size="sm"><AvatarFallback>{user ? getInitials(user.full_name) : 'U'}</AvatarFallback></Avatar><ChevronDown className="size-4 text-muted-foreground" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel>{user?.full_name}<span className="block text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push('/settings')}><Settings className="mr-2 size-4" />Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { logout(); client.clear(); router.replace('/login') }}><LogOut className="mr-2 size-4" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
}
