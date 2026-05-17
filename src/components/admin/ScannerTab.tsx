'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ScanLine,
  LogIn,
  LogOut,
  X,
  Loader2,
  AlertCircle,
  User,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { CheckResult } from '@/types'
import { formatDateTime } from '@/lib/format-utils'
import { CheckIcon } from '@/components/CheckIcon'
import { PhotoZoomOverlay } from '@/components/PhotoZoomOverlay'

export function ScannerTab({ isActive = true }: { isActive?: boolean }) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const processCheck = useCallback(async (qrCode: string) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'QR code tidak valid')
      }
      const data: CheckResult = await res.json()
      setResult(data)
      toast.success(data.message || (data.type === 'check_in' ? 'Check-in berhasil!' : 'Check-out berhasil!'))
      window.dispatchEvent(new CustomEvent('hp-check-update'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses QR code'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    setResult(null)
    setError(null)
    setCameraError(null)
    if (!containerRef.current) return

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText: string) => {
          await scanner.stop()
          setScanning(false)
          await processCheck(decodedText)
        },
        () => { /* ignore scan miss */ }
      )
      setScanning(true)
    } catch (err) {
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.')
      console.error('Scanner error:', err)
    }
  }, [processCheck])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* ignore */ }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      toast.error('Masukkan kode QR terlebih dahulu')
      return
    }
    await stopScanner()
    await processCheck(manualCode.trim())
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setManualCode('')
    setCameraError(null)
  }

  // Stop scanner when tab becomes inactive (camera releases resources)
  useEffect(() => {
    if (!isActive) {
      stopScanner()
    }
  }, [isActive, stopScanner])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => { scannerRef.current = null })
      }
    }
  }, [])

  // Show result
  if (result) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center px-4 py-8 pb-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.5 }}>
          <div className={cn('flex h-20 w-20 items-center justify-center rounded-full mb-6', result.type === 'check_in' ? 'bg-emerald-100' : 'bg-red-100')}>
            {result.type === 'check_in' ? (
              <LogIn className="h-10 w-10 text-emerald-600" />
            ) : (
              <LogOut className="h-10 w-10 text-red-600" />
            )}
          </div>
        </motion.div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-center space-y-4 w-full">
          <Badge
            variant={result.type === 'check_in' ? 'default' : 'destructive'}
            className={cn('text-sm px-4 py-1', result.type === 'check_in' && 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {result.type === 'check_in' ? 'CHECK-IN BERHASIL' : 'CHECK-OUT BERHASIL'}
          </Badge>
          <Card className="w-full py-4">
            <CardContent className="p-4 space-y-3">
              {/* Employee info section */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{result.employee.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.employee.department}
                    {result.employee.position ? ` · ${result.employee.position}` : ''}
                  </p>
                </div>
              </div>
              <Separator />
              {/* Phone info section - enhanced layout with photo */}
              <div className="flex items-start gap-3">
                {result.phone.phonePhoto ? (
                  <div
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-100 bg-muted cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => setZoomPhoto(result.phone.phonePhoto)}
                  >
                    <img
                      src={result.phone.phonePhoto}
                      alt={`${result.phone.brand} ${result.phone.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center rounded-xl border-2 border-emerald-100 bg-teal-50">
                    <Smartphone className="h-10 w-10 text-teal-600" />
                  </div>
                )}
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold">{result.phone.brand} {result.phone.model}</p>
                  {result.phone.phoneType && (
                    <Badge variant="secondary" className="mt-1 text-[10px] px-2 py-0 h-5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {result.phone.phoneType}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    IMEI: {result.phone.imei}
                    {result.phone.color ? ` · ${result.phone.color}` : ''}
                  </p>
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground text-center">{formatDateTime(result.checkedAt)}</p>
            </CardContent>
          </Card>
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={handleReset}>
            <ScanLine className="h-4 w-4 mr-2" />
            Scan Lagi
          </Button>
        </motion.div>
        </div>
        <PhotoZoomOverlay photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />
      </div>
    )
  }

  // Show error
  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center px-4 py-8 pb-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-6">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <div className="text-center space-y-4 w-full">
          <Badge variant="destructive" className="text-sm px-4 py-1">GAGAL</Badge>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={handleReset}>
            <ScanLine className="h-4 w-4 mr-2" />
            Scan Lagi
          </Button>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-3 pb-4">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-[60vh] mx-auto w-full max-w-sm">
        {cameraError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <AlertCircle className="h-10 w-10 text-white/60 mb-3" />
            <p className="text-sm text-white/80">{cameraError}</p>
          </div>
        ) : (
          <div id="qr-reader" ref={containerRef} className="w-full h-full" />
        )}

        {!cameraError && !scanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-2 border-white/30 rounded-2xl w-[250px] h-[250px]" />
          </div>
        )}

        <div className="absolute top-3 left-3 right-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm',
            submitting ? 'bg-amber-500/80 text-white' : scanning ? 'bg-emerald-500/80 text-white' : 'bg-gray-500/80 text-white'
          )}>
            {submitting ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Memproses...</>
            ) : scanning ? (
              <><span className="h-2 w-2 rounded-full bg-white animate-pulse" />Memindai...</>
            ) : (
              <><ScanLine className="h-3 w-3" />Kamera tidak aktif</>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 w-full max-w-sm mx-auto">
        {!scanning ? (
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={startScanner} disabled={submitting}>
            <ScanLine className="h-4 w-4 mr-2" />
            Mulai Scan
          </Button>
        ) : (
          <Button variant="outline" className="w-full h-12" onClick={stopScanner}>
            <X className="h-4 w-4 mr-2" />
            Hentikan Scan
          </Button>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">Atau masukkan kode secara manual</p>
          <div className="flex gap-2">
            <Input
              placeholder="Masukkan kode QR..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              className="h-11 flex-1"
              disabled={submitting}
            />
            <Button
              className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleManualSubmit}
              disabled={submitting || !manualCode.trim()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
