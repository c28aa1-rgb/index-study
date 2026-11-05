import { useEffect, useState } from 'react'
import type { OAuthGrant } from '@supabase/supabase-js'
import { Button, Page, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChatGPTMark } from '../components/ChatGPTMark'

const endpoint = 'https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp'
const pluginUrl = 'https://chatgpt.com/plugins/plugins_6aeca7c3678c8191a0abb08bc370a2b5'
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
    <h1 className="desk-heading">Use Index in ChatGPT.</h1>
    <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">Use your Index sets in ChatGPT. Web access depends on your ChatGPT plan and workspace.</p>
    <section className="mt-9 overflow-hidden rounded-2xl border border-ink/15 bg-paper" aria-labelledby="chatgpt-title">
      <div className="border-b border-rule bg-desk/60 px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white"><ChatGPTMark className="h-6 w-6" /></span>
          <div>
            <h2 id="chatgpt-title" className="font-display text-2xl font-bold">Connect to ChatGPT</h2>
          <p className="mt-1 text-sm text-ink-2">Your Index server and account connection are ready.</p>
          </div>
        </div>
        <a href={pluginUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 font-semibold text-white shadow-[0_3px_0_#0a1226] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin">
          <ChatGPTMark /> View Index Study plugin
        </a>
      </div>
      <div className="px-6 py-6 sm:px-8">
        <h3 className="font-display text-lg font-bold">Use Index in a ChatGPT web chat</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">The plugin page currently marks your Plus account as desktop-only. ChatGPT does not allow Plus accounts to use custom MCP write actions from web chats. OpenAI currently lists Business, Enterprise, and Edu workspaces for full MCP access. Index can’t change this plan restriction.</p>
        <ol className="mt-5 space-y-5">
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">1</span>
            <div><p className="font-semibold">Use an eligible ChatGPT web workspace</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Your account or workspace must allow custom MCP apps with write actions. On Plus, use the desktop app for this private plugin.</p></div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">2</span>
            <div><p className="font-semibold">Add Index Study in ChatGPT web</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Open <strong>Plugins</strong>, choose <strong>+</strong> → <strong>Add custom MCP server</strong>, and use the server URL below. Select OAuth and dynamic client registration, then create and install the plugin.</p></div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">3</span>
            <div><p className="font-semibold">Connect your Index account</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Choose <strong>Connect</strong>, sign in with Google, then review the Index permission screen and choose <strong>Allow connection</strong>.</p></div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marker text-sm font-bold">4</span>
            <div><p className="font-semibold">Use it in a chat</p><p className="mt-1 text-sm leading-relaxed text-ink-2">Start a new ChatGPT web chat, type <kbd className="rounded border border-rule bg-desk px-1.5 py-0.5 text-xs">@</kbd>, select <strong>Index Study</strong>, and ask it to make or update a set.</p></div>
          </li>
        </ol>
        <div className="mt-6 rounded-xl border-l-4 border-margin bg-desk px-4 py-3 text-sm leading-relaxed text-ink-2">
          Try: <span className="font-semibold text-ink">“Make a study set from these notes”</span>, <span className="font-semibold text-ink">“Add these terms to my biology set”</span>, or <span className="font-semibold text-ink">“Remove this card from my set.”</span>
        </div>
        <details className="mt-5 border-t border-rule pt-4">
          <summary className="cursor-pointer font-semibold underline decoration-rule underline-offset-4">Server address and manual setup</summary>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">In ChatGPT on the web, open <strong>Plugins</strong>, choose <strong>+</strong>, then <strong>Add custom MCP server</strong>. Name it <strong>Index Study</strong>, paste the URL below, choose OAuth with dynamic client registration and scope <code>openid</code>, then create and install it. This requires an eligible workspace that supports MCP write actions.</p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="connector-url">Index server URL</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input id="connector-url" className="min-w-0 flex-1 rounded-lg border border-rule bg-desk px-3 py-3 text-xs" readOnly value={endpoint} onFocus={e => e.target.select()} />
            <Button tone="paper" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); setCopied(true) } catch { setError('Select and copy the server URL above.') } }}>{copied ? 'Copied' : 'Copy URL'}</Button>
          </div>
        </details>
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
