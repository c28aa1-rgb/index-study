import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { googleSignInEnabled, supabase } from './supabase'
import { AUTH_RETURN_KEY, safeReturnTo } from './oauth'

type Auth = {
  user: User | null
  name: string
  ready: boolean
  authError: string
  googleEnabled: boolean | null
}
const Ctx = createContext<Auth>({
  user: null,
  name: '',
  ready: false,
  authError: '',
  googleEnabled: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [authError, setAuthError] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(supabase ? null : false)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    googleSignInEnabled()
      .then((enabled) => {
        if (alive) setGoogleEnabled(enabled)
      })
      .catch(() => {
        if (alive) setGoogleEnabled(false)
      })
    const complete = (nextUser: User | null) => {
      if (!alive) return
      setUser(nextUser)
      setReady(true)
      if (nextUser) {
        try {
          const destination = sessionStorage.getItem(AUTH_RETURN_KEY)
          sessionStorage.removeItem(AUTH_RETURN_KEY)
          if (destination) window.location.hash = safeReturnTo(destination)
        } catch {}
      }
    }
    supabase.auth
      .initialize()
      .then(async ({ error }) => {
        if (error && alive) setAuthError('Sign-in couldn’t finish. Please try again.')
        const { data, error: sessionError } = await supabase!.auth.getSession()
        if (!alive) return
        if (sessionError) setAuthError(sessionError.message)
        complete(data.session?.user ?? null)
      })
      .catch(() => {
        if (alive) setReady(true)
      })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      complete(s?.user ?? null)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const profileName = [user?.user_metadata?.full_name, user?.user_metadata?.name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim()
  const name = profileName || user?.email?.split('@')[0] || 'You'
  return <Ctx.Provider value={{ user, name, ready, authError, googleEnabled }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
