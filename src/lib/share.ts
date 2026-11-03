import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { StudySet } from './types'

type Packed = { t: string; d: string; a: string; c: [string, string][] }

export function packSet(s: StudySet) {
  const p: Packed = { t: s.title, d: s.description, a: s.author_name, c: s.cards.map((c) => [c.term, c.definition]) }
  return compressToEncodedURIComponent(JSON.stringify(p))
}

export function unpackSet(code: string): Packed | null {
  try {
    if (!code || code.length > 250_000) return null
    const raw = decompressFromEncodedURIComponent(code)
    if (!raw || raw.length > 2_000_000) return null
    const p = JSON.parse(raw)
    if (
      !p ||
      typeof p.t !== 'string' ||
      !p.t.trim() ||
      p.t.length > 200 ||
      typeof p.d !== 'string' ||
      p.d.length > 5000 ||
      typeof p.a !== 'string' ||
      p.a.length > 200 ||
      !Array.isArray(p.c) ||
      p.c.length < 2 ||
      p.c.length > 1000
    )
      return null
    if (
      !p.c.every(
        (c: unknown) =>
          Array.isArray(c) &&
          c.length === 2 &&
          c.every((s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 20_000),
      )
    )
      return null
    return p as Packed
  } catch {
    return null
  }
}

export const appBase = () => location.href.split('#')[0]
