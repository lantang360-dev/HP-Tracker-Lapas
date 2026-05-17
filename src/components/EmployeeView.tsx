'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  Smartphone,
  LogOut,
  Building2,
  Clock,
  Loader2,
  AlertCircle,
  QrCode,
  RefreshCw,
  MonitorSmartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { AppUser, EmployeeBarcode } from '@/types'
import { formatTime, formatDateId } from '@/lib/format-utils'

export function EmployeeView({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const [barcodeData, setBarcodeData] = useState<EmployeeBarcode | null>(null)
  const [loading, setLoading] = useState(true)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<{
    success: boolean
    employee: {
      id: string
      name: string
      nip: string
      department: string
      position?: string
      phone?: string
      hasLogin: boolean
      phones: Array<{ id: string; brand: string; model: string; imei: string; color?: string; status: string; createdAt: string }>
      deviceSession: { deviceName: string; lastLogin: string; registeredAt: string } | null
    }
  } | null>(null)

  // Phone status for checkout
  const [phoneInside, setPhoneInside] = useState(false)
  const [insidePhones, setInsidePhones] = useState<Array<{ id: string; brand: string; model: string; imei: string; color?: string; checkedInAt: string | null }>>([])
  const [checkingOut, setCheckingOut] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const statusRes = await fetch(`/api/employee/my-status?employeeId=${user.id}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setPhoneInside(statusData.phoneInside || false)
        setInsidePhones(statusData.insidePhones || [])
      }
    } catch {
      // Silent fail for background refresh
    }
  }, [user.id])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setBarcodeError(null)
    try {
      // Fetch barcode data (includes inline SVG)
      const barcodeRes = await fetch(`/api/employee/barcode?employeeId=${user.id}&t=${Date.now()}`)
      if (barcodeRes.ok) {
        const data: EmployeeBarcode = await barcodeRes.json()
        setBarcodeData(data)
      } else {
        const errData = await barcodeRes.json().catch(() => ({}))
        const msg = errData.message || 'Gagal memuat barcode'
        setBarcodeError(msg)
        toast.error(msg)
      }

      // Fetch profile
      const profileRes = await fetch(`/api/employee/profile?employeeId=${user.id}`)
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfileData(data)
      }

      // Fetch phone inside status
      await fetchStatus()
    } catch {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [user.id, fetchStatus])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-poll phone status every 8 seconds
  // This is needed because scan events happen on admin's phone,
  // so the employee's phone can't receive them via CustomEvent
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus()
    }, 8000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Listen for check-in/out events (works for self-checkout on same device)
  useEffect(() => {
    const handler = () => fetchStatus()
    window.addEventListener('hp-check-update', handler)
    return () => window.removeEventListener('hp-check-update', handler)
  }, [fetchStatus])

  const handleRefresh = () => {
    setBarcodeData(null)
    fetchData()
  }

  const handleCheckout = async (phoneId: string) => {
    setCheckingOut(true)
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
      toast.success('HP Anda berhasil di-checkout!')
      window.dispatchEvent(new CustomEvent('hp-check-update'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal check-out')
    } finally {
      setCheckingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-6 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold">HP Tracker</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Keluar
          </Button>
        </div>
        <h1 className="text-xl font-bold">{user.name}</h1>
        <p className="text-sm text-emerald-100 mt-0.5">{user.department}{user.position ? ` · ${user.position}` : ''}</p>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 -mt-4 space-y-4 pb-6">
        {/* Date Card */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tanggal Hari Ini</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{formatDateId(new Date())}</p>
          </CardContent>
        </Card>

        {/* Phone Status Card */}
        <Card className={cn('shadow-md border-2', phoneInside ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl shrink-0', phoneInside ? 'bg-amber-100' : 'bg-emerald-100')}>
                {phoneInside ? (
                  <Building2 className="h-6 w-6 text-amber-600" />
                ) : (
                  <LogOut className="h-6 w-6 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold', phoneInside ? 'text-amber-800' : 'text-emerald-800')}>
                  {phoneInside ? 'HP Anda Di Dalam Lokasi' : 'HP Anda Di Luar Lokasi'}
                </p>
                {phoneInside && insidePhones.length > 0 ? (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {insidePhones[0].brand} {insidePhones[0].model}
                    {insidePhones[0].checkedInAt && (
                      <> · Masuk: {formatTime(insidePhones[0].checkedInAt)}</>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    HP belum di-scan untuk masuk hari ini
                  </p>
                )}
              </div>
              {phoneInside && insidePhones.length > 0 && (
                <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 shrink-0">
                  Di Dalam
                </Badge>
              )}
            </div>

            {/* Checkout Button */}
            {phoneInside && insidePhones.length > 0 && (
              <Button
                variant="destructive"
                className="w-full h-12 mt-3"
                onClick={() => handleCheckout(insidePhones[0].id)}
                disabled={checkingOut}
              >
                {checkingOut ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses Checkout...</>
                ) : (
                  <><LogOut className="h-4 w-4 mr-2" />HP Saya Keluar</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <QrCode className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold">Barcode Harian</h2>
              </div>

              {barcodeError ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-3">
                    <AlertCircle className="h-7 w-7 text-amber-600" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Barcode Belum Tersedia</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {barcodeError.includes('ponsel') || barcodeError.includes('HP') || barcodeError.includes('phone')
                      ? 'Anda belum memiliki HP yang terdaftar. Hubungi admin untuk mendaftarkan HP Anda terlebih dahulu.'
                      : barcodeError}
                  </p>
                </div>
              ) : barcodeData && barcodeData.svgHtml ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', duration: 0.4 }}
                  className="flex justify-center"
                >
                  <div className="bg-white p-4 rounded-2xl shadow-inner border">
                    <div
                      className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full"
                      dangerouslySetInnerHTML={{ __html: barcodeData.svgHtml }}
                    />
                  </div>
                </motion.div>
              ) : (
                <div className="flex justify-center">
                  <Skeleton className="w-56 h-56 rounded-2xl" />
                </div>
              )}

              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Tunjukkan barcode ini saat memasuki lokasi kerja
              </p>

              <Button
                variant="outline"
                className="w-full h-10"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Perbarui Barcode
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Phone Info */}
        {barcodeData && (
          <Card className="shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Info Handphone</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Merk & Model</span>
                  <span className="text-sm font-medium">{barcodeData.phone.brand} {barcodeData.phone.model}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">IMEI</span>
                  <span className="text-sm font-mono font-medium">{barcodeData.phone.imei}</span>
                </div>
                {barcodeData.phone.color && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Warna</span>
                      <span className="text-sm font-medium">{barcodeData.phone.color}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional phones info from profile */}
        {profileData && profileData.employee.phones && profileData.employee.phones.length > 1 && (
          <Card className="shadow-md">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Semua HP Terdaftar</span>
              <div className="mt-2 space-y-2">
                {profileData.employee.phones.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.brand} {p.model}</span>
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className={cn('text-[10px] ml-2', p.status === 'active' && 'bg-emerald-100 text-emerald-700')}>
                      {p.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Device Binding Info */}
        {profileData && profileData.employee.deviceSession && (
          <Card className="shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MonitorSmartphone className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Perangkat Terdaftar</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Perangkat</span>
                  <span className="text-sm font-medium">{profileData.employee.deviceSession.deviceName}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Terakhir Login</span>
                  <span className="text-sm font-medium">{formatDistanceToNow(new Date(profileData.employee.deviceSession.lastLogin), { addSuffix: true, locale: idLocale })}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Terdaftar Sejak</span>
                  <span className="text-sm font-medium">{formatDistanceToNow(new Date(profileData.employee.deviceSession.registeredAt), { addSuffix: true, locale: idLocale })}</span>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 p-2.5">
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Akun Anda terikat ke perangkat ini. Hubungi admin jika Anda ingin mengganti perangkat login.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logout at bottom */}
        <Button
          variant="outline"
          className="w-full h-11 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Keluar
        </Button>
      </div>
    </div>
  )
}
