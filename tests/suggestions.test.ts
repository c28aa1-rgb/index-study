import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { dictionarySuggestions, plainDefinition, uniqueSuggestions } from '../src/lib/suggestions'
import { isAttribution } from '../src/lib/attribution'
import { exportText, parseImport } from '../src/lib/importParse'
import { packSet, unpackSet } from '../src/lib/share'
import type { StudySet } from '../src/lib/types'

vi.mock('../src/lib/supabase', () => ({ supabase: null }))
const attribution = { url: 'https://en.wiktionary.org/wiki/cell', license: 'CC BY-SA 4.0' as const }

describe('card suggestions and source credits', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('finds lowercase entries after a capitalized word misses', async () => {
    const request = vi.fn(async (input: string | URL) => {
      const url = String(input)
      return new Response(
        JSON.stringify(
          url.includes('/definition/Studyword')
            ? {}
            : url.includes('/definition/studyword')
              ? { en: [{ definitions: [{ definition: 'A dictionary definition.' }] }] }
              : ['Studyword', [], [], []],
        ),
        { status: url.includes('/definition/Studyword') ? 404 : 200 },
      )
    })
    vi.stubGlobal('fetch', request)
    const result = await dictionarySuggestions('Studyword', new AbortController().signal)
    expect(result[0]).toMatchObject({
      definition: 'A dictionary definition.',
      attribution: { url: 'https://en.wiktionary.org/wiki/studyword' },
    })
    expect(request).toHaveBeenCalledTimes(3)
  })
  it('turns dictionary markup into plain text without scripts or styles', () => {
    expect(
      plainDefinition('<script>alert(1)</script><style>.bad{}</style>A <b>cell</b> &amp; &#x41; &#66;.'),
    ).toBe('A cell & A B.')
  })
  it('deduplicates suggestions without dropping source credit', () => {
    expect(
      uniqueSuggestions([
        { term: 'Cell', definition: 'Unit of life', attribution, source: 'Your sets' },
        { term: 'cell', definition: 'unit of life', source: 'Public set' },
      ]),
    ).toEqual([{ term: 'Cell', definition: 'Unit of life', attribution, source: 'Your sets' }])
  })
  it('keeps dictionary attribution in shared links and text exports', () => {
    const set: StudySet = {
      id: 'x',
      title: 'Cells',
      description: '',
      author_name: 'Student',
      owner_id: null,
      visibility: 'public',
      created_at: '',
      updated_at: '',
      cards: [
        { id: 'a', term: 'Cell', definition: 'Unit of life', attribution },
        { id: 'b', term: 'DNA', definition: 'Genetic material' },
      ],
    }
    expect(unpackSet(packSet(set))?.c[0][2]).toEqual(attribution)
    expect(exportText(set.cards)).toContain('Source: https://en.wiktionary.org/wiki/cell; CC BY-SA 4.0')
    expect(parseImport(exportText(set.cards), { kind: 'tab' }, { kind: 'newline' })[0]).toMatchObject({
      definition: 'Unit of life',
      attribution,
    })
  })
  it('rejects forged or unsafe source links in share payloads', () => {
    const bad = { url: 'javascript:alert(1)', license: 'CC BY-SA 4.0' }
    expect(isAttribution(bad)).toBe(false)
    expect(isAttribution({ ...attribution, url: 'https://en.wiktionary.org.evil.invalid/wiki/cell' })).toBe(
      false,
    )
    expect(
      unpackSet(
        compressToEncodedURIComponent(
          JSON.stringify({
            t: 'X',
            d: '',
            a: '',
            c: [
              ['A', 'B', bad],
              ['C', 'D'],
            ],
          }),
        ),
      ),
    ).toBeNull()
  })
})
