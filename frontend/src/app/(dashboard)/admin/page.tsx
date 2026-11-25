'use client'

import { useQuery } from '@tanstack/react-query'
import { PageTransition } from '@/components/layout/page-transition'
import { Card } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { getAdminHealth } from '@/lib/api'

export default function AdminPage() {
  const permitted = useAuthStore((state) => state.user?.is_superuser === true)
  const health = useQuery({ queryKey: ['admin-health'], queryFn: getAdminHealth, enabled: permitted })
  return <PageTransition><div className="space-y-5">
    <h1 className="text-3xl font-semibold tracking-tight">Administration</h1>
    {!permitted ? <p role="alert" className="text-muted-foreground">Administrator access is required.</p> : <Card className="p-5"><h2 className="font-semibold">Service health</h2>
      {health.isLoading && <p className="mt-2 text-sm">Checking services…</p>}
      {health.isError && <p role="alert" className="mt-2 text-sm text-destructive">Could not check service health.</p>}
      {health.data && <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(health.data, null, 2)}</pre>}
    </Card>}
  </div></PageTransition>
}
