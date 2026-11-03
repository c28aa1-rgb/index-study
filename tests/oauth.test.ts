import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AUTH_RETURN_KEY, safeReturnTo, signInWithGoogle } from '../src/lib/oauth'

const { google } = vi.hoisted(() => ({ google: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { signInWithOAuth: google } } }))

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
  vi.stubGlobal('location', { origin: 'https://school.github.io', pathname: '/dalton-index/' })
  google.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

it('starts Google OAuth at the deployment base and preserves the requested set', async () => {
  google.mockResolvedValue({ error: null })
  await signInWithGoogle('/set/biology/learn')
  expect(google).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'https://school.github.io/dalton-index/', queryParams: { prompt: 'select_account' } },
  })
  expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBe('/set/biology/learn')
})

it('rejects unsafe destinations and clears the pending return route after OAuth failure', async () => {
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/auth?next=/auth', null]) {
    expect(safeReturnTo(path)).toBe('/')
  }
  expect(safeReturnTo('/shared/code?view=cards')).toBe('/shared/code?view=cards')
  google.mockResolvedValue({ error: new Error('Provider not enabled') })
  await expect(signInWithGoogle('/set/biology')).rejects.toThrow('Provider not enabled')
  expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull()
})
