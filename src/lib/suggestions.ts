import { supabase } from './supabase'
import type { Card, Side } from './types'
import { isAttribution } from './attribution'

export type Suggestion = Pick<Card, 'term' | 'definition' | 'attribution'> & { source: string }
const cache = new Map<string, Suggestion[]>()
const headers = { 'Api-User-Agent': 'IndexStudy/1.0 (https://github.com/c28aa1-rgb/index-study)' }

export function plainDefinition(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
      if (named[entity]) return named[entity]
      const point = entity.toLowerCase().startsWith('#x')
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1))
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
    .replace(/\s+/g, ' ')
    .trim()
}

export function uniqueSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>()
  return suggestions
    .filter((item) => {
      const key = `${item.term.toLowerCase().trim()}\0${item.definition.toLowerCase().trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}

export async function librarySuggestions(
  query: string,
  side: Side,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .rpc('suggest_study_cards', { p_query: query, p_side: side })
    .abortSignal(signal)
  if (error) throw error
  return (Array.isArray(data) ? data : [])
    .filter(
      (row) =>
        typeof row.term === 'string' &&
        typeof row.definition === 'string' &&
        row.term.length <= 20_000 &&
        row.definition.length <= 20_000,
    )
    .map((row) => ({
      term: row.term,
      definition: row.definition,
      source: row.mine ? 'Your sets' : 'Public set',
      ...(isAttribution(row.attribution) ? { attribution: row.attribution } : {}),
    }))
}

export async function dictionarySuggestions(
  term: string,
  signal: AbortSignal,
  context = '',
): Promise<Suggestion[]> {
  if (term.length < 3 || term.length > 80 || !/^[\p{L}\p{M}\s'-]+$/u.test(term)) return []
  const key = term.trim().toLowerCase()
  let suggestions = cache.get(key)
  if (!suggestions) {
    let sourceTerm = term.trim()
    const loadDefinitions = async () => {
      const load = () =>
        fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(sourceTerm)}`, {
          signal,
          headers,
          credentials: 'omit',
        })
      let response = await load()
      if (response.status === 404 && sourceTerm !== key) {
        sourceTerm = key
        response = await load()
      }
      return response.ok ? response.json() : null
    }
    const url = new URL('https://en.wiktionary.org/w/api.php')
    url.search = new URLSearchParams({
      action: 'opensearch',
      search: term,
      limit: '4',
      namespace: '0',
      format: 'json',
      origin: '*',
    }).toString()
    const results = await Promise.allSettled([
      loadDefinitions(),
      fetch(url, { signal, headers, credentials: 'omit' }).then(async (response) =>
        response.ok ? response.json() : null,
      ),
    ])
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const definitions = results[0].status === 'fulfilled' ? results[0].value : null
    const words = results[1].status === 'fulfilled' ? results[1].value : null
    if (!definitions && !words) throw new Error('Dictionary unavailable')
    suggestions = []
    const entries =
      definitions && typeof definitions === 'object'
        ? (definitions.en ?? Object.values(definitions).find(Array.isArray))
        : []
    if (Array.isArray(entries))
      for (const entry of entries) {
        if (!Array.isArray(entry?.definitions)) continue
        for (const item of entry.definitions.slice(0, 30)) {
          if (typeof item?.definition !== 'string') continue
          const definition = plainDefinition(item.definition)
          if (definition && definition.length <= 2000)
            suggestions.push({
              term: term.trim(),
              definition,
              source: 'Wiktionary',
              attribution: {
                url: `https://en.wiktionary.org/wiki/${encodeURIComponent(sourceTerm)}`,
                license: 'CC BY-SA 4.0',
              },
            })
        }
      }
    if (Array.isArray(words?.[1]))
      for (const word of words[1]) {
        if (typeof word === 'string' && word.length <= 80 && word.toLowerCase() !== key)
          suggestions.push({ term: word, definition: '', source: 'Wiktionary · term' })
      }
    if (results.every((result) => result.status === 'rejected')) throw new Error('Dictionary unavailable')
    cache.set(key, suggestions)
    if (cache.size > 64) cache.delete(cache.keys().next().value!)
  }
  const keywords = new Set(context.toLowerCase().match(/[a-z]{4,}/g) ?? [])
  const score = (item: Suggestion) =>
    (item.definition ? 1 : 0) +
    (item.definition.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => keywords.has(word)).length * 2
  return [...suggestions].sort((a, b) => score(b) - score(a)).slice(0, 5)
}
