import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
export const cloud = !!supabase

export async function googleSignInEnabled(): Promise<boolean> {
  if (!url || !key) return false
  const response = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key } })
  if (!response.ok) throw new Error('Couldn’t check Google sign-in availability.')
  const settings = await response.json()
  return settings.external?.google === true
}
