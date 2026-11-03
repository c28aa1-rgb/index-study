import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MCOptions, Prompt, WrittenInput, mcOptions, other } from '../components/Questions'
import { StudyShell } from '../components/StudyShell'
import { Button, Empty, Modal, Page, Segmented, Spinner } from '../components/ui'
import { check, type Verdict } from '../lib/grade'
import { useSet } from '../lib/hooks'
import { paper, snap } from '../lib/motion'
import type { Card, Side } from '../lib/types'
import { shuffle } from '../lib/util'

// stage 0: needs multiple choice, 1: needs written, 2: done
type Stage = 0 | 1 | 2
const ROUND = 7

type Q = { card: Card; kind: 'mc' | 'written'; options: string[] }
type Feedback = { verdict: Verdict; given: string } | null

export default function Learn() {
  const { id } = useParams()
  const { set, rate, state } = useSet(id)
  const [answerWith, setAnswerWith] = useState<Side>('definition')
  const [stages, setStages] = useState<Record<string, Stage>>({})
  const [queue, setQueue] = useState<Card[]>([])
  const [round, setRound] = useState(1)
  const [roundCards, setRoundCards] = useState<Card[]>([])
  const [q, setQ] = useState<Q | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [between, setBetween] = useState(false)
  const [opts, setOpts] = useState(false)

  const cards = set?.cards ?? []
  const done = cards.filter((c) => stages[c.id] === 2).length
  const total = cards.length
  const finished = total > 0 && done === total

  const makeQ = useCallback(
    (card: Card, st: Record<string, Stage>): Q => {
      const kind = (st[card.id] ?? 0) === 0 && cards.length >= 2 ? 'mc' : 'written'
      return { card, kind, options: kind === 'mc' ? mcOptions(card, cards, answerWith) : [] }
    },
    [cards, answerWith],
  )

  const startRound = useCallback(
    (st: Record<string, Stage>) => {
      const pending = cards.filter((c) => (st[c.id] ?? 0) < 2)
      if (!pending.length) return
      // in-progress cards first, then new ones
      const inProg = shuffle(pending.filter((c) => (st[c.id] ?? 0) === 1))
      const fresh = shuffle(pending.filter((c) => (st[c.id] ?? 0) === 0))
      const picked = [...inProg, ...fresh].slice(0, ROUND)
      setRoundCards(picked)
      setQueue(picked.slice(1))
      setQ(makeQ(picked[0], st))
      setChosen(null)
      setFeedback(null)
      setBetween(false)
    },
    [cards, makeQ],
  )

  useEffect(() => {
    if (set) {
      setStages({})
      setRound(1)
      startRound({})
    }
  }, [set, answerWith])

  const next = (st: Record<string, Stage>, retry: Card | null) => {
    const q2 = retry ? [...queue, retry] : queue
    if (!q2.length) {
      setBetween(true)
      setQ(null)
      return
    }
    setQueue(q2.slice(1))
    setQ(makeQ(q2[0], st))
    setChosen(null)
    setFeedback(null)
  }

  const grade = (correct: boolean, given: string, verdict?: Verdict) => {
    if (!q || feedback || opts) return
    const cur = stages[q.card.id] ?? 0
    const st = { ...stages, [q.card.id]: (correct ? Math.min(2, cur + 1) : cur) as Stage }
    setStages(st)
    if (q.kind === 'written' || cards.length < 2) rate(q.card.id, correct ? 2 : 0)
    else if (!correct) rate(q.card.id, 0)
    if (q.kind === 'mc') setChosen(given)
    setFeedback({ verdict: verdict ?? (correct ? 'correct' : 'wrong'), given })
  }

  useEffect(() => {
    if (!feedback || feedback.verdict === 'wrong' || q?.kind !== 'mc' || opts) return
    const timer = setTimeout(() => next(stages, null), 750)
    return () => clearTimeout(timer)
  }, [feedback, opts, q])

  const overrideCorrect = () => {
    if (!q) return
    const cur = stages[q.card.id] ?? 0
    const st = { ...stages, [q.card.id]: Math.min(2, cur + 1) as Stage }
    setStages(st)
    rate(q.card.id, 2)
    next(st, null)
  }

  const cont = () => {
    if (!q || !feedback) return
    const wrong = feedback.verdict === 'wrong'
    next(stages, wrong ? q.card : null)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (opts || (e.target as HTMLElement).tagName === 'BUTTON') return
      if (e.key === 'Enter' && feedback && !(feedback.verdict !== 'wrong' && q?.kind === 'mc')) {
        e.preventDefault()
        cont()
      }
      if (e.key === 'Enter' && between) {
        e.preventDefault()
        setRound((r) => r + 1)
        startRound(stages)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const roundStats = useMemo(() => roundCards.map((c) => ({ c, s: stages[c.id] ?? 0 })), [roundCards, stages])

  if (state === 'loading')
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (!set)
    return (
      <Page>
        <Empty title="Set not found" body="Pick another set from your library." />
      </Page>
    )

  const prompt = q ? q.card[other(answerWith)] : ''
  const answer = q ? q.card[answerWith] : ''

  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      mode="Learn"
      progress={total ? (done + Object.values(stages).filter((s) => s === 1).length * 0.5) / total : 0}
      right={
        <Button tone="ghost" size="sm" onClick={() => setOpts(true)}>
          Options
        </Button>
      }
    >
      <div className="mb-6 flex items-center justify-between font-mono text-xs text-ink-3">
        <span>Round {round}</span>
        <span>
          <span className="font-bold text-mastered">{done}</span> / {total} mastered
        </span>
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div
            key="fin"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: paper }}
            className="ruled rounded-2xl p-8 pt-0 shadow-lift [--head:72px]"
          >
            <h2 className="flex h-[72px] items-center font-display text-3xl font-extrabold">
              All <span className="marker mx-2">{total}</span> mastered.
            </h2>
            <p className="mt-4 leading-8 text-ink-2">
              Each card is now scheduled for spaced review. Come back when the Review count goes up.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setStages({})
                  setRound(1)
                  startRound({})
                }}
              >
                Learn again
              </Button>
              <Link to={`/set/${set.id}/test`}>
                <Button tone="paper">Take a test</Button>
              </Link>
            </div>
          </motion.div>
        ) : between ? (
          <motion.div
            key={'between' + round}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: paper }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl bg-paper p-6 shadow-lift sm:p-8"
          >
            <h2 className="font-display text-3xl font-extrabold">Round {round} done</h2>
            <p className="mt-1 text-ink-2">
              {done} of {total} mastered so far.
            </p>
            <ul className="mt-6 space-y-2">
              {roundStats.map(({ c, s }, idx) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0, transition: { ...snap, delay: idx * 0.04 } }}
                  className="flex items-center gap-3 rounded-lg bg-desk/60 px-3 py-2 text-sm"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${s === 2 ? 'bg-mastered' : s === 1 ? 'bg-marker' : 'bg-margin'}`}
                  />
                  <span className="font-semibold">{c.term}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-ink-3">
                    {s === 2 ? 'mastered' : s === 1 ? 'familiar' : 'missed'}
                  </span>
                </motion.li>
              ))}
            </ul>
            <Button
              className="mt-6"
              onClick={() => {
                setRound((r) => r + 1)
                startRound(stages)
              }}
            >
              Continue to round {round + 1}
            </Button>
          </motion.div>
        ) : q ? (
          <motion.div
            key={q.card.id + round + q.kind + queue.length}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0, transition: paper }}
            exit={{ opacity: 0, x: -40, transition: { duration: 0.16 } }}
            className="rounded-2xl bg-paper p-6 shadow-lift sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <Prompt label={other(answerWith)} text={prompt} />
              {(stages[q.card.id] ?? 0) === 1 && (
                <span className="shrink-0 rounded-md bg-marker px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                  familiar
                </span>
              )}
            </div>
            <div className="my-6 h-[1.5px] bg-margin/60" />
            <p className="mb-3 text-sm font-semibold text-ink-2">
              {q.kind === 'mc' ? 'Choose the answer' : 'Type the answer'}
            </p>
            {q.kind === 'mc' ? (
              <MCOptions
                options={q.options}
                correct={answer}
                chosen={chosen}
                onChoose={(o) => grade(o === answer, o)}
              />
            ) : (
              <WrittenInput
                disabled={!!feedback}
                onSkip={() => grade(false, '')}
                onSubmit={(v) => {
                  const verdict = check(v, answer)
                  grade(verdict !== 'wrong', v, verdict)
                }}
              />
            )}

            <AnimatePresence>
              {feedback && !(q.kind === 'mc' && feedback.verdict !== 'wrong') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto', transition: paper }}
                  className="overflow-hidden"
                >
                  <div
                    className={`mt-6 rounded-xl p-4 ${feedback.verdict === 'wrong' ? 'bg-margin/10' : 'bg-mastered-soft'}`}
                  >
                    <p
                      className={`font-display font-bold ${feedback.verdict === 'wrong' ? 'text-margin' : 'text-mastered'}`}
                    >
                      {feedback.verdict === 'correct'
                        ? 'Correct'
                        : feedback.verdict === 'close'
                          ? 'Close enough. Watch the spelling.'
                          : feedback.given
                            ? 'Not quite'
                            : 'Here it is'}
                    </p>
                    {feedback.verdict === 'wrong' && feedback.given && q.kind === 'written' && (
                      <p className="mt-2 text-sm">
                        You wrote: <span className="line-through decoration-margin">{feedback.given}</span>
                      </p>
                    )}
                    {feedback.verdict !== 'correct' && (
                      <p className="mt-2 text-sm">
                        Answer: <span className="font-semibold">{answer}</span>
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button size="sm" onClick={cont} autoFocus>
                        Continue
                      </Button>
                      {feedback.verdict === 'wrong' && q.kind === 'written' && feedback.given && (
                        <button
                          onClick={overrideCorrect}
                          className="text-sm font-semibold text-ink-3 underline decoration-2 underline-offset-4 hover:text-ink"
                        >
                          I was right
                        </button>
                      )}
                      <span className="ml-auto hidden font-mono text-xs text-ink-3 sm:inline">Enter</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Modal open={opts} onClose={() => setOpts(false)}>
        <h2 className="font-display text-2xl font-bold">Options</h2>
        <p className="mb-2 mt-4 text-sm font-semibold">Answer with</p>
        <Segmented<Side>
          id="learn-side"
          value={answerWith}
          onChange={setAnswerWith}
          options={[
            { value: 'definition', label: 'Definition' },
            { value: 'term', label: 'Term' },
          ]}
        />
        <p className="mt-3 text-xs text-ink-3">Changing this restarts the session.</p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setOpts(false)}>Done</Button>
        </div>
      </Modal>
    </StudyShell>
  )
}
