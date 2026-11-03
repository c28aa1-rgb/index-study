import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Card, Side } from '../lib/types'
import { sample, shuffle } from '../lib/util'
import { shake, snap } from '../lib/motion'

export const other = (s: Side): Side => (s === 'term' ? 'definition' : 'term')

// Build up to 4 unique options for `card`, answered with `side`.
export function mcOptions(card: Card, pool: Card[], side: Side, n = 4): string[] {
  const right = card[side]
  const seen = new Set([right.trim().toLowerCase()])
  const wrong: string[] = []
  for (const c of shuffle(pool)) {
    const v = c[side]
    const k = v.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    wrong.push(v)
    if (wrong.length === n - 1) break
  }
  return shuffle([right, ...wrong])
}

export function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">{label}</p>
      <p
        className={`mt-3 whitespace-pre-wrap font-semibold leading-snug ${text.length > 90 ? 'text-xl' : 'text-2xl sm:text-3xl'}`}
      >
        {text}
      </p>
    </div>
  )
}

type MCProps = {
  options: string[]
  correct: string
  chosen: string | null
  onChoose: (o: string) => void
  keys?: boolean
  compact?: boolean
}

export function MCOptions({ options, correct, chosen, onChoose, keys = true, compact }: MCProps) {
  useEffect(() => {
    if (!keys) return
    const h = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        document.querySelector('[aria-modal="true"]') ||
        /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      )
        return
      const n = Number(e.key)
      if (n >= 1 && n <= options.length && chosen === null) onChoose(options[n - 1])
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [options, chosen, keys, onChoose])

  return (
    <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {options.map((o, idx) => {
        const answered = chosen !== null
        const isRight = o === correct
        const isPicked = o === chosen
        const cls = !answered
          ? 'border-ink/15 bg-paper hover:border-ink'
          : isRight
            ? 'border-mastered bg-mastered-soft'
            : isPicked
              ? 'border-margin bg-margin/10'
              : 'border-ink/10 bg-paper opacity-50'
        return (
          <motion.button
            key={o + idx}
            disabled={answered}
            onClick={() => onChoose(o)}
            initial={{ opacity: 0, y: 10 }}
            animate={
              answered && isPicked && !isRight
                ? { opacity: 1, y: 0, ...shake }
                : answered && isRight
                  ? { opacity: 1, y: 0, scale: [1, 1.03, 1] }
                  : { opacity: 1, y: 0 }
            }
            transition={{ ...snap, delay: answered ? 0 : idx * 0.04 }}
            whileHover={answered ? undefined : { y: -2 }}
            whileTap={answered ? undefined : { scale: 0.98 }}
            className={`flex min-h-16 items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${cls}`}
          >
            {keys && (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-desk font-mono text-xs font-bold text-ink-3">
                {idx + 1}
              </span>
            )}
            <span className="whitespace-pre-wrap">{o}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function WrittenInput({
  onSubmit,
  disabled,
  onSkip,
  placeholder = 'Type the answer',
  submitLabel = 'Answer',
}: {
  onSubmit: (v: string) => void
  disabled?: boolean
  onSkip?: () => void
  placeholder?: string
  submitLabel?: string
}) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSubmit(v)
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input
        ref={ref}
        aria-label={placeholder}
        disabled={disabled}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="field flex-1 text-lg"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="flex gap-2">
        {onSkip && (
          <button
            type="button"
            disabled={disabled}
            onClick={onSkip}
            className="h-11 rounded-xl px-3 text-sm font-semibold text-ink-3 hover:text-ink"
          >
            Don't know
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={disabled || !v.trim()}
          className="h-11 rounded-xl bg-ink px-5 font-semibold text-white disabled:opacity-30"
        >
          {submitLabel}
        </motion.button>
      </div>
    </form>
  )
}

export { sample }
