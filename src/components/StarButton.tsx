import { motion } from 'framer-motion'
import { snap } from '../lib/motion'
import { playSound } from '../lib/sound'

export function StarButton({
  starred,
  term,
  onClick,
  disabled,
}: {
  starred: boolean
  term: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      aria-label={`${starred ? 'Unstar' : 'Star'} card: ${term}`}
      aria-pressed={starred}
      title={starred ? 'Unstar card' : 'Star card'}
      disabled={disabled}
      onClick={() => {
        playSound('tap')
        onClick()
      }}
      whileTap={{ scale: 0.85 }}
      transition={snap}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-marker-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60 ${starred ? 'text-ink' : 'text-ink-3'}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={starred ? 'var(--color-marker)' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9Z" />
      </svg>
    </motion.button>
  )
}
