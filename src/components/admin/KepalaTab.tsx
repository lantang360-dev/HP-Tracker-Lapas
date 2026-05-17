'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  Shield,
  Plus,
  X,
  Loader2,
  User,
  Key,
  Lock,
  Building2,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
// ScrollArea removed - using native overflow-y-auto for reliable mobile scrolling
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { KepalaAccount } from '@/types'
import { getCached, setCached } from '@/lib/apiCache'

export function KepalaTab() {
  const [kepalaList, setKepalaList] = useState<KepalaAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formNip, setFormNip] = useState('')
  const [formDept, setFormDept] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')

  const fetchKepala = useCallback(async () => {
    // Check global cache first (from prefetch)
    const cached = getCached<{ data: KepalaAccount[] }>('/api/kepala')
    if (cached) {
      setKepalaList(cached.data || [])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/kepala', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const data = await res.json()
      setKepalaList(data.data || [])
      setCached('/api/kepala', data)
    } catch {
      toast.error('Gagal memuat data kepala')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKepala() }, [fetchKepala])

  const resetForm = () => {
    setFormName('')
    setFormNip('')
    setFormDept('')
    setFormPosition('')
    setFormPhone('')
    setFormUsername('')
    setFormPassword('')
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formNip.trim() || !formDept.trim() || !formUsername.trim() || !formPassword.trim()) {
      toast.error('Nama, NIP, Departemen, Username, dan Password wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/kepala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          nip: formNip.trim(),
          department: formDept.trim(),
          position: formPosition.trim() || undefined,
          phone: formPhone.trim() || undefined,
          username: formUsername.trim(),
          password: formPassword.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal membuat akun')
      toast.success(data.message || 'Akun Kepala berhasil dibuat!')
      setAddOpen(false)
      resetForm()
      fetchKepala()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat akun')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (kepala: KepalaAccount) => {
    if (!confirm(`Hapus akun Kepala untuk ${kepala.name}?\n\nAkun akan dikembalikan menjadi petugas biasa.`)) return
    setDeletingId(kepala.id)
    try {
      const res = await fetch('/api/kepala', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kepala.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus')
      toast.success(data.message || 'Akun Kepala berhasil dihapus')
      fetchKepala()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Info Card */}
      <div className="px-4 pt-3 pb-2">
        <Card className="border-blue-200 bg-blue-50/80">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                <Shield className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">Akun Kepala</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  Kepala memiliki akses penuh ke seluruh fitur sistem, termasuk dashboard, scan, dan kelola petugas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="py-3 px-4 gap-2">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : kepalaList.length > 0 ? (
          <div className="space-y-2 pb-24">
            {kepalaList.map((k, idx) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="py-3 px-4 gap-0">
                  <CardContent className="p-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
                        <Shield className="h-5 w-5 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{k.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {k.department}{k.position ? ` · ${k.position}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">
                            <Key className="h-2.5 w-2.5 mr-0.5" />
                            {k.username}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            NIP: {k.nip}
                          </span>
                        </div>
                        {k.deviceSession && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Terakhir login: {formatDistanceToNow(new Date(k.deviceSession.lastLogin), { addSuffix: true, locale: idLocale })} · {k.deviceSession.deviceName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(k)}
                        disabled={deletingId === k.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
                        title="Hapus akun kepala"
                      >
                        {deletingId === k.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada akun Kepala</p>
            <p className="text-xs text-muted-foreground mt-1">Tekan + untuk menambahkan</p>
          </div>
        )}
      </div>
      <button
        onClick={() => { resetForm(); setAddOpen(true) }}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
        aria-label="Tambah Akun Kepala"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Kepala Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="px-1 pb-2">
            <SheetTitle className="text-lg">Tambah Akun Kepala</SheetTitle>
            <SheetDescription>Buat akun login baru untuk Kepala</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-1 pb-8 pt-2">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                Akun Kepala akan memiliki akses penuh ke seluruh fitur sistem termasuk dashboard, scan HP, dan kelola data petugas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-name">Nama Lengkap *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-name" placeholder="Nama lengkap kepala" value={formName} onChange={(e) => setFormName(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-nip">NIP *</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-nip" placeholder="NIP" value={formNip} onChange={(e) => setFormNip(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-dept">Departemen *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-dept" placeholder="Nama departemen" value={formDept} onChange={(e) => setFormDept(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-position">Jabatan</Label>
              <Input id="kepala-position" placeholder="Jabatan (opsional)" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="h-11" disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-phone">No. Telepon</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-phone" placeholder="08xxxxxxxxxx" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="kepala-username">Username *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-username" placeholder="Username login" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kepala-password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="kepala-password" type="password" placeholder="Password login" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="pl-9 h-11" disabled={submitting} />
              </div>
            </div>
            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Buat Akun Kepala</>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
