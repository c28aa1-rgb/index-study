import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { paper } from '../lib/motion'

type T = { id: number; text: string }
let push: (text: string) => void = () => {}
export const toast = (text: string) => push(text)

export function Toaster() {
  const [items, setItems] = useState<T[]>([])
  useEffect(() => {
    push = (text) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { id, text }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2400)
    }
    const onSyncError = () => push('Progress saved in this browser. Cloud sync failed; check your connection.')
    window.addEventListener('di.sync-error', onSyncError)
    return () => {
      push = () => {}
      window.removeEventListener('di.sync-error', onSyncError)
    }
  }, [])
  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: 24, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: paper }}
            exit={{ y: 10, opacity: 0, transition: { duration: 0.15 } }}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lift"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
