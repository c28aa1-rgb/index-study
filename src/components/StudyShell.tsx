import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar } from './ui'
import { page } from '../lib/motion'

export function StudyShell({
  setId,
  title,
  mode,
  progress,
  right,
  children,
}: {
  setId: string
  title: string
  mode: string
  progress?: number
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.div variants={page} initial="initial" animate="enter" exit="exit" className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-desk/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <span className="shrink-0 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-widest text-white">
            {mode}
          </span>
          <span className="min-w-0 truncate font-display font-bold">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            {right}
            <Link
              to={`/set/${setId}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xl text-ink-2 hover:bg-desk-2 hover:text-ink"
              aria-label="Close and go back to set"
            >
              ×
            </Link>
          </div>
        </div>
        {progress !== undefined && <Bar value={progress} className="h-1 rounded-none" color="bg-margin" />}
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">{children}</main>
    </motion.div>
  )
}
