import { playSound, setSounds, useSounds } from '../lib/sound'

export function SoundToggle() {
  const enabled = useSounds()
  return (
    <button
      type="button"
      aria-label={enabled ? 'Mute sounds' : 'Enable sounds'}
      aria-pressed={enabled}
      title={enabled ? 'Mute sounds' : 'Enable sounds'}
      onClick={() => {
        setSounds(!enabled)
        if (!enabled) playSound('match')
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-desk-2 focus-visible:outline-2 focus-visible:outline-ink"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4 6 8H3v8h3l5 4Z" />
        {enabled ? (
          <>
            <path d="M15 8a6 6 0 0 1 0 8" />
            <path d="M18 5a10 10 0 0 1 0 14" />
          </>
        ) : (
          <path d="m16 9 6 6m0-6-6 6" />
        )}
      </svg>
    </button>
  )
}
