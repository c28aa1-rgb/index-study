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
          'sb-index-test-auth-token',
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
  await page.route('https://index-test.supabase.co/**', async (route) => {
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
    if (url.pathname.endsWith('/rpc/suggest_study_cards')) {
      const { p_query, p_side } = request.postDataJSON()
      let sets: StudySet[]
      try {
        sets = await page.evaluate(() => JSON.parse(localStorage.getItem('di.sets') || '[]'))
      } catch (error) {
        if (/Execution context was destroyed|Target page.*closed/.test(String(error)))
          return route.abort().catch(() => {}) // A pending suggestion was cancelled by navigation.
        throw error
      }
      const rows = sets
        .filter((set) => set.owner_id === userId || set.visibility === 'public')
        .flatMap((set) =>
          set.cards
            .filter(
              (card) =>
                typeof card[p_side as 'term' | 'definition'] === 'string' &&
                card[p_side as 'term' | 'definition'].toLowerCase().startsWith(p_query.toLowerCase()),
            )
            .map((card) => ({ ...card, mine: set.owner_id === userId })),
        )
        .slice(0, 8)
      return route.fulfill({ json: rows })
    }
    if (url.pathname.endsWith('/study_sets')) {
      const sets = (await page.evaluate(() =>
        JSON.parse(localStorage.getItem('di.sets') || '[]'),
      )) as StudySet[]
      if (['POST', 'PATCH'].includes(request.method())) {
        const next = request.postDataJSON() as StudySet
        if (request.method() === 'PATCH' && !sets.some(s => s.id === value('id') && s.updated_at === value('updated_at') && s.owner_id === userId))
          return route.fulfill({ json: object ? null : [] })
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
    if (url.pathname.endsWith('/study_stars')) {
      const setId = request.method() === 'POST' ? request.postDataJSON().set_id : value('set_id')
      const key = `test.stars.${userId}.${setId}`
      const stars: string[] = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), key)
      if (request.method() !== 'GET') {
        const cardId = request.method() === 'POST' ? request.postDataJSON().card_id : value('card_id')
        const next =
          request.method() === 'POST' ? [...new Set([...stars, cardId])] : stars.filter((s) => s !== cardId)
        await page.evaluate(({ key, next }) => localStorage.setItem(key, JSON.stringify(next)), { key, next })
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ json: stars.map((card_id) => ({ card_id })) })
    }
    return route.fulfill({ status: 404 })
  })
  await page.route('https://en.wiktionary.org/**', (route) => route.fulfill({ json: {} }))
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockGoogleAccount(page)
    await use(page)
  },
})
export { expect }
