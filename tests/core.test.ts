import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { check } from '../src/lib/grade'
import { exportText, parseImport } from '../src/lib/importParse'
import { packSet, unpackSet } from '../src/lib/share'
import { fresh, isDue, level, review, summary } from '../src/lib/srs'
import type { StudySet } from '../src/lib/types'
import { deleteSet, getProgress, getSet, mySets, saveProgress, saveSet } from '../src/lib/store'

vi.mock('../src/lib/supabase', () => ({ supabase: null }))

const now = 1_000_000_000
const set: StudySet = {
  id: 'set',
  title: 'Vocabulary',
  description: 'Two words',
  author_name: 'Student',
  owner_id: null,
  visibility: 'private',
  created_at: '',
  updated_at: '',
  cards: [
    { id: 'a', term: 'Alpha', definition: 'First letter' },
    { id: 'b', term: 'Beta', definition: 'Second letter' },
  ],
}

describe('written grading', () => {
  it.each([
    ['LIBRARY', 'library', 'correct'],
    ['cafe', 'café', 'correct'],
    ['the library', 'library', 'correct'],
    ['mitocondria', 'mitochondria', 'close'],
    ['', 'answer', 'wrong'],
    ['wrong', 'right', 'wrong'],
    ['A', 'A', 'correct'],
    ['-1', '1', 'wrong'],
    ['1', '1/2', 'wrong'],
    ['0.5', '0.6', 'wrong'],
    ['New York', 'New York; NYC', 'correct'],
  ])('%s vs %s is %s', (given, expected, verdict) => expect(check(given, expected)).toBe(verdict))
})
describe('imports', () => {
  const parse = (text: string, kind: 'tab' | 'comma' = 'tab') =>
    parseImport(text, { kind }, { kind: 'newline' }).map((c) => [c.term, c.definition])
  it('reads tabs, CRLF, blank rows, and BOM', () =>
    expect(parse('\uFEFFAlpha\tFirst\r\n\r\nBeta\tSecond')).toEqual([
      ['Alpha', 'First'],
      ['Beta', 'Second'],
    ]))
  it('preserves quoted commas, newlines, and escaped quotes', () =>
    expect(parse('"Alpha, beta","A\nB and ""C"""\nDelta,Fourth', 'comma')).toEqual([
      ['Alpha, beta', 'A\nB and "C"'],
      ['Delta', 'Fourth'],
    ]))
  it('preserves extra separators in definitions', () =>
    expect(parse('Alpha,one, two, three', 'comma')).toEqual([['Alpha', 'one, two, three']]))
  it('supports custom separators', () =>
    expect(
      parseImport('A::one|B::two', { kind: 'custom', custom: '::' }, { kind: 'custom', custom: '|' }),
    ).toMatchObject([
      { term: 'A', definition: 'one' },
      { term: 'B', definition: 'two' },
    ]))
  it('keeps unmatched rows visible for correction', () => expect(parse('Alpha')).toEqual([['Alpha', '']]))
  it('round trips multiline and quoted card text', () => {
    const cards = [{ id: 'a', term: 'A\tB', definition: 'one\n"two"' }]
    expect(parse(exportText(cards))).toEqual([['A\tB', 'one\n"two"']])
  })
})
describe('share links', () => {
  it('round trips without owner data or card IDs', () =>
    expect(unpackSet(packSet(set))).toEqual({
      t: set.title,
      d: set.description,
      a: set.author_name,
      c: [
        ['Alpha', 'First letter'],
        ['Beta', 'Second letter'],
      ],
    }))
  it.each([
    null,
    { t: 'X', d: '', a: '', c: [['only', 'one']] },
    {
      t: 'X',
      d: '',
      a: '',
      c: [
        [{}, 'value'],
        ['a', 'b'],
      ],
    },
  ])('rejects malformed payload %j', (payload) =>
    expect(unpackSet(compressToEncodedURIComponent(JSON.stringify(payload)))).toBeNull(),
  )
  it('rejects damaged and oversized links', () => {
    expect(unpackSet('damaged')).toBeNull()
    expect(unpackSet('x'.repeat(250001))).toBeNull()
  })
})
describe('spaced review', () => {
  it('schedules a missed card ten minutes later', () => {
    const p = review(undefined, 0, now)
    expect(p.due).toBe(now + 600_000)
    expect(level(p)).toBe('learning')
    expect(isDue(p, now)).toBe(false)
    expect(isDue(p, p.due)).toBe(true)
  })
  it('advances from familiar to mastered with successful recall', () => {
    const first = review(undefined, 2, now)
    expect(first.interval).toBe(1)
    expect(level(first)).toBe('familiar')
    const second = review(first, 2, first.due)
    expect(second.interval).toBe(6)
    expect(level(second)).toBe('mastered')
  })
  it('resets a lapse while keeping ease bounded', () => {
    let p = fresh()
    for (let i = 0; i < 20; i++) p = review(p, 0, now)
    expect(p.ease).toBe(1.3)
    expect(p.lapses).toBe(20)
    expect(p.reps).toBe(0)
  })
  it('counts only the cards still in a set', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(summary(['a', 'b'], { a: review(undefined, 0, now - 700_000), removed: review(undefined, 2, now) })).toEqual(
      { new: 1, learning: 1, familiar: 0, mastered: 0, due: 1 },
    )
    vi.restoreAllMocks()
  })
})

describe('local library persistence', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('rejects incomplete cards without overwriting the saved version', async () => {
    await saveSet(set)
    await expect(saveSet({ ...set, cards: [{ ...set.cards[0], definition: '' }, set.cards[1]] })).rejects.toThrow(
      'term and definition',
    )
    expect((await getSet(set.id))?.cards[0].definition).toBe('First letter')
  })
  it('persists ratings and removes them when deleting a set', async () => {
    await saveSet(set)
    const progress = { a: review(undefined, 2, now) }
    await saveProgress(set.id, progress)
    expect(await getProgress(set.id)).toEqual(progress)
    await deleteSet(set.id)
    expect(await getSet(set.id)).toBeNull()
    expect(await getProgress(set.id)).toEqual({})
  })
  it('reports storage failures rather than claiming a save succeeded', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage full')
    })
    await expect(saveSet(set)).rejects.toThrow('Storage full')
    await expect(saveProgress(set.id, {})).rejects.toThrow('couldn’t be saved')
  })
  it('never overwrites an unreadable library during a new save', async () => {
    localStorage.setItem('di.sets', '{broken')
    await expect(saveSet(set)).rejects.toThrow('couldn’t be read')
    expect(localStorage.getItem('di.sets')).toBe('{broken')
    localStorage.setItem('di.sets', JSON.stringify([{ title: 'Bad cards', cards: null }]))
    await expect(mySets()).rejects.toThrow('couldn’t be read')
  })
})
