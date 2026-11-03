import { useCallback, useEffect, useRef, useState } from 'react'
import { getProgress, getSet, saveProgress } from './store'
import type { ProgressMap, StudySet } from './types'
import { review, type Rating } from './srs'
import { useAuth } from './auth'
import { toast } from '../components/Toast'

export function useSet(id: string | undefined) {
  const { user, ready } = useAuth()
  const [set, setSet] = useState<StudySet | null>(null)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')
  const progRef = useRef<ProgressMap>({})

  useEffect(() => {
    if (!id || !ready) return
    let alive = true
    setState('loading')
    Promise.all([getSet(id), getProgress(id)])
      .then(([s, p]) => {
        if (!alive) return
        setSet(s)
        progRef.current = p
        setProgress(p)
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

  return { set, setSet, progress, rate, reset, restore, state, error }
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
