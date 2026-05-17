import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeId, username, password } = body

    if (!employeeId || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Employee ID, username, dan password wajib diisi' },
        { status: 400 }
      )
    }

    // Check username uniqueness (exclude current employee)
    const existingUser = await db.employee.findFirst({
      where: {
        username,
        NOT: { id: employeeId },
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Username sudah digunakan oleh petugas lain' },
        { status: 409 }
      )
    }

    // Update employee credentials
    const employee = await db.employee.update({
      where: { id: employeeId },
      data: {
        username,
        password,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Kredensial berhasil diperbarui',
      employee: {
        id: employee.id,
        name: employee.name,
        nip: employee.nik,
        username: employee.username,
      },
    })
  } catch (error) {
    console.error('Set credentials error:', error)

    // Handle case where employee is not found
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    if (errorMessage.includes('Record to update not found')) {
      return NextResponse.json(
        { success: false, message: 'Petugas tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
