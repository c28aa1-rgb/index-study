import { useEffect, useState } from 'react'
import type { OAuthGrant } from '@supabase/supabase-js'
import { Button, Page, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Connections() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<OAuthGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let alive = true
    supabase?.auth.oauth.listGrants().then(({ data, error }) => {
      if (!alive) return
      if (error) setError('Connections couldn’t be loaded. Try refreshing this page.')
      else setGrants(data || [])
      setLoading(false)
    }).catch(() => { if (alive) { setError('Connections couldn’t be loaded. Try refreshing this page.'); setLoading(false) } })
    return () => { alive = false }
  }, [])
  async function disconnect(clientId: string) {
    if (!supabase || !user) return
    setBusy(clientId); setError('')
    try {
      // Removing our grant stops existing tokens immediately, even if provider revocation fails.
      const { error: localError } = await supabase.from('study_connector_grants').delete().eq('user_id', user.id).eq('client_id', clientId)
      if (localError) throw localError
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) {
        setError('Index set access has stopped. Refresh and disconnect again to finish removing the sign-in grant.')
      } else setGrants(list => list.filter(g => g.client.id !== clientId))
    } catch { setError('Couldn’t disconnect. Check your connection and try again.') }
    setBusy('')
  }
  return <Page className="max-w-3xl pt-10 sm:pt-16">
    <h1 className="desk-heading" id="connected-title">Connected apps</h1>
    <p className="mt-5 text-ink-2">Manage apps you’ve allowed to access your study sets.</p>
    <section className="mt-8" aria-labelledby="connected-title">
      {loading ? <div className="py-6"><Spinner /></div> : grants.length ? <ul className="mt-4 divide-y divide-rule">
        {grants.map(g => <li key={g.client.id} className="flex items-center justify-between gap-4 py-5">
          <div><p className="font-semibold">{g.client.name || 'Connected app'}</p><p className="mt-1 text-xs text-ink-3">Connected {new Date(g.granted_at).toLocaleDateString()}</p></div>
          <Button tone="paper" size="sm" disabled={!!busy} onClick={() => disconnect(g.client.id)}>{busy === g.client.id ? 'Disconnecting…' : 'Disconnect'}</Button>
        </li>)}
      </ul> : <p className="mt-4 text-sm text-ink-3">No apps connected yet.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-margin/10 p-3 text-sm text-margin">{error}</p>}
    </section>
  </Page>
}
