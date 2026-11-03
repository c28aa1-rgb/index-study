import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StudyShell } from '../components/StudyShell'
import { Button, Empty, Page, Spinner } from '../components/ui'
import { useKey, useSet } from '../lib/hooks'
import { paper } from '../lib/motion'
import { isDue, review, type Rating } from '../lib/srs'
import type { Card } from '../lib/types'

const ratings: { rating: Rating; title: string; hint: string; tone: string }[] = [
  { rating: 0, title: 'Again', hint: '10 minutes', tone: 'border-margin text-margin' },
  { rating: 1, title: 'Hard', hint: '', tone: 'border-ink/20 text-ink-2' },
  { rating: 2, title: 'Good', hint: '', tone: 'border-mastered text-mastered' },
  { rating: 3, title: 'Easy', hint: '', tone: 'border-ink text-ink' },
]

export default function Review() {
  const { id } = useParams()
  const { set, progress, rate, state, error } = useSet(id)
  const [deck, setDeck] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!set) return
    setDeck(
      set.cards
        .filter((c) => !progress[c.id]?.last || isDue(progress[c.id]))
        .sort((a, b) => (progress[a.id]?.due ?? Infinity) - (progress[b.id]?.due ?? Infinity)),
    )
  }, [set])
  const card = deck[index]
  const grade = (rating: Rating) => {
    if (!card || !revealed) return
    rate(card.id, rating)
    setRevealed(false)
    setIndex((n) => n + 1)
  }
  useKey(
    (e) => {
      if (!started || !card) return
      if (e.key === ' ' && !revealed) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && /^[1-4]$/.test(e.key)) grade((Number(e.key) - 1) as Rating)
    },
    [started, revealed, card, index],
  )

  if (state === 'loading')
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (!set)
    return (
      <Page>
        <Empty
          title="Couldn't open this set"
          body={error || 'Choose another set from your library.'}
          action={<Link to="/">Go to library</Link>}
        />
      </Page>
    )
  const nextDue = set.cards
    .map((c) => progress[c.id]?.due)
    .filter((d): d is number => !!d && d > Date.now())
    .sort((a, b) => a - b)[0]

  return (
    <StudyShell setId={set.id} title={set.title} mode="Review" progress={started ? index / deck.length : undefined}>
      {!started || !card ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={paper}
          className="study-panel"
        >
          <div className="mode-symbol" aria-hidden="true">
            ↻
          </div>
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">
            {started ? 'Review complete.' : deck.length ? 'A little today. More remembered.' : 'You’re caught up.'}
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-ink-2">
            {started
              ? `You reviewed ${deck.length} cards. Your answers determine when each card comes back.`
              : deck.length
                ? `${deck.length} cards are ready, including new cards. Recall each answer before revealing it, then rate how well you remembered.`
                : 'No cards are due right now.'}
          </p>
          {nextDue && (
            <p className="mt-4 text-sm text-ink-3">
              Next review:{' '}
              {new Date(nextDue).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              .
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {!started && deck.length > 0 ? (
              <Button size="lg" onClick={() => setStarted(true)}>
                Review {deck.length} cards
              </Button>
            ) : (
              <Link className="button-link" to={`/set/${set.id}`}>
                Back to set
              </Link>
            )}
            <Link className="button-link secondary" to={`/set/${set.id}/flashcards`}>
              Practice flashcards
            </Link>
          </div>
        </motion.section>
      ) : (
        <>
          <p className="mb-5 text-sm text-ink-3">
            {index + 1} of {deck.length} cards
          </p>
          <AnimatePresence mode="wait">
            <motion.section
              key={card.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={paper}
              className="overflow-hidden rounded-2xl bg-paper shadow-lift"
            >
              <div className="ruled flex min-h-56 flex-col px-6 pb-8 pt-4 sm:px-10">
                <p className="flex h-10 items-start text-sm text-ink-3">Term</p>
                <h1 className="my-auto pt-8 text-center font-display text-3xl font-bold sm:text-4xl">{card.term}</h1>
              </div>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t border-rule-soft p-6 sm:p-10"
                >
                  <p className="mb-3 text-sm text-ink-3">Definition</p>
                  <p className="whitespace-pre-wrap text-xl leading-relaxed">{card.definition}</p>
                </motion.div>
              )}
            </motion.section>
          </AnimatePresence>
          {!revealed ? (
            <div className="mt-8 text-center">
              <Button size="lg" onClick={() => setRevealed(true)}>
                Show answer
              </Button>
              <p className="mt-3 text-xs text-ink-3">Try to recall it first. Press Space to reveal.</p>
            </div>
          ) : (
            <div className="mt-7">
              <p className="mb-3 text-center text-sm text-ink-2">How well did you remember?</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ratings.map((r) => (
                  <motion.button
                    key={r.rating}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => grade(r.rating)}
                    className={`rounded-xl border-2 bg-paper p-4 ${r.tone}`}
                  >
                    <span className="block font-bold">{r.title}</span>
                    <span className="mt-1 block text-xs">
                      {r.hint || `${review(progress[card.id], r.rating).interval} days`}
                    </span>
                  </motion.button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-ink-3">Keys 1–4 to rate</p>
            </div>
          )}
        </>
      )}
    </StudyShell>
  )
}
