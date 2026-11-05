import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ConnectorError, handler } from './core.ts'

const url = Deno.env.get('SUPABASE_URL')!
const key = Deno.env.get('SUPABASE_ANON_KEY')!
const client = (token: string) => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
})
Deno.serve(handler({
  async authenticate(token) {
    const { data, error } = await client(token).auth.getClaims(token)
    return error || !data ? null : data.claims as never
  },
  async execute(token, operation, args) {
    const { data, error } = await client(token).rpc('index_study_connector', { operation, arguments: args })
    if (error) {
      if (error.code === '42501') throw new ConnectorError('Your Index connection has expired or was disconnected. Reconnect your account.', 'unauthorized')
      if (['22023', '40001'].includes(error.code)) throw new ConnectorError(error.message, error.code)
      throw new ConnectorError('Index couldn’t save the change. Nothing was changed; try again shortly.', 'unavailable')
    }
    return data
  },
}))
