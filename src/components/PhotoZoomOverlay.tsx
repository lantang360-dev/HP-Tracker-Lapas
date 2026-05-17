'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Reusable fullscreen photo zoom overlay.
 * Shows a fullscreen image when photo is non-null, dismissed by tapping outside.
 */
export function PhotoZoomOverlay({
  photo,
  onClose,
}: {
  photo: string | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative max-w-sm w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photo}
              alt="Foto HP"
              className="w-full rounded-2xl shadow-2xl"
              style={{ maxHeight: '75vh', objectFit: 'contain' }}
            />
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-center text-white/60 text-xs mt-3 select-none">
              Ketuk area luar untuk menutup
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
