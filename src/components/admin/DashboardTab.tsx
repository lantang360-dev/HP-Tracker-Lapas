'use client'

import React, { useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Users,
  Smartphone,
  MapPin,
  Activity,
  LogIn,
  LogOut,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { DashboardStats } from '@/types'
import { formatRelative } from '@/lib/format-utils'
import { useFetch } from '@/hooks/useFetch'

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <Card className="py-4 px-4 gap-2">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bg)}>
            <Icon className="h-5 w-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card className="py-4 px-4 gap-2">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-10" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardTab() {
  const { data: stats, loading, error, refresh } = useFetch<DashboardStats>('/api/dashboard/stats', {
    cacheTime: 5000,
  })

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('hp-check-update', handler)
    return () => window.removeEventListener('hp-check-update', handler)
  }, [refresh])

  if (error && !stats) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="space-y-4 px-4 pt-3 pb-4">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Coba Lagi
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-3 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {loading && !stats ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : stats ? (
            <>
              <StatCard icon={Users} label="Total Petugas" value={stats.totalEmployees} color="text-emerald-600" bg="bg-emerald-50" />
              <StatCard icon={Smartphone} label="Total HP" value={stats.totalPhones} color="text-teal-600" bg="bg-teal-50" />
              <StatCard icon={MapPin} label="HP Di Dalam" value={stats.currentlyInside} color="text-amber-600" bg="bg-amber-50" />
              <StatCard icon={Activity} label="Aktivitas Hari Ini" value={stats.todayCheckIns + stats.todayCheckOuts} color="text-rose-600" bg="bg-rose-50" />
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Aktivitas Terbaru</h2>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Separator />
        </div>

        {loading && !stats ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="py-3 px-4 gap-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats && stats.recentLogs.length > 0 ? (
          <div className="space-y-2">
            {stats.recentLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="py-3 px-4 gap-0">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-full shrink-0', log.type === 'check_in' ? 'bg-emerald-100' : 'bg-red-100')}>
                        {log.type === 'check_in' ? (
                          <LogIn className="h-4 w-4 text-emerald-700" />
                        ) : (
                          <LogOut className="h-4 w-4 text-red-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.employee.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {log.phone.brand} {log.phone.model}
                          {log.phone.color ? ` · ${log.phone.color}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant={log.type === 'check_in' ? 'default' : 'destructive'}
                          className={cn('text-[10px] px-1.5 py-0', log.type === 'check_in' && 'bg-emerald-600 hover:bg-emerald-700')}
                        >
                          {log.type === 'check_in' ? 'Masuk' : 'Keluar'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelative(log.checkedAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada aktivitas hari ini</p>
          </div>
        )}
      </div>
    </div>
  )
}
