import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mcOptions, other, Prompt } from '../components/Questions'
import { StudyShell } from '../components/StudyShell'
import { Button, Empty, Page, Segmented, Spinner, Toggle } from '../components/ui'
import { check, checkSmart } from '../lib/grade'
import { useSet } from '../lib/hooks'
import { paper } from '../lib/motion'
import type { Card, Side } from '../lib/types'
import { shuffle } from '../lib/util'
import { playSound } from '../lib/sound'

type Kind = 'mixed' | 'written' | 'choice' | 'truefalse'
type Question = {
  card: Card
  kind: Exclude<Kind, 'mixed'>
  options: string[]
  statement: string
  truth: boolean
}

export default function Test() {
  const { id } = useParams()
  const { set, state, error, rate } = useSet(id)
  const [kind, setKind] = useState<Kind>('mixed')
  const [side, setSide] = useState<Side>('term')
  const [count, setCount] = useState(10)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [graded, setGraded] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [confirm, setConfirm] = useState(false)
  const [smart, setSmart] = useState(true)

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
          body={error || 'Return to your library and choose another set.'}
          action={<Link to="/">Go to library</Link>}
        />
      </Page>
    )

  const start = () => {
    setQuestions(
      shuffle(set.cards)
        .slice(0, Math.min(count, set.cards.length))
        .map((card, i) => {
          const k = kind === 'mixed' ? (['written', 'choice', 'truefalse'] as const)[i % 3] : kind
          const wrong = shuffle(set.cards).find((c) => c[side] !== card[side])
          const truth = !wrong || Math.random() > 0.5
          return {
            card,
            kind: k,
            options: mcOptions(card, set.cards, side),
            truth,
            statement: truth ? card[side] : wrong![side],
          }
        }),
    )
    setAnswers({})
    setResults([])
    setGraded(false)
    setConfirm(false)
    window.scrollTo({ top: 0 })
  }
  const submit = () => {
    if (questions.some((_, i) => !answers[i]?.trim()) && !confirm) {
      setConfirm(true)
      return
    }
    const marks = questions.map((q, i) =>
      q.kind === 'truefalse'
        ? answers[i] === String(q.truth)
        : q.kind === 'written'
          ? (smart ? checkSmart : check)(answers[i] || '', q.card[side]) !== 'wrong'
          : answers[i] === q.card[side],
    )
    setResults(marks)
    questions.forEach((q, i) => rate(q.card.id, marks[i] ? 2 : 0))
    setGraded(true)
    playSound('complete')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const score = results.filter(Boolean).length
  const answered = Object.values(answers).filter((a) => a.trim()).length

  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      mode="Test"
      progress={questions.length ? (graded ? 1 : answered / questions.length) : undefined}
    >
      {!questions.length ? (
        <section className="study-panel">
          <div className="mode-symbol" aria-hidden="true">
            ✓
          </div>
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">A practice run.</h1>
          <p className="mt-3 text-ink-2">
            Answer at your own pace. Get your score and corrections at the end.
          </p>
          <label className="mt-8 block font-semibold" htmlFor="question-count">
            Number of questions
          </label>
          <input
            id="question-count"
            type="number"
            min={1}
            max={set.cards.length}
            value={Math.min(count, set.cards.length)}
            onChange={(e) => setCount(Math.max(1, Math.min(set.cards.length, Number(e.target.value) || 1)))}
            className="field mt-2 max-w-28"
          />
          <p className="mt-6 mb-2 font-semibold">Question types</p>
          <Segmented
            id="test-kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'written', label: 'Written' },
              { value: 'choice', label: 'Multiple choice' },
              { value: 'truefalse', label: 'True / false' },
            ]}
          />
          <p className="mt-6 mb-2 font-semibold">Answer with</p>
          <Segmented
            id="test-side"
            value={side}
            onChange={setSide}
            options={[
              { value: 'term', label: 'Term' },
              { value: 'definition', label: 'Definition' },
            ]}
          />
          <div className="mt-6">
            <Toggle label="Smart grading for written answers" checked={smart} onChange={setSmart} />
            <p className="mt-1 text-xs text-ink-3">Accept common rewordings and matching key ideas.</p>
          </div>
          <div className="mt-8">
            <Button size="lg" onClick={start}>
              Start test
            </Button>
          </div>
        </section>
      ) : (
        <>
          {graded ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={paper}
              className="study-panel mb-8 border-t-4 border-mastered"
            >
              <p className="text-sm font-semibold text-ink-2">Your result</p>
              <h1 className="mt-2 font-display text-6xl font-extrabold">
                {Math.round((score / questions.length) * 100)}
                <span className="text-3xl">%</span>
              </h1>
              <p className="mt-3 text-ink-2">
                {score} of {questions.length} correct.{' '}
                {score === questions.length
                  ? 'You got every answer.'
                  : 'Review the corrections below, then try again.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={start}>Try another test</Button>
                <Link className="button-link" to={`/set/${set.id}/learn`}>
                  Keep learning
                </Link>
                <Button tone="ghost" onClick={() => setQuestions([])}>
                  Test settings
                </Button>
              </div>
            </motion.section>
          ) : (
            <div className="mb-6 flex justify-between text-sm text-ink-2">
              <h1 className="font-semibold">Practice test</h1>
              <span>
                {answered} of {questions.length} answered
              </span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!graded) submit()
            }}
            className="space-y-5"
          >
            {questions.map((q, i) => (
              <section
                key={q.card.id}
                className={`study-panel ${graded ? (results[i] ? 'border-l-4 border-mastered' : 'border-l-4 border-margin') : ''}`}
              >
                <div className="mb-4 flex justify-between text-sm text-ink-3">
                  <span>
                    Question {i + 1} of {questions.length}
                  </span>
                  <span>
                    {q.kind === 'choice'
                      ? 'Multiple choice'
                      : q.kind === 'truefalse'
                        ? 'True / false'
                        : 'Written'}
                  </span>
                </div>
                <Prompt label={other(side)} text={q.card[other(side)]} />
                {q.kind === 'written' ? (
                  <input
                    aria-label={`Answer to question ${i + 1}`}
                    disabled={graded}
                    className="field mt-6"
                    placeholder="Type your answer"
                    autoComplete="off"
                    value={answers[i] || ''}
                    onChange={(e) => {
                      setAnswers({ ...answers, [i]: e.target.value })
                      setConfirm(false)
                    }}
                  />
                ) : (
                  <fieldset disabled={graded} className="mt-5 grid gap-2 sm:grid-cols-2">
                    <legend className="sr-only">Answer to question {i + 1}</legend>
                    {q.kind === 'truefalse' && (
                      <p className="col-span-full mb-3 rounded-lg bg-desk p-4">{q.statement}</p>
                    )}
                    {(q.kind === 'truefalse' ? ['true', 'false'] : q.options).map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 ${answers[i] === option ? 'border-ink bg-rule-soft/40' : 'border-ink/10'}`}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          checked={answers[i] === option}
                          onChange={() => {
                            setAnswers({ ...answers, [i]: option })
                            setConfirm(false)
                          }}
                          value={option}
                        />
                        <span>
                          {q.kind === 'truefalse' ? (option === 'true' ? 'True' : 'False') : option}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {graded && (
                  <div
                    className={`mt-5 rounded-lg p-4 text-sm ${results[i] ? 'bg-mastered-soft' : 'bg-margin/10'}`}
                  >
                    <p className="font-bold">
                      {results[i]
                        ? smart && q.kind === 'written' && check(answers[i] || '', q.card[side]) === 'wrong'
                          ? 'Correct · accepted rewording'
                          : 'Correct'
                        : answers[i]
                          ? 'Not quite'
                          : 'Unanswered'}
                    </p>
                    {!results[i] && (
                      <p className="mt-1">
                        Correct answer:{' '}
                        <strong>{q.kind === 'truefalse' ? String(q.truth) : q.card[side]}</strong>
                        {q.kind === 'truefalse' && !q.truth && (
                          <>
                            . {q.card[other(side)]} matches {q.card[side]}.
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </section>
            ))}
            {!graded && (
              <div className="sticky bottom-4 rounded-xl bg-ink p-4 text-white shadow-lift">
                {confirm && (
                  <p role="status" className="mb-3 text-sm text-marker">
                    {questions.length - answered} unanswered. Submit again to count these as incorrect.
                  </p>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">Ready to check your work?</span>
                  <Button type="submit" tone="marker">
                    {confirm ? 'Submit anyway' : 'Grade test'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </>
      )}
    </StudyShell>
  )
}
