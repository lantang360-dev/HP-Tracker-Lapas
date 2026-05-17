'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone,
  LogIn,
  Delete,
  UserPlus,
  Loader2,
  Fingerprint,
  User,
  Lock,
  X,
  MonitorSmartphone,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { AppUser, DeviceMismatchInfo } from '@/types'
import { getDeviceFingerprint, getDeviceName } from '@/lib/format-utils'

// ============================================================
// Types
// ============================================================

export interface RememberedUser {
  loginUsername: string  // The actual username used for login (e.g. "admin", "budi.s")
  displayName: string    // User's display name (e.g. "Administrator", "Budi Santoso")
  role: string           // "admin", "kepala", "employee"
  savedAt: number        // Timestamp when saved
}

type LoginMode = 'pin' | 'full'

const REMEMBERED_KEY = 'hp_tracker_remembered'

// ============================================================
// PIN Dot Display
// ============================================================

function PinDots({ length, entered, hasError }: { length: number; entered: number; hasError: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3.5 my-3">
      {Array.from({ length }).map((_, i) => (
        <motion.div
          key={i}
          animate={i === entered - 1 && !hasError ? { scale: [1, 1.4, 1] } : { scale: 1 }}
          transition={{ duration: 0.15 }}
          className="h-3.5 w-3.5 rounded-full transition-colors duration-150"
          style={{
            backgroundColor: i < entered
              ? hasError ? '#fca5a5' : '#ffffff'
              : 'rgba(255,255,255,0.2)',
            boxShadow: i < entered && !hasError ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ============================================================
// Numpad Component
// ============================================================

function Numpad({ onKey, disabled }: { onKey: (key: string) => void; disabled: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="grid grid-cols-3 gap-2.5 mt-3 w-full max-w-[280px] mx-auto">
      {keys.map((key) => {
        if (key === '') return <div key="empty" className="h-[58px]" />

        if (key === 'del') {
          return (
            <button
              key="del"
              type="button"
              onClick={() => onKey('del')}
              disabled={disabled}
              className="h-[58px] flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 transition-all disabled:opacity-40"
            >
              <Delete className="h-5 w-5 text-white/70" />
            </button>
          )
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => onKey(key)}
            disabled={disabled}
            className="h-[58px] flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/35 active:scale-95 transition-all text-white text-xl font-semibold disabled:opacity-40 select-none"
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Header Section (shared)
// ============================================================

function LoginHeader() {
  return (
    <div className="text-center mb-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6, delay: 0.1 }}
        className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200 mb-4"
      >
        <Smartphone className="h-10 w-10 text-white" />
      </motion.div>
      <h1 className="text-2xl font-bold text-white tracking-tight">HP Tracker</h1>
      <p className="text-sm text-white/80 mt-1">Sistem Pendataan Handphone</p>
      <p className="text-xs text-white/70 mt-0.5">Lembaga Pemasyarakatan Kelas IIA Bontang</p>
    </div>
  )
}

// ============================================================
// Login API call helper
// ============================================================

async function doLogin(username: string, pin: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: pin,
      deviceId: getDeviceFingerprint(),
      deviceName: getDeviceName(),
      userAgent: navigator.userAgent,
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    if (data.reason === 'device_mismatch') {
      throw { isDeviceMismatch: true, data }
    }
    throw { isDeviceMismatch: false, message: data.message || 'Login gagal' }
  }
  return data
}

// ============================================================
// PIN-Only Login (Quick Login)
// ============================================================

function QuickPinLogin({
  remembered,
  onLoginSuccess,
  onSwitchToFull,
}: {
  remembered: RememberedUser
  onLoginSuccess: (user: AppUser, loginUsername: string) => void
  onSwitchToFull: () => void
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [shake, setShake] = useState(false)

  const resetPin = useCallback(() => {
    setPin('')
    setHasError(false)
    setShake(false)
  }, [])

  const submitPin = useCallback(async (pinValue: string) => {
    if (loading) return
    setLoading(true)
    setHasError(false)
    try {
      const data = await doLogin(remembered.loginUsername, pinValue)
      if (data.deviceInfo?.isFirstLogin) {
        toast.success(`Perangkat ${data.deviceInfo.name} berhasil terdaftar!`)
      }
      toast.success(`Selamat datang, ${data.user.name}!`)
      onLoginSuccess(data.user, remembered.loginUsername)
    } catch (err: unknown) {
      const e = err as { isDeviceMismatch?: boolean; message?: string }
      if (e.isDeviceMismatch) {
        toast.error('Perangkat tidak diizinkan. Hubungi admin.')
      }
      setHasError(true)
      setShake(true)
      setTimeout(resetPin, 700)
    } finally {
      setLoading(false)
    }
  }, [remembered.loginUsername, loading, onLoginSuccess, resetPin])

  const handleKey = useCallback((key: string) => {
    if (loading) return
    setHasError(false)

    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1))
      return
    }

    if (pin.length >= 4) return

    const newPin = pin + key
    setPin(newPin)

    // Auto-submit when reaching 4+ digits
    if (newPin.length >= 4) {
      submitPin(newPin)
    }
  }, [pin, loading, submitPin])

  // Handle physical keyboard input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (val.length > pin.length && val.length >= 4) {
      setPin(val)
      submitPin(val)
    } else {
      setPin(val)
      setHasError(false)
    }
  }, [pin.length, submitPin])

  return (
    <motion.div
      key="pin-login"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm relative z-10"
    >
      <LoginHeader />

      {/* User Info Card */}
      <Card className="shadow-xl border-0 bg-white/15 backdrop-blur-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 shrink-0">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{remembered.displayName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-white/60">
                  @{remembered.loginUsername}
                </span>
                {remembered.role === 'kepala' && (
                  <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded-full">Kepala</span>
                )}
                {remembered.role === 'admin' && (
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-full">Admin</span>
                )}
              </div>
            </div>
            <Fingerprint className="h-5 w-5 text-white/40 shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* PIN Input Card */}
      <motion.div animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }} transition={{ duration: 0.5 }}>
        <Card className="shadow-xl border-0 bg-white/15 backdrop-blur-sm">
          <CardContent className="p-6 pt-5">
            <p className="text-center text-sm font-semibold text-white mb-1">Masukkan PIN</p>
            <p className="text-center text-[11px] text-white/50 mb-1">Minimal 4 digit</p>

            <PinDots length={4} entered={pin.length} hasError={hasError} />

            {hasError && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-300 text-center mb-1"
              >
                PIN salah, coba lagi
              </motion.p>
            )}

            {loading && (
              <div className="flex justify-center my-2">
                <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
              </div>
            )}

            {!loading && (
              <Numpad onKey={handleKey} disabled={loading} />
            )}

            {/* Hidden input for keyboard accessibility */}
            <input
              type="tel"
              inputMode="numeric"
              className="sr-only"
              autoComplete="one-time-code"
              value={pin}
              onChange={handleInputChange}
              aria-label="PIN"
              tabIndex={-1}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Switch Account Button */}
      <div className="text-center mt-5 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSwitchToFull}
          className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="text-xs">Login Akun Lain</span>
        </Button>
        <p className="text-[10px] text-white/30">
          {new Date(remembered.savedAt).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
          })} &middot; Tersimpan di perangkat ini
        </p>
      </div>
    </motion.div>
  )
}

// ============================================================
// Full Login (Username + PIN/Password)
// ============================================================

function FullLogin({
  onLoginSuccess,
  onBack,
  defaultUsername,
  deviceMismatch,
  setDeviceMismatch,
}: {
  onLoginSuccess: (user: AppUser, loginUsername: string) => void
  onBack: () => void
  defaultUsername?: string
  deviceMismatch: DeviceMismatchInfo | null
  setDeviceMismatch: (v: DeviceMismatchInfo | null) => void
}) {
  const [username, setUsername] = useState(defaultUsername || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Username dan PIN wajib diisi')
      return
    }
    setLoading(true)
    setDeviceMismatch(null)
    try {
      const data = await doLogin(username.trim(), password)

      if (data.deviceInfo?.isFirstLogin) {
        toast.success(`Perangkat ${data.deviceInfo.name} berhasil terdaftar!`)
      }
      toast.success(`Selamat datang, ${data.user.name}!`)

      // Save to localStorage for future PIN-only login
      try {
        const remembered: RememberedUser = {
          loginUsername: username.trim(),
          displayName: data.user.name,
          role: data.user.role,
          savedAt: Date.now(),
        }
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify(remembered))
      } catch { /* quota exceeded, ignore */ }

      onLoginSuccess(data.user, username.trim())
    } catch (err: unknown) {
      const e = err as { isDeviceMismatch?: boolean; message?: string; data?: DeviceMismatchInfo }
      if (e.isDeviceMismatch && e.data) {
        setDeviceMismatch(e.data)
        return
      }
      toast.error(e.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      key="full-login"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm relative z-10"
    >
      <LoginHeader />

      <Card className="shadow-xl border-0 bg-white/15 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Back button (only show if we can go back) */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-white/60 hover:text-white text-xs mb-4 -mt-1 transition-colors"
            >
              ← Kembali ke PIN Login
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-white/90">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  id="login-username"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-11 bg-white/15 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-pin" className="text-white/90">PIN / Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  id="login-pin"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan PIN"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputMode="numeric"
                  className="pl-9 pr-10 h-11 bg-white/15 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 tracking-widest"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? <X className="h-4 w-4" /> : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-white/40">PIN minimal 4 digit angka</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Masuk
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Device Mismatch Warning */}
      <AnimatePresence>
        {deviceMismatch && (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            <Card className="border-red-200 bg-red-50 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                    <TriangleAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-red-900">Perangkat Tidak Dikenal</h3>
                    <p className="text-xs text-red-700 mt-1">
                      Login dari perangkat baru ditolak untuk keamanan akun Anda.
                    </p>
                  </div>
                </div>
                <Separator className="bg-red-200" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-red-600 uppercase font-medium">Perangkat Terdaftar</p>
                      <p className="text-xs text-red-900 font-medium">{deviceMismatch.registeredDevice.name}</p>
                      <p className="text-[10px] text-red-600">
                        Terakhir login: {formatDistanceToNow(new Date(deviceMismatch.registeredDevice.lastLogin), { addSuffix: true, locale: idLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Perangkat Anda Sekarang</p>
                      <p className="text-xs text-foreground font-medium">{deviceMismatch.currentDevice.name}</p>
                    </div>
                  </div>
                </div>
                <Separator className="bg-red-200" />
                <div className="rounded-lg bg-white/60 p-3">
                  <p className="text-[11px] text-red-800 leading-relaxed">{deviceMismatch.hint}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-100 h-10"
                  onClick={() => setDeviceMismatch(null)}
                >
                  Mengerti, Kembali ke Login
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================
// Main LoginScreen Component
// ============================================================

export function PinPadLoginScreen({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [deviceMismatch, setDeviceMismatch] = useState<DeviceMismatchInfo | null>(null)

  // Read remembered user from localStorage (lazy initializer - runs once)
  const [initialState] = useState<{ mode: LoginMode; remembered: RememberedUser | null }>(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as RememberedUser
        if (parsed.loginUsername && parsed.displayName) {
          return { mode: 'pin', remembered: parsed }
        }
      }
    } catch { /* ignore */ }
    return { mode: 'full', remembered: null }
  })

  const [mode, setMode] = useState<LoginMode>(initialState.mode)
  const [remembered, setRemembered] = useState<RememberedUser | null>(initialState.remembered)

  const handleLoginSuccess = useCallback((_user: AppUser, _loginUsername: string) => {
    // Clear any stored session user (page.tsx will set the new one)
    onLogin(_user)
  }, [onLogin])

  const handleSwitchToFull = useCallback(() => {
    setMode('full')
    setDeviceMismatch(null)
  }, [])

  const handleBackToPin = useCallback(() => {
    if (remembered) {
      setMode('pin')
    }
    setDeviceMismatch(null)
  }, [remembered])

  // Also add logout function that clears remembered user
  useEffect(() => {
    // Expose a global function to clear remembered user on logout
    const handler = () => {
      try { localStorage.removeItem(REMEMBERED_KEY) } catch { /* ignore */ }
    }
    window.addEventListener('hp-tracker-logout', handler)
    return () => window.removeEventListener('hp-tracker-logout', handler)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/login-bg.webp)' }}
    >
      <div className="absolute inset-0 bg-black/40" />

      {/* Download Update Link */}
      <a
        href="/hp-tracker-update-v12.zip"
        download
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/70 hover:text-white hover:bg-white/25 transition-colors text-[10px] font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Update v12
      </a>

      <AnimatePresence mode="wait">
        {mode === 'pin' && remembered ? (
          <QuickPinLogin
            key="pin-mode"
            remembered={remembered}
            onLoginSuccess={handleLoginSuccess}
            onSwitchToFull={handleSwitchToFull}
          />
        ) : (
          <FullLogin
            key="full-mode"
            onLoginSuccess={handleLoginSuccess}
            onBack={remembered ? handleBackToPin : undefined}
            defaultUsername=""
            deviceMismatch={deviceMismatch}
            setDeviceMismatch={setDeviceMismatch}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
