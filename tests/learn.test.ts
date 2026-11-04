import { describe, expect, it } from 'vitest'
import {
  answerMemory,
  gradeLearnAnswer,
  learningRound,
  meetsGoal,
  memoryFor,
  questionKind,
  recallScore,
} from '../src/lib/learn'
import { fresh, review } from '../src/lib/srs'
import type { Card, ProgressMap } from '../src/lib/types'

const now = 1_000_000_000
const card: Card = { id: 'a', term: 'Cell', definition: 'Basic unit of life' }
function learned(written = 2) {
  let memory = answerMemory(card, undefined, 'mc', true, now)
  for (let i = 1; i <= written; i++) memory = answerMemory(card, memory, 'written', true, now + i * 60_000)
  return memory
}

describe('adaptive Learn', () => {
  it('fades choices into recall and requires repeated written success', () => {
    const choice = answerMemory(card, undefined, 'mc', true, now)
    expect(questionKind(undefined, 'new')).toBe('mc')
    expect(questionKind(choice, 'new')).toBe('written')
    const once = answerMemory(card, choice, 'written', true, now + 60_000)
    expect(meetsGoal(once, 'understanding', now + 60_000)).toBe(false)
    const twice = answerMemory(card, once, 'written', true, now + 120_000)
    expect(meetsGoal(twice, 'understanding', now + 120_000)).toBe(true)
    expect(meetsGoal(twice, 'mastery', now + 120_000)).toBe(false)
    expect(meetsGoal(learned(3), 'mastery', now + 180_000)).toBe(true)
  })
  it('uses a lighter recognition goal and respects initial knowledge', () => {
    const first = answerMemory(card, undefined, 'mc', true, now)
    const second = answerMemory(card, first, 'mc', true, now + 10_000)
    expect(meetsGoal(second, 'familiarity', now + 10_000)).toBe(true)
    expect(questionKind(first, 'new', undefined, 'familiarity')).toBe('mc')
    expect(questionKind(undefined, 'most')).toBe('written')
    expect(questionKind(undefined, 'some', review(undefined, 2, now))).toBe('written')
  })
  it('resets a missed recall streak while keeping the card in written practice', () => {
    const memory = learned()
    const missed = answerMemory(card, memory, 'written', false, now + 180_000)
    expect(missed).toMatchObject({ streak: 0, writtenStreak: 0, misses: 1 })
    expect(questionKind(missed, 'new')).toBe('written')
    const missedAgain = answerMemory(card, missed, 'written', false, now + 240_000)
    expect(questionKind(missedAgain, 'new')).toBe('written')
    expect(questionKind(answerMemory(card, undefined, 'mc', false, now), 'new')).toBe('mc')
    const oldMemory = { ...missed }
    delete oldMemory.writtenAttempts
    expect(questionKind(oldMemory, 'new')).toBe('written')
    expect(meetsGoal(missed, 'familiarity', now + 180_000)).toBe(false)
    expect(missed.stability).toBeLessThan(memory.stability)
  })
  it('forgets over time and gains more stability from spaced successful recall', () => {
    const memory = learned()
    expect(recallScore(memory, memory.last + memory.stability)).toBeCloseTo(
      recallScore(memory, memory.last) / 2,
    )
    expect(meetsGoal(memory, 'understanding', memory.last + memory.stability)).toBe(false)
    const immediate = answerMemory(card, memory, 'written', true, memory.last + 1000)
    const spaced = answerMemory(card, memory, 'written', true, memory.last + 86_400_000)
    expect(spaced.stability).toBeGreaterThan(immediate.stability)
  })
  it('keeps answer directions independent and discards memory for edited cards', () => {
    const progress = { ...fresh(), learn: { definition: learned() } }
    expect(memoryFor(card, progress, 'definition')).toBeDefined()
    expect(memoryFor(card, progress, 'term')).toBeUndefined()
    expect(memoryFor({ ...card, definition: 'Changed' }, progress, 'definition')).toBeUndefined()
    const emoji = { ...card, term: '😀' }
    const emojiProgress = { ...fresh(), learn: { term: answerMemory(emoji, undefined, 'written', true, now) } }
    expect(memoryFor({ ...emoji, term: '😁' }, emojiProgress, 'term')).toBeUndefined()
    expect(review(progress, 2, now).learn).toEqual(progress.learn)
  })
  it('prioritizes weak cards, mixes new ones, avoids same-round repeats, and skips ready cards', () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ ...card, id: String(i) }))
    const map: ProgressMap = {}
    cards.slice(0, 5).forEach((c) => {
      map[c.id] = { ...fresh(), learn: { definition: answerMemory(c, undefined, 'written', false, now) } }
    })
    map['11'] = { ...fresh(), learn: { definition: learned() } }
    const round = learningRound(cards, map, 'definition', 'understanding', now + 120_000)
    expect(round).toHaveLength(7)
    expect(new Set(round.map((c) => c.id)).size).toBe(7)
    expect(round[0].id).toMatch(/^[0-4]$/)
    expect(round.some((c) => Number(c.id) >= 5)).toBe(true)
    expect(round.some((c) => c.id === '11')).toBe(false)
    const forgotten = learningRound([cards[11]], map, 'definition', 'understanding', now + 30 * 86_400_000)
    expect(forgotten).toHaveLength(1)
  })
  it('applies strict spelling only for the mastery goal without pretending to grade paraphrases', () => {
    expect(gradeLearnAnswer('mitocondria', 'mitochondria', 'understanding')).toBe('close')
    expect(gradeLearnAnswer('mitocondria', 'mitochondria', 'mastery')).toBe('wrong')
    expect(gradeLearnAnswer('cafe', 'café', 'mastery')).toBe('wrong')
    expect(gradeLearnAnswer(' NYC ', 'New York; NYC', 'mastery')).toBe('correct')
    expect(gradeLearnAnswer('Fundamental component of organisms', card.definition, 'understanding')).toBe(
      'wrong',
    )
  })
})
