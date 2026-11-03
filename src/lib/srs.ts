import type { CardProgress, ProgressMap } from './types'

// SM-2 variant. Rating: 0 = missed, 1 = hard, 2 = good, 3 = easy.
export type Rating = 0 | 1 | 2 | 3
const DAY = 86_400_000

export function fresh(): CardProgress {
  return { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, last: 0 }
}

export function review(p: CardProgress | undefined, rating: Rating, now = Date.now()): CardProgress {
  const c = { ...(p ?? fresh()) }
  if (rating === 0) {
    c.reps = 0
    c.lapses += 1
    c.interval = 0
    c.ease = Math.max(1.3, c.ease - 0.2)
    c.due = now + 10 * 60_000 // back in 10 minutes
  } else {
    const q = rating + 2 // map to SM-2 quality 3..5
    c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    c.reps += 1
    if (c.reps === 1) c.interval = rating === 3 ? 3 : 1
    else if (c.reps === 2) c.interval = rating === 1 ? 3 : 6
    else c.interval = Math.round(c.interval * c.ease * (rating === 1 ? 0.8 : rating === 3 ? 1.3 : 1))
    c.due = now + c.interval * DAY
  }
  c.last = now
  return c
}

export type Level = 'new' | 'learning' | 'familiar' | 'mastered'

export function level(p: CardProgress | undefined): Level {
  if (!p || p.last === 0) return 'new'
  if (p.reps === 0) return 'learning'
  if (p.interval >= 6) return 'mastered'
  return 'familiar'
}

export function isDue(p: CardProgress | undefined, now = Date.now()) {
  return !!p && p.last > 0 && p.due <= now
}

export function summary(ids: string[], map: ProgressMap) {
  const out = { new: 0, learning: 0, familiar: 0, mastered: 0, due: 0 }
  for (const id of ids) {
    out[level(map[id])]++
    if (isDue(map[id])) out.due++
  }
  return out
}
