import { format, formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'HH:mm', { locale: idLocale })
  } catch {
    return '--:--'
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'dd MMM yyyy, HH:mm', { locale: idLocale })
  } catch {
    return '-'
  }
}

export function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return formatDistanceToNow(d, { addSuffix: true, locale: idLocale })
  } catch {
    return '-'
  }
}

export function getTodayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDateId(date: Date): string {
  return format(date, 'EEEE, dd MMMM yyyy', { locale: idLocale })
}

// ============================================================
// Device Fingerprint Utility
// ============================================================

const DEVICE_UUID_KEY = 'hp_tracker_device_uuid'

/**
 * Generate and persist a unique device UUID in localStorage.
 * Unlike User-Agent hashing, this guarantees uniqueness per device
 * because localStorage is isolated per device/browser profile.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return ''
  try {
    // Check if UUID already exists in localStorage
    let uuid = localStorage.getItem(DEVICE_UUID_KEY)
    if (uuid && uuid.length >= 20) return uuid

    // Generate a new UUID (crypto.randomUUID is available in all modern browsers)
    uuid = crypto.randomUUID()
    localStorage.setItem(DEVICE_UUID_KEY, uuid)
    return uuid
  } catch {
    // Fallback: if localStorage is unavailable, generate a temporary UUID
    return crypto.randomUUID()
  }
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s[\d.]+;\s([^;)]+)/)
    return match ? `Android (${match[1].trim()})` : 'Android'
  }
  if (/Windows/i.test(ua)) return 'Windows PC'
  if (/Mac/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Unknown Device'
}
