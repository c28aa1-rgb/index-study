import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ImportModal } from '../components/ImportModal'
import { toast } from '../components/Toast'
import { BackLink, Button, Empty, Page, Segmented, Spinner, Toggle } from '../components/ui'
import { CardSuggestions } from '../components/CardSuggestions'
import { CardAttribution } from '../components/Attribution'
import { playSound } from '../lib/sound'
import { useAuth } from '../lib/auth'
import { paper, snap } from '../lib/motion'
import { getSet, saveSet } from '../lib/store'
import { cloud } from '../lib/supabase'
import type { Card, Side, StudySet, Visibility } from '../lib/types'
import { uid } from '../lib/util'

const blank = (): Card => ({ id: uid(), term: '', definition: '' })

function AutoText({
  value,
  onChange,
  placeholder,
  onKeyDown,
  inputRef,
  onFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  inputRef?: (el: HTMLTextAreaElement | null) => void
  onFocus?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={(el) => {
        ref.current = el
        inputRef?.(el)
      }}
      rows={1}
      value={value}
      aria-label={placeholder}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="field resize-none overflow-hidden leading-snug"
    />
  )
}

function Row({
  card,
  index,
  onChange,
  onDelete,
  onTabOut,
  onMove,
  register,
  suggestions,
  cards,
  context,
}: {
  card: Card
  index: number
  onChange: (c: Card) => void
  onDelete: () => void
  onTabOut: () => void
  onMove: (direction: -1 | 1) => void
  register: (el: HTMLTextAreaElement | null) => void
  suggestions: boolean
  cards: Card[]
  context: string
}) {
  const drag = useDragControls()
  const [focused, setFocused] = useState<Side | null>(null)
  return (
    <Reorder.Item
      value={card}
      dragListener={false}
      dragControls={drag}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: paper }}
      exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-lift)', rotate: -0.6 }}
      className="relative mb-4 list-none rounded-xl bg-paper shadow-card"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          const label = focused === 'term' ? 'Term' : 'Definition'
          event.currentTarget.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)?.focus()
          setFocused(null)
        }
      }}
    >
      <div className="flex items-center justify-between border-b-[1.5px] border-margin/70 px-4 py-2">
        <span className="font-mono text-sm font-bold text-ink-3">{index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            onPointerDown={(e) => drag.start(e)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                onMove(e.key === 'ArrowUp' ? -1 : 1)
              }
            }}
            className="cursor-grab touch-none rounded-md px-2 py-1 text-ink-3 hover:bg-desk hover:text-ink active:cursor-grabbing"
            aria-label={`Reorder card ${index + 1}. Use up or down arrows.`}
          >
            ⋮⋮
          </button>
          <button
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-ink-3 hover:bg-margin/10 hover:text-margin"
            aria-label={`Delete card ${index + 1}`}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="grid gap-5 p-4 pb-5 sm:grid-cols-2">
        <div>
          <AutoText
            value={card.term}
            inputRef={register}
            onChange={(term) => onChange({ ...card, term })}
            placeholder="Term"
            onFocus={() => setFocused('term')}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">Term</p>
        </div>
        <div>
          <AutoText
            value={card.definition}
            onChange={(definition) => onChange({ ...card, definition, attribution: definition.trim() ? card.attribution : undefined })}
            placeholder="Definition"
            onFocus={() => setFocused('definition')}
            onKeyDown={(e) => {
              if (
                e.key === 'Tab' &&
                !e.shiftKey &&
                !e.currentTarget.closest('li')?.querySelector('[role="group"] button')
              ) onTabOut()
            }}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">Definition</p>
          <CardAttribution value={card.attribution} />
        </div>
      </div>
      {suggestions && focused && (
        <CardSuggestions
          card={card}
          side={focused}
          cards={cards}
          context={context}
          index={index}
          onSelect={(suggestion) => {
            const term =
              focused === 'term' ||
              !card.term.trim() ||
              suggestion.term.toLowerCase().startsWith(card.term.trim().toLowerCase())
                ? suggestion.term
                : card.term
            const fillDefinition = focused === 'definition' || !card.definition.trim()
            onChange({
              ...card,
              term,
              definition: fillDefinition && suggestion.definition ? suggestion.definition : card.definition,
              attribution:
                fillDefinition && suggestion.definition ? suggestion.attribution : card.attribution,
            })
            playSound('tap')
            setFocused(null)
          }}
        />
      )}
    </Reorder.Item>
  )
}

