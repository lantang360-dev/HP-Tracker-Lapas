'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Smartphone,
  Search,
  Plus,
  X,
  Loader2,
  QrCode,
  Camera,
  Pencil,
  ImagePlus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
// ScrollArea removed - using native overflow-y-auto for reliable mobile scrolling
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PhoneRegistration, Employee } from '@/types'
import { PhotoZoomOverlay } from '@/components/PhotoZoomOverlay'
import { getCached, setCached } from '@/lib/apiCache'

// ============================================================
// Image compression utility
// ============================================================
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX_WIDTH = 400
        let { width, height } = img
        if (width > MAX_WIDTH) {
          const ratio = MAX_WIDTH / width
          width = MAX_WIDTH
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ============================================================
// Phone type options
// ============================================================
const PHONE_TYPE_OPTIONS = ['Smartphone', 'Tablet', 'Feature Phone', 'PDA', 'Lainnya']

// ============================================================
// Photo upload area component
// ============================================================
function PhotoUploadArea({
  photo,
  onPhotoChange,
  onPhotoRemove,
}: {
  photo: string | null
  onPhotoChange: (dataUrl: string) => void
  onPhotoRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      onPhotoChange(compressed)
    } catch {
      toast.error('Gagal memproses foto')
    }
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <Label>Foto HP</Label>
      <div
        className="relative flex items-center justify-center w-32 h-32 mx-auto rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 cursor-pointer overflow-hidden transition-colors hover:border-emerald-500/50 hover:bg-emerald-50/50"
        onClick={() => inputRef.current?.click()}
      >
        {photo ? (
          <>
            <img
              src={photo}
              alt="Foto HP"
              className="w-full h-full object-cover rounded-2xl"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPhotoRemove()
              }}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              aria-label="Hapus foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Camera className="h-7 w-7" />
            <span className="text-[10px] font-medium">Tap untuk foto</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

// ============================================================
// Main component
// ============================================================
export function PhoneListTab() {
  const [phones, setPhones] = useState<PhoneRegistration[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState<PhoneRegistration | null>(null)
  const [qrSvg, setQrSvg] = useState<string>('')
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false)
  const [credEmployeeId, setCredEmployeeId] = useState('')
  const [credEmployeeName, setCredEmployeeName] = useState('')
  const [credUsername, setCredUsername] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credExistingUsername, setCredExistingUsername] = useState<string | null>(null)
  const [credSubmitting, setCredSubmitting] = useState(false)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editPhone, setEditPhone] = useState<PhoneRegistration | null>(null)
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editPhoneType, setEditPhoneType] = useState('Smartphone')
  const [editImei, setEditImei] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editPhoto, setEditPhoto] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Photo zoom state
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePhone, setDeletePhone] = useState<PhoneRegistration | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Registration form
  const [formEmployee, setFormEmployee] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formPhoneType, setFormPhoneType] = useState('Smartphone')
  const [formImei, setFormImei] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formPhoto, setFormPhoto] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchPhones = useCallback(async () => {
    // Check global cache first (from prefetch)
    const cached = getCached<PhoneRegistration[]>('/api/phones')
    if (cached) {
      setPhones(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/phones', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat daftar HP')
      const data: PhoneRegistration[] = await res.json()
      setPhones(data)
      setCached('/api/phones', data)
    } catch {
      toast.error('Gagal memuat daftar HP')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    // Check global cache first (deduplicate with EmployeesTab)
    const cached = getCached<Employee[]>('/api/employees')
    if (cached) {
      setEmployees(cached)
      return
    }
    try {
      const res = await fetch('/api/employees', { cache: 'no-store' })
      if (!res.ok) return
      const data: Employee[] = await res.json()
      setEmployees(data)
      setCached('/api/employees', data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchPhones()
    fetchEmployees()
  }, [fetchPhones, fetchEmployees])

  const filteredPhones = phones.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.employee.name.toLowerCase().includes(q) ||
      `${p.brand} ${p.model}`.toLowerCase().includes(q) ||
      p.imei.toLowerCase().includes(q) ||
      p.employee.department.toLowerCase().includes(q) ||
      (p.phoneType || '').toLowerCase().includes(q)
    )
  })

  const handleRegister = async () => {
    if (!formEmployee || !formBrand || !formModel || !formImei) {
      toast.error('Mohon lengkapi semua field wajib')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formEmployee,
          brand: formBrand,
          model: formModel,
          phoneType: formPhoneType,
          imei: formImei,
          color: formColor || undefined,
          phonePhoto: formPhoto || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal mendaftarkan HP')
      }
      toast.success('HP berhasil didaftarkan!')

      // Open credentials dialog for the employee
      const emp = employees.find((e) => e.id === formEmployee)
      if (emp) {
        openCredentialsDialog(emp.id, emp.name, emp.username || null)
      }

      setRegisterOpen(false)
      resetForm()
      fetchPhones()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mendaftarkan HP')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormEmployee('')
    setFormBrand('')
    setFormModel('')
    setFormPhoneType('Smartphone')
    setFormImei('')
    setFormColor('')
    setFormPhoto(null)
  }

  const handleShowQr = async (phone: PhoneRegistration) => {
    setSelectedPhone(phone)
    setQrDialogOpen(true)
    setQrSvg('')
    try {
      const res = await fetch(`/api/phones/${phone.id}/qrcode`)
      if (res.ok) {
        const svgText = await res.text()
        setQrSvg(svgText)
      }
    } catch {
      setQrSvg('')
    }
  }

  // ============================================================
  // Edit phone logic
  // ============================================================
  const openEditDialog = (phone: PhoneRegistration) => {
    setEditPhone(phone)
    setEditBrand(phone.brand)
    setEditModel(phone.model)
    setEditPhoneType(phone.phoneType || 'Smartphone')
    setEditImei(phone.imei)
    setEditColor(phone.color || '')
    setEditPhoto(phone.phonePhoto || null)
    setEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editPhone || !editBrand || !editModel || !editImei) {
      toast.error('Mohon lengkapi semua field wajib')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/phones/${editPhone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: editBrand,
          model: editModel,
          phoneType: editPhoneType,
          imei: editImei,
          color: editColor || undefined,
          phonePhoto: editPhoto,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal memperbarui HP')
      }
      toast.success('Data HP berhasil diperbarui!')
      setEditDialogOpen(false)
      fetchPhones()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui HP')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ============================================================
  // Delete phone logic
  // ============================================================
  const openDeleteDialog = (phone: PhoneRegistration) => {
    setDeletePhone(phone)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletePhone) return
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/phones/${deletePhone.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menghapus HP')
      }
      toast.success('HP berhasil dihapus dari sistem')
      setDeleteDialogOpen(false)
      setDeletePhone(null)
      fetchPhones()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus HP')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const openCredentialsDialog = (empId: string, empName: string, existingUsername: string | null) => {
    setCredEmployeeId(empId)
    setCredEmployeeName(empName)
    setCredUsername(existingUsername || '')
    setCredPassword('')
    setCredExistingUsername(existingUsername)
    setCredentialsDialogOpen(true)
  }

  const handleSaveCredentials = async () => {
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
          employeeId: credEmployeeId,
          username: credUsername.trim(),
          password: credPassword.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan kredensial')
      toast.success(data.message || 'Kredensial berhasil disimpan!')
      setCredentialsDialogOpen(false)
      fetchEmployees()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kredensial')
    } finally {
      setCredSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari petugas atau HP..."
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

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="py-3 px-4 gap-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPhones.length > 0 ? (
          <div className="space-y-2 pb-24">
            {filteredPhones.map((phone) => (
              <motion.div
                key={phone.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="py-3 px-3.5 gap-0">
                  <CardContent className="p-0">
                    <div className="flex items-start gap-2.5">
                      {/* Photo or icon - clickable for zoom */}
                      <div
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-lg bg-muted shrink-0 overflow-hidden',
                          phone.phonePhoto && 'cursor-pointer active:scale-[0.96] transition-transform border border-emerald-200'
                        )}
                        onClick={() => phone.phonePhoto && setZoomPhoto(phone.phonePhoto)}
                      >
                        {phone.phonePhoto ? (
                          <img
                            src={phone.phonePhoto}
                            alt={`${phone.brand} ${phone.model}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{phone.employee.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {phone.employee.department}
                          {phone.employee.position ? ` · ${phone.employee.position}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {phone.brand} {phone.model}
                          {phone.color ? ` · ${phone.color}` : ''}
                        </p>
                        {/* Phone type badge */}
                        {phone.phoneType && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[10px] px-1.5 py-0 h-4 font-normal border-muted-foreground/25 text-muted-foreground"
                          >
                            {phone.phoneType}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge
                          variant={phone.status === 'active' ? 'default' : 'secondary'}
                          className={cn('text-[10px] px-1.5 py-0', phone.status === 'active' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100')}
                        >
                          {phone.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShowQr(phone)}>
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(phone)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => openDeleteDialog(phone)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Smartphone className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Tidak ditemukan HP yang cocok' : 'Belum ada HP terdaftar'}
            </p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { resetForm(); setRegisterOpen(true) }}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
        aria-label="Tambah HP Baru"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Registration Sheet */}
      <Sheet open={registerOpen} onOpenChange={setRegisterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          <SheetHeader className="px-1">
            <SheetTitle className="text-lg">Daftar HP Baru</SheetTitle>
            <SheetDescription>Tambahkan handphone baru ke sistem tracking</SheetDescription>
          </SheetHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4 px-1 pb-4 pt-2">
              {/* Photo Upload */}
              <PhotoUploadArea
                photo={formPhoto}
                onPhotoChange={setFormPhoto}
                onPhotoRemove={() => setFormPhoto(null)}
              />

              <div className="space-y-2">
                <Label htmlFor="employee">Petugas *</Label>
                <Select value={formEmployee} onValueChange={setFormEmployee}>
                  <SelectTrigger className="w-full h-11" id="employee">
                    <SelectValue placeholder="Pilih petugas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex flex-col">
                          <span className="text-sm">{emp.name}</span>
                          <span className="text-xs text-muted-foreground">{emp.department}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="brand">Merk *</Label>
                  <Input id="brand" placeholder="Samsung" value={formBrand} onChange={(e) => setFormBrand(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input id="model" placeholder="Galaxy S24" value={formModel} onChange={(e) => setFormModel(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phonetype">Tipe HP</Label>
                <Select value={formPhoneType} onValueChange={setFormPhoneType}>
                  <SelectTrigger className="w-full h-11" id="phonetype">
                    <SelectValue placeholder="Pilih tipe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI *</Label>
                <Input id="imei" placeholder="350000000000000" value={formImei} onChange={(e) => setFormImei(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Warna</Label>
                <Input id="color" placeholder="Hitam" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="h-11" />
              </div>
              <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={handleRegister} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Daftarkan HP'
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              Hapus HP
            </DialogTitle>
            <DialogDescription className="pt-2">
              Yakin ingin menghapus HP berikut dari sistem?
            </DialogDescription>
          </DialogHeader>
          {deletePhone && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">{deletePhone.brand} {deletePhone.model}</p>
              <p className="text-xs text-muted-foreground">Pemilik: {deletePhone.employee.name}</p>
              <p className="text-xs text-muted-foreground">IMEI: {deletePhone.imei}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Catatan: HP yang sedang <strong>check-in</strong> tidak bisa dihapus.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteSubmitting} className="flex-1">
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting} className="flex-1">
              {deleteSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Menghapus...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-1.5" />Hapus</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Phone Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data HP</DialogTitle>
            <DialogDescription>
              {editPhone ? `${editPhone.brand} ${editPhone.model} - ${editPhone.employee.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photo */}
            <PhotoUploadArea
              photo={editPhoto}
              onPhotoChange={setEditPhoto}
              onPhotoRemove={() => setEditPhoto(null)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-brand">Merk *</Label>
                <Input id="edit-brand" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model *</Label>
                <Input id="edit-model" value={editModel} onChange={(e) => setEditModel(e.target.value)} className="h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phonetype">Tipe HP</Label>
              <Select value={editPhoneType} onValueChange={setEditPhoneType}>
                <SelectTrigger className="w-full h-11" id="edit-phonetype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-imei">IMEI *</Label>
              <Input id="edit-imei" value={editImei} onChange={(e) => setEditImei(e.target.value)} className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-color">Warna</Label>
              <Input id="edit-color" placeholder="Hitam" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSubmitting}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEditSave} disabled={editSubmitting}>
              {editSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code HP</DialogTitle>
            <DialogDescription>
              {selectedPhone ? `${selectedPhone.brand} ${selectedPhone.model} - ${selectedPhone.employee.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            {qrSvg ? (
              <div className="bg-white p-4 rounded-xl shadow-sm" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <Skeleton className="h-48 w-48 rounded-xl" />
            )}
          </div>
          {selectedPhone && (
            <div className="text-center text-xs text-muted-foreground">
              <p>IMEI: {selectedPhone.imei}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo zoom overlay */}
      <PhotoZoomOverlay photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atur Login Petugas</DialogTitle>
            <DialogDescription>
              Set kredensial login untuk {credEmployeeName}
              {credExistingUsername && (
                <Badge variant="secondary" className="ml-2 text-[10px]">Sudah ada login</Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {credExistingUsername && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Username saat ini:</p>
                <p className="text-sm font-medium">{credExistingUsername}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cred-username">Username</Label>
              <Input
                id="cred-username"
                placeholder="username_login"
                value={credUsername}
                onChange={(e) => setCredUsername(e.target.value)}
                className="h-11"
                disabled={credSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-password">Password</Label>
              <Input
                id="cred-password"
                type="password"
                placeholder="Password"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                className="h-11"
                disabled={credSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)} disabled={credSubmitting}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCredentials} disabled={credSubmitting}>
              {credSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
