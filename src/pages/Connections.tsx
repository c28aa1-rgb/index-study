import { useEffect, useState } from 'react'
import type { OAuthGrant } from '@supabase/supabase-js'
import { Button, Page, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChatGPTMark } from '../components/ChatGPTMark'

const connectionSite = 'https://index-study-web.wiseonyx1.chatgpt.site'
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
    <h1 className="desk-heading">Use Index in ChatGPT.</h1>
    <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">Turn notes into a private study set, or add and remove cards, from a ChatGPT Work conversation on the web.</p>
    <section className="mt-9 overflow-hidden rounded-2xl border border-ink/15 bg-paper" aria-labelledby="chatgpt-title">
      <div className="border-b border-rule bg-desk/60 px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-white"><ChatGPTMark className="h-6 w-6" /></span>
          <div>
            <h2 id="chatgpt-title" className="font-display text-2xl font-bold">Connect with ChatGPT</h2>
            <p className="mt-1 text-sm text-ink-2">Use the new Index Study Web plugin hosted on ChatGPT Sites.</p>
          </div>
        </div>
        <a href={connectionSite} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 font-semibold text-white shadow-[0_3px_0_#0a1226] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin">
          <ChatGPTMark /> Connect with ChatGPT
        </a>
      </div>
      <div className="px-6 py-6 sm:px-8">
        <h3 className="font-display text-lg font-bold">Set up your web connection</h3>
        <ol className="mt-5 space-y-5">
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">1</span>
            <div><p className="font-semibold">Link your Index account</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Open the connection Site above. Continue with ChatGPT if asked, then select <strong>Link Index account</strong>. Sign in with your Index Google account and choose <strong>Allow connection</strong>.</p></div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">2</span>
            <div><p className="font-semibold">Find Index Study Web in ChatGPT</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Open <a href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">ChatGPT Plugins</a>, then <strong>Personal → Created by you</strong>. Select <strong>Index Study Web</strong> and choose <strong>Install</strong> or <strong>Connect</strong> if shown.</p></div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">3</span>
            <div><p className="font-semibold">Start a Work chat on the web</p><p className="mt-1 text-sm leading-relaxed text-ink-2">At <strong>chatgpt.com</strong>, switch to <strong>Work</strong> and start a new conversation. Type <kbd className="rounded border border-rule bg-desk px-1.5 py-0.5 text-xs">@</kbd>, select <strong>Index Study Web</strong>, then give it your notes and ask for a set.</p></div>
          </li>
        </ol>
        <div className="mt-6 rounded-xl border-l-4 border-margin bg-desk px-4 py-3 text-sm leading-relaxed text-ink-2">
          Try: <span className="font-semibold text-ink">“Make a study set from these notes”</span>, <span className="font-semibold text-ink">“Add these terms to my biology set”</span>, or <span className="font-semibold text-ink">“Remove this card from my set.”</span>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-ink-3">This Site-hosted connection is private to its owner’s ChatGPT account. Other people need their own connection; personal Site plugins cannot currently be shared. Account linking is complete when the Site says “Index account linked.”</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">Only your own sets are available. New sets are private. Disconnect below or on the connection Site to stop access.</p>
      </div>
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
