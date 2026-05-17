// ============================================================
// Type Definitions for HP Tracker
// ============================================================

export interface AppUser {
  id: string
  name: string
  nip: string
  department: string
  position: string
  role: 'admin' | 'kepala' | 'employee'
}

export interface Employee {
  id: string
  name: string
  nip: string
  department: string
  position?: string
  phone?: string
  username?: string | null
  password?: string | null
  phones?: PhoneRegistration[]
  deviceSessions?: Array<{
    id: string
    deviceName: string
    deviceId: string
    isActive: boolean
    lastLogin: string
    createdAt: string
  }>
  createdAt?: string
}

export interface PhoneRegistration {
  id: string
  brand: string
  model: string
  phoneType?: string
  imei: string
  color?: string
  phonePhoto?: string
  qrCode: string
  status: string
  employeeId: string
  createdAt?: string
  employee: {
    id: string
    name: string
    nip: string
    department: string
    position?: string
  }
}

export interface DashboardStats {
  totalEmployees: number
  totalPhones: number
  currentlyInside: number
  todayCheckIns: number
  todayCheckOuts: number
  recentLogs: RecentLog[]
}

export interface RecentLog {
  id: string
  type: 'check_in' | 'check_out'
  checkedAt: string
  employee: { name: string; department: string }
  phone: { brand: string; model: string; color?: string; phoneType?: string; phonePhoto?: string }
}

export interface InsidePhone {
  phoneId: string
  phone: { id: string; brand: string; model: string; color?: string; imei: string; phoneType?: string; phonePhoto?: string }
  employee: { id: string; name: string; department: string; position?: string }
  checkedAt: string
}

export interface CheckResult {
  type: 'check_in' | 'check_out'
  checkedAt: string
  employee: { name: string; department: string; position?: string }
  phone: { brand: string; model: string; color?: string; imei: string; phoneType?: string; phonePhoto?: string }
  message?: string
}

export interface HistoryLog {
  id: string
  type: 'check_in' | 'check_out'
  checkedAt: string
  employee: { name: string; department: string }
  phone: { brand: string; model: string; color?: string; phoneType?: string; phonePhoto?: string }
}

export interface HistoryResponse {
  logs: HistoryLog[]
  total: number
  page: number
  totalPages: number
}

export interface EmployeeBarcode {
  success: boolean
  qrCode: string
  date: string
  svgHtml: string
  phone: { brand: string; model: string; imei: string; color?: string; phoneType?: string; phonePhoto?: string }
  employee: { name: string; department: string }
}

export interface DeviceMismatchInfo {
  currentDevice: { name: string; id: string }
  registeredDevice: { name: string; lastLogin: string; registeredAt: string }
  hint: string
}

export interface RecapEntry {
  no: number
  employeeName: string
  department: string
  position: string
  phoneBrand: string
  phoneModel: string
  phoneColor: string
  phoneType?: string
  phonePhoto?: string
  imei: string
  timeIn: string
  timeOut: string
  status: 'sudah_keluar' | 'masih_di_dalam' | 'data_tidak_lengkap'
}

export interface RecapDay {
  date: string
  formattedDate: string
  totalMasuk: number
  totalKeluar: number
  masihDiDalam: number
  entries: RecapEntry[]
}

export interface RecapData {
  success: boolean
  filterType: string
  filterValue: string
  periodLabel: string
  totalDays: number
  days: RecapDay[]
}

export type AdminTabId = 'dashboard' | 'phones' | 'scan' | 'inside' | 'history' | 'employees' | 'kepala'

export interface KepalaAccount {
  id: string
  name: string
  nip: string
  department: string
  position: string | null
  username: string | null
  phone: string | null
  createdAt: string
  deviceSession: { deviceName: string; lastLogin: string } | null
}
