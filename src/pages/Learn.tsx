import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MCOptions, Prompt, WrittenInput, mcOptions, other } from '../components/Questions'
import { StarButton } from '../components/StarButton'
import { StudyShell } from '../components/StudyShell'
import { toast } from '../components/Toast'
import { Button, Empty, Modal, Page, Segmented, Spinner, Toggle } from '../components/ui'
import { useAuth } from '../lib/auth'
import type { Verdict } from '../lib/grade'
import { useKey, useSet } from '../lib/hooks'
import {
  gradeLearnAnswer,
  learningRound,
  meetsGoal,
  memoryFor,
  questionKind,
  type Familiarity,
  type LearnGoal,
  type QuestionKind,
} from '../lib/learn'
import { paper, snap } from '../lib/motion'
import { fresh } from '../lib/srs'
import type { Card, CardProgress, Side } from '../lib/types'

type Q = { card: Card; kind: QuestionKind; options: string[] }
type Preferences = {
  goal: LearnGoal
  familiarity: Familiarity
  answerWith: Side
  starsOnly: boolean
  retype: boolean
}
const defaults: Preferences = {
  goal: 'understanding',
  familiarity: 'new',
  answerWith: 'definition',
  starsOnly: false,
  retype: true,
}
const goals: Record<LearnGoal, { label: string; description: string }> = {
  familiarity: {
    label: 'Basic familiarity',
    description: 'Recognize each answer correctly in two separate rounds.',
  },
  understanding: {
    label: 'Solid understanding',
    description: 'Build up to written answers, then recall each one correctly in two separate rounds.',
  },
  mastery: {
    label: 'Complete mastery',
    description: 'Recall each answer in writing three times across separate rounds. Spelling must match.',
  },
}

function readPreferences(key: string): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      goal: ['familiarity', 'understanding', 'mastery'].includes(p.goal) ? p.goal : defaults.goal,
      familiarity: ['new', 'some', 'most'].includes(p.familiarity) ? p.familiarity : defaults.familiarity,
      answerWith: p.answerWith === 'term' ? 'term' : 'definition',
      starsOnly: p.starsOnly === true,
      retype: p.retype !== false,
    }
  } catch {
    return defaults
  }
}

