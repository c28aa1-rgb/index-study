import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { Button, Page, Spinner } from '../components/ui'
import { Logo } from '../components/Nav'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function OAuthConsent() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const { user } = useAuth()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    if (!authorizationId || !/^[A-Za-z0-9_-]{20,128}$/.test(authorizationId) || !supabase) { setError('This connection link is incomplete. Start again from ChatGPT.'); setLoading(false); return }
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) setError('This connection request expired or couldn’t be loaded. Start again from ChatGPT.')
      else if ('redirect_url' in data) window.location.assign(data.redirect_url)
      else setDetails(data)
      setLoading(false)
    }).catch(() => { if (alive) { setError('Couldn’t load the request. Check your connection and start again.'); setLoading(false) } })
    return () => { alive = false }
  }, [authorizationId])
  async function decide(approve: boolean) {
    if (!details || !authorizationId || !supabase || !user) return
    setBusy(true); setError('')
    try {
      if (approve) {
        const { error } = await supabase.from('study_connector_grants').upsert({ user_id: user.id, client_id: details.client.id }, { ignoreDuplicates: true })
        if (error) throw error
      }
      const { data, error } = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
      if (error || !data) throw error || new Error('No return address')
      // Return URL comes only from the authenticated provider, never URL parameters.
      window.location.assign(data.redirect_url)
    } catch {
      setError('The connection couldn’t finish. Try again or return to ChatGPT and reconnect.')
      setBusy(false)
    }
  }
  return <Page className="min-h-screen max-w-2xl py-7">
    <Logo />
    <section className="study-panel mt-12 sm:mt-20" aria-labelledby="connect-title">
      <h1 id="connect-title" className="font-display text-3xl font-bold">Connect your study sets</h1>
      {loading ? <div className="mt-8"><Spinner /></div> : details && <>
        <p className="mt-4 text-ink-2"><strong className="text-ink">{details.client.name || 'This application'}</strong> wants to use your Index library.</p>
        <p className="mt-2 break-all text-sm text-ink-3">Signed in as {user?.email}</p>
        <ul className="my-7 list-disc space-y-3 pl-5 text-ink-2">
          <li>Find and read your study sets.</li>
          <li>Create private sets from notes you give it.</li>
          <li>Add or remove cards in your existing sets.</li>
        </ul>
        <p className="text-sm leading-relaxed text-ink-2">Your study progress and starred cards stay separate. The connection cannot delete whole sets or change who can see them.</p>
        <div className="my-6 border-y border-rule py-4 text-xs leading-relaxed text-ink-3">
          <p>Returns to <span className="break-all">{details.redirect_uri}</span></p>
          <p className="mt-2">Requested identity permissions: {details.scope || 'Account identity only'}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => decide(true)}>{busy ? 'Finishing…' : 'Allow connection'}</Button>
          <Button tone="paper" disabled={busy} onClick={() => decide(false)}>Don’t allow</Button>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-ink-3">Only allow apps you trust. You can disconnect at any time in <Link className="underline" to="/connections">Connections</Link>.</p>
      </>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-margin/10 p-3 text-sm text-margin">{error}</p>}
    </section>
  </Page>
}
