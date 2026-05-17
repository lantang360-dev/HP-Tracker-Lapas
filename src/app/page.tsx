'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Loader2 } from 'lucide-react'
import { LoginScreen } from '@/components/LoginScreen'
import { AdminView } from '@/components/AdminView'
import { EmployeeView } from '@/components/EmployeeView'
import type { AppUser } from '@/types'

const SESSION_KEY = 'hp_tracker_user'
const SESSION_TIME_KEY = 'hp_tracker_session_time'
const SESSION_TIMEOUT_MS = 1 * 60 * 1000 // 1 minute

// Session auto-clears when browser/app is closed (sessionStorage).
// Additionally, session expires after 1 minute of inactivity.
export default function Page() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_TIME_KEY)
    sessionStorage.removeItem('hp_tracker_last_tab')
  }, [])

  const handleLogout = useCallback(() => {
    setUser(null)
    clearSession()
    window.dispatchEvent(new CustomEvent('hp-tracker-logout'))
  }, [clearSession])

  // Check session expiry every 5 seconds
  useEffect(() => {
    if (!user) return

    // Set session timestamp on login
    sessionStorage.setItem(SESSION_TIME_KEY, Date.now().toString())

    const checkExpiry = () => {
      try {
        const sessionTime = sessionStorage.getItem(SESSION_TIME_KEY)
        if (!sessionTime) {
          handleLogout()
          return
        }
        const elapsed = Date.now() - parseInt(sessionTime, 10)
        if (elapsed >= SESSION_TIMEOUT_MS) {
          handleLogout()
        }
      } catch {
        handleLogout()
      }
    }

    timerRef.current = setInterval(checkExpiry, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user, handleLogout])

  // Restore session on mount
  useEffect(() => {
    let restoredUser: AppUser | null = null
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as AppUser
        if (parsed && parsed.id && parsed.role) {
          // Check if session has already expired
          const sessionTime = sessionStorage.getItem(SESSION_TIME_KEY)
          if (sessionTime) {
            const elapsed = Date.now() - parseInt(sessionTime, 10)
            if (elapsed < SESSION_TIMEOUT_MS) {
              restoredUser = parsed
            }
          }
        }
      }
    } catch {
      clearSession()
    }
    if (!restoredUser) {
      clearSession()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(restoredUser)
    setLoading(false)
  }, [clearSession])

  const handleLogin = useCallback((loggedInUser: AppUser) => {
    setUser(loggedInUser)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser))
    sessionStorage.setItem(SESSION_TIME_KEY, Date.now().toString())
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200"
        >
          <Smartphone className="h-8 w-8 text-white" />
        </motion.div>
        <Loader2 className="h-6 w-6 text-emerald-600 animate-spin mt-4" />
      </div>
    )
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />
  if (user.role === 'admin' || user.role === 'kepala') return <AdminView user={user} onLogout={handleLogout} />
  return <EmployeeView user={user} onLogout={handleLogout} />
}
