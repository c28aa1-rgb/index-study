import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { page, paper, snap } from '../lib/motion'
import type { Level } from '../lib/srs'

type BtnProps = HTMLMotionProps<'button'> & {
  tone?: 'ink' | 'paper' | 'ghost' | 'danger' | 'marker'
  size?: 'sm' | 'md' | 'lg'
}

const tones = {
  ink: 'bg-ink text-white hover:bg-ink-2 shadow-[0_3px_0_#0a1226]',
  paper: 'bg-paper text-ink border-2 border-ink hover:bg-desk shadow-[0_3px_0_var(--color-ink)]',
  ghost: 'text-ink-2 hover:bg-desk-2 hover:text-ink',
  danger: 'bg-paper text-margin border-2 border-margin hover:bg-margin hover:text-white',
  marker: 'bg-marker text-ink border-2 border-ink shadow-[0_3px_0_var(--color-ink)] hover:brightness-95',
}
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5', lg: 'h-14 px-7 text-lg' }

export function Button({ tone = 'ink', size = 'md', className = '', children, ...rest }: BtnProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ y: 2, scale: 0.98, boxShadow: '0 1px 0 rgba(0,0,0,0)' }}
      transition={snap}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none select-none ${tones[tone]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      variants={page}
      initial="initial"
      animate="enter"
      exit="exit"
      className={`mx-auto w-full max-w-5xl px-4 sm:px-6 pb-24 ${className}`}
    >
      {children}
    </motion.main>
  )
}

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const title = ref.current?.querySelector('h2')
    if (title) title.id = titleId
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) || [],
      )
    const frame = requestAnimationFrame(() =>
      (
        focusable().find((el) => el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') ||
        focusable()[0] ||
        ref.current
      )?.focus(),
    )
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        const nodes = focusable()
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (!first) {
          e.preventDefault()
          ref.current?.focus()
          return
        }
        if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', h)
      document.body.style.overflow = oldOverflow
      previous?.focus()
    }
  }, [open, titleId])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: paper }}
            exit={{ y: 24, opacity: 0, transition: { duration: 0.16 } }}
            className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-paper p-6 shadow-lift`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Bar({
  value,
  className = '',
  color = 'bg-ink',
}: {
  value: number
  className?: string
  color?: string
}) {
  return (
    <div className={`h-2 rounded-full bg-desk-2 overflow-hidden ${className}`}>
      <motion.div
        className={`h-full origin-left rounded-full ${color}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={paper}
      />
    </div>
  )
}

const levelColor: Record<Level, string> = {
  new: 'bg-desk-2',
  learning: 'bg-margin',
  familiar: 'bg-marker',
  mastered: 'bg-mastered',
}

export function MasteryStrip({ counts, total }: { counts: Record<Level, number>; total: number }) {
  const order: Level[] = ['mastered', 'familiar', 'learning', 'new']
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-desk-2">
        {order.map((l) => (
          <motion.div
            key={l}
            className={levelColor[l]}
            initial={{ width: 0 }}
            animate={{ width: `${total ? (counts[l] / total) * 100 : 0}%` }}
            transition={paper}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {order.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-sm ${levelColor[l]} ${l === 'new' ? 'border border-ink-3/40' : ''}`}
            />
            <span className="capitalize">{l}</span>
            <span className="font-mono">{counts[l]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-24">
      <motion.div
        role="status"
        aria-label="Loading"
        className="h-10 w-14 rounded-md border-2 border-ink bg-paper"
        animate={{ rotateY: [0, 180, 360] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="ruled mx-auto mt-10 max-w-md rounded-xl p-8 pt-4 shadow-card [--head:52px]">
      <h2 className="font-display text-2xl font-bold h-[52px] flex items-center">{title}</h2>
      <p className="mt-3 leading-8 text-ink-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
      <motion.span className="inline-block" whileHover={{ x: -3 }}>
        ←
      </motion.span>
      {label}
    </Link>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  id: string
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-xl bg-desk-2 p-1" role="group">
      {options.map((o) => (
        <button
          type="button"
          aria-pressed={value === o.value}
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`relative min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${value === o.value ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-lg bg-paper shadow-card"
              transition={snap}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-desk-2'}`}
      >
        <motion.span
          className="absolute top-1 h-5 w-5 rounded-full bg-paper shadow"
          animate={{ left: checked ? 24 : 4 }}
          transition={snap}
        />
      </button>
    </label>
  )
}
