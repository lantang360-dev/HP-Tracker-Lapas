'use client'

import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Smartphone,
  ScanLine,
  Building2,
  History,
  Users,
  Shield,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardTab, PhoneListTab, ScannerTab, InsideTab, HistoryTab, EmployeesTab, KepalaTab } from '@/components/admin'
import { prefetchUrls, invalidateCache } from '@/lib/apiCache'
import type { AppUser, AdminTabId } from '@/types'

const adminTabs: { id: AdminTabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'phones', label: 'Daftar HP', icon: Smartphone },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'inside', label: 'Di Dalam', icon: Building2 },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'employees', label: 'Petugas', icon: Users },
  { id: 'kepala', label: 'Kepala', icon: Shield },
]

/** All API endpoints used by tabs - pre-fetched on app load for instant tab switching */
const PREFETCH_URLS = [
  '/api/dashboard/stats',
  '/api/phones',
  '/api/employees',
  '/api/inside',
  '/api/check/logs?page=1&limit=20',
  '/api/kepala',
]

const LAST_TAB_KEY = 'hp_tracker_last_tab'

export function AdminView({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  // Restore last active tab from sessionStorage (resets to dashboard when app is closed)
  const [activeTab, setActiveTab] = useState<AdminTabId>(() => {
    try {
      const saved = sessionStorage.getItem(LAST_TAB_KEY)
      if (saved && adminTabs.some(t => t.id === saved)) {
        return saved as AdminTabId
      }
    } catch { /* ignore */ }
    return 'dashboard'
  })

  // Pre-fetch all tab API data in background on mount
  // This ensures all tabs have data ready before user navigates to them
  useEffect(() => {
    prefetchUrls(PREFETCH_URLS)
  }, [])

  // Listen for data changes to invalidate cache and trigger re-fetch
  useEffect(() => {
    const handler = () => {
      // Invalidate and re-prefetch after scan/update events
      invalidateCache()
      // Small delay to let DB write complete, then re-prefetch
      setTimeout(() => prefetchUrls(PREFETCH_URLS), 500)
    }
    window.addEventListener('hp-check-update', handler)
    return () => window.removeEventListener('hp-check-update', handler)
  }, [])

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Header - fixed height, doesn't shrink */}
      <header className="shrink-0 bg-white border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Smartphone className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">HP Tracker</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {user.role === 'kepala' ? 'Panel Kepala' : 'Admin Panel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn("text-[10px] hidden sm:flex", user.role === 'kepala' && "bg-blue-100 text-blue-700 border-blue-200")}>
              <Shield className="h-3 w-3 mr-1" />
              {user.name}
              {user.role === 'kepala' && ' · Kepala'}
            </Badge>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLogout}>
              <LogOut className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content area - ALL tabs mounted, inactive tabs hidden via CSS */}
      {/* All tabs fetch data immediately on mount → instant switching */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <div className={cn('absolute inset-0', activeTab !== 'dashboard' && 'invisible pointer-events-none')}>
          <DashboardTab />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'phones' && 'invisible pointer-events-none')}>
          <PhoneListTab />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'scan' && 'invisible pointer-events-none')}>
          <ScannerTab isActive={activeTab === 'scan'} />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'inside' && 'invisible pointer-events-none')}>
          <InsideTab />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'history' && 'invisible pointer-events-none')}>
          <HistoryTab />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'employees' && 'invisible pointer-events-none')}>
          <EmployeesTab />
        </div>
        <div className={cn('absolute inset-0', activeTab !== 'kepala' && 'invisible pointer-events-none')}>
          <KepalaTab />
        </div>
      </main>

      {/* Bottom Navigation - fixed height, part of flex layout (NOT position:fixed) */}
      <nav className="shrink-0 bg-white border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-14 px-1 max-w-lg mx-auto">
          {adminTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  try { sessionStorage.setItem(LAST_TAB_KEY, tab.id) } catch { /* ignore */ }
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                  isActive ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center rounded-lg transition-all',
                  isActive ? 'h-7 w-7' : 'h-6 w-6'
                )}>
                  <tab.icon className={cn(isActive ? 'h-4 w-4' : 'h-3.5 w-3.5')} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn('text-[10px] leading-tight', isActive ? 'font-semibold' : 'font-medium')}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
