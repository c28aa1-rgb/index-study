import { test, expect } from './cloud'

const clientId = '00000000-0000-4000-a000-000000000010'
const authorizationId = '00000000-0000-4000-a000-000000000011'
const detail = { authorization_id: authorizationId, client: { id: clientId, name: 'ChatGPT', uri: 'https://chatgpt.com', logo_uri: '' }, redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect', scope: 'openid', user: { id: '00000000-0000-4000-a000-000000000001', email: 'student@example.invalid' } }

test('connection request survives the static-page bridge and requires explicit approval', async ({ page }, testInfo) => {
  let approvals = 0
  let grants = 0
  await page.route('https://index-test.supabase.co/auth/v1/oauth/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: detail })
    approvals++
    return route.fulfill({ json: { redirect_url: 'http://127.0.0.1:4175/index-study/#/connections?connected=yes' } })
  })
  await page.route('https://index-test.supabase.co/rest/v1/study_connector_grants*', route => {
    grants++
    return route.fulfill({ status: 201, json: [] })
  })
  await page.goto(`/oauth-consent.html?authorization_id=${authorizationId}`)
  await expect(page.getByRole('heading', { name: 'Connect your study sets' })).toBeVisible()
  await expect(page.getByText('ChatGPT', { exact: true })).toBeVisible()
  await expect(page.getByText('Create private sets from notes you give it.')).toBeVisible()
  await page.screenshot({ path: `docs/connector-consent-${testInfo.project.name}.png`, fullPage: true })
  expect(approvals).toBe(0)
  expect(grants).toBe(0)
  await page.getByRole('button', { name: 'Allow connection' }).click()
  await expect(page).toHaveURL(/connected=yes/)
  expect(approvals).toBe(1)
  expect(grants).toBe(1)
})

test('denying a request never enables set access', async ({ page }) => {
  let grants = 0
  let action = ''
  await page.route('https://index-test.supabase.co/auth/v1/oauth/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: detail })
    action = route.request().postDataJSON().action
    return route.fulfill({ json: { redirect_url: 'http://127.0.0.1:4175/index-study/#/connections?denied=yes' } })
  })
  await page.route('https://index-test.supabase.co/rest/v1/study_connector_grants*', route => { grants++; return route.fulfill({ status: 201, json: [] }) })
  await page.goto(`/#/connect/authorize?authorization_id=${authorizationId}`)
  await page.getByRole('button', { name: 'Don’t allow' }).click()
  await expect(page).toHaveURL(/denied=yes/)
  expect(action).toBe('deny')
  expect(grants).toBe(0)
})

test('expired or missing requests cannot be approved', async ({ page }) => {
  await page.goto('/#/connect/authorize')
  await expect(page.getByRole('alert')).toContainText('incomplete')
  await expect(page.getByRole('button', { name: 'Allow connection' })).toHaveCount(0)
  await page.route('https://index-test.supabase.co/auth/v1/oauth/**', route => route.fulfill({ status: 400, json: { message: 'Expired' } }))
  await page.goto(`/#/connect/authorize?authorization_id=${authorizationId}`)
  await expect(page.getByRole('alert')).toContainText('expired')
  await expect(page.getByRole('button', { name: 'Allow connection' })).toHaveCount(0)
})

test('disconnect removes Index access before revoking provider tokens', async ({ page }) => {
  const calls: string[] = []
  await page.route('https://index-test.supabase.co/auth/v1/user/oauth/grants*', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [{ client: detail.client, scopes: ['openid'], granted_at: '2026-11-05T12:00:00Z' }] })
    calls.push('provider')
    return route.fulfill({ status: 204 })
  })
  await page.route('https://index-test.supabase.co/rest/v1/study_connector_grants*', route => { calls.push('index'); return route.fulfill({ status: 204 }) })
  await page.goto('/#/connections')
  await expect(page.getByRole('heading', { name: 'Connected apps' })).toBeVisible()
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  await expect(page.getByText('No apps connected yet.', { exact: false })).toBeVisible()
  expect(calls).toEqual(['index','provider'])
})
