import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'

// Get today's date in Asia/Makassar timezone (WITA, UTC+8)
function getTodayWIB(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now) // Returns yyyy-MM-dd
}

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

    // Use WIB timezone for date calculation
    const today = getTodayWIB()

    // Check if a daily barcode already exists for today
    const existingBarcode = await db.dailyBarcode.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    })

    let qrCodeValue: string

    if (existingBarcode) {
      qrCodeValue = existingBarcode.qrCode
    } else {
      // Find employee's active phone registration
      const activePhone = await db.phoneRegistration.findFirst({
        where: {
          employeeId,
          status: 'active',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (!activePhone) {
        return NextResponse.json(
          { success: false, message: 'Tidak ditemukan ponsel yang aktif untuk petugas ini' },
          { status: 404 }
        )
      }

      // Generate new UUID as QR code
      qrCodeValue = randomUUID()

      // Create daily barcode record
      await db.dailyBarcode.create({
        data: {
          employeeId,
          phoneId: activePhone.id,
          qrCode: qrCodeValue,
          date: today,
        },
      })
    }

    // Generate QR code SVG
    const svgString = await QRCode.toString(qrCodeValue, {
      type: 'svg',
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    return new NextResponse(svgString, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('QR code SVG generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
