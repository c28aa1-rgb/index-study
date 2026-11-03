import { useCallback, useEffect, useRef, useState } from 'react'
import { getProgress, getSet, getStars, saveProgress, saveStar } from './store'
import type { Card, CardProgress, ProgressMap, Side, StudySet } from './types'
import { fresh, review, type Rating } from './srs'
import { answerMemory, meetsGoal, memoryFor, type LearnGoal, type QuestionKind } from './learn'
import { useAuth } from './auth'
import { toast } from '../components/Toast'

export function useSet(id: string | undefined) {
  const { user, ready } = useAuth()
  const [set, setSet] = useState<StudySet | null>(null)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [starred, setStarred] = useState<string[]>([])
  const [savingStars, setSavingStars] = useState<string[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')
  const progRef = useRef<ProgressMap>({})

  useEffect(() => {
    if (!id || !ready) return
    let alive = true
    setState('loading')
    Promise.all([getSet(id), getProgress(id), getStars(id)])
      .then(([s, p, stars]) => {
        if (!alive) return
        setSet(s)
        progRef.current = p
        setProgress(p)
        setStarred(stars)
        setSavingStars([])
        setState(s ? 'ready' : 'missing')
      })
      .catch((e) => {
        if (!alive) return
        setError(e.message || String(e))
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [id, ready, user?.id])

  const persist = (map: ProgressMap) => {
    if (id) void saveProgress(id, map).catch((e) => toast(e.message))
  }

  const rate = useCallback(
    (cardId: string, rating: Rating) => {
      if (!id) return
      const next = { ...progRef.current, [cardId]: review(progRef.current[cardId], rating) }
      progRef.current = next
      setProgress(next)
      persist(next)
    },
    [id],
  )

  const reset = useCallback(() => {
    if (!id) return
    progRef.current = {}
    setProgress({})
    persist({})
  }, [id])

  const restore = (map: ProgressMap) => {
    progRef.current = map
    setProgress(map)
    persist(map)
  }

  const learnAnswer = (
    card: Card,
    side: Side,
    kind: QuestionKind,
    correct: boolean,
    goal: LearnGoal,
    before?: CardProgress,
  ) => {
    const p = before ?? progRef.current[card.id] ?? fresh()
    const memory = memoryFor(card, p, side)
    const nextMemory = answerMemory(card, memory, kind, correct)
    const scheduled = !correct
      ? review(p, 0)
      : meetsGoal(nextMemory, goal) && !meetsGoal(memory, goal)
        ? review(p, 2)
        : p
    const next = {
      ...progRef.current,
      [card.id]: { ...scheduled, learn: { ...p.learn, [side]: nextMemory } },
    }
    progRef.current = next
    setProgress(next)
    persist(next)
    return next
  }

  const toggleStar = async (cardId: string) => {
    if (!id || savingStars.includes(cardId)) return
    const wasStarred = starred.includes(cardId)
    const update = (value: boolean) =>
      setStarred((stars) => (value ? [...new Set([...stars, cardId])] : stars.filter((s) => s !== cardId)))
    setSavingStars((ids) => [...ids, cardId])
    update(!wasStarred)
    try {
      await saveStar(id, cardId, !wasStarred)
    } catch (e) {
      update(wasStarred)
      toast((e as Error).message)
    } finally {
      setSavingStars((ids) => ids.filter((s) => s !== cardId))
    }
  }

  return {
    set,
    setSet,
    progress,
    rate,
    reset,
    restore,
    learnAnswer,
    starred,
    toggleStar,
    savingStars,
    state,
    error,
  }
}

export function useKey(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      handler(e)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
