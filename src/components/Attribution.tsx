import { isAttribution } from '../lib/attribution'

export function CardAttribution({ value }: { value: unknown }) {
  if (!isAttribution(value)) return null
  return (
    <p className="mt-2 text-xs font-normal leading-relaxed text-ink-3">
      Definition adapted from{' '}
      <a className="underline underline-offset-2" href={value.url} target="_blank" rel="noreferrer">
        Wiktionary
      </a>{' '}
      ·{' '}
      <a
        className="underline underline-offset-2"
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noreferrer"
      >
        {value.license}
      </a>
    </p>
  )
}
