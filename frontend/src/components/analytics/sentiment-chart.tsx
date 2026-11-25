'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SentimentTrend } from '@/types'

interface SentimentChartProps {
  data: SentimentTrend[]
  loading?: boolean
  className?: string
}

type TooltipEntry = { name?: string; color?: string; value?: string | number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-xs">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize text-muted-foreground">{entry.name?.replace('_', ' ')}</span>
          <span className="ml-auto font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function SentimentChart({ data, loading, className }: SentimentChartProps) {
  if (loading) {
    return (
      <div className={cn('flex h-[300px] items-center justify-center', className)}>
        <div className="h-[280px] w-full animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  const hasClassifiedReviews = data.some((day) => day.positive || day.neutral || day.negative || day.very_negative)
  if (!hasClassifiedReviews) {
    return (
      <Card className={cn('min-h-[360px] p-4 sm:p-5', className)}>
        <h2 className="font-semibold">Sentiment trends</h2>
        <p className="mt-3 text-sm text-muted-foreground">No reviews have a sentiment classification in this period.</p>
      </Card>
    )
  }

  return (
    <Card className={cn('min-w-0 overflow-hidden p-4 sm:p-5', className)}>
      <h2 className="mb-2 font-semibold">Sentiment trends</h2>
      <ResponsiveContainer width="100%" height={300} minWidth={0}>
        <BarChart data={data} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            isAnimationActive={false}
            dataKey="positive"
            name="Positive"
            fill="#10B981"
            radius={[4, 4, 0, 0]}
            stackId="sentiment"
          />
          <Bar
            isAnimationActive={false}
            dataKey="neutral"
            name="Neutral"
            fill="#F59E0B"
            radius={[4, 4, 0, 0]}
            stackId="sentiment"
          />
          <Bar
            isAnimationActive={false}
            dataKey="negative"
            name="Negative"
            fill="#EF4444"
            radius={[4, 4, 0, 0]}
            stackId="sentiment"
          />
          <Bar
            isAnimationActive={false}
            dataKey="very_negative"
            name="Very Negative"
            fill="#991B1B"
            radius={[4, 4, 0, 0]}
            stackId="sentiment"
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
