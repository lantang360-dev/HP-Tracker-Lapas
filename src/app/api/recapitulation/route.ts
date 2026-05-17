import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Timezone helper: Asia/Makassar (WITA, UTC+8)
function getWIBOffset(date: Date): Date {
  // Use Intl to get WIB date parts, then construct a local Date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const y = get('year')
  const m = get('month')
  const d = get('day')
  const h = get('hour')
  const min = get('minute')
  const s = get('second')
  // hour12:false with Intl can return "24" for midnight in some locales — normalize to "00"
  const hour = h === '24' ? '00' : h
  return new Date(`${y}-${m}-${d}T${hour}:${min}:${s}`)
}

function getTodayWIB(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function formatDateLocal(date: Date): string {
  const wib = getWIBOffset(date)
  const y = wib.getFullYear()
  const m = String(wib.getMonth() + 1).padStart(2, '0')
  const d = String(wib.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeLocal(date: Date): string {
  try {
    if (!date || isNaN(date.getTime())) return '-'
    const wib = getWIBOffset(date)
    if (!wib || isNaN(wib.getTime())) return '-'
    const h = String(wib.getHours()).padStart(2, '0')
    const m = String(wib.getMinutes()).padStart(2, '0')
    if (isNaN(Number(h)) || isNaN(Number(m))) return '-'
    return `${h}:${m}`
  } catch {
    return '-'
  }
}

function formatTanggalIndo(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00+08:00')
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const dayName = days[date.getDay()]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${dayName}, ${day} ${month} ${year}`
}

// Types
interface RecapEntry {
  no: number
  employeeName: string
  department: string
  position: string
  phoneBrand: string
  phoneModel: string
  phoneColor: string
  imei: string
  timeIn: string
  timeOut: string
  status: 'sudah_keluar' | 'masih_di_dalam' | 'data_tidak_lengkap'
}

interface RecapDay {
  date: string
  formattedDate: string
  totalMasuk: number
  totalKeluar: number
  masihDiDalam: number
  entries: RecapEntry[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filterType = searchParams.get('filterType') || 'date'
    const filterValue = searchParams.get('filterValue') || getTodayWIB()

    if (!filterValue) {
      return NextResponse.json(
        { error: 'Parameter filterValue wajib diisi' },
        { status: 400 }
      )
    }

    // Build date range based on filter type (using WIB timezone)
    let startDate: Date
    let endDate: Date

    if (filterType === 'date') {
      const parsed = new Date(filterValue + 'T00:00:00+08:00')
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD' },
          { status: 400 }
        )
      }
      startDate = new Date(filterValue + 'T00:00:00+08:00')
      endDate = new Date(filterValue + 'T23:59:59.999+08:00')
    } else if (filterType === 'month') {
      const [yearStr, monthStr] = filterValue.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      if (!year || !month || month < 1 || month > 12) {
        return NextResponse.json(
          { error: 'Format bulan tidak valid. Gunakan YYYY-MM' },
          { status: 400 }
        )
      }
      startDate = new Date(Date.UTC(year, month - 1, 1) - 8 * 60 * 60 * 1000)
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999) - 8 * 60 * 60 * 1000)
    } else if (filterType === 'year') {
      const year = parseInt(filterValue, 10)
      if (!year || year < 2000 || year > 2100) {
        return NextResponse.json(
          { error: 'Format tahun tidak valid. Gunakan YYYY' },
          { status: 400 }
        )
      }
      startDate = new Date(Date.UTC(year, 0, 1) - 8 * 60 * 60 * 1000)
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - 8 * 60 * 60 * 1000)
    } else {
      return NextResponse.json(
        { error: 'filterType harus date, month, atau year' },
        { status: 400 }
      )
    }

    // Fetch all check logs within the date range
    const logs = await db.checkLog.findMany({
      where: {
        checkedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            nik: true,
            department: true,
            position: true,
          },
        },
        phone: {
          select: {
            id: true,
            brand: true,
            model: true,
            imei: true,
            color: true,
          },
        },
      },
      orderBy: { checkedAt: 'asc' },
    })

    // Group logs by date (using WIB timezone)
    const groupedByDate: Record<string, typeof logs> = {}

    for (const log of logs) {
      const dateStr = formatDateLocal(new Date(log.checkedAt))
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = []
      }
      groupedByDate[dateStr].push(log)
    }

    // Build recapitulation data
    const recapDays: RecapDay[] = []
    const sortedDates = Object.keys(groupedByDate).sort()

    for (const dateStr of sortedDates) {
      const dayLogs = groupedByDate[dateStr]

      const phoneLogs: Record<string, typeof dayLogs> = {}
      for (const log of dayLogs) {
        if (!phoneLogs[log.phoneId]) {
          phoneLogs[log.phoneId] = []
        }
        phoneLogs[log.phoneId].push(log)
      }

      const entries: RecapEntry[] = []

      for (const phoneId of Object.keys(phoneLogs)) {
        const pLogs = phoneLogs[phoneId].sort((a, b) =>
          a.checkedAt.getTime() - b.checkedAt.getTime()
        )

        const phone = pLogs[0].phone
        const employee = pLogs[0].employee

        const usedIndices = new Set<number>()
        for (let i = 0; i < pLogs.length; i++) {
          if (usedIndices.has(i)) continue
          if (pLogs[i].type !== 'check_in') continue

          let checkOutLog = null
          let checkOutIdx = -1
          for (let j = i + 1; j < pLogs.length; j++) {
            if (usedIndices.has(j)) continue
            if (pLogs[j].type === 'check_out') {
              checkOutLog = pLogs[j]
              checkOutIdx = j
              break
            }
          }

          if (checkOutLog) {
            usedIndices.add(i)
            usedIndices.add(checkOutIdx)
            entries.push({
              no: entries.length + 1,
              employeeName: employee.name,
              department: employee.department,
              position: employee.position || '-',
              phoneBrand: phone.brand,
              phoneModel: phone.model,
              phoneColor: phone.color || '-',
              imei: phone.imei,
              timeIn: formatTimeLocal(new Date(pLogs[i].checkedAt)),
              timeOut: formatTimeLocal(new Date(checkOutLog.checkedAt)),
              status: 'sudah_keluar',
            })
          } else {
            usedIndices.add(i)
            entries.push({
              no: entries.length + 1,
              employeeName: employee.name,
              department: employee.department,
              position: employee.position || '-',
              phoneBrand: phone.brand,
              phoneModel: phone.model,
              phoneColor: phone.color || '-',
              imei: phone.imei,
              timeIn: formatTimeLocal(new Date(pLogs[i].checkedAt)),
              timeOut: '-',
              status: 'masih_di_dalam',
            })
          }
        }

        for (let i = 0; i < pLogs.length; i++) {
          if (usedIndices.has(i)) continue
          if (pLogs[i].type === 'check_out') {
            usedIndices.add(i)
            entries.push({
              no: entries.length + 1,
              employeeName: employee.name,
              department: employee.department,
              position: employee.position || '-',
              phoneBrand: phone.brand,
              phoneModel: phone.model,
              phoneColor: phone.color || '-',
              imei: phone.imei,
              timeIn: '-',
              timeOut: formatTimeLocal(new Date(pLogs[i].checkedAt)),
              status: 'data_tidak_lengkap',
            })
          }
        }
      }

      entries.sort((a, b) => {
        if (a.timeIn === '-') return 1
        if (b.timeIn === '-') return -1
        return a.timeIn.localeCompare(b.timeIn)
      })

      entries.forEach((e, idx) => { e.no = idx + 1 })

      const totalMasuk = entries.filter(e => e.timeIn !== '-').length
      const totalKeluar = entries.filter(e => e.timeOut !== '-').length
      const masihDiDalam = entries.filter(e => e.status === 'masih_di_dalam').length

      recapDays.push({
        date: dateStr,
        formattedDate: formatTanggalIndo(dateStr),
        totalMasuk,
        totalKeluar,
        masihDiDalam,
        entries,
      })
    }

    let periodLabel = ''
    if (filterType === 'date') {
      periodLabel = formatTanggalIndo(filterValue)
    } else if (filterType === 'month') {
      const [y, m] = filterValue.split('-')
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ]
      periodLabel = `${monthNames[parseInt(m, 10) - 1]} ${y}`
    } else {
      periodLabel = `Tahun ${filterValue}`
    }

    return NextResponse.json({
      success: true,
      filterType,
      filterValue,
      periodLabel,
      totalDays: recapDays.length,
      days: recapDays,
    })
  } catch (error) {
    console.error('Recapitulation error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat data rekapitulasi' },
      { status: 500 }
    )
  }
}
