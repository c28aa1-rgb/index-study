import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StudyShell } from '../components/StudyShell'
import { Button, Empty, Modal, Page, Spinner, Toggle } from '../components/ui'
import { useKey, useSet } from '../lib/hooks'
import { flip, paper, snap } from '../lib/motion'
import type { Card, ProgressMap } from '../lib/types'
import { shuffle } from '../lib/util'

type Dir = -1 | 1

function FlipCard({
  card,
  flipped,
  onFlip,
  front,
  onSwipe,
  tracking,
  dir,
}: {
  card: Card
  flipped: boolean
  onFlip: () => void
  front: 'term' | 'definition'
  onSwipe: (d: Dir) => void
  tracking: boolean
  dir: Dir
}) {
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 0, 240], [-12, 0, 12])
  const knowOpacity = useTransform(x, [20, 120], [0, 1])
  const learnOpacity = useTransform(x, [-120, -20], [1, 0])
  const a = front === 'term' ? card.term : card.definition
  const b = front === 'term' ? card.definition : card.term

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const go = Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 600
    if (go) onSwipe(info.offset.x > 0 ? 1 : -1)
    else animate(x, 0, snap)
  }

  const face =
    'ruled backface-hidden absolute inset-0 flex flex-col rounded-2xl border border-ink/10 px-6 sm:px-10 shadow-lift [--head:56px] [--line:34px]'
  const text = (s: string) =>
    s.length > 120 ? 'text-xl sm:text-2xl' : s.length > 50 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${flipped ? (front === 'term' ? 'Definition' : 'Term') : front === 'term' ? 'Term' : 'Definition'}: ${flipped ? b : a}. Flip card`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onFlip()
        }
      }}
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing [perspective:1600px]"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin={false}
      onDragEnd={onDragEnd}
      custom={dir}
      variants={{
        enter: (d: Dir) => ({ x: d * 80, opacity: 0, scale: 0.96 }),
        center: { x: 0, opacity: 1, scale: 1, transition: paper },
        exit: (d: Dir) => ({
          x: d * 420,
          opacity: 0,
          rotate: d * 14,
          transition: { duration: 0.32, ease: [0.3, 0, 0.8, 0.5] },
        }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
    >
      <motion.div
        className="preserve-3d relative h-full w-full"
        animate={{ rotateX: !reduced && flipped ? 180 : 0 }}
        transition={flip}
        onTap={onFlip}
      >
        <div aria-hidden={flipped} className={face} style={reduced && flipped ? { visibility: 'hidden' } : undefined}>
          <span className="flex h-14 items-center font-mono text-xs uppercase tracking-widest text-ink-3">{front}</span>
          <span
            className={`m-auto max-h-full overflow-auto whitespace-pre-wrap pb-14 text-center font-semibold leading-snug ${text(a)}`}
          >
            {a}
          </span>
        </div>
        <div
          aria-hidden={!flipped}
          className={`${face} ${reduced ? '' : '[transform:rotateX(180deg)]'}`}
          style={reduced && !flipped ? { visibility: 'hidden' } : undefined}
        >
          <span className="flex h-14 items-center font-mono text-xs uppercase tracking-widest text-margin">
            {front === 'term' ? 'definition' : 'term'}
          </span>
          <span
            className={`m-auto max-h-full overflow-auto whitespace-pre-wrap pb-14 text-center leading-snug ${text(b)}`}
          >
            {b}
          </span>
        </div>
      </motion.div>
      {tracking && (
        <>
          <motion.span
            style={{ opacity: knowOpacity }}
            className="pointer-events-none absolute right-5 top-4 rotate-6 rounded-lg border-2 border-mastered bg-mastered-soft px-3 py-1 font-display font-bold text-mastered"
          >
            Know
          </motion.span>
          <motion.span
            style={{ opacity: learnOpacity }}
            className="pointer-events-none absolute left-5 top-4 -rotate-6 rounded-lg border-2 border-margin bg-paper px-3 py-1 font-display font-bold text-margin"
          >
            Still learning
          </motion.span>
        </>
      )}
    </motion.div>
  )
}

export default function Flashcards() {
  const { id } = useParams()
  const { set, progress: savedProgress, rate, restore, state } = useSet(id)
  const [history, setHistory] = useState<ProgressMap[]>([])
  const [deck, setDeck] = useState<Card[]>([])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [dir, setDir] = useState<Dir>(1)
  const [known, setKnown] = useState<string[]>([])
  const [learning, setLearning] = useState<string[]>([])
  const [settings, setSettings] = useState(false)
  const [opts, setOpts] = useState({ shuffle: false, front: 'term' as 'term' | 'definition', tracking: true })

  const start = (cards: Card[]) => {
    setDeck(opts.shuffle ? shuffle(cards) : cards)
    setI(0)
    setFlipped(false)
    setKnown([])
    setLearning([])
    setHistory([])
  }

  useEffect(() => {
    if (set) start(set.cards)
  }, [set, opts.shuffle, opts.tracking])

  const card = deck[i]
  const done = deck.length > 0 && i >= deck.length

  const advance = (d: Dir) => {
    if (!card) return
    setDir(d)
    setFlipped(false)
    if (opts.tracking) {
      setHistory((h) => [...h, savedProgress])
      if (d === 1) setKnown((k) => [...k, card.id])
      else setLearning((l) => [...l, card.id])
      rate(card.id, d === 1 ? 2 : 0)
      setI((n) => n + 1)
    } else {
      setI((n) => Math.max(0, Math.min(deck.length - 1, n + d)))
    }
  }

  const undo = () => {
    if (i === 0) return
    const prev = deck[i - 1]
    const snapshot = history[i - 1]
    if (snapshot) restore(snapshot)
    setHistory((h) => h.slice(0, -1))
    setKnown((k) => k.filter((x) => x !== prev.id))
    setLearning((l) => l.filter((x) => x !== prev.id))
    setDir(-1)
    setFlipped(false)
    setI(i - 1)
  }

  useKey(
    (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'ArrowRight') advance(1)
      else if (e.key === 'ArrowLeft') advance(-1)
      else if (e.key.toLowerCase() === 'z' && opts.tracking) undo()
    },
    [card, opts, i, deck, history, savedProgress],
  )

  const progress = useMemo(() => (deck.length ? Math.min(i, deck.length) / deck.length : 0), [i, deck])

  if (state === 'loading')
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (!set)
    return (
      <Page>
        <Empty title="Set not found" body="Go back to your library and pick another set." />
      </Page>
    )

  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      mode="Flashcards"
      progress={progress}
      right={
        <Button tone="ghost" size="sm" onClick={() => setSettings(true)}>
          Options
        </Button>
      }
    >
      {!done ? (
        <>
          <div className="mb-4 flex items-center justify-between font-mono text-sm">
            {opts.tracking ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-margin shadow-card">
                <motion.span
                  key={learning.length}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  transition={snap}
                  className="font-bold"
                >
                  {learning.length}
                </motion.span>
                still learning
              </span>
            ) : (
              <span />
            )}
            <span className="text-ink-3">
              {Math.min(i + 1, deck.length)} / {deck.length}
            </span>
            {opts.tracking ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-mastered shadow-card">
                know
                <motion.span
                  key={known.length}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  transition={snap}
                  className="font-bold"
                >
                  {known.length}
                </motion.span>
              </span>
            ) : (
              <span />
            )}
          </div>
          <div className="relative h-[360px] sm:h-[420px]">
            <AnimatePresence custom={dir} initial={false}>
              {card && (
                <FlipCard
                  key={card.id + i}
                  card={card}
                  flipped={flipped}
                  onFlip={() => setFlipped((f) => !f)}
                  front={opts.front}
                  onSwipe={advance}
                  tracking={opts.tracking}
                  dir={dir}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ x: -3 }}
              transition={snap}
              onClick={() => advance(-1)}
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${opts.tracking ? 'border-margin text-margin' : 'border-ink'}`}
              aria-label={opts.tracking ? 'Still learning' : 'Previous card'}
            >
              {opts.tracking ? '✕' : '←'}
            </motion.button>
            {opts.tracking && (
              <button
                onClick={undo}
                disabled={i === 0}
                className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-3 hover:text-ink disabled:opacity-30"
              >
                Undo
              </button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ x: 3 }}
              transition={snap}
              onClick={() => advance(1)}
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${opts.tracking ? 'border-mastered text-mastered' : 'border-ink'}`}
              aria-label={opts.tracking ? 'Know it' : 'Next card'}
            >
              {opts.tracking ? '✓' : '→'}
            </motion.button>
          </div>
          <p className="mt-6 text-center text-xs text-ink-3">Space to flip · ← → to sort · drag the card</p>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: paper }}
          className="ruled mx-auto mt-6 w-full max-w-lg rounded-2xl p-8 pt-0 shadow-lift [--head:72px]"
        >
          <h2 className="flex h-[72px] items-center font-display text-3xl font-extrabold">
            {learning.length === 0 ? 'Clean sweep.' : 'Round done.'}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-mastered-soft p-4">
              <p className="font-mono text-4xl font-bold text-mastered">{known.length}</p>
              <p className="text-sm font-semibold">know</p>
            </div>
            <div className="rounded-xl bg-margin/10 p-4">
              <p className="font-mono text-4xl font-bold text-margin">{learning.length}</p>
              <p className="text-sm font-semibold">still learning</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {learning.length > 0 && (
              <Button onClick={() => start(set.cards.filter((c) => learning.includes(c.id)))}>
                Keep going with {learning.length}
              </Button>
            )}
            <Button tone="paper" onClick={() => start(set.cards)}>
              Restart all
            </Button>
          </div>
        </motion.div>
      )}

      <Modal open={settings} onClose={() => setSettings(false)}>
        <h2 className="mb-3 font-display text-2xl font-bold">Options</h2>
        <Toggle
          label="Track progress (sort into know / still learning)"
          checked={opts.tracking}
          onChange={(tracking) => setOpts({ ...opts, tracking })}
        />
        <Toggle label="Shuffle" checked={opts.shuffle} onChange={(s) => setOpts({ ...opts, shuffle: s })} />
        <Toggle
          label="Show definition first"
          checked={opts.front === 'definition'}
          onChange={(d) => setOpts({ ...opts, front: d ? 'definition' : 'term' })}
        />
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setSettings(false)}>Done</Button>
        </div>
      </Modal>
    </StudyShell>
  )
}
