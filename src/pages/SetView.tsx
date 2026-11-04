import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from '../components/Toast'
import { StarButton } from '../components/StarButton'
import { CardAttribution } from '../components/Attribution'
import { BackLink, Button, Empty, MasteryStrip, Modal, Page, Segmented, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSet } from '../lib/hooks'
import { exportText } from '../lib/importParse'
import { item, list, snap } from '../lib/motion'
import { appBase, packSet } from '../lib/share'
import { level, summary, type Level } from '../lib/srs'
import { deleteSet, saveSet } from '../lib/store'
import { cloud } from '../lib/supabase'
import type { StudySet } from '../lib/types'
import { uid } from '../lib/util'

const modes = [
  { to: 'flashcards', label: 'Flashcards', hint: 'Flip and sort', glyph: '◧' },
  { to: 'learn', label: 'Learn', hint: 'Adaptive rounds', glyph: '◎' },
  { to: 'test', label: 'Test', hint: 'Graded practice', glyph: '✓' },
  { to: 'match', label: 'Match', hint: 'Beat the clock', glyph: '⧉' },
]

const dot: Record<Level, string> = {
  new: 'bg-desk-2 border border-ink-3/30',
  learning: 'bg-margin',
  familiar: 'bg-marker',
  mastered: 'bg-mastered',
}

