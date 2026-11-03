import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { guess, parseImport, type RowSep, type Sep } from '../lib/importParse'
import type { Card } from '../lib/types'
import { Button, Modal, Segmented } from './ui'
import { snap } from '../lib/motion'

const placeholder = `Mitochondria\tMakes ATP
Ribosome\tBuilds proteins
Nucleus\tHolds DNA`

export function ImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (cards: Card[], replace: boolean) => void
}) {
  const [text, setText] = useState('')
  const [sep, setSep] = useState<Sep>({ kind: 'tab' })
  const [rowSep, setRowSep] = useState<RowSep>({ kind: 'newline' })
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const cards = useMemo(() => parseImport(text, sep, rowSep), [text, sep, rowSep])

  const onPaste = (value: string) => {
    setText(value)
    if (!touched && value) {
      const g = guess(value)
      setSep(g.sep)
      setRowSep(g.rowSep)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 2_000_000) {
      setError('Choose a file smaller than 2 MB.')
      return
    }
    try {
      onPaste(await f.text())
      setError('')
    } catch {
      setError('Couldn’t read that file. Try pasting the text instead.')
    }
  }

  const done = (replace: boolean) => {
    if (cards.length > 1000) {
      setError('Import up to 1,000 cards at a time.')
      return
    }
    onImport(
      cards.filter((c) => c.term || c.definition),
      replace,
    )
    setText('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Import cards</h2>
          <p className="mt-1 text-sm text-ink-2">
            Paste from Docs, Sheets, Word, or a .csv / .txt file. Each line becomes a card.
          </p>
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 shrink-0 rounded-lg text-xl text-ink-3 hover:bg-desk"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <textarea
            aria-label="Paste cards to import"
            autoFocus
            value={text}
            onChange={(e) => onPaste(e.target.value)}
            placeholder={placeholder}
            className="h-64 w-full resize-none rounded-xl border-2 border-ink/15 bg-desk/50 p-3 font-mono text-sm outline-none transition-colors focus:border-ink"
          />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink">
            <input
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="underline decoration-rule decoration-2 underline-offset-4">Choose a file</span>
          </label>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="mb-1.5 font-semibold">Between term and definition</p>
              <Segmented
                id="sep"
                value={sep.kind}
                onChange={(k) => {
                  setTouched(true)
                  setSep({ kind: k, custom: sep.custom })
                }}
                options={[
                  { value: 'tab', label: 'Tab' },
                  { value: 'comma', label: 'Comma' },
                  { value: 'dash', label: ' - ' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />
              {sep.kind === 'custom' && (
                <input
                  className="field mt-2 max-w-40 font-mono"
                  placeholder="e.g. :"
                  value={sep.custom ?? ''}
                  onChange={(e) => setSep({ kind: 'custom', custom: e.target.value })}
                />
              )}
            </div>
            <div>
              <p className="mb-1.5 font-semibold">Between cards</p>
              <Segmented
                id="rowsep"
                value={rowSep.kind}
                onChange={(k) => {
                  setTouched(true)
                  setRowSep({ kind: k, custom: rowSep.custom })
                }}
                options={[
                  { value: 'newline', label: 'New line' },
                  { value: 'semicolon', label: 'Semicolon' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />
              {rowSep.kind === 'custom' && (
                <input
                  className="field mt-2 max-w-40 font-mono"
                  placeholder="e.g. |"
                  value={rowSep.custom ?? ''}
                  onChange={(e) => setRowSep({ kind: 'custom', custom: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <p className="mb-2 text-sm font-semibold">
            Preview <span className="font-mono text-ink-3">{cards.length}</span>
          </p>
          <div className="h-80 overflow-auto rounded-xl bg-desk/60 p-2">
            {cards.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-3">Cards show up here as you paste.</p>
            )}
            <AnimatePresence initial={false}>
              {cards.slice(0, 200).map((c, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={snap}
                  className="mb-1.5 grid grid-cols-2 gap-3 rounded-lg bg-paper px-3 py-2 text-sm shadow-card"
                >
                  <span className="truncate font-semibold">{c.term || <em className="text-ink-3">empty</em>}</span>
                  <span className={`truncate ${c.definition ? 'text-ink-2' : 'text-margin'}`}>
                    {c.definition || 'no definition found'}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-margin" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button tone="paper" disabled={!cards.length} onClick={() => done(true)}>
          Replace all cards
        </Button>
        <Button disabled={!cards.length} onClick={() => done(false)}>
          Add {cards.length || ''} cards
        </Button>
      </div>
    </Modal>
  )
}
