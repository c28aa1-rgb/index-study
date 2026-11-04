export type Attribution = { url: string; license: 'CC BY-SA 4.0' }

export function isAttribution(value: unknown): value is Attribution {
  if (!value || typeof value !== 'object') return false
  const source = value as Attribution
  if (source.license !== 'CC BY-SA 4.0' || typeof source.url !== 'string' || source.url.length > 2000)
    return false
  try {
    const url = new URL(source.url)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'en.wiktionary.org' &&
      url.pathname.startsWith('/wiki/') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