export default function Editor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { user, name, ready } = useAuth()
  const [set, setSet] = useState<StudySet | null>(null)
  const [importOpen, setImportOpen] = useState(params.get('import') === '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState(() => {
    try {
      return localStorage.getItem('index.suggestions') !== 'off'
    } catch {
      return true
    }
  })
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('index.suggestions', suggestions ? 'on' : 'off')
    } catch {}
  }, [suggestions])

  useEffect(() => {
    if (!ready) return
    if (cloud && !user) {
      nav('/auth?next=' + encodeURIComponent(location.hash.slice(1)), { replace: true })
      return
    }
    if (!id) {
      const now = new Date().toISOString()
      setSet({
        id: uid(),
        title: '',
        description: '',
        cards: [blank(), blank(), blank()],
        visibility: 'unlisted',
        owner_id: user?.id ?? null,
        author_name: name,
        created_at: now,
        updated_at: now,
      })
      return
    }
    getSet(id)
      .then((s) => {
        if (!s) return nav('/', { replace: true })
        // Editing someone else's set makes your own copy.
        if (cloud && s.owner_id !== user?.id)
          setSet({
            ...s,
            id: uid(),
            title: s.title + ' (copy)',
            owner_id: user!.id,
            author_name: name,
            visibility: 'unlisted',
          })
        else setSet(s)
      })
      .catch((e) => setError(e.message))
  }, [id, ready, user?.id])

  useEffect(() => {
    if (focusNext.current) {
      refs.current[focusNext.current]?.focus()
      focusNext.current = null
    }
  })

  if (!set) return <Page>{error ? <Empty title="Couldn't load this set" body={error} /> : <Spinner />}</Page>

  const patch = (p: Partial<StudySet>) => setSet({ ...set, ...p })
  const setCards = (cards: Card[]) => patch({ cards })
  const addCard = () => {
    const c = blank()
    focusNext.current = c.id
    setCards([...set.cards, c])
  }

  const save = async () => {
    const cards = set.cards.filter((c) => c.term.trim() || c.definition.trim())
    if (!set.title.trim()) return setError('Give the set a title.')
    if (cards.length < 2) return setError('Add at least two cards.')
    if (cards.some((c) => !c.term.trim() || !c.definition.trim()))
      return setError('Add a term and definition to every card.')
    setError('')
    setSaving(true)
    try {
      const saved = await saveSet({ ...set, title: set.title.trim(), cards }, id && set.owner_id === user?.id ? set.updated_at : undefined)
      toast(id ? 'Set saved' : 'Set created')
      nav(`/set/${saved.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Page>
      <div className="flex items-center justify-between pt-8">
        <BackLink to={id ? `/set/${id}` : '/'} label={id ? 'Back to set' : 'Library'} />
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight">
        {id ? 'Edit set' : 'New set'}
      </h1>

      <div className="mt-8 grid gap-6">
        <div>
          <input
            aria-label="Set title"
            maxLength={200}
            autoFocus={!id}
            className="field font-display text-2xl font-bold"
            placeholder="Title, like “Bio unit 3: cells”"
            value={set.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">Title</p>
        </div>
        <div>
          <input
            aria-label="Set description"
            maxLength={5000}
            className="field"
            placeholder="What's in it (optional)"
            value={set.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">Description</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="paper" size="sm" onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button
              tone="ghost"
              size="sm"
              onClick={() =>
                setCards(set.cards.map((c) => ({ ...c, term: c.definition, definition: c.term })))
              }
            >
              Swap terms and definitions
            </Button>
          </div>
          {cloud && (
            <Segmented<Visibility>
              id="vis"
              value={set.visibility}
              onChange={(visibility) => patch({ visibility })}
              options={[
                { value: 'private', label: 'Only me' },
                { value: 'unlisted', label: 'Anyone with link' },
                { value: 'public', label: 'Public' },
              ]}
            />
          )}
        </div>
      </div>

      <div className="mt-5 max-w-lg">
        <Toggle label="Term and definition suggestions" checked={suggestions} onChange={setSuggestions} />
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          Matches from your cards, public sets and Wiktionary. Choose a suggestion to use it.
        </p>
      </div>

      <Reorder.Group axis="y" values={set.cards} onReorder={setCards} className="mt-8">
        <AnimatePresence initial={false}>
          {set.cards.map((c, i) => (
            <Row
              key={c.id}
              card={c}
              index={i}
              suggestions={suggestions}
              cards={set.cards}
              context={`${set.title} ${set.description}`}
              register={(el) => (refs.current[c.id] = el)}
              onChange={(nc) => setCards(set.cards.map((x) => (x.id === c.id ? nc : x)))}
              onDelete={() => setCards(set.cards.filter((x) => x.id !== c.id))}
              onMove={(direction) => {
                const next = i + direction
                if (next < 0 || next >= set.cards.length) return
                const cards = [...set.cards]
                ;[cards[i], cards[next]] = [cards[next], cards[i]]
                setCards(cards)
              }}
              onTabOut={() => {
                if (i === set.cards.length - 1) addCard()
              }}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      <motion.button
        layout
        onClick={addCard}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={snap}
        className="flex h-20 w-full items-center justify-center rounded-xl border-2 border-dashed border-ink/25 font-semibold text-ink-2 hover:border-ink hover:text-ink"
      >
        + Add card
      </motion.button>

      <div className="sticky bottom-4 z-30 mt-10 flex items-center justify-between gap-4 rounded-2xl bg-ink/95 p-3 pl-5 text-white shadow-lift backdrop-blur">
        <AnimatePresence mode="wait">
          <motion.span
            key={error || 'count'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`text-sm ${error ? 'font-semibold text-marker' : 'text-white/70'}`}
          >
            {error || `${set.cards.filter((c) => c.term || c.definition).length} cards`}
          </motion.span>
        </AnimatePresence>
        <Button tone="marker" onPointerDown={event => event.preventDefault()} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create set'}
        </Button>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(cards, replace) => {
          const kept = replace ? [] : set.cards.filter((c) => c.term || c.definition)
          setCards([...kept, ...cards])
          toast(`Imported ${cards.length} cards`)
        }}
      />
    </Page>
  )
}
