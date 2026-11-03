export type Card = { id: string; term: string; definition: string }

export type Visibility = 'private' | 'unlisted' | 'public'

export type StudySet = {
  id: string
  title: string
  description: string
  cards: Card[]
  visibility: Visibility
  owner_id: string | null
  author_name: string
  created_at: string
  updated_at: string
}

export type CardProgress = {
  ease: number
  interval: number // days
  due: number // epoch ms
  reps: number
  lapses: number
  last: number
  learn?: Partial<Record<Side, LearnMemory>>
}

export type LearnMemory = {
  content: number
  attempts: number
  misses: number
  streak: number
  writtenStreak: number
  last: number
  correct: boolean
  stability: number // estimated recall half-life in milliseconds
}

export type ProgressMap = Record<string, CardProgress>

export type Side = 'term' | 'definition'