function ShareModal({
  set,
  open,
  onClose,
  onUpdate,
}: {
  set: StudySet
  open: boolean
  onClose: () => void
  onUpdate: (s: StudySet) => void
}) {
  const { user } = useAuth()
  const [updating, setUpdating] = useState(false)
  const link = cloud ? `${appBase()}#/set/${set.id}` : `${appBase()}#/shared/${packSet(set)}`
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(msg)
    } catch {
      toast('Copy failed. Select the text and copy it.')
    }
  }
  const makeUnlisted = async () => {
    setUpdating(true)
    try {
      onUpdate(await saveSet({ ...set, visibility: 'unlisted' }))
      toast('Sharing enabled')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setUpdating(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-2xl font-bold">Share this set</h2>
      {cloud && set.visibility === 'private' ? (
        <div className="mt-4 rounded-xl bg-marker-soft p-4 text-sm">
          <p>This set is set to Only me, so the link won't open for anyone else.</p>
          {set.owner_id === user?.id && (
            <Button size="sm" className="mt-3" disabled={updating} onClick={makeUnlisted}>
              {updating ? 'Updating…' : 'Allow anyone with the link'}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-2">
          {cloud
            ? 'Anyone with this link can study the set and save their own copy.'
            : 'The whole set travels inside this link. Whoever opens it can save a copy to their browser.'}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <input
          aria-label="Share link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="h-11 min-w-0 flex-1 rounded-xl border-2 border-ink/15 bg-desk/60 px-3 font-mono text-xs outline-none"
        />
        <Button onClick={() => copy(link, 'Link copied')}>Copy link</Button>
      </div>
      <button
        onClick={() => copy(exportText(set.cards), 'Cards copied as text')}
        className="mt-4 text-sm font-semibold text-ink-2 underline decoration-rule decoration-2 underline-offset-4 hover:text-ink"
      >
        Copy cards as tab-separated text
      </button>
    </Modal>
  )
}

export default function SetView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, name } = useAuth()
  const { set, setSet, progress, reset, starred, toggleStar, savingStars, state, error } = useSet(id)
  const [share, setShare] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [sort, setSort] = useState<'original' | 'mastery'>('original')
  const [starsOnly, setStarsOnly] = useState(false)

  const stats = useMemo(
    () =>
      set
        ? summary(
            set.cards.map((c) => c.id),
            progress,
          )
        : null,
    [set, progress],
  )
  const sorted = useMemo(() => {
    if (!set) return []
    const cards = starsOnly ? set.cards.filter((c) => starred.includes(c.id)) : set.cards
    if (sort === 'original') return cards
    const rank: Record<Level, number> = { learning: 0, new: 1, familiar: 2, mastered: 3 }
    return [...cards].sort((a, b) => rank[level(progress[a.id])] - rank[level(progress[b.id])])
  }, [set, sort, progress, starsOnly, starred])

  if (state === 'loading')
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (state === 'error')
    return (
      <Page>
        <Empty title="Couldn't load set" body={error} />
      </Page>
    )
  if (!set || !stats)
    return (
      <Page>
        <Empty
          title="Set not found"
          body="It may have been deleted, or its owner made it private."
          action={<Button onClick={() => nav('/')}>Go to library</Button>}
        />
      </Page>
    )

  const mine = !cloud || set.owner_id === user?.id

  const copyToMine = async () => {
    if (!user) return nav('/auth?next=' + encodeURIComponent(`/set/${set.id}`))
    setMutating(true)
    const now = new Date().toISOString()
    try {
      const s = await saveSet({
        ...set,
        id: uid(),
        cards: set.cards.map((c) => ({ ...c, id: uid() })),
        owner_id: user.id,
        author_name: name,
        visibility: 'unlisted',
        created_at: now,
        updated_at: now,
      })
      toast('Saved to your library')
      nav(`/set/${s.id}`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  return (
    <Page>
      <div className="pt-8">
        <BackLink to="/" label="Library" />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{set.title}</h1>
          {set.description && <p className="mt-2 max-w-xl text-ink-2">{set.description}</p>}
          <p className="mt-3 font-mono text-xs text-ink-3">
            {set.cards.length} cards · by {set.author_name}
            {cloud &&
              ` · ${set.visibility === 'private' ? 'only you' : set.visibility === 'unlisted' ? 'link only' : 'public'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="paper" size="sm" onClick={() => setShare(true)}>
            Share
          </Button>
          {mine ? (
            <>
              <Button tone="paper" size="sm" onClick={() => nav(`/set/${set.id}/edit`)}>
                Edit
              </Button>
              <Button tone="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={mutating} onClick={copyToMine}>
              Save a copy
            </Button>
          )}
        </div>
      </div>

      <motion.div
        variants={list}
        initial="initial"
        animate="enter"
        className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        {modes.map((m) => (
          <motion.div key={m.to} variants={item}>
            <Link to={`/set/${set.id}/${m.to}`}>
              <motion.div
                whileHover={{ y: -4, rotate: -0.5 }}
                whileTap={{ scale: 0.97 }}
                transition={snap}
                className="flex h-28 flex-col justify-between rounded-xl border-2 border-ink bg-paper p-4 shadow-[0_4px_0_var(--color-ink)]"
              >
                <span className="font-mono text-xl leading-none text-margin">{m.glyph}</span>
                <span>
                  <span className="block font-display text-lg font-bold leading-tight">{m.label}</span>
                  <span className="text-xs text-ink-3">{m.hint}</span>
                </span>
              </motion.div>
            </Link>
          </motion.div>
        ))}
        <motion.div variants={item} className="col-span-2 md:col-span-1">
          <Link to={`/set/${set.id}/review`}>
            <motion.div
              whileHover={{ y: -4, rotate: 0.5 }}
              whileTap={{ scale: 0.97 }}
              transition={snap}
              className="flex h-28 flex-col justify-between rounded-xl border-2 border-ink bg-marker p-4 shadow-[0_4px_0_var(--color-ink)]"
            >
              <span className="flex items-baseline justify-between">
                <span className="font-mono text-xl leading-none">↻</span>
                <span className="font-mono text-2xl font-bold">{stats.due}</span>
              </span>
              <span>
                <span className="block font-display text-lg font-bold leading-tight">Review</span>
                <span className="text-xs text-ink-2">
                  {stats.due ? `${stats.due} due now` : 'Spaced repetition'}
                </span>
              </span>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>

      <section className="mt-10 rounded-2xl bg-paper p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Your progress</h2>
          {Object.keys(progress).length > 0 && (
            <button
              onClick={() => setConfirmReset(true)}
              className="text-xs font-semibold text-ink-3 hover:text-margin"
            >
              Reset progress
            </button>
          )}
        </div>
        <div className="mt-3">
          <MasteryStrip counts={stats} total={set.cards.length} />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Cards</h2>
        <button
          type="button"
          aria-pressed={starsOnly}
          onClick={() => setStarsOnly((only) => !only)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${starsOnly ? 'bg-marker' : 'bg-paper hover:bg-marker-soft'}`}
        >
          Starred only ({set.cards.filter((c) => starred.includes(c.id)).length})
        </button>
        <Segmented
          id="sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'original', label: 'Original order' },
            { value: 'mastery', label: 'Weakest first' },
          ]}
        />
      </div>
      {starsOnly && sorted.length > 0 && (
        <Link
          to={`/set/${set.id}/flashcards?starred=1`}
          className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
        >
          Study starred flashcards →
        </Link>
      )}
      {starsOnly && sorted.length === 0 && (
        <p className="mt-4 rounded-xl bg-paper p-5 text-sm text-ink-2">
          No starred cards yet. Switch off Starred only and tap a star beside a card.
        </p>
      )}
      <motion.ul layout className="mt-4 space-y-2.5">
        <AnimatePresence initial={false}>
          {sorted.map((c) => {
            const l = level(progress[c.id])
            return (
              <motion.li
                key={c.id}
                layout
                transition={snap}
                className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-xl bg-paper px-4 py-3.5 shadow-card sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.6fr)]"
              >
                <span className="row-span-2 flex flex-col items-center gap-1 sm:row-span-1">
                  <StarButton
                    starred={starred.includes(c.id)}
                    term={c.term}
                    onClick={() => void toggleStar(c.id)}
                    disabled={savingStars.includes(c.id)}
                  />
                  <span className={`h-2 w-2 rounded-full ${dot[l]}`} title={l} />
                </span>
                <span className="font-semibold sm:border-r sm:border-rule-soft sm:pr-4">{c.term}</span>
                <div className="col-start-2 whitespace-pre-wrap text-ink-2 sm:col-start-3">
                  {c.definition}
                  <CardAttribution value={c.attribution} />
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </motion.ul>

      <ShareModal set={set} open={share} onClose={() => setShare(false)} onUpdate={setSet} />
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)}>
        <h2 className="font-display text-2xl font-bold">Reset your progress?</h2>
        <p className="mt-3 text-ink-2">
          All cards in this set will be marked new, and their review dates will be cleared.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button tone="ghost" onClick={() => setConfirmReset(false)}>
            Keep progress
          </Button>
          <Button
            tone="danger"
            onClick={() => {
              reset()
              setConfirmReset(false)
              toast('Progress reset')
            }}
          >
            Reset progress
          </Button>
        </div>
      </Modal>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2 className="font-display text-2xl font-bold">Delete “{set.title}”?</h2>
        <p className="mt-2 text-ink-2">
          The set and its {set.cards.length} cards are removed for good.{' '}
          {cloud
            ? 'Anyone with the link loses access too.'
            : 'Previously shared links still contain their own copy.'}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button tone="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            tone="danger"
            disabled={mutating}
            onClick={async () => {
              setMutating(true)
              try {
                await deleteSet(set.id)
                toast('Set deleted')
                nav('/')
              } catch (e) {
                toast((e as Error).message)
              } finally {
                setMutating(false)
              }
            }}
          >
            {mutating ? 'Deleting…' : 'Delete set'}
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
