'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Building2,
  Clock,
  RefreshCw,
  LogOut,
  Loader2,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PhotoZoomOverlay } from '@/components/PhotoZoomOverlay'
import type { InsidePhone } from '@/types'
import { formatTime } from '@/lib/format-utils'
import { getCached, setCached } from '@/lib/apiCache'

export function InsideTab() {
  const [insidePhones, setInsidePhones] = useState<InsidePhone[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)

  const fetchInside = useCallback(async (showLoading = false) => {
    // Check global cache first (from prefetch)
    const cached = getCached<InsidePhone[]>('/api/inside')
    if (cached) {
      setInsidePhones(cached)
      setLoading(false)
      if (showLoading) return
    }
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/inside', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const data: InsidePhone[] = await res.json()
      setInsidePhones(data)
      setCached('/api/inside', data)
    } catch {
      toast.error('Gagal memuat data HP di dalam lokasi')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchInside(true)
  }, [fetchInside])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchInside(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchInside])

  useEffect(() => {
    const handler = () => fetchInside(false)
    window.addEventListener('hp-check-update', handler)
    return () => window.removeEventListener('hp-check-update', handler)
  }, [fetchInside])

  const handleCheckout = async (phoneId: string) => {
    setCheckingOut(phoneId)
    try {
      const res = await fetch('/api/check/manual-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal check-out')
      }
      toast.success('HP berhasil check-out')
      window.dispatchEvent(new CustomEvent('hp-check-update'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal check-out')
    } finally {
      setCheckingOut(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">HP Di Dalam Lokasi</h2>
            {!loading && (
              <p className="text-xs text-muted-foreground">
                {insidePhones.length} handphone tercatat di dalam
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchInside(false)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="py-4 px-4 gap-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insidePhones.length > 0 ? (
          <div className="space-y-2">
            {insidePhones.map((item, idx) => (
              <motion.div key={item.phoneId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <Card className="py-4 px-4 gap-0">
                  <CardContent className="p-0 space-y-3">
                    {/* Employee info with optional photo */}
                    <div className="flex items-center gap-3">
                      {/* Phone photo thumbnail - clickable for zoom */}
                      {item.phone.phonePhoto ? (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden border-2 border-emerald-100 bg-muted shrink-0 cursor-pointer active:scale-[0.96] transition-transform"
                          onClick={() => setZoomPhoto(item.phone.phonePhoto!)}
                        >
                          <img
                            src={item.phone.phonePhoto}
                            alt={`${item.phone.brand} ${item.phone.model}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
                          <Smartphone className="h-6 w-6 text-emerald-700" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.employee.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.employee.department}
                          {item.employee.position ? ` · ${item.employee.position}` : ''}
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">
                        Di Dalam
                      </Badge>
                    </div>
                    {/* Phone details */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pl-[60px]">
                      <span>{item.phone.brand} {item.phone.model}</span>
                      {item.phone.color && <span>· {item.phone.color}</span>}
                      {item.phone.phonePhoto && (
                        <span className="text-emerald-600 font-medium">· Tap foto untuk zoom</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pl-[60px]">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Masuk: {formatTime(item.checkedAt)}</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleCheckout(item.phoneId)}
                        disabled={checkingOut === item.phoneId}
                      >
                        {checkingOut === item.phoneId ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Proses...</>
                        ) : (
                          <><LogOut className="h-3 w-3 mr-1" />Checkout</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Tidak ada HP di dalam lokasi</p>
          </div>
        )}
      </div>

      {/* Photo zoom overlay */}
      <PhotoZoomOverlay photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />
    </div>
  )
}
