import { supabase } from './supabase'

export const AUTH_RETURN_KEY = 'di.auth.next'

export function safeReturnTo(path: string | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !path.startsWith('/auth')
    ? path
    : '/'
}

export async function signInWithGoogle(next: string) {
  if (!supabase) throw new Error('Google sign-in isn’t connected yet.')
  sessionStorage.setItem(AUTH_RETURN_KEY, safeReturnTo(next))
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: new URL(location.pathname, location.origin).href,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
  } catch (error) {
    sessionStorage.removeItem(AUTH_RETURN_KEY)
    throw error
  }
}
