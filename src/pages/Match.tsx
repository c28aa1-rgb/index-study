import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StudyShell } from '../components/StudyShell'
import { Button, Empty, Page, Spinner } from '../components/ui'
import { useSet } from '../lib/hooks'
import { paper, shake, snap } from '../lib/motion'
import type { Card, Side } from '../lib/types'
import { formatMs, shuffle } from '../lib/util'
import { playSound } from '../lib/sound'

type Tile = { key: string; card: Card; side: Side }

export default function Match() {
  const { id } = useParams()
  const { set, state, error } = useSet(id)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [wrong, setWrong] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const [penalties, setPenalties] = useState(0)
  const started = useRef(0)
  const penalty = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bestKey = `di.match.${id}.${Math.min(6, set?.cards.length ?? 0)}`

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(bestKey))
      setBest(saved > 0 ? saved : null)
    } catch {}
  }, [bestKey])
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed(performance.now() - started.current + penalty.current), 80)
    return () => clearInterval(t)
  }, [running])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
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
  const pairs = Math.min(6, set.cards.length)
  const finished = tiles.length > 0 && matched.length === pairs * 2
  const start = () => {
    if (timer.current) clearTimeout(timer.current)
    const cards = shuffle(set.cards).slice(0, pairs)
    setTiles(
      shuffle(
        cards.flatMap((card) =>
          (['term', 'definition'] as const).map((side) => ({ key: card.id + side, card, side })),
        ),
      ),
    )
    setSelected(null)
    setMatched([])
    setWrong([])
    setElapsed(0)
    setPenalties(0)
    penalty.current = 0
    started.current = performance.now()
    setRunning(true)
  }
  const pick = (tile: Tile) => {
    if (!running || wrong.length || matched.includes(tile.key)) return
    if (selected === tile.key) {
      setSelected(null)
      return
    }
    if (!selected) {
      setSelected(tile.key)
      return
    }
    const previous = tiles.find((t) => t.key === selected)!
    if (
      previous.side !== tile.side &&
      previous.card.term === tile.card.term &&
      previous.card.definition === tile.card.definition
    ) {
      const next = [...matched, previous.key, tile.key]
      playSound(next.length === pairs * 2 ? 'complete' : 'match')
      setMatched(next)
      setSelected(null)
      if (next.length === pairs * 2) {
        const time = performance.now() - started.current + penalty.current
        setElapsed(time)
        setRunning(false)
        if (best === null || time < best) {
          setBest(time)
          try {
            localStorage.setItem(bestKey, String(time))
          } catch {}
        }
      }
    } else {
      playSound('wrong')
      setWrong([selected, tile.key])
      penalty.current += 2000
      setPenalties((n) => n + 1)
      timer.current = setTimeout(() => {
        setWrong([])
        setSelected(null)
      }, 550)
    }
  }

  return (
    <StudyShell setId={set.id} title={set.title} mode="Match" progress={matched.length / (pairs * 2)}>
      {!tiles.length || finished ? (
        <motion.section
          key={finished ? 'result' : 'start'}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={paper}
          className="study-panel text-center"
        >
          <div className="mode-symbol mx-auto" aria-hidden="true">
            ⧉
          </div>
          <h1 className="mt-5 font-display text-4xl font-extrabold">
            {finished ? 'All paired up.' : 'Find their other halves.'}
          </h1>
          {finished ? (
            <>
              <p className="mt-5 font-display text-6xl font-extrabold tabular-nums">{formatMs(elapsed)}</p>
              <p className="mt-3 text-ink-2">
                {pairs} pairs matched
                {penalties ? `, including ${penalties * 2}s in penalties` : ' with no misses'}.
              </p>
            </>
          ) : (
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-ink-2">
              Match each term to its definition. Clear {pairs} pairs as quickly as you can. A wrong pair adds
              2 seconds.
            </p>
          )}
          {best !== null && (
            <p className="mt-4 text-sm font-semibold text-mastered">Personal best: {formatMs(best)}</p>
          )}
          <Button size="lg" className="mt-8" onClick={start}>
            {finished ? 'Play again' : 'Start matching'}
          </Button>
        </motion.section>
      ) : (
        <>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-sm text-ink-3">Time</p>
              <p
                role="timer"
                aria-label="Elapsed time"
                className="font-display text-4xl font-extrabold tabular-nums"
              >
                {formatMs(elapsed)}
              </p>
            </div>
            <p className="text-sm text-ink-2">
              {matched.length / 2} of {pairs} pairs
            </p>
            <Button tone="ghost" size="sm" onClick={start}>
              Restart
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((tile) => {
              const gone = matched.includes(tile.key)
              const bad = wrong.includes(tile.key)
              return (
                <motion.button
                  key={tile.key}
                  disabled={gone || wrong.length > 0}
                  aria-pressed={selected === tile.key}
                  aria-label={gone ? 'Matched pair' : tile.card[tile.side]}
                  onClick={() => pick(tile)}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={bad ? { ...shake, opacity: 1 } : { opacity: gone ? 0 : 1, scale: gone ? 0.9 : 1 }}
                  transition={snap}
                  whileTap={{ scale: 0.97 }}
                  className={`min-h-36 rounded-xl border-2 p-4 text-sm leading-relaxed shadow-card sm:min-h-40 sm:text-base ${gone ? 'pointer-events-none' : ''} ${bad ? 'border-margin bg-margin/10' : selected === tile.key ? 'border-ink bg-marker-soft' : 'border-rule-soft bg-paper hover:border-ink/40'}`}
                >
                  {tile.card[tile.side]}
                </motion.button>
              )
            })}
          </div>
          <p role="status" className="mt-5 min-h-6 text-center text-sm text-margin">
            {wrong.length
              ? 'Those don’t match. 2 seconds added.'
              : selected
                ? 'Now choose its match.'
                : 'Choose a term or definition.'}
          </p>
        </>
      )}
    </StudyShell>
  )
}
