import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        phones: {
          orderBy: { createdAt: 'desc' },
        },
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Petugas tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        nip: employee.nik,
        department: employee.department,
        position: employee.position,
        phone: employee.phone,
        hasLogin: !!employee.username,
        phones: employee.phones.map((p) => ({
          id: p.id,
          brand: p.brand,
          model: p.model,
          imei: p.imei,
          color: p.color,
          status: p.status,
          createdAt: p.createdAt,
        })),
        deviceSession: employee.deviceSessions[0] ? {
          deviceName: employee.deviceSessions[0].deviceName,
          lastLogin: employee.deviceSessions[0].lastLogin,
          registeredAt: employee.deviceSessions[0].createdAt,
        } : null,
      },
    })
  } catch (error) {
    console.error('Employee profile error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