export default function Learn() {
  const { id } = useParams()
  const { user } = useAuth()
  const { set, progress, learnAnswer, starred, toggleStar, savingStars, state, error } = useSet(id)
  const prefsKey = `di.learn-options.${user?.id}.${id}`
  const [prefs, setPrefs] = useState(() => readPreferences(prefsKey))
  const { goal, familiarity, answerWith, starsOnly, retype } = prefs
  const [started, setStarted] = useState(false)
  const [queue, setQueue] = useState<Card[]>([])
  const [round, setRound] = useState(1)
  const [roundCards, setRoundCards] = useState<Card[]>([])
  const [q, setQ] = useState<Q | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ verdict: Verdict; given: string; before: CardProgress } | null>(
    null,
  )
  const [retyped, setRetyped] = useState(false)
  const [between, setBetween] = useState(false)
  const [opts, setOpts] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify(prefs))
    } catch {}
  }, [prefsKey, prefs])

  const cards = useMemo(
    () => set?.cards.filter((card) => !starsOnly || starred.includes(card.id)) ?? [],
    [set, starsOnly, starred],
  )
  const done = cards.filter((card) => meetsGoal(memoryFor(card, progress[card.id], answerWith), goal)).length
  const practiced = cards.filter((card) => memoryFor(card, progress[card.id], answerWith)).length
  const finished = cards.length > 0 && done === cards.length

  const makeQ = (card: Card): Q => {
    const kind = questionKind(
      memoryFor(card, progress[card.id], answerWith),
      familiarity,
      progress[card.id],
      goal,
    )
    const options = kind === 'mc' ? mcOptions(card, set!.cards, answerWith) : []
    return { card, kind: kind === 'mc' && options.length > 1 ? 'mc' : 'written', options }
  }

  const startRound = () => {
    const picked = learningRound(cards, progress, answerWith, goal)
    setRoundCards(picked)
    setQueue(picked.slice(1))
    setQ(picked.length ? makeQ(picked[0]) : null)
    setChosen(null)
    setFeedback(null)
    setRetyped(false)
    setBetween(false)
    setStarted(true)
  }

  const next = () => {
    if (!queue.length) {
      setBetween(true)
      setQ(null)
    } else {
      setQueue(queue.slice(1))
      setQ(makeQ(queue[0]))
    }
    setChosen(null)
    setFeedback(null)
    setRetyped(false)
  }

  const grade = (correct: boolean, given: string, verdict?: Verdict) => {
    if (!q || feedback || opts) return
    const before = progress[q.card.id] ?? fresh()
    learnAnswer(q.card, answerWith, q.kind, correct, goal)
    if (q.kind === 'mc') setChosen(given)
    setFeedback({ verdict: verdict ?? (correct ? 'correct' : 'wrong'), given, before })
  }

  useEffect(() => {
    if (!feedback || feedback.verdict === 'wrong' || q?.kind !== 'mc' || opts) return
    const timer = setTimeout(next, 750)
    return () => clearTimeout(timer)
  }, [feedback, opts, q])

  const needsRetype = retype && q?.kind === 'written' && feedback?.verdict === 'wrong' && !retyped
  useKey(
    (event) => {
      if (opts || (event.target as HTMLElement).tagName === 'BUTTON') return
      if (
        event.key === 'Enter' &&
        feedback &&
        !needsRetype &&
        !(q?.kind === 'mc' && feedback.verdict !== 'wrong')
      ) {
        event.preventDefault()
        next()
      } else if (event.key === 'Enter' && between) {
        event.preventDefault()
        setRound((n) => n + 1)
        startRound()
      }
    },
    [opts, feedback, q, queue, between, needsRetype, progress, cards],
  )

  const change = (value: Partial<Preferences>) => {
    setPrefs((p) => ({ ...p, ...value }))
    setStarted(false)
    setRound(1)
    setQ(null)
    setFeedback(null)
  }

  if (state === 'loading')
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (state === 'error')
    return (
      <Page>
        <Empty title="Couldn’t load Learn" body={error} />
      </Page>
    )
  if (!set)
    return (
      <Page>
        <Empty title="Set not found" body="Pick another set from your library." />
      </Page>
    )

  const prompt = q?.card[other(answerWith)] ?? ''
  const answer = q?.card[answerWith] ?? ''

  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      mode="Learn"
      progress={cards.length ? done / cards.length : 0}
      right={
        <Button tone="ghost" size="sm" onClick={() => setOpts(true)}>
          Options
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-ink-3">
        <span>{started ? `Round ${round} · ${goals[goal].label}` : 'Your study path'}</span>
        <span>
          <span className="font-bold text-mastered">{done}</span> / {cards.length} ready
        </span>
      </div>
      <AnimatePresence mode="wait">
        {!started ? (
          <motion.section
            key="setup"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: paper }}
            className="rounded-2xl bg-paper p-6 shadow-lift sm:p-8"
          >
            <h1 className="font-display text-3xl font-extrabold">What’s your goal?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Your answers shape the next round. Progress is saved so you can pick up here later.
            </p>
            <div className="mt-6 space-y-2" role="radiogroup" aria-label="Study goal">
              {(Object.keys(goals) as LearnGoal[]).map((value) => (
                <label
                  key={value}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left ${goal === value ? 'border-ink bg-marker-soft' : 'border-ink/10 hover:border-ink/40'}`}
                >
                  <input
                    type="radio"
                    name="learn-goal"
                    value={value}
                    checked={goal === value}
                    onChange={() => change({ goal: value })}
                    className="mt-1 h-4 w-4 shrink-0 accent-ink"
                  />
                  <span>
                    <span className="block font-display text-lg font-bold">{goals[value].label}</span>
                    <span className="mt-1 block text-sm text-ink-2">{goals[value].description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mb-3 mt-6 text-sm font-semibold">How much do you already know?</p>
            <Segmented<Familiarity>
              id="learn-familiarity"
              value={familiarity}
              onChange={(value) => change({ familiarity: value })}
              options={[
                { value: 'new', label: 'It’s new' },
                { value: 'some', label: 'Some of it' },
                { value: 'most', label: 'Most of it' },
              ]}
            />
            <p className="mt-2 text-xs text-ink-3">
              Knowing most starts you with written recall. Saved answer history takes priority.
            </p>
            <div className="mt-4">
              <Toggle
                label={`Starred only (${set.cards.filter((c) => starred.includes(c.id)).length})`}
                checked={starsOnly}
                onChange={(value) => change({ starsOnly: value })}
              />
            </div>
            {cards.length === 0 ? (
              <p className="mt-4 text-sm text-ink-2">Star some cards first, or switch off Starred only.</p>
            ) : (
              <Button className="mt-6" onClick={startRound}>
                {finished ? 'View completed path' : practiced ? 'Continue learning' : 'Start learning'}
              </Button>
            )}
          </motion.section>
        ) : cards.length === 0 ? (
          <Empty
            title="No starred cards left"
            body="Choose more cards from the set, or continue with all cards."
            action={<Button onClick={() => change({ starsOnly: false })}>Study all cards</Button>}
          />
        ) : finished ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: paper }}
            className="ruled rounded-2xl p-6 pt-0 shadow-lift [--head:88px] sm:p-8 sm:pt-0"
          >
            <h2 className="flex min-h-[88px] items-center font-display text-3xl font-extrabold">
              Goal reached for {cards.length} cards.
            </h2>
            <p className="mt-4 leading-7 text-ink-2">
              You’ve reached {goals[goal].label.toLowerCase()} for this direction. Keep using spaced Review to
              check what you remember over time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={`/set/${set.id}/review`}>
                <Button>Spaced review</Button>
              </Link>
              <Button tone="paper" onClick={() => setStarted(false)}>
                Change study goal
              </Button>
            </div>
          </motion.div>
        ) : between ? (
          <motion.div
            key={`between${round}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: paper }}
            className="rounded-2xl bg-paper p-6 shadow-lift sm:p-8"
          >
            <h2 className="font-display text-3xl font-extrabold">Round {round} done</h2>
            <p className="mt-2 text-ink-2">
              {done} of {cards.length} ready. Missed answers get more practice; correct answers return with
              less help.
            </p>
            <ul className="mt-6 space-y-2">
              {roundCards.map((card, index) => {
                const memory = memoryFor(card, progress[card.id], answerWith)
                const ready = meetsGoal(memory, goal)
                return (
                  <motion.li
                    key={card.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { ...snap, delay: index * 0.04 } }}
                    className="flex items-center gap-3 rounded-lg bg-desk/60 px-3 py-2 text-sm"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${ready ? 'bg-mastered' : memory?.correct ? 'bg-marker' : 'bg-margin'}`}
                    />
                    <span className="min-w-0 break-words font-semibold">{card.term}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-ink-3">
                      {ready ? 'ready' : memory?.correct ? 'building recall' : 'needs practice'}
                    </span>
                  </motion.li>
                )
              })}
            </ul>
            <Button
              className="mt-6"
              onClick={() => {
                setRound((n) => n + 1)
                startRound()
              }}
            >
              Continue to round {round + 1}
            </Button>
          </motion.div>
        ) : q ? (
          <motion.div
            key={`${q.card.id}-${round}-${queue.length}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0, transition: paper }}
            exit={{ opacity: 0, x: -40, transition: { duration: 0.16 } }}
            className="rounded-2xl bg-paper p-6 shadow-lift sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <Prompt label={other(answerWith)} text={prompt} />
              <StarButton
                starred={starred.includes(q.card.id)}
                term={q.card.term}
                onClick={() => void toggleStar(q.card.id)}
                disabled={savingStars.includes(q.card.id)}
              />
            </div>
            <div className="my-6 h-[1.5px] bg-margin/60" />
            <p className="mb-3 text-sm font-semibold text-ink-2">
              {q.kind === 'mc'
                ? 'Choose the answer'
                : goal === 'mastery'
                  ? 'Type the answer · exact spelling'
                  : 'Type the answer'}
            </p>
            {q.kind === 'mc' ? (
              <MCOptions
                options={q.options}
                correct={answer}
                chosen={chosen}
                onChoose={(value) => grade(value === answer, value)}
              />
            ) : (
              <WrittenInput
                disabled={!!feedback}
                onSkip={() => grade(false, '')}
                onSubmit={(value) => {
                  const verdict = gradeLearnAnswer(value, answer, goal)
                  grade(verdict !== 'wrong', value, verdict)
                }}
              />
            )}
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
                        : 'Let’s practice this one again.'}
                  </p>
                  {feedback.verdict !== 'correct' && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      Answer: <span className="font-semibold">{answer}</span>
                    </p>
                  )}
                  {needsRetype && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-ink-2">
                        Copy this once to correct it. You’ll recall it again in a later round.
                      </p>
                      <WrittenInput
                        placeholder="Retype the correct answer"
                        submitLabel="Check correction"
                        onSubmit={(value) => {
                          if (gradeLearnAnswer(value, answer, goal) !== 'wrong') setRetyped(true)
                          else toast('Copy the correct answer shown above.')
                        }}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button size="sm" disabled={!!needsRetype} onClick={next}>
                      Continue
                    </Button>
                    {feedback.verdict === 'wrong' && q.kind === 'written' && feedback.given && (
                      <button
                        className="text-sm font-semibold text-ink-3 underline underline-offset-4"
                        onClick={() => {
                          learnAnswer(q.card, answerWith, q.kind, true, goal, feedback.before)
                          next()
                        }}
                      >
                        I was right
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Modal open={opts} onClose={() => setOpts(false)}>
        <h2 className="font-display text-2xl font-bold">Options</h2>
        <p className="mb-2 mt-4 text-sm font-semibold">Answer with</p>
        <Segmented<Side>
          id="learn-side"
          value={answerWith}
          onChange={(value) => change({ answerWith: value })}
          options={[
            { value: 'definition', label: 'Definition' },
            { value: 'term', label: 'Term' },
          ]}
        />
        <div className="mt-4">
          <Toggle
            label="Retype missed written answers"
            checked={retype}
            onChange={(value) => setPrefs((p) => ({ ...p, retype: value }))}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Each direction has its own saved progress. Changing direction starts a new round.
        </p>
        <Button
          tone="paper"
          className="mt-4"
          onClick={() => {
            setStarted(false)
            setOpts(false)
          }}
        >
          Change study goal
        </Button>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setOpts(false)}>Done</Button>
        </div>
      </Modal>
    </StudyShell>
  )
}
