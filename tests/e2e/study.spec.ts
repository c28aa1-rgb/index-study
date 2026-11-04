import { type Page } from '@playwright/test'
import { expect, test, mockGoogleAccount, USER_ID } from './cloud'

const pairs = [
  { id: 'a', term: 'Alpha', definition: 'First letter' },
  { id: 'b', term: 'Beta', definition: 'Second letter' },
  { id: 'c', term: 'Gamma', definition: 'Third letter' },
]
const seed = {
  id: 'study-seed',
  title: 'Greek letters',
  description: 'Practice recall',
  cards: pairs,
  visibility: 'private' as const,
  owner_id: USER_ID,
  author_name: 'Student',
  created_at: '2026-11-03T12:00:00Z',
  updated_at: '2026-11-03T12:00:00Z',
}
async function open(page: Page, path = '') {
  await page.addInitScript((set) => {
    if (!localStorage.getItem('di.sets')) localStorage.setItem('di.sets', JSON.stringify([set]))
  }, seed)
  await page.goto(`/#/set/${seed.id}${path}`)
}
test('imports CSV, validates incomplete cards, saves and edits a set', async ({ page }) => {
  await page.goto('/#/create?import=1')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Paste cards to import' })
    .fill('"Cell, membrane","Controls entry"\nNucleus,')
  await page.getByRole('button', { name: 'Replace all cards' }).click()
  await page.getByRole('textbox', { name: 'Set title' }).fill('Biology import')
  await page.getByRole('button', { name: 'Create set', exact: true }).click()
  await expect(page.getByText('Add a term and definition to every card.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Definition', exact: true }).last().fill('Holds DNA')
  await page.getByRole('button', { name: 'Create set', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Biology import' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'Term', exact: true }).first().fill('Cell membrane')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Cell membrane', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Controls entry', { exact: true })).toBeVisible()
})
test('flashcards flip, sort, undo persisted progress, and complete', async ({ page }) => {
  await open(page, '/flashcards')
  await page.getByRole('button', { name: /Term: Alpha/ }).click()
  await expect(page.getByRole('button', { name: /Definition: First letter/ })).toBeVisible()
  await page.getByRole('button', { name: 'Know it', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || '{}').a?.reps,
        `di.progress.${USER_ID}.study-seed`,
      ),
    )
    .toBe(1)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        (key) => Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length,
        `di.progress.${USER_ID}.study-seed`,
      ),
    )
    .toBe(0)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Know it', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Clean sweep.' })).toBeVisible()
})
test('learn progresses from choices to written recall', async ({ page }) => {
  await open(page, '/learn')
  await page.getByRole('button', { name: 'Start learning', exact: true }).click()
  for (let i = 0; i < pairs.length; i++) {
    const term = await page.locator('main p.whitespace-pre-wrap').first().innerText()
    const correct = pairs.find((c) => c.term === term)!.definition
    await page.getByRole('button', { name: new RegExp(correct) }).click()
    if (i < pairs.length - 1) {
      await expect(page.getByRole('button', { name: new RegExp(correct) })).toBeDisabled()
      await expect(page.locator('main p.whitespace-pre-wrap').first()).not.toHaveText(term)
    }
  }
  await page.getByRole('button', { name: 'Continue to round 2' }).click()
  for (let round = 2; round <= 3; round++) {
    for (let i = 0; i < pairs.length; i++) {
      const term = await page.locator('main p.whitespace-pre-wrap').first().innerText()
      await page
        .getByRole('textbox', { name: 'Type the answer' })
        .fill(pairs.find((c) => c.term === term)!.definition)
      await page.getByRole('button', { name: 'Answer', exact: true }).click()
      if (round !== 3 || i < pairs.length - 1) {
        await page.getByRole('button', { name: 'Continue', exact: true }).click()
      }
      if (i < pairs.length - 1)
        await expect(page.locator('main p.whitespace-pre-wrap').first()).not.toHaveText(term)
    }
    if (round === 2) {
      await expect(page.getByRole('heading', { name: 'Round 2 done' })).toBeVisible()
      await page.getByRole('button', { name: 'Continue to round 3' }).click()
    }
  }
  await expect(page.getByRole('heading', { name: 'Goal reached for 3 cards.' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'View completed path' }).click()
  await expect(page.getByRole('heading', { name: 'Goal reached for 3 cards.' })).toBeVisible()
})
test('stars persist, filter a flashcard round, survive progress reset and can be removed', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Star card: Alpha', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unstar card: Alpha', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unstar card: Alpha', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Starred only (1)', exact: true }).click()
  await expect(page.getByText('Beta', { exact: true })).not.toBeVisible()
  await page.getByRole('link', { name: 'Study starred flashcards' }).click()
  await expect(page.getByRole('button', { name: /Term: Alpha/ })).toBeVisible()
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Know it', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Clean sweep.' })).toBeVisible()
  await page.getByRole('link', { name: 'Close and go back to set' }).click()
  await page.getByRole('button', { name: 'Reset progress', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset progress', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unstar card: Alpha', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Unstar card: Alpha', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Star card: Alpha', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Star card: Alpha', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('link', { name: /Flashcards/ }).click()
  await page.getByRole('button', { name: 'Starred only', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No starred cards yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Study all cards', exact: true }).click()
  await page.getByRole('button', { name: 'Star card: Alpha', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unstar card: Alpha', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Starred only', exact: true }).click()
  await page.getByRole('button', { name: /Term: Alpha/ }).click()
  await expect(page.getByRole('button', { name: /Definition: First letter/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('Learn remembers misses, supports correction and starred study, and separates answer directions', async ({
  page,
}) => {
  await open(page, '/learn')
  await page.getByRole('button', { name: 'Most of it', exact: true }).click()
  await page.getByRole('button', { name: 'Start learning', exact: true }).click()
  const term = await page.locator('main p.whitespace-pre-wrap').first().innerText()
  const card = pairs.find((c) => c.term === term)!
  await page.getByRole('textbox', { name: 'Type the answer', exact: true }).fill('incorrect')
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Retype the correct answer', exact: true }).fill(card.definition)
  await page.getByRole('button', { name: 'Check correction', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Continue learning', exact: true }).click()
  await expect(page.locator('main p.whitespace-pre-wrap').first()).toHaveText(term)
  await page.getByRole('button', { name: `Star card: ${term}`, exact: true }).click()
  await expect(page.getByRole('button', { name: `Unstar card: ${term}`, exact: true })).toBeEnabled()
  await page.reload()
  await page.getByRole('switch', { name: 'Starred only (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Continue learning', exact: true }).click()
  await page.getByRole('textbox', { name: 'Type the answer', exact: true }).fill(card.definition)
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to round 2' }).click()
  await expect(page.getByRole('textbox', { name: 'Type the answer', exact: true })).toBeVisible()
  const before = await page.evaluate(
    ({ key, id }) => JSON.parse(localStorage.getItem(key) || '{}')[id].learn.definition,
    { key: `di.progress.${USER_ID}.study-seed`, id: card.id },
  )
  expect(before).toMatchObject({ attempts: 2, misses: 1, streak: 1, writtenStreak: 1 })
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByRole('button', { name: 'Term', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Start learning', exact: true }).click()
  await expect(page.locator('main p.whitespace-pre-wrap').first()).toHaveText(card.definition)
  await page.getByRole('textbox', { name: 'Type the answer', exact: true }).fill(card.term)
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
  const after = await page.evaluate(
    ({ key, id }) => JSON.parse(localStorage.getItem(key) || '{}')[id].learn,
    { key: `di.progress.${USER_ID}.study-seed`, id: card.id },
  )
  expect(after.definition).toEqual(before)
  expect(after.term).toMatchObject({ attempts: 1, writtenStreak: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('a failed star save rolls back and reports the error', async ({ page }) => {
  await open(page)
  await page.route('**/rest/v1/study_stars*', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, json: { message: 'Unavailable' } })
      : route.fallback(),
  )
  await page.getByRole('button', { name: 'Star card: Alpha', exact: true }).click()
  await expect(page.getByText('Couldn’t save this star. Check your connection and try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Star card: Alpha', exact: true })).toBeEnabled()
})
test('written test grades correct, incorrect and unanswered responses', async ({ page }) => {
  await open(page, '/test')
  await page.getByRole('button', { name: 'Written', exact: true }).click()
  await page.getByRole('button', { name: 'Start test', exact: true }).click()
  const first = page.locator('form section').first()
  const definition = await first.locator('p.whitespace-pre-wrap').innerText()
  await page
    .getByRole('textbox', { name: 'Answer to question 1', exact: true })
    .fill(pairs.find((c) => c.definition === definition)!.term)
  await page.getByRole('textbox', { name: 'Answer to question 2', exact: true }).fill('incorrect')
  await page.getByRole('button', { name: 'Grade test', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 unanswered')
  await page.getByRole('button', { name: 'Submit anyway' }).click()
  await expect(page.getByRole('heading', { name: '33%' })).toBeVisible()
  await expect(page.getByText('Unanswered', { exact: true })).toBeVisible()
  await expect(page.getByText('Not quite', { exact: true })).toBeVisible()
})
test('match applies penalties, clears pairs and remembers best time', async ({ page }) => {
  await open(page, '/match')
  await page.getByRole('button', { name: 'Start matching' }).click()
  await page.getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Second letter', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('2 seconds added')
  await expect(page.getByRole('button', { name: 'Alpha', exact: true })).toBeEnabled()
  for (const p of pairs) {
    await page.getByRole('button', { name: p.term, exact: true }).click()
    await page.getByRole('button', { name: p.definition, exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'All paired up.' })).toBeVisible()
  await expect(page.getByText(/Personal best:/)).toBeVisible()
})
test('spaced review schedules cards and excludes future reviews', async ({ page }) => {
  await open(page, '/review')
  await page.getByRole('button', { name: 'Review 3 cards' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByRole('button', { name: /Good/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Review complete.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'You’re caught up.' })).toBeVisible()
})
test('a shared set opens for another Google user and saves an independent copy', async ({
  page,
  browser,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByRole('button', { name: 'Allow anyone with the link' }).click()
  await expect(
    page.getByText('Anyone with this link can study the set and save their own copy.'),
  ).toBeVisible()
  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue()
  const sharedSets = await page.evaluate(() => JSON.parse(localStorage.getItem('di.sets') || '[]'))
  const context = await browser.newContext()
  const recipient = await context.newPage()
  await mockGoogleAccount(recipient, { userId: '00000000-0000-4000-a000-000000000002', sets: sharedSets })
  await recipient.goto(url)
  await expect(recipient.getByRole('heading', { name: 'Greek letters' })).toBeVisible()
  await recipient.getByRole('button', { name: 'Save a copy' }).click()
  await expect(recipient).toHaveURL(/#\/set\//)
  await expect(recipient).not.toHaveURL(new RegExp(seed.id))
  await expect(recipient.getByRole('link', { name: /Flashcards/ })).toBeVisible()
  await context.close()
})
test('keyboard traps in options and reduced motion still reveals card backs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/flashcards')
  await page.getByRole('button', { name: /Term: Alpha/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Definition: First letter/ })).toBeVisible()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(page.getByRole('switch').first()).toBeFocused()
  await page.getByRole('button', { name: 'Done', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('switch').first()).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Options', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: /Definition: First letter/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
