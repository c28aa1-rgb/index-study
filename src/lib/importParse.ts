import type { Card } from './types'
import { uid } from './util'

export type Sep = { kind: 'tab' | 'comma' | 'dash' | 'custom'; custom?: string }
export type RowSep = { kind: 'newline' | 'semicolon' | 'custom'; custom?: string }

const between = (s: Sep) =>
  s.kind === 'tab' ? '\t' : s.kind === 'comma' ? ',' : s.kind === 'dash' ? ' - ' : s.custom || '\t'
const rows = (s: RowSep) => (s.kind === 'newline' ? '\n' : s.kind === 'semicolon' ? ';' : s.custom || '\n')

export function parseImport(text: string, sep: Sep, rowSep: RowSep): Card[] {
  const b = between(sep)
  const r = rows(rowSep)
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const result: Card[] = []
  let term = '',
    definition = '',
    inDefinition = false,
    quoted = false
  const append = (s: string) => {
    if (inDefinition) definition += s
    else term += s
  }
  const push = () => {
    if (term.trim() || definition.trim()) result.push({ id: uid(), term: term.trim(), definition: definition.trim() })
    term = ''
    definition = ''
    inDefinition = false
  }
  for (let i = 0; i < source.length; ) {
    const c = source[i]
    if (c === '"' && (quoted || !(inDefinition ? definition : term).trim())) {
      if (quoted && source[i + 1] === '"') {
        append('"')
        i += 2
        continue
      }
      quoted = !quoted
      i++
      continue
    }
    if (!quoted && source.startsWith(r, i)) {
      push()
      i += r.length
      continue
    }
    if (!quoted && !inDefinition && source.startsWith(b, i)) {
      inDefinition = true
      i += b.length
      continue
    }
    append(c)
    i++
  }
  push()
  return result
}

// Guess separators from a pasted sample
export function guess(text: string): { sep: Sep; rowSep: RowSep } {
  const lines = text.split('\n').filter(Boolean)
  const rowSep: RowSep =
    lines.length > 1 ? { kind: 'newline' } : text.includes(';') ? { kind: 'semicolon' } : { kind: 'newline' }
  const sample = lines.slice(0, 5).join('\n')
  const sep: Sep = sample.includes('\t')
    ? { kind: 'tab' }
    : sample.includes(' - ')
      ? { kind: 'dash' }
      : sample.includes(',')
        ? { kind: 'comma' }
        : { kind: 'tab' }
  return { sep, rowSep }
}

export function exportText(cards: Card[]) {
  const quote = (s: string) => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return cards.map((c) => `${quote(c.term)}\t${quote(c.definition)}`).join('\n')
}
