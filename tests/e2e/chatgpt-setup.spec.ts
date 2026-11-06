import { expect, test } from '@playwright/test'
import { mockGoogleAccount } from './cloud'

test('public ChatGPT guide explains eligibility and serves real screenshots before sign-in', async ({ page }) => {
  await mockGoogleAccount(page, { signedIn: false })
  await page.goto('/#/chatgpt-setup')
  await expect(page.getByRole('heading', { name: /Connect Index.*to ChatGPT/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Check your ChatGPT access first' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Server URL', exact: true })).toHaveValue('https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp')
  await expect(page.getByRole('textbox', { name: 'Base scopes', exact: true })).toHaveValue('openid\noffline_access')
  const images = page.locator('figure img')
  await expect(images).toHaveCount(5)
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(633)
    expect(await image.evaluate(el => (el as HTMLImageElement).naturalHeight)).toBe(977)
  }
  await page.getByText('I don’t see Add custom MCP server.', { exact: true }).click()
  await expect(page.getByText(/The Index URL cannot unlock a disabled ChatGPT feature/)).toBeVisible()
  const links = await page.locator('main a').evaluateAll(els => els.map(el => (el as HTMLAnchorElement).href))
  expect(links.some(href => href.includes('.chatgpt.site'))).toBe(false)
  expect(page.url()).toContain('#/chatgpt-setup')
})
