import { useEffect, useState } from 'react'
import {
  dictionarySuggestions,
  librarySuggestions,
  uniqueSuggestions,
  type Suggestion,
} from '../lib/suggestions'
import type { Card, Side } from '../lib/types'

export function CardSuggestions({
  card,
  side,
  cards,
  context,
  index,
  onSelect,
}: {
  card: Card
  side: Side
  cards: Card[]
  context: string
  index: number
  onSelect: (suggestion: Suggestion) => void
}) {
  const searchSide: Side = side === 'definition' && card.term.trim() ? 'term' : side
  const query = card[searchSide].trim().slice(0, 300)
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const local = cards
      .filter(
        (c) =>
          c.id !== card.id &&
          c.term &&
          c.definition &&
          c[searchSide].toLowerCase().startsWith(query.toLowerCase()),
      )
      .map((c) => ({ ...c, source: 'This set' }))
    setItems(query.length >= 2 ? uniqueSuggestions(local) : [])
    setUnavailable(false)
    setLoading(query.length >= 2)
    if (query.length < 2) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let alive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      const timeout = setTimeout(() => controller.abort(), 4500)
      const results = await Promise.allSettled([
        librarySuggestions(query, searchSide, controller.signal),
        searchSide === 'term'
          ? dictionarySuggestions(query, controller.signal, context)
          : Promise.resolve([]),
      ])
      clearTimeout(timeout)
      if (!alive) return
      setItems(
        uniqueSuggestions([
          ...local,
          ...results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
        ]),
      )
      setUnavailable(results.every((result) => result.status === 'rejected'))
      setLoading(false)
    }, 550)
    return () => {
      alive = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, searchSide, card.id, context])

  if (query.length < 2) return null
  return (
    <div
      className="border-t border-rule-soft px-4 pb-4 pt-3"
      role="group"
      aria-label={`Suggestions for card ${index + 1}`}
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-3">
        {loading ? 'Finding suggestions…' : 'Suggestions'}
      </p>
      {items.length ? (
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={`${item.term}\0${item.definition}`}
              type="button"
            onPointerDown={(event) => event.preventDefault()}
              onClick={() => onSelect(item)}
              className="block w-full rounded-lg bg-desk/60 px-3 py-2 text-left text-sm hover:bg-marker-soft focus-visible:outline-2 focus-visible:outline-ink"
            >
              <span className="block font-semibold">{item.term}</span>
              {item.definition && (
                <span className="mt-0.5 block line-clamp-2 text-ink-2">{item.definition}</span>
              )}
              <span className="mt-1 block text-[10px] text-ink-3">{item.source}</span>
            </button>
          ))}
        </div>
      ) : (
        !loading && (
          <p className="text-xs text-ink-3">
            {unavailable
              ? 'Suggestions are unavailable right now. You can keep writing.'
              : 'No suggestions yet. Keep typing or add your own answer.'}
          </p>
        )
      )}
    </div>
  )
}
