'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { BarChart3, Bot, ClipboardCheck, LayoutDashboard, MessageSquareText, Mic, PanelLeftClose, PanelLeftOpen, Settings, Shield, SunMoon } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/reviews', label: 'Review inbox', icon: MessageSquareText },
  { href: '/approvals', label: 'Approval queue', icon: ClipboardCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 }, { href: '/brand', label: 'Business profile', icon: Mic },
  { href: '/agent', label: 'Automation and activity', icon: Bot }, { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/admin', label: 'Administration', icon: Shield },
]

export function Sidebar({ open, onClose, collapsed, onToggle }: { open: boolean; onClose: () => void; collapsed: boolean; onToggle: () => void }) {
  const path = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const user = useAuthStore((state) => state.user)
  const content = (compact: boolean) => <div className={cn('flex h-full min-h-0 flex-col', compact ? 'p-2' : 'p-4')}>
    <Link href="/dashboard" aria-label="AutoReply AI" onClick={onClose} className="mb-6 flex w-fit items-center gap-3 rounded-lg p-2 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><MessageSquareText className="size-4" /></span>{!compact && 'AutoReply AI'}
    </Link>
    <nav aria-label="Workspace" className="flex-1 space-y-1 overflow-y-auto">{links.filter(({ href }) => href !== '/admin' || user?.is_superuser).map(({ href, label, icon: Icon }) => {
      const active = path === href || path.startsWith(href + '/')
      return <Link key={href} href={href} onClick={onClose} aria-label={label} title={compact ? label : undefined} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', compact && 'justify-center', active ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-4 shrink-0" />{!compact && label}</Link>
    })}</nav>
    <button className={cn('mt-4 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted', compact && 'justify-center')} aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><SunMoon className="size-4" />{!compact && 'Toggle theme'}</button>
  </div>

  return <>
    <aside className={cn('fixed inset-y-0 hidden border-r bg-card lg:block', collapsed ? 'w-16' : 'w-64')}>
      <div className="h-[calc(100%-3.25rem)]">{content(collapsed)}</div>
      <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="mx-2 flex items-center gap-3 rounded-lg p-3 text-sm text-muted-foreground hover:bg-muted" onClick={onToggle}>{collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} />Collapse</>}</button>
    </aside>
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="inset-y-0 left-0 top-0 flex h-dvh w-[min(19rem,90vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-card p-0 sm:rounded-none lg:hidden">
        <DialogTitle className="sr-only">Workspace navigation</DialogTitle><DialogDescription className="sr-only">Go to another section of your workspace.</DialogDescription>{content(false)}
      </DialogContent>
    </Dialog>
  </>
}
