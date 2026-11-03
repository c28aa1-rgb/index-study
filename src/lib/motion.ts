import type { Transition, Variants } from 'framer-motion'

// Motion identity: paper cards. Quick, a hair of overshoot, never floaty.
export const snap: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }
export const paper: Transition = { type: 'spring', stiffness: 300, damping: 28 }
export const flip: Transition = { type: 'spring', stiffness: 210, damping: 22 }
export const easeOut = [0.2, 0, 0, 1] as const

export const page: Variants = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.38, ease: easeOut } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.3, 0, 1, 1] } },
}

export const list: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
}

export const item: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: paper },
}

export const shake = { x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.36 } }
