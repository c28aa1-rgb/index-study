import { useEffect, useState } from 'react'
import type { OAuthGrant } from '@supabase/supabase-js'
import { Button, Page, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const endpoint = 'https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp'
export default function Connections() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<OAuthGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
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
    <h1 className="desk-heading">Your notes. Your next set.</h1>
    <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">Connect Index to ChatGPT, then give it notes, a document, or a topic. Ask it to create a study set or update cards you already have.</p>
    <section className="mt-9 border-l-4 border-margin bg-paper px-6 py-6 sm:px-8" aria-labelledby="chatgpt-title">
      <h2 id="chatgpt-title" className="font-display text-2xl font-bold">Study sets in ChatGPT</h2>
      <p className="mt-4 text-sm leading-relaxed text-ink-2">Add Index as a custom MCP server in ChatGPT’s Plugins settings, using this server URL and OAuth authentication. When you connect, sign in with Google and review the permissions.</p>
      <label className="mt-5 block text-sm font-semibold" htmlFor="connector-url">Server URL</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input id="connector-url" className="min-w-0 flex-1 rounded-lg border border-rule bg-desk px-3 py-3 text-xs" readOnly value={endpoint} onFocus={e => e.target.select()} />
        <Button tone="paper" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); setCopied(true) } catch { setError('Select and copy the server URL above.') } }}>{copied ? 'Copied' : 'Copy URL'}</Button>
      </div>
      <a href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-semibold underline decoration-margin underline-offset-4">Open ChatGPT plugins</a>
      <p className="mt-6 border-t border-rule pt-5 text-sm italic leading-relaxed text-ink-2">“Make a 20-card study set from these notes.”<br />“Add five examples to my biology set.”<br />“Remove the duplicate cards from that set.”</p>
    </section>
    <section className="mt-10" aria-labelledby="connected-title">
      <h2 id="connected-title" className="font-display text-2xl font-bold">Connected apps</h2>
      {loading ? <div className="py-6"><Spinner /></div> : grants.length ? <ul className="mt-4 divide-y divide-rule">
        {grants.map(g => <li key={g.client.id} className="flex items-center justify-between gap-4 py-5">
          <div><p className="font-semibold">{g.client.name || 'Connected app'}</p><p className="mt-1 text-xs text-ink-3">Connected {new Date(g.granted_at).toLocaleDateString()}</p></div>
          <Button tone="paper" size="sm" disabled={!!busy} onClick={() => disconnect(g.client.id)}>{busy === g.client.id ? 'Disconnecting…' : 'Disconnect'}</Button>
        </li>)}
      </ul> : <p className="mt-4 text-sm text-ink-3">No apps connected yet. Connect from ChatGPT to get started.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-margin/10 p-3 text-sm text-margin">{error}</p>}
    </section>
  </Page>
}
