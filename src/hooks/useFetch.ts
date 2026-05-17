'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCached, setCached } from '@/lib/apiCache'

type FetchOptions = {
  cacheTime?: number // ms to keep cached data (default 5s - reduced for real-time freshness)
  showLoading?: boolean
}

/**
 * Custom hook for data fetching with global cache integration.
 * 
 * - Checks global cache first (from prefetch) for instant data
 * - Falls back to API fetch if cache miss
 * - Updates global cache with new data
 * - Auto-refreshes every 30 seconds
 */
export function useFetch<T>(url: string | null, options: FetchOptions = {}) {
  const { cacheTime = 5000 } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!url) return

    // Check global cache first (from prefetch or previous tab visit)
    if (!forceRefresh) {
      const cached = getCached<T>(url)
      if (cached) {
        setData(cached)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Error ${res.status}: ${text}`)
      }
      const result: T = await res.json()

      if (mountedRef.current) {
        setData(result)
        // Update global cache so other tabs/components can benefit
        setCached(url, result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [url, cacheTime])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => { mountedRef.current = false }
  }, [fetchData])

  // Auto-refresh on interval
  useEffect(() => {
    if (!url) return
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [url, fetchData])

  return { data, setData, loading, error, refresh: () => fetchData(true) }
}
