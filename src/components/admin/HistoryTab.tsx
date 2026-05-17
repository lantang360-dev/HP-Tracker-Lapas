'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  RefreshCw,
  LogIn,
  LogOut,
  History,
  Search,
  Loader2,
  FileSpreadsheet,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { HistoryLog, HistoryResponse, RecapData } from '@/types'
import { formatTime, getTodayStr } from '@/lib/format-utils'
import { getCached, setCached } from '@/lib/apiCache'

export function HistoryTab() {
  const [activeView, setActiveView] = useState<'logs' | 'recap'>('logs')
  const [logs, setLogs] = useState<HistoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [dateFilter, setDateFilter] = useState(getTodayStr())

  // Recap state
  const [recapFilterType, setRecapFilterType] = useState<'date' | 'month' | 'year'>('date')
  const [recapDate, setRecapDate] = useState(getTodayStr())
  const [recapMonth, setRecapMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [recapYear, setRecapYear] = useState(format(new Date(), 'yyyy'))
  const [recapData, setRecapData] = useState<RecapData | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  // ---- Logs ----
  const fetchLogs = useCallback(async (p: number, date?: string) => {
    const url = `/api/check/logs?page=${p}&limit=20${date ? `&date=${date}` : ''}`
    // Check global cache first (from prefetch)
    if (p === 1 && !date) {
      const cached = getCached<HistoryResponse>(url)
      if (cached) {
        setLogs(cached.logs)
        setPage(cached.page)
        setTotalPages(cached.totalPages)
        setTotal(cached.total)
        setLoading(false)
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat riwayat')
      const data: HistoryResponse = await res.json()
      setLogs(data.logs)
      setPage(data.page)
      setTotalPages(data.totalPages)
      setTotal(data.total)
      setCached(url, data)
    } catch {
      toast.error('Gagal memuat riwayat')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeView === 'logs') {
      fetchLogs(1, dateFilter || undefined)
    }
  }, [dateFilter, fetchLogs, activeView])

  // ---- Recap ----
  const getRecapFilterValue = useCallback(() => {
    if (recapFilterType === 'date') return recapDate
    if (recapFilterType === 'month') return recapMonth
    return recapYear
  }, [recapFilterType, recapDate, recapMonth, recapYear])

  const fetchRecap = useCallback(async () => {
    const fv = getRecapFilterValue()
    if (!fv) return
    setRecapLoading(true)
    try {
      const res = await fetch(`/api/recapitulation?filterType=${recapFilterType}&filterValue=${fv}`)
      if (!res.ok) throw new Error('Gagal memuat rekapitulasi')
      const data: RecapData = await res.json()
      setRecapData(data)
      // Auto-expand if single day
      if (data.days.length <= 3) {
        setExpandedDays(new Set(data.days.map(d => d.date)))
      } else if (data.days.length > 0) {
        setExpandedDays(new Set([data.days[0].date]))
      }
    } catch {
      toast.error('Gagal memuat rekapitulasi')
    } finally {
      setRecapLoading(false)
    }
  }, [recapFilterType, getRecapFilterValue])

  useEffect(() => {
    if (activeView === 'recap') {
      fetchRecap()
    }
  }, [activeView, fetchRecap])

  useEffect(() => {
    const handler = () => {
      if (activeView === 'logs') {
        fetchLogs(page, dateFilter || undefined)
      } else {
        fetchRecap()
      }
    }
    window.addEventListener('hp-check-update', handler)
    return () => window.removeEventListener('hp-check-update', handler)
  }, [fetchLogs, fetchRecap, page, dateFilter, activeView])

  const toggleDayExpand = (dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      return next
    })
  }

  const handleDownloadCSV = async () => {
    const fv = getRecapFilterValue()
    if (!fv) return
    try {
      const res = await fetch(`/api/recapitulation/csv?filterType=${recapFilterType}&filterValue=${fv}`)
      if (!res.ok) throw new Error('Gagal mengunduh')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rekapitulasi_hp_${recapFilterType}_${fv}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('File CSV berhasil diunduh!')
    } catch {
      toast.error('Gagal mengunduh CSV')
    }
  }

  const handlePrint = () => {
    if (!recapData || recapData.days.length === 0) {
      toast.error('Tidak ada data untuk dicetak')
      return
    }
    const fv = getRecapFilterValue()
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Pop-up diblokir oleh browser')
      return
    }

    let tableRows = ''
    let globalNo = 1
    for (const day of recapData.days) {
      for (const entry of day.entries) {
        const statusText = entry.status === 'sudah_keluar' ? 'Sudah Keluar' : entry.status === 'masih_di_dalam' ? 'Masih Di Dalam' : 'Data Tidak Lengkap'
        const statusColor = entry.status === 'sudah_keluar' ? '#059669' : entry.status === 'masih_di_dalam' ? '#d97706' : '#dc2626'
        tableRows += `
          <tr>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;">${globalNo}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:12px;">${day.date}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;">${entry.employeeName}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;">${entry.department}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;">${entry.position}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;">${entry.phoneBrand} ${entry.phoneModel}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;">${entry.imei}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-weight:600;">${entry.timeIn}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-weight:600;">${entry.timeOut}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;color:${statusColor};font-size:12px;font-weight:500;">${statusText}</td>
          </tr>`
        globalNo++
      }
    }

    const totalEntries = recapData.days.reduce((sum, d) => sum + d.entries.length, 0)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekapitulasi HP - ${recapData.periodLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1f2937; }
          @media print { body { padding: 10px; } }
          h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
          h2 { font-size: 14px; text-align: center; color: #6b7280; font-weight: 400; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead th { background: #059669; color: white; padding: 8px 10px; text-align: center; font-weight: 600; font-size: 12px; }
          tbody tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; }
          .stats { margin-top: 12px; display: flex; gap: 16px; font-size: 12px; }
          .stats span { padding: 4px 10px; background: #f0fdf4; border-radius: 4px; border: 1px solid #bbf7d0; }
        </style>
      </head>
      <body>
        <h1>REKAPITULASI PENDATAAN HANDPHONE</h1>
        <h2>Periode: ${recapData.periodLabel}</h2>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Nama Petugas</th>
              <th>Departemen</th>
              <th>Jabatan</th>
              <th>HP (Merk/Model)</th>
              <th>IMEI</th>
              <th>Jam Masuk</th>
              <th>Jam Keluar</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${totalEntries === 0 ? '<p style="text-align:center;padding:20px;color:#9ca3af;">Tidak ada data untuk periode ini</p>' : ''}
        <div class="stats">
          <span>Total Data: ${totalEntries}</span>
          <span>Total Hari: ${recapData.totalDays}</span>
        </div>
        <div class="footer">
          <span>Sistem HP Tracker</span>
          <span>Dicetak: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}</span>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  // ---- Render ----
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3 px-4 pt-3 pb-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Riwayat</h2>
          {!loading && activeView === 'logs' && (
            <p className="text-xs text-muted-foreground">{total} aktivitas tercatat</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => {
          if (activeView === 'logs') fetchLogs(page, dateFilter || undefined)
          else fetchRecap()
        }} disabled={loading || recapLoading}>
          <RefreshCw className={cn('h-4 w-4', (loading || recapLoading) && 'animate-spin')} />
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1.5 bg-muted rounded-lg p-1">
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all',
            activeView === 'logs' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveView('logs')}
        >
          <History className="h-3.5 w-3.5" />
          Log Aktivitas
        </button>
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all',
            activeView === 'recap' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveView('recap')}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Rekapitulasi
        </button>
      </div>

      {/* ==================== LOGS VIEW ==================== */}
      {activeView === 'logs' && (
        <>
          {/* Date filter */}
          <div className="space-y-1.5">
            <Label htmlFor="date-filter" className="text-xs">Filter Tanggal</Label>
            <div className="flex gap-2">
              <Input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 flex-1"
              />
              {dateFilter && (
                <Button variant="outline" size="sm" className="h-10" onClick={() => { setDateFilter('') }}>
                  Semua
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="py-3 px-4 gap-2">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : logs.length > 0 ? (
            <>
              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div key={log.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1 }}>
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
                              {log.employee.department} · {log.phone.brand} {log.phone.model}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <Badge
                              variant={log.type === 'check_in' ? 'default' : 'destructive'}
                              className={cn('text-[10px] px-1.5 py-0', log.type === 'check_in' && 'bg-emerald-600 hover:bg-emerald-700')}
                            >
                              {log.type === 'check_in' ? 'Masuk' : 'Keluar'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{formatTime(log.checkedAt)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => fetchLogs(Math.max(1, page - 1), dateFilter || undefined)}
                    disabled={page <= 1}
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => fetchLogs(Math.min(totalPages, page + 1), dateFilter || undefined)}
                    disabled={page >= totalPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {dateFilter ? 'Tidak ada riwayat pada tanggal ini' : 'Belum ada riwayat'}
              </p>
            </div>
          )}
        </>
      )}

      {/* ==================== RECAPITULATION VIEW ==================== */}
      {activeView === 'recap' && (
        <>
          {/* Filter Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              Filter Rekapitulasi
            </Label>
            <div className="flex gap-1.5 bg-muted rounded-lg p-1">
              {(['date', 'month', 'year'] as const).map((type) => (
                <button
                  key={type}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                    recapFilterType === type ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setRecapFilterType(type)}
                >
                  {type === 'date' ? 'Tanggal' : type === 'month' ? 'Bulan' : 'Tahun'}
                </button>
              ))}
            </div>

            {/* Dynamic Filter Input */}
            <div className="flex gap-2">
              {recapFilterType === 'date' && (
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={recapDate}
                    onChange={(e) => setRecapDate(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              )}
              {recapFilterType === 'month' && (
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="month"
                    value={recapMonth}
                    onChange={(e) => setRecapMonth(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              )}
              {recapFilterType === 'year' && (
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    value={recapYear}
                    onChange={(e) => setRecapYear(e.target.value)}
                    className="pl-9 h-10"
                    min="2020"
                    max="2100"
                    placeholder="Tahun"
                  />
                </div>
              )}
              <Button
                size="sm"
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={fetchRecap}
                disabled={recapLoading}
              >
                {recapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          {recapData && recapData.days.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={handleDownloadCSV}
                disabled={recapLoading}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={handlePrint}
                disabled={recapLoading}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Cetak
              </Button>
            </div>
          )}

          {/* Period Summary */}
          {recapData && !recapLoading && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-800">Rekapitulasi: {recapData.periodLabel}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-700">{recapData.totalDays}</p>
                    <p className="text-[10px] text-emerald-600">Hari</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-700">
                      {recapData.days.reduce((s, d) => s + d.entries.length, 0)}
                    </p>
                    <p className="text-[10px] text-emerald-600">Total Data</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600">
                      {recapData.days.reduce((s, d) => s + d.masihDiDalam, 0)}
                    </p>
                    <p className="text-[10px] text-amber-600">Masih Dalam</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recap Content */}
          {recapLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="py-4 px-4 gap-2">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recapData && recapData.days.length > 0 ? (
            <div className="space-y-2 pb-4">
              {recapData.days.map((day) => {
                const isExpanded = expandedDays.has(day.date)
                return (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Day Header */}
                    <button
                      onClick={() => toggleDayExpand(day.date)}
                      className="w-full"
                    >
                      <Card className={cn(
                        'py-3 px-4 gap-0 transition-colors',
                        isExpanded ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-muted/50'
                      )}>
                        <CardContent className="p-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                              <CalendarDays className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{day.formattedDate}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-emerald-600 font-medium">
                                  <LogIn className="h-2.5 w-2.5 inline mr-0.5" />{day.totalMasuk} Masuk
                                </span>
                                <span className="text-[10px] text-red-500 font-medium">
                                  <LogOut className="h-2.5 w-2.5 inline mr-0.5" />{day.totalKeluar} Keluar
                                </span>
                                {day.masihDiDalam > 0 && (
                                  <span className="text-[10px] text-amber-600 font-medium">
                                    {day.masihDiDalam} Masih Dalam
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-[10px]">
                                {day.entries.length} data
                              </Badge>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </button>

                    {/* Expanded Entries */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-2 mt-1 space-y-1.5 border-l-2 border-emerald-200 pl-3">
                            {/* Table Header for mobile */}
                            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                              <span className="w-6 text-center">No</span>
                              <span>Nama / HP</span>
                              <span>Departemen</span>
                              <span className="text-center w-14">Masuk</span>
                              <span className="text-center w-14">Keluar</span>
                              <span className="w-20 text-center">Status</span>
                            </div>

                            {day.entries.map((entry) => (
                              <motion.div
                                key={entry.no}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.1 }}
                              >
                                <Card className="py-2.5 px-3 gap-0">
                                  <CardContent className="p-0">
                                    {/* Mobile Card Layout */}
                                    <div className="sm:hidden space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
                                          {entry.no}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{entry.employeeName}</p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {entry.phoneBrand} {entry.phoneModel}
                                            {entry.phoneColor !== '-' ? ` · ${entry.phoneColor}` : ''}
                                          </p>
                                        </div>
                                        <Badge
                                          className={cn(
                                            'text-[10px] px-1.5 py-0 shrink-0',
                                            entry.status === 'sudah_keluar' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                                            entry.status === 'masih_di_dalam' && 'bg-amber-100 text-amber-700 hover:bg-amber-100',
                                            entry.status === 'data_tidak_lengkap' && 'bg-red-100 text-red-700 hover:bg-red-100',
                                          )}
                                        >
                                          {entry.status === 'sudah_keluar' ? 'Sudah Keluar' : entry.status === 'masih_di_dalam' ? 'Masih Dalam' : 'Belum Lengkap'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 pl-8 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <span className="text-muted-foreground/60">Dept:</span>
                                          <span className="truncate max-w-[100px]">{entry.department}</span>
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <LogIn className="h-3 w-3 text-emerald-500" />
                                          <span className={cn('font-medium', entry.timeIn === '-' && 'text-muted-foreground/40')}>{entry.timeIn}</span>
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <LogOut className="h-3 w-3 text-red-500" />
                                          <span className={cn('font-medium', entry.timeOut === '-' && 'text-muted-foreground/40')}>{entry.timeOut}</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Desktop Table Layout */}
                                    <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 items-center text-sm">
                                      <span className="w-6 text-center text-xs text-muted-foreground">{entry.no}</span>
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{entry.employeeName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{entry.phoneBrand} {entry.phoneModel}</p>
                                      </div>
                                      <span className="text-xs text-muted-foreground truncate">{entry.department}</span>
                                      <span className={cn('text-center w-14 font-medium', entry.timeIn === '-' && 'text-muted-foreground/40')}>
                                        {entry.timeIn}
                                      </span>
                                      <span className={cn('text-center w-14 font-medium', entry.timeOut === '-' && 'text-muted-foreground/40')}>
                                        {entry.timeOut}
                                      </span>
                                      <Badge
                                        className={cn(
                                          'text-[10px] px-1.5 py-0 w-20 justify-center',
                                          entry.status === 'sudah_keluar' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                                          entry.status === 'masih_di_dalam' && 'bg-amber-100 text-amber-700 hover:bg-amber-100',
                                          entry.status === 'data_tidak_lengkap' && 'bg-red-100 text-red-700 hover:bg-red-100',
                                        )}
                                      >
                                        {entry.status === 'sudah_keluar' ? 'Sudah Keluar' : entry.status === 'masih_di_dalam' ? 'Masih Dalam' : 'Belum Lengkap'}
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          ) : recapData && recapData.days.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada data rekapitulasi untuk periode ini</p>
              <p className="text-xs text-muted-foreground mt-1">Coba ubah filter dan klik cari</p>
            </div>
          ) : null}
        </>
      )}
      </div>
    </div>
  )
}
