'use client'

import { useEffect, useRef, useState } from 'react'

type CheckUpdateData = {
  type: 'check_in' | 'check_out'
  employeeId: string
  employeeName: string
  phoneId: string
  phoneBrand: string
  phoneModel: string
}

type RealtimeEventCallback = (data: CheckUpdateData) => void

/**
 * Hook for real-time sync with safe WebSocket connection.
 * Completely optional - if socket.io-client is unavailable or
 * connection fails, it silently falls back to polling-only.
 */
export function useRealtimeSync(
  onCheckUpdate: RealtimeEventCallback,
  options?: { employeeId?: string; enabled?: boolean }
) {
  const [isConnected, setIsConnected] = useState(false)
  const callbackRef = useRef(onCheckUpdate)
  const socketRef = useRef<{ disconnect: () => void } | null>(null)

  useEffect(() => {
    callbackRef.current = onCheckUpdate
  }, [onCheckUpdate])

  useEffect(() => {
    if (socketRef.current) return

    let destroyed = false

    async function connect() {
      try {
        // Dynamic import - won't crash if socket.io-client is missing
        const socketIo = await import('socket.io-client')

        // Don't connect if not in browser
        if (typeof window === 'undefined') return

        const socket = socketIo.io('/?XTransformPort=3004', {
          transports: ['polling', 'websocket'],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 2,
          reconnectionDelay: 3000,
          timeout: 3000,
        })

        socket.on('connect', () => {
          if (!destroyed) setIsConnected(true)
        })

        socket.on('disconnect', () => {
          if (!destroyed) setIsConnected(false)
        })

        socket.on('check-update', (data: CheckUpdateData) => {
          if (options?.employeeId && data.employeeId !== options.employeeId) return
          callbackRef.current(data)
        })

        socket.on('connect_error', () => {
          // Expected on Vercel - WebSocket service not available
          if (!destroyed) setIsConnected(false)
        })

        socketRef.current = socket
      } catch {
        // socket.io-client not available - polling fallback will handle it
      }
    }

    connect()

    return () => {
      destroyed = true
      try {
        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }, [options?.employeeId])

  return { isConnected }
}
