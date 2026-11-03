import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Nav'
import { Button, Page } from '../components/ui'
import { useAuth } from '../lib/auth'
import { safeReturnTo, signInWithGoogle } from '../lib/oauth'

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.4Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.2-1.8 13.6-5l-6.7-5.2c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.7-3.5-11.3-8.3H5.8v5.4A20.5 20.5 0 0 0 24 44Z"
      />
      <path fill="#FBBC05" d="M12.7 27.5a12.3 12.3 0 0 1 0-7V15H5.8a20 20 0 0 0 0 18l6.9-5.5Z" />
      <path
        fill="#EA4335"
        d="M24 12.2c3 0 5.6 1 7.7 3l5.8-5.8A19.6 19.6 0 0 0 24 4 20.5 20.5 0 0 0 5.8 15l6.9 5.5A12 12 0 0 1 24 12.2Z"
      />
    </svg>
  )
}

export default function AuthPage() {
  const [params] = useSearchParams()
  const next = safeReturnTo(params.get('next'))
  const nav = useNavigate()
  const { user, authError, googleEnabled } = useAuth()
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState(authError)
  useEffect(() => {
    setError(authError)
  }, [authError])
  useEffect(() => {
    if (user) nav(next, { replace: true })
  }, [user, next])
  const google = async () => {
    setError('')
    setGoogleBusy(true)
    try {
      await signInWithGoogle(next)
    } catch (e) {
      setError((e as Error).message)
      setGoogleBusy(false)
    }
  }
  return (
    <Page className="flex min-h-screen flex-col">
      <header className="py-7">
        <Logo />
      </header>
      <div className="my-auto grid items-center gap-12 py-10 md:grid-cols-[1fr_1.05fr] md:gap-20">
        <div className="max-w-md">
          <h1 className="desk-heading">
            Your study desk.
            <br />
            Ready when you are.
          </h1>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-ink-2">
            Keep your notes, cards, and next study session in one place.
          </p>
          <div className="mt-9 hidden border-l-2 border-margin pl-5 text-sm leading-7 text-ink-2 md:block">
            Flashcards. Learn. Test. Match. Review.
            <br />
            One set, however you want to study.
          </div>
        </div>
        <section
          className="study-panel w-full max-w-lg justify-self-center md:justify-self-end"
          aria-labelledby="signin-title"
        >
          <h2 id="signin-title" className="font-display text-3xl font-bold">
            Sign in to Index
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">Use Google to sign in or create an account.</p>
          <Button tone="paper" className="mt-6 w-full" disabled={!googleEnabled || googleBusy} onClick={google}>
            <GoogleMark />
            {googleBusy
              ? 'Opening Google…'
              : googleEnabled === null
                ? 'Checking Google sign-in…'
                : 'Continue with Google'}
          </Button>
          {googleEnabled === false && (
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Google sign-in is currently unavailable. Please try again later.
            </p>
          )}
          {error && (
            <p className="mt-5 rounded-lg bg-margin/10 p-3 text-sm text-margin" role="alert">
              {error}
            </p>
          )}
          <p className="mt-5 text-xs leading-relaxed text-ink-3">
            Your name comes from your Google profile. No separate password needed.
          </p>
        </section>
      </div>
    </Page>
  )
}
