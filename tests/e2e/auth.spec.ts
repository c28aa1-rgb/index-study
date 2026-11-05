import { expect, test } from '@playwright/test'
import { mockGoogleAccount } from './cloud'

test('sign-in offers only Google and starts PKCE OAuth', async ({ page }) => {
  await mockGoogleAccount(page, { signedIn: false })
  // Previous local-mode flags must never bypass Google sign-in.
  await page.addInitScript(() => localStorage.setItem('di.localAccess', '1'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in to Index' })).toBeVisible()
  await expect(page).toHaveTitle('Index')
  await expect(page.getByText(/Dalton/i)).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue in this browser' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('heading', { name: 'Google sign-in test provider' })).toBeVisible()
  const url = new URL(page.url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4175/')
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
})

test('Google sign-in preserves the Index connection request', async ({ page }) => {
  await mockGoogleAccount(page, { signedIn: false })
  const request = '/connect/authorize?authorization_id=test-connection-id'
  await page.goto('/#' + request)
  await expect(page.getByRole('heading', { name: 'Sign in to Index' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('heading', { name: 'Google sign-in test provider' })).toBeVisible()
  await page.goto('/') // Inspect the saved return path on Index's origin.
  const saved = await page.evaluate(() => sessionStorage.getItem('di.auth.next'))
  expect(saved).toBe(request)
})
