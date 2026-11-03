import { expect, test } from '@playwright/test'
import { mockGoogleAccount } from './cloud'

test('sign-in offers only Google and starts PKCE OAuth', async ({ page }) => {
  await mockGoogleAccount(page, { signedIn: false })
  // Previous local-mode flags must never bypass Google sign-in.
  await page.addInitScript(() => localStorage.setItem('di.localAccess', '1'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in to Dalton Index' })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue in this browser' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('heading', { name: 'Google sign-in test provider' })).toBeVisible()
  const url = new URL(page.url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4175/')
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
})
