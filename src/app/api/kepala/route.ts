import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET - List all kepala accounts
 */
export async function GET() {
  try {
    const kepalaList = await db.employee.findMany({
      where: { role: 'kepala' },
      include: {
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: kepalaList.map((k) => ({
        id: k.id,
        name: k.name,
        nip: k.nik,
        department: k.department,
        position: k.position,
        username: k.username,
        phone: k.phone,
        createdAt: k.createdAt,
        deviceSession: k.deviceSessions[0] ? {
          deviceName: k.deviceSessions[0].deviceName,
          lastLogin: k.deviceSessions[0].lastLogin,
        } : null,
      })),
    })
  } catch (error) {
    console.error('Get kepala error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memuat data kepala' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new kepala account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, nip, department, position, phone, username, password } = body

    if (!name || !nip || !department || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Nama, NIP, Departemen, Username, dan Password wajib diisi' },
        { status: 400 }
      )
    }

    // Check duplicate NIP
    const existingNik = await db.employee.findUnique({ where: { nik: nip } })
    if (existingNik) {
      return NextResponse.json(
        { success: false, message: 'NIP sudah terdaftar' },
        { status: 409 }
      )
    }

    // Check duplicate username
    const existingUsername = await db.employee.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json(
        { success: false, message: 'Username sudah digunakan' },
        { status: 409 }
      )
    }

    const kepala = await db.employee.create({
      data: {
        name,
        nik: nip,
        department,
        position: position || 'Kepala',
        phone: phone || null,
        username,
        password,
        role: 'kepala',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Akun Kepala untuk ${name} berhasil dibuat!`,
      data: {
        id: kepala.id,
        name: kepala.name,
        username: kepala.username,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create kepala error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat akun kepala' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a kepala account (change role back to employee)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID wajib diisi' },
        { status: 400 }
      )
    }

    const kepala = await db.employee.findUnique({ where: { id } })
    if (!kepala || kepala.role !== 'kepala') {
      return NextResponse.json(
        { success: false, message: 'Akun kepala tidak ditemukan' },
        { status: 404 }
      )
    }

    // Downgrade to employee and remove credentials
    await db.employee.update({
      where: { id },
      data: {
        role: 'employee',
        username: null,
        password: null,
      },
    })

    // Deactivate device sessions
    await db.deviceSession.updateMany({
      where: { employeeId: id, isActive: true },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: `Akun Kepala ${kepala.name} berhasil dihapus`,
    })
  } catch (error) {
    console.error('Delete kepala error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus akun kepala' },
      { status: 500 }
    )
  }
}
