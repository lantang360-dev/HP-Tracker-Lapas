/**
 * Global API Cache with request deduplication.
 * 
 * - Prevents duplicate in-flight requests to the same URL
 * - Caches responses for 30 seconds
 * - Supports prefetch: warm cache before components mount
 * 
 * Used by AdminView to pre-fetch all tab data on app load,
 * so tab switching is instant.
 */

type CacheEntry<T = any> = {
  data: T
  timestamp: number
}

const CACHE_TTL = 30_000 // 30 seconds
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any>>()

/** Get cached data if fresh (< 30s old) */
export function getCached<T = any>(url: string): T | null {
  const entry = cache.get(url)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  if (entry) cache.delete(url) // clean up expired
  return null
}

/** Store data in cache */
export function setCached(url: string, data: any) {
  cache.set(url, { data, timestamp: Date.now() })
}

/** Invalidate specific URL or entire cache */
export function invalidateCache(url?: string) {
  if (url) {
    cache.delete(url)
    inflight.delete(url)
  } else {
    cache.clear()
    inflight.clear()
  }
}

/** Pre-fetch multiple URLs in background (silent, no error throwing) */
export function prefetchUrls(urls: string[]) {
  for (const url of urls) {
    // Skip if already cached
    if (getCached(url)) continue
    // Skip if already in-flight
    if (inflight.has(url)) continue

    const promise = fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setCached(url, data)
      })
      .catch(() => {
        // Silent fail for prefetch
      })
      .finally(() => {
        inflight.delete(url)
      })

    inflight.set(url, promise)
  }
}

/** Fetch with automatic cache check and deduplication */
export async function cachedFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // Check cache first
  const cached = getCached<T>(url)
  if (cached) return cached

  // Deduplicate: if same request is in-flight, reuse the promise
  if (inflight.has(url)) {
    return inflight.get(url) as Promise<T>
  }

  const promise = fetch(url, { ...options, cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      const data: T = await res.json()
      setCached(url, data)
      return data
    })
    .finally(() => {
      inflight.delete(url)
    })

  inflight.set(url, promise)
  return promise
}
