import { test as base, expect, type Page } from '@playwright/test'
import type { StudySet } from '../../src/lib/types'

export const USER_ID = '00000000-0000-4000-a000-000000000001'

export async function mockGoogleAccount(
  page: Page,
  options: { signedIn?: boolean; userId?: string; sets?: StudySet[] } = {},
) {
  const userId = options.userId || USER_ID
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'student@example.invalid',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'Google Student' },
    created_at: '2026-11-03T12:00:00Z',
  }
  await page.addInitScript(
    ({ user, signedIn, sets }) => {
      if (sets) localStorage.setItem('di.sets', JSON.stringify(sets))
      if (signedIn)
        localStorage.setItem(
          'sb-dalton-test-auth-token',
          JSON.stringify({
            access_token: 'browser-test-token',
            refresh_token: 'browser-test-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user,
          }),
        )
    },
    { user, signedIn: options.signedIn !== false, sets: options.sets },
  )
  await page.route('https://dalton-test.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/settings')
      return route.fulfill({ json: { external: { google: true, email: false }, disable_signup: false } })
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    if (url.pathname === '/auth/v1/authorize')
      return route.fulfill({ contentType: 'text/html', body: '<h1>Google sign-in test provider</h1>' })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (!url.pathname.startsWith('/rest/v1/'))
      return route.fulfill({ status: 404, json: { message: 'Unexpected mock endpoint' } })
    const object = request.headers().accept?.includes('vnd.pgrst.object')
    const value = (name: string) => url.searchParams.get(name)?.replace(/^eq\./, '')
    if (url.pathname.endsWith('/study_sets')) {
      const sets = (await page.evaluate(() => JSON.parse(localStorage.getItem('di.sets') || '[]'))) as StudySet[]
      if (request.method() === 'POST') {
        const next = request.postDataJSON() as StudySet
        await page.evaluate(
          (sets) => localStorage.setItem('di.sets', JSON.stringify(sets)),
          [next, ...sets.filter((s) => s.id !== next.id)],
        )
        return route.fulfill({ json: object ? next : [next] })
      }
      const rows = sets.filter(
        (s) =>
          (!value('id') || s.id === value('id')) &&
          (!value('owner_id') || s.owner_id === value('owner_id')) &&
          (!value('visibility') || s.visibility === value('visibility')) &&
          (s.owner_id === userId || s.visibility !== 'private'),
      )
      return route.fulfill({ json: object ? (rows[0] ?? null) : rows })
    }
    if (url.pathname.endsWith('/study_progress')) {
      if (request.method() === 'POST') return route.fulfill({ status: 204 })
      const key = `di.progress.${userId}.${value('set_id')}`
      const data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key)
      const rows = data ? [{ data, updated_at: new Date().toISOString() }] : []
      return route.fulfill({ json: object ? (rows[0] ?? null) : rows })
    }
    return route.fulfill({ status: 404 })
  })
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockGoogleAccount(page)
    await use(page)
  },
})
export { expect }
