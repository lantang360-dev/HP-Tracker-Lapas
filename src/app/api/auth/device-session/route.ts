import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET - Get device sessions for an employee
 * Query: ?employeeId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: 'Employee ID wajib diisi' },
        { status: 400 }
      )
    }

    const sessions = await db.deviceSession.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceId: s.deviceId,
        userAgent: s.userAgent,
        isActive: s.isActive,
        lastLogin: s.lastLogin,
        createdAt: s.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get device sessions error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Reset (deactivate) all device sessions for an employee
 * Body: { employeeId: string }
 * This allows the employee to login from a new device
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeId } = body

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: 'Employee ID wajib diisi' },
        { status: 400 }
      )
    }

    // Deactivate all existing device sessions
    const result = await db.deviceSession.updateMany({
      where: {
        employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Berhasil mereset ${result.count} perangkat. Petugas dapat login dari perangkat baru.`,
      deactivatedCount: result.count,
    })
  } catch (error) {
    console.error('Reset device sessions error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
