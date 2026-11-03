import type { Card, CardProgress, LearnMemory, ProgressMap, Side } from './types'
import { shuffle } from './util'
import { check, type Verdict } from './grade'

export type LearnGoal = 'familiarity' | 'understanding' | 'mastery'
export type Familiarity = 'new' | 'some' | 'most'
export type QuestionKind = 'mc' | 'written'
const DAY = 86_400_000

// Rule-based approximation of Quizlet's published recall signals, not its trained model.
// https://quizlet.com/blog/spaced-repetition-for-all-cognitive-science-meets-big-data-in-a-procrastinating-world
function contentKey(card: Card) {
  let hash = 2166136261
  for (const char of card.term + '\0' + card.definition) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619)
  return hash >>> 0
}

export function memoryFor(card: Card, p: CardProgress | undefined, side: Side): LearnMemory | undefined {
  const memory = p?.learn?.[side]
  return memory?.content === contentKey(card) ? memory : undefined
}

export function recallScore(memory: LearnMemory | undefined, now = Date.now()) {
  if (!memory) return 0.45
  const confidence = memory.correct ? Math.min(0.98, 0.82 + memory.streak * 0.04) : 0.2
  return confidence * 2 ** (-Math.max(0, now - memory.last) / Math.max(60_000, memory.stability))
}

export function meetsGoal(memory: LearnMemory | undefined, goal: LearnGoal, now = Date.now()) {
  if (!memory || recallScore(memory, now) < 0.75) return false
  return goal === 'familiarity' ? memory.streak >= 2 : memory.writtenStreak >= (goal === 'mastery' ? 3 : 2)
}

export function questionKind(
  memory: LearnMemory | undefined,
  familiarity: Familiarity,
  p?: CardProgress,
  goal: LearnGoal = 'understanding',
): QuestionKind {
  if (goal === 'familiarity') return 'mc'
  if (memory) return memory.streak > 0 ? 'written' : 'mc'
  return familiarity === 'most' || (familiarity === 'some' && (p?.reps ?? 0) > 0) ? 'written' : 'mc'
}

export function gradeLearnAnswer(given: string, expected: string, goal: LearnGoal): Verdict {
  if (goal !== 'mastery') return check(given, expected)
  const normalize = (value: string) => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
  const options = [expected, ...expected.split(/;|\s\/\s|\bor\b/)]
  return given.trim() && options.some((option) => normalize(option) === normalize(given))
    ? 'correct'
    : 'wrong'
}

export function answerMemory(
  card: Card,
  memory: LearnMemory | undefined,
  kind: QuestionKind,
  correct: boolean,
  now = Date.now(),
): LearnMemory {
  const streak = correct ? (memory?.streak ?? 0) + 1 : 0
  const writtenStreak = correct && kind === 'written' ? (memory?.writtenStreak ?? 0) + 1 : 0
  // Wider gaps make a successful recall more informative; immediate retries add less stability.
  const gap = memory ? Math.max(0, now - memory.last) : 0
  const base = kind === 'written' ? DAY : 10 * 60_000
  const stability = correct
    ? Math.min(30 * DAY, Math.max(base, (memory?.stability ?? 0) * 1.8 + Math.min(gap, 7 * DAY)))
    : Math.max(60_000, (memory?.stability ?? base) * 0.35)
  return {
    content: contentKey(card),
    attempts: (memory?.attempts ?? 0) + 1,
    misses: (memory?.misses ?? 0) + (correct ? 0 : 1),
    streak,
    writtenStreak,
    last: now,
    correct,
    stability,
  }
}

export function learningRound(
  cards: Card[],
  map: ProgressMap,
  side: Side,
  goal: LearnGoal,
  now = Date.now(),
  size = 7,
): Card[] {
  const pending = cards.filter((card) => !meetsGoal(memoryFor(card, map[card.id], side), goal, now))
  const practiced = shuffle(pending.filter((card) => memoryFor(card, map[card.id], side))).sort(
    (a, b) =>
      recallScore(memoryFor(a, map[a.id], side), now) - recallScore(memoryFor(b, map[b.id], side), now),
  )
  const fresh = shuffle(pending.filter((card) => !memoryFor(card, map[card.id], side)))
  const picked: Card[] = []
  // Mix new material into practice without letting a large set postpone all written recall.
  while (picked.length < size && (practiced.length || fresh.length)) {
    for (let n = 0; n < 2 && picked.length < size && practiced.length; n++) picked.push(practiced.shift()!)
    if (picked.length < size && fresh.length) picked.push(fresh.shift()!)
  }
  return picked
}
