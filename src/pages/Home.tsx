import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Empty, Page, Spinner } from '../components/ui'
import { SetTile } from '../components/SetTile'
import { useAuth } from '../lib/auth'
import { flip } from '../lib/motion'
import { mySets } from '../lib/store'
import { cloud } from '../lib/supabase'
import type { StudySet } from '../lib/types'

const demo = [
  ['Mitochondria', 'Makes ATP through cellular respiration', 'Cell biology'],
  ['la biblioteca', 'the library', 'Spanish vocabulary'],
  ['Derivative of sin x', 'cos x', 'Calculus'],
]

function CardStack() {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const reduced = useReducedMotion()
  const [term, definition, subject] = demo[index]
  const face =
    'ruled backface-hidden absolute inset-0 flex flex-col rounded-2xl border border-ink/15 px-7 shadow-lift [--head:52px] [--line:32px]'
  return (
    <div className="relative mx-auto w-full max-w-sm px-2 pb-3 pt-5">
      <div className="relative h-64 sm:h-72 [perspective:1400px]">
        {[2, 1].map((d) => (
          <div
            key={d}
            className="absolute inset-0 rounded-2xl border border-ink/15 bg-paper shadow-card"
            style={{ transform: `translate(${d * 5}px, ${d * 7}px) rotate(${d * 1.5}deg)` }}
          />
        ))}
        <motion.button
          type="button"
          onClick={() => setFlipped((v) => !v)}
          aria-label={`${flipped ? definition : term}. Flip sample card`}
          className="preserve-3d relative h-full w-full text-left"
          animate={{ rotateX: !reduced && flipped ? 180 : 0 }}
          transition={flip}
        >
          <div aria-hidden={flipped} className={face} style={reduced && flipped ? { visibility: 'hidden' } : undefined}>
            <span className="flex h-[52px] items-center justify-between text-xs font-semibold text-ink-3">
              <span>{subject}</span>
              <span>Term</span>
            </span>
            <span className="m-auto pb-7 text-center font-hand text-4xl leading-tight sm:text-5xl">{term}</span>
          </div>
          <div
            aria-hidden={!flipped}
            className={`${face} ${reduced ? '' : '[transform:rotateX(180deg)]'}`}
            style={reduced && !flipped ? { visibility: 'hidden' } : undefined}
          >
            <span className="flex h-[52px] items-center text-xs font-semibold text-margin">Definition</span>
            <span className="m-auto pb-7 text-center font-hand text-4xl leading-tight">{definition}</span>
          </div>
        </motion.button>
      </div>
      <div className="mt-8 flex items-center justify-between text-sm text-ink-3">
        <span>Click the card to flip it</span>
        <button
          onClick={() => {
            setFlipped(false)
            setIndex((i) => (i + 1) % demo.length)
          }}
          className="rounded-lg px-3 py-2 font-semibold text-ink hover:bg-paper"
        >
          Next card <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, ready, name } = useAuth()
  const nav = useNavigate()
  const [sets, setSets] = useState<StudySet[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!ready) return
    let alive = true
    setError('')
    mySets()
      .then((s) => {
        if (alive) setSets(s)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [ready, user?.id])
  if (error)
    return (
      <Page>
        <Empty
          title="Couldn't load your library"
          body={error}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Page>
    )
  if (!ready || sets === null)
    return (
      <Page>
        <Spinner />
      </Page>
    )
  const filtered = sets.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <Page>
      {sets.length === 0 ? (
        <>
          <section className="grid items-center gap-9 pb-14 pt-12 md:grid-cols-[1.12fr_1fr] md:gap-14 md:pb-20 md:pt-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2">
                <span className="h-2 w-2 rounded-full bg-margin" />
                Your study desk
              </p>
              <h1 className="desk-heading">
                Turn class notes
                <br />
                into recall.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
                Make a set, paste in your notes, and find a way to study that works for you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => nav('/create')}>
                  Create a set
                </Button>
                <Button size="lg" tone="paper" onClick={() => nav('/create?import=1')}>
                  Import notes
                </Button>
              </div>
            </div>
            <CardStack />
          </section>
          <section className="border-t border-ink/15 py-9">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-bold">One set. Five ways to study.</h2>
              <Link
                to="/explore"
                className="text-sm font-semibold text-ink-2 underline decoration-rule underline-offset-4"
              >
                Explore shared sets
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
              {[
                ['◧', 'Flashcards', 'Flip, recall, and sort.'],
                ['◎', 'Learn', 'Practice, then write it back.'],
                ['✓', 'Test', 'See what you know.'],
                ['⧉', 'Match', 'Pair terms against the clock.'],
                ['↻', 'Review', 'Revisit cards when they’re due.'],
              ].map(([glyph, title, body]) => (
                <div key={title}>
                  <span className="text-2xl text-margin" aria-hidden="true">
                    {glyph}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-12">
            <div>
              <p className="mb-3 text-sm text-ink-2">{name === 'You' ? 'Welcome back.' : `Welcome back, ${name}.`}</p>
              <h1 className="desk-heading">Your study desk.</h1>
              <p className="mt-4 text-ink-2">
                {sets.length} {sets.length === 1 ? 'set' : 'sets'}, {sets.reduce((n, s) => n + s.cards.length, 0)}{' '}
                cards. Pick up where you left off.
              </p>
            </div>
            <Button tone="paper" onClick={() => nav('/create?import=1')}>
              Import notes
            </Button>
          </div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-ink/15 pb-5">
            <h2 className="font-display text-xl font-bold">Your sets</h2>
            <input
              aria-label="Search your sets"
              className="h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm sm:w-72"
              placeholder="Find a set…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length ? (
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <SetTile key={s.id} set={s} />
              ))}
              <Link
                to="/create"
                className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/20 text-ink-2 transition-colors hover:border-ink hover:bg-paper/50"
              >
                <span className="text-3xl" aria-hidden="true">
                  +
                </span>
                <span className="font-semibold">Create a set</span>
              </Link>
            </div>
          ) : (
            <Empty
              title="No matching sets"
              body="Try a different title or clear your search."
              action={
                <Button tone="paper" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          )}
        </>
      )}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 py-5 text-xs text-ink-3">
        <span>Index</span>
        <span>{cloud ? 'Your cards, across devices.' : 'Saved in this browser. Share a set to send a copy.'}</span>
      </footer>
    </Page>
  )
}
