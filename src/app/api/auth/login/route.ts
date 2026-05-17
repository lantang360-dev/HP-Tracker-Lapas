import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Parse device name from user agent string
 */
function parseDeviceName(userAgent: string): string {
  if (!userAgent) return 'Unknown Device'

  // Try to extract device/OS info
  if (/iPhone/i.test(userAgent)) return 'iPhone'
  if (/iPad/i.test(userAgent)) return 'iPad'
  if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android\s[\d.]+;\s([^;)]+)/)
    return match ? `Android (${match[1].trim()})` : 'Android'
  }
  if (/Windows/i.test(userAgent)) return 'Windows PC'
  if (/Mac/i.test(userAgent)) return 'Mac'
  if (/Linux/i.test(userAgent)) return 'Linux'

  return 'Unknown Device'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, deviceId, deviceName, userAgent } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi' },
        { status: 400 }
      )
    }

    // Admin login - no device binding for admin
    if (username === 'admin' && password === 'admin123') {
      return NextResponse.json({
        success: true,
        user: {
          id: 'admin',
          name: 'Administrator',
          nip: 'ADMIN',
          department: 'Management',
          position: 'Administrator',
          role: 'admin',
        },
      })
    }

    // Employee login
    const employee = await db.employee.findUnique({
      where: { username },
      include: {
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!employee || employee.password !== password) {
      return NextResponse.json(
        { success: false, message: 'Username atau password salah' },
        { status: 401 }
      )
    }

    // Kepala (head) role — full admin access, no device binding
    if (employee.role === 'kepala') {
      return NextResponse.json({
        success: true,
        user: {
          id: employee.id,
          name: employee.name,
          nip: employee.nik,
          department: employee.department,
          position: employee.position || 'Kepala',
          role: 'kepala',
        },
      })
    }

    // Device binding check (for regular employees only)
    // deviceId must be provided by client (stored in localStorage per device)
    if (!deviceId) {
      return NextResponse.json(
        { success: false, message: 'Perangkat tidak dikenali. Gunakan browser terbaru.' },
        { status: 400 }
      )
    }
    const currentDeviceId = deviceId
    const currentDeviceName = deviceName || parseDeviceName(userAgent || '')
    const currentUA = userAgent || ''

    const activeSessions = employee.deviceSessions.filter((s) => s.isActive)

    if (activeSessions.length > 0) {
      const matchingDevice = activeSessions.find((s) => s.deviceId === currentDeviceId)

      if (!matchingDevice) {
        // Device mismatch! Login from different device
        const lastDevice = activeSessions[0]
        return NextResponse.json({
          success: false,
          message: 'PERANGKAT_TIDAK_DIIZINKAN',
          reason: 'device_mismatch',
          currentDevice: {
            name: currentDeviceName,
            id: currentDeviceId,
          },
          registeredDevice: {
            name: lastDevice.deviceName,
            lastLogin: lastDevice.lastLogin.toISOString(),
            registeredAt: lastDevice.createdAt.toISOString(),
          },
          hint: `Akun ini terikat ke perangkat "${lastDevice.deviceName}". Hubungi admin untuk mereset perangkat jika Anda ganti HP.`,
        }, { status: 403 })
      }

      // Device matches - update last login
      await db.deviceSession.update({
        where: { id: matchingDevice.id },
        data: { lastLogin: new Date() },
      })
    } else {
      // First time login - register this device
      await db.deviceSession.create({
        data: {
          employeeId: employee.id,
          deviceId: currentDeviceId,
          deviceName: currentDeviceName,
          userAgent: currentUA.substring(0, 500),
        },
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: employee.id,
        name: employee.name,
        nip: employee.nik,
        department: employee.department,
        position: employee.position,
        role: 'employee',
      },
      deviceInfo: {
        name: currentDeviceName,
        isFirstLogin: activeSessions.length === 0,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
