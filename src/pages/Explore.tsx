import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Page, Spinner } from '../components/ui'
import { SetTile } from '../components/SetTile'
import { publicSets } from '../lib/store'
import { cloud } from '../lib/supabase'
import type { StudySet } from '../lib/types'

export default function Explore() {
  const [query, setQuery] = useState('')
  const [sets, setSets] = useState<StudySet[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!cloud) return
    let alive = true
    const timer = setTimeout(() => {
      setError('')
      publicSets(query)
        .then((s) => {
          if (alive) setSets(s)
        })
        .catch((e) => {
          if (alive) setError(e.message)
        })
    }, 220)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])
  return (
    <Page>
      <div className="pb-8 pt-12">
        <h1 className="desk-heading">Explore</h1>
        <p className="mt-4 max-w-lg text-ink-2">Find study sets shared by other students.</p>
        {cloud && (
          <input
            aria-label="Search sets"
            className="field mt-7 max-w-lg text-lg"
            placeholder="Search by subject or title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>
      {!cloud ? (
        <Empty
          title="No shared sets yet"
          body="Public sets will appear here when online sharing is connected. You can still send a set directly from its Share menu."
          action={
            <Link className="button-link" to="/">
              Your library
            </Link>
          }
        />
      ) : error ? (
        <Empty title="Couldn't load public sets" body={error} />
      ) : sets === null ? (
        <Spinner />
      ) : sets.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <SetTile key={s.id} set={s} />
          ))}
        </div>
      ) : (
        <Empty
          title={query ? 'No matching sets' : 'No shared sets yet'}
          body={query ? 'Try another subject or title.' : 'Make one of your sets public to share it here.'}
        />
      )}
    </Page>
  )
}
