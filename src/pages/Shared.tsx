import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink, Button, Empty, Page } from '../components/ui'
import { toast } from '../components/Toast'
import { useAuth } from '../lib/auth'
import { unpackSet } from '../lib/share'
import { saveSet } from '../lib/store'
import { cloud } from '../lib/supabase'
import { uid } from '../lib/util'
import { CardAttribution } from '../components/Attribution'

export default function Shared() {
  const { code } = useParams()
  const packed = useMemo(() => unpackSet(code || ''), [code])
  const { user, name } = useAuth()
  const nav = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!packed)
    return (
      <Page>
        <Empty
          title="This link couldn’t be read"
          body="It may be incomplete or damaged. Ask the sender to copy the full link again."
          action={<Link to="/">Go to library</Link>}
        />
      </Page>
    )
  const save = async () => {
    if (cloud && !user) return nav(`/auth?next=${encodeURIComponent(`/shared/${code}`)}`)
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const set = await saveSet({
        id: uid(),
        title: packed.t,
        description: packed.d,
        author_name: name,
        owner_id: user?.id || null,
        visibility: 'private',
        cards: packed.c.map(([term, definition, attribution]) => ({
          id: uid(),
          term,
          definition,
          ...(attribution ? { attribution } : {}),
        })),
        created_at: now,
        updated_at: now,
      })
      toast('Set saved to your library')
      nav(`/set/${set.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }
  return (
    <Page>
      <div className="pt-8">
        <BackLink to="/" label="Library" />
      </div>
      <section className="study-panel mt-8">
        <p className="text-sm text-ink-3">Shared by {packed.a || 'a classmate'}</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold">{packed.t}</h1>
        {packed.d && <p className="mt-3 text-ink-2">{packed.d}</p>}
        <p className="mt-4 text-sm text-ink-3">
          {packed.c.length} cards. Save a copy to study in all five modes.
        </p>
        <Button className="mt-6" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save and study'}
        </Button>
        {error && (
          <p className="mt-3 text-margin" role="alert">
            {error}
          </p>
        )}
      </section>
      <h2 className="mb-4 mt-8 font-display text-2xl font-bold">Cards in this set</h2>
      <div className="space-y-3">
        {packed.c.map(([term, definition, attribution], i) => (
          <div key={i} className="grid gap-3 rounded-xl bg-paper p-5 shadow-card sm:grid-cols-2">
            <p className="font-semibold">{term}</p>
            <div>
              <p className="whitespace-pre-wrap text-ink-2">{definition}</p>
              <CardAttribution value={attribution} />
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
