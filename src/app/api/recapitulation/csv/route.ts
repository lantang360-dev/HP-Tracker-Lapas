import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filterType = searchParams.get('filterType') || 'date'
    const filterValue = searchParams.get('filterValue') || ''

    if (!filterValue) {
      return NextResponse.json({ error: 'Parameter filterValue wajib diisi' }, { status: 400 })
    }

    // Build date range
    let startDate: Date
    let endDate: Date

    if (filterType === 'date') {
      const parsed = new Date(filterValue + 'T00:00:00')
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 })
      }
      startDate = new Date(parsed); startDate.setHours(0, 0, 0, 0)
      endDate = new Date(parsed); endDate.setHours(23, 59, 59, 999)
    } else if (filterType === 'month') {
      const [yearStr, monthStr] = filterValue.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      if (!year || !month || month < 1 || month > 12) {
        return NextResponse.json({ error: 'Format bulan tidak valid' }, { status: 400 })
      }
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
      endDate = new Date(year, month, 0, 23, 59, 59, 999)
    } else if (filterType === 'year') {
      const year = parseInt(filterValue, 10)
      if (!year || year < 2000 || year > 2100) {
        return NextResponse.json({ error: 'Format tahun tidak valid' }, { status: 400 })
      }
      startDate = new Date(year, 0, 1, 0, 0, 0, 0)
      endDate = new Date(year, 11, 31, 23, 59, 59, 999)
    } else {
      return NextResponse.json({ error: 'filterType harus date, month, atau year' }, { status: 400 })
    }

    const logs = await db.checkLog.findMany({
      where: { checkedAt: { gte: startDate, lte: endDate } },
      include: {
        employee: { select: { name: true, department: true, position: true } },
        phone: { select: { brand: true, model: true, imei: true, color: true } },
      },
      orderBy: { checkedAt: 'asc' },
    })

    // Group by date
    const groupedByDate: Record<string, typeof logs> = {}
    for (const log of logs) {
      const dateStr = formatDateLocal(new Date(log.checkedAt))
      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = []
      groupedByDate[dateStr].push(log)
    }

    // Build period label
    let periodLabel = ''
    if (filterType === 'date') {
      periodLabel = formatTanggalIndo(filterValue)
    } else if (filterType === 'month') {
      const [y, m] = filterValue.split('-')
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
      periodLabel = `${monthNames[parseInt(m, 10) - 1]} ${y}`
    } else {
      periodLabel = `Tahun ${filterValue}`
    }

    // Build CSV
    const lines: string[] = []
    lines.push('REKAPITULASI PENDATAAN HANDPHONE')
    lines.push(`Periode: ${periodLabel}`)
    lines.push('')
    lines.push('No,Tanggal,Nama Petugas,Departemen,Jabatan,Merk HP,Model HP,Warna HP,IMEI,Jam Masuk,Jam Keluar,Status')

    let no = 1
    const sortedDates = Object.keys(groupedByDate).sort()
    for (const dateStr of sortedDates) {
      const dayLogs = groupedByDate[dateStr]
      const phoneLogs: Record<string, typeof dayLogs> = {}
      for (const log of dayLogs) {
        if (!phoneLogs[log.phoneId]) phoneLogs[log.phoneId] = []
        phoneLogs[log.phoneId].push(log)
      }

      for (const phoneId of Object.keys(phoneLogs)) {
        const pLogs = phoneLogs[phoneId].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())
        const phone = pLogs[0].phone
        const employee = pLogs[0].employee
        const usedIndices = new Set<number>()

        for (let i = 0; i < pLogs.length; i++) {
          if (usedIndices.has(i) || pLogs[i].type !== 'check_in') continue
          let checkOutLog = null
          let checkOutIdx = -1
          for (let j = i + 1; j < pLogs.length; j++) {
            if (usedIndices.has(j)) continue
            if (pLogs[j].type === 'check_out') {
              checkOutLog = pLogs[j]; checkOutIdx = j; break
            }
          }
          if (checkOutLog) {
            usedIndices.add(i); usedIndices.add(checkOutIdx)
            lines.push(`${no},"${formatTanggalIndo(dateStr)}","${employee.name}","${employee.department}","${employee.position || '-'}","${phone.brand}","${phone.model}","${phone.color || '-'}","${phone.imei}","${formatTimeLocal(new Date(pLogs[i].checkedAt))}","${formatTimeLocal(new Date(checkOutLog.checkedAt))}","Sudah Keluar"`)
            no++
          } else {
            usedIndices.add(i)
            lines.push(`${no},"${formatTanggalIndo(dateStr)}","${employee.name}","${employee.department}","${employee.position || '-'}","${phone.brand}","${phone.model}","${phone.color || '-'}","${phone.imei}","${formatTimeLocal(new Date(pLogs[i].checkedAt))}","-","Masih Di Dalam"`)
            no++
          }
        }
        for (let i = 0; i < pLogs.length; i++) {
          if (usedIndices.has(i) || pLogs[i].type !== 'check_out') continue
          usedIndices.add(i)
          lines.push(`${no},"${formatTanggalIndo(dateStr)}","${employee.name}","${employee.department}","${employee.position || '-'}","${phone.brand}","${phone.model}","${phone.color || '-'}","${phone.imei}","-","${formatTimeLocal(new Date(pLogs[i].checkedAt))}","Data Tidak Lengkap"`)
          no++
        }
      }
    }

    if (no === 1) {
      lines.push(',,,Tidak ada data untuk periode ini,,,,,,')
    }

    lines.push('')
    lines.push(`Total: ${no - 1} data`)
    lines.push(`Dicetak pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}`)

    const csv = lines.join('\n')
    const filename = `rekapitulasi_hp_${filterType}_${filterValue}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Gagal mengunduh CSV' }, { status: 500 })
  }
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeLocal(date: Date): string {
  try {
    if (!date || isNaN(date.getTime())) return '-'
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    if (isNaN(Number(h)) || isNaN(Number(m))) return '-'
    return `${h}:${m}`
  } catch {
    return '-'
  }
}

function formatTanggalIndo(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}
