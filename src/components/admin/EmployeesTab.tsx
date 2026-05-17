'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  Users,
  Search,
  Plus,
  X,
  Loader2,
  User,
  Building2,
  Smartphone,
  Shield,
  Key,
  RefreshCw,
  MonitorSmartphone,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { Employee } from '@/types'
import { formatDateTime } from '@/lib/format-utils'
import { getCached, setCached, invalidateCache } from '@/lib/apiCache'

export function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [credDialogOpen, setCredDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [credUsername, setCredUsername] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credSubmitting, setCredSubmitting] = useState(false)
  const [resettingDevice, setResettingDevice] = useState<string | null>(null)

  // Add employee form
  const [addOpen, setAddOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formNip, setFormNip] = useState('')
  const [formDept, setFormDept] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit employee form
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNip, setEditNip] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const fetchEmployees = useCallback(async () => {
    // Check global cache first (deduplicate with PhoneListTab)
    const cached = getCached<Employee[]>('/api/employees')
    if (cached) {
      setEmployees(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/employees', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data petugas')
      const data: Employee[] = await res.json()
      setEmployees(data)
      setCached('/api/employees', data)
    } catch {
      toast.error('Gagal memuat data petugas')
    } finally {
      setLoading(false)
    }
  }, [])

  const resetAddForm = () => {
    setFormName('')
    setFormNip('')
    setFormDept('')
    setFormPosition('')
    setFormPhone('')
  }

  const handleAddEmployee = async () => {
    if (!formName.trim() || !formNip.trim() || !formDept.trim()) {
      toast.error('Nama, NIP, dan Departemen wajib diisi')
      return
    }
    setAddSubmitting(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          nip: formNip.trim(),
          department: formDept.trim(),
          position: formPosition.trim() || undefined,
          phone: formPhone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan petugas')
      toast.success(`Petugas ${formName.trim()} berhasil ditambahkan!`)
      setAddOpen(false)
      resetAddForm()
      invalidateCache()
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambahkan petugas')
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEditDialog = (emp: Employee) => {
    setSelectedEmployee(emp)
    setEditName(emp.name)
    setEditNip(emp.nip)
    setEditDept(emp.department)
    setEditPosition(emp.position || '')
    setEditPhone(emp.phone || '')
    setEditDialogOpen(true)
  }

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return
    if (!editName.trim() || !editNip.trim() || !editDept.trim()) {
      toast.error('Nama, NIP, dan Departemen wajib diisi')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          nip: editNip.trim(),
          department: editDept.trim(),
          position: editPosition.trim() || undefined,
          phone: editPhone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah data petugas')
      toast.success(`Data petugas ${editName.trim()} berhasil diperbarui!`)
      setEditDialogOpen(false)
      setSelectedEmployee(null)
      invalidateCache()
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah data petugas')
    } finally {
      setEditSubmitting(false)
    }
  }

  const openDeleteDialog = (emp: Employee) => {
    setSelectedEmployee(emp)
    setDeleteDialogOpen(true)
  }

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus petugas')
      toast.success(data.message || 'Petugas berhasil dihapus!')
      setDeleteDialogOpen(false)
      setSelectedEmployee(null)
      invalidateCache()
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus petugas')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const filteredEmployees = employees.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.name.toLowerCase().includes(q) ||
      e.nip.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    )
  })

  const openCredentials = (emp: Employee) => {
    setSelectedEmployee(emp)
    setCredUsername(emp.username || '')
    setCredPassword('')
    setCredDialogOpen(true)
  }

  const handleSaveCredentials = async () => {
    if (!selectedEmployee) return
    if (!credUsername.trim() || !credPassword.trim()) {
      toast.error('Username dan password wajib diisi')
      return
    }
    setCredSubmitting(true)
    try {
      const res = await fetch('/api/auth/set-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          username: credUsername.trim(),
          password: credPassword.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan kredensial')
      toast.success(data.message || 'Kredensial berhasil disimpan!')
      setCredDialogOpen(false)
      invalidateCache()
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kredensial')
    } finally {
      setCredSubmitting(false)
    }
  }

  const handleResetDevice = async (empId: string, empName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm(`Reset perangkat untuk ${empName}?\n\nPetugas akan bisa login dari perangkat baru.`)) return
    setResettingDevice(empId)
    try {
      const res = await fetch('/api/auth/device-session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal reset perangkat')
      toast.success(data.message || 'Perangkat berhasil direset!')
      invalidateCache()
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal reset perangkat')
    } finally {
      setResettingDevice(null)
    }
  }

  const getActiveDevice = (emp: Employee) => {
    return emp.deviceSessions?.find((s) => s.isActive)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari petugas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Employee List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="py-3 px-4 gap-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEmployees.length > 0 ? (
          <div className="space-y-2 pb-24">
            {filteredEmployees.map((emp, idx) => {
              const activeDevice = getActiveDevice(emp)
              return (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Card className="py-3 px-4 gap-0 hover:bg-muted/50 transition-colors">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                          <User className="h-5 w-5 text-emerald-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emp.department}
                            {emp.position ? ` · ${emp.position}` : ''}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant={emp.username ? 'default' : 'secondary'}
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                emp.username && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                              )}
                            >
                              {emp.username ? (
                                <><Key className="h-2.5 w-2.5 mr-0.5" /> Login Aktif</>
                              ) : (
                                'Belum Login'
                              )}
                            </Badge>
                            {activeDevice && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600">
                                <MonitorSmartphone className="h-2.5 w-2.5 mr-0.5" />
                                {activeDevice.deviceName}
                              </Badge>
                            )}
                            {emp.phones && emp.phones.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {emp.phones.length} HP
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dropdown Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted shrink-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openCredentials(emp)}>
                              <Shield className="h-4 w-4 mr-2 text-emerald-600" />
                              Atur Login
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(emp)}>
                              <Pencil className="h-4 w-4 mr-2 text-blue-600" />
                              Edit Petugas
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(emp)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus Petugas
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Device info bar */}
                      {activeDevice && emp.username && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-muted pl-[52px]">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <MonitorSmartphone className="h-3 w-3" />
                            <span>Terikat: {activeDevice.deviceName}</span>
                            <span className="text-muted-foreground/60">
                              · {formatDistanceToNow(new Date(activeDevice.lastLogin), { addSuffix: true, locale: idLocale })}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleResetDevice(emp.id, emp.name, e)}
                            disabled={resettingDevice === emp.id}
                            className="text-[10px] text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50 flex items-center gap-0.5"
                            title="Reset perangkat"
                          >
                            {resettingDevice === emp.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Reset
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Tidak ditemukan petugas' : 'Belum ada data petugas'}
            </p>
          </div>
        )}
      </div>

      {/* FAB - Tambah Petugas */}
      <button
        onClick={() => { resetAddForm(); setAddOpen(true) }}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
        aria-label="Tambah Petugas Baru"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Employee Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="px-1 pb-2">
            <SheetTitle className="text-lg">Tambah Petugas Baru</SheetTitle>
            <SheetDescription>Tambahkan data petugas ke sistem</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-1 pb-8 pt-2">
              <div className="space-y-2">
                <Label htmlFor="emp-name">Nama Lengkap *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="emp-name" placeholder="Masukkan nama lengkap" value={formName} onChange={(e) => setFormName(e.target.value)} className="pl-9 h-11" disabled={addSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-nip">NIP *</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="emp-nip" placeholder="NIP" value={formNip} onChange={(e) => setFormNip(e.target.value)} className="pl-9 h-11" disabled={addSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-dept">Departemen *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="emp-dept" placeholder="Nama departemen" value={formDept} onChange={(e) => setFormDept(e.target.value)} className="pl-9 h-11" disabled={addSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-position">Jabatan</Label>
                <Input id="emp-position" placeholder="Jabatan (opsional)" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="h-11" disabled={addSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-phone">No. Telepon</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="emp-phone" placeholder="08xxxxxxxxxx" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="pl-9 h-11" disabled={addSubmitting} />
                </div>
              </div>
              <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddEmployee} disabled={addSubmitting}>
                {addSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />Tambah Petugas</>
                )}
              </Button>
            </div>
        </SheetContent>
      </Sheet>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Petugas</DialogTitle>
            <DialogDescription>
              {selectedEmployee && (
                <>Ubah data untuk <span className="font-medium text-foreground">{selectedEmployee.name}</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama Lengkap *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-name" placeholder="Masukkan nama lengkap" value={editName} onChange={(e) => setEditName(e.target.value)} className="pl-9 h-11" disabled={editSubmitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nip">NIP *</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-nip" placeholder="NIP" value={editNip} onChange={(e) => setEditNip(e.target.value)} className="pl-9 h-11" disabled={editSubmitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept">Departemen *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-dept" placeholder="Nama departemen" value={editDept} onChange={(e) => setEditDept(e.target.value)} className="pl-9 h-11" disabled={editSubmitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">Jabatan</Label>
              <Input id="edit-position" placeholder="Jabatan (opsional)" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="h-11" disabled={editSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">No. Telepon</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-phone" placeholder="08xxxxxxxxxx" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="pl-9 h-11" disabled={editSubmitting} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSubmitting}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEditEmployee} disabled={editSubmitting}>
              {editSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Petugas</DialogTitle>
            <DialogDescription>
              {selectedEmployee && (
                <>
                  Yakin ingin menghapus <span className="font-medium text-foreground">{selectedEmployee.name}</span> dari sistem?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Nama: <span className="text-foreground font-medium">{selectedEmployee.name}</span></p>
              <p className="text-xs text-muted-foreground">NIP: <span className="text-foreground font-medium">{selectedEmployee.nip}</span></p>
              <p className="text-xs text-muted-foreground">Departemen: <span className="text-foreground font-medium">{selectedEmployee.department}</span></p>
              {selectedEmployee.phones && selectedEmployee.phones.length > 0 && (
                <p className="text-xs text-destructive font-medium mt-1">
                  ⚠️ Petugas ini memiliki {selectedEmployee.phones.length} HP terdaftar. Hapus HP terlebih dahulu di tab Daftar HP.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteSubmitting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteEmployee} disabled={deleteSubmitting}>
              {deleteSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menghapus...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Hapus</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atur Login Petugas</DialogTitle>
            <DialogDescription>
              {selectedEmployee && (
                <>Set kredensial login untuk <span className="font-medium text-foreground">{selectedEmployee.name}</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-xs text-muted-foreground">NIP: {selectedEmployee.nip}</p>
                <p className="text-xs text-muted-foreground">Departemen: {selectedEmployee.department}</p>
                {selectedEmployee.phones && selectedEmployee.phones.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    HP: {selectedEmployee.phones.map((p) => `${p.brand} ${p.model}`).join(', ')}
                  </p>
                )}
              </div>

              {/* Device Binding Info */}
              {(() => {
                const activeDevice = getActiveDevice(selectedEmployee)
                if (!activeDevice || !selectedEmployee.username) return null
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                        <MonitorSmartphone className="h-3.5 w-3.5" />
                        Perangkat Terdaftar
                      </p>
                      <button
                        onClick={() => handleResetDevice(selectedEmployee.id, selectedEmployee.name)}
                        disabled={resettingDevice === selectedEmployee.id}
                        className="text-[10px] text-amber-700 hover:text-amber-800 font-medium disabled:opacity-50 flex items-center gap-0.5"
                      >
                        {resettingDevice === selectedEmployee.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Reset
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-blue-800">
                        <span className="font-medium">{activeDevice.deviceName}</span>
                      </p>
                      <p className="text-[10px] text-blue-600">
                        Terakhir login: {formatDistanceToNow(new Date(activeDevice.lastLogin), { addSuffix: true, locale: idLocale })}
                      </p>
                      <p className="text-[10px] text-blue-600">
                        Terdaftar: {formatDateTime(activeDevice.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {selectedEmployee.username && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700 font-medium">Login sudah diatur</p>
                  <p className="text-xs text-emerald-600">Username: {selectedEmployee.username}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="emp-cred-username">Username</Label>
                <Input
                  id="emp-cred-username"
                  placeholder="username_login"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  className="h-11"
                  disabled={credSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-cred-password">Password Baru</Label>
                <Input
                  id="emp-cred-password"
                  type="password"
                  placeholder="Password baru"
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  className="h-11"
                  disabled={credSubmitting}
                />
                <p className="text-[10px] text-muted-foreground">Wajib diisi untuk mengatur/mengubah password</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredDialogOpen(false)} disabled={credSubmitting}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCredentials} disabled={credSubmitting || !credUsername.trim() || !credPassword.trim()}>
              {credSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                'Simpan Kredensial'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
