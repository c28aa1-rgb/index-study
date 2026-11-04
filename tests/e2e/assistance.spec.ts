import { test, expect, USER_ID } from './cloud'

const set = {
  id: 'assist-seed',
  title: 'Biology',
  description: 'Cell processes',
  owner_id: USER_ID,
  author_name: 'Student',
  visibility: 'private' as const,
  created_at: '2026-11-03T12:00:00Z',
  updated_at: '2026-11-03T12:00:00Z',
  cards: [
    { id: 'a', term: 'Ribosome', definition: 'Produces proteins' },
    { id: 'b', term: 'Cell membrane', definition: 'Controls what enters and leaves the cell' },
  ],
}
async function seed(page: import('@playwright/test').Page) {
  await page.addInitScript((set) => localStorage.setItem('di.sets', JSON.stringify([set])), set)
}

test('written Learn stays written after a miss following correct multiple choice', async ({ page }) => {
  await seed(page)
  await page.addInitScript((key) => localStorage.setItem(key, '["a"]'), `test.stars.${USER_ID}.${set.id}`)
  await page.goto(`/#/set/${set.id}/learn`)
  await page.getByRole('switch', { name: 'Starred only (1)' }).click()
  await page.getByRole('button', { name: 'Start learning', exact: true }).click()
  await page.getByRole('button', { name: /Produces proteins/ }).click()
  await page.getByRole('button', { name: 'Continue to round 2' }).click()
  await page.getByRole('textbox', { name: 'Type the answer', exact: true }).fill('Breaks proteins')
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
  await page.getByRole('textbox', { name: 'Retype the correct answer' }).fill('Produces proteins')
  await page.getByRole('button', { name: 'Check correction' }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to round 3' }).click()
  await expect(page.getByRole('textbox', { name: 'Type the answer', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Type the answer', exact: true }).fill('Makes proteins')
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
  await expect(page.getByText('Correct · accepted rewording', { exact: true })).toBeVisible()
})

test('Test accepts a supported rewording with smart grading and rejects it with standard grading', async ({
  page,
}) => {
  await seed(page)
  for (const smart of [true, false]) {
    await page.goto(`/#/set/${set.id}/test`)
    await page.getByRole('button', { name: 'Written', exact: true }).click()
    await page.getByRole('button', { name: 'Definition', exact: true }).click()
    if (!smart) await page.getByRole('switch', { name: 'Smart grading for written answers' }).click()
    await page.getByRole('button', { name: 'Start test', exact: true }).click()
    for (let i = 0; i < 2; i++) {
      const term = await page.locator('form section').nth(i).locator('p.whitespace-pre-wrap').innerText()
      await page
        .getByRole('textbox', { name: `Answer to question ${i + 1}`, exact: true })
        .fill(term === 'Ribosome' ? 'Makes proteins' : 'Regulates what enters and leaves the cell')
    }
    await page.getByRole('button', { name: 'Grade test', exact: true }).click()
    await expect(page.getByRole('heading', { name: smart ? '100%' : '0%', exact: true })).toBeVisible()
    if (smart) {
      await expect(page.getByText('Correct · accepted rewording', { exact: true })).toHaveCount(2)
      await page.getByRole('button', { name: 'Test settings' }).click()
    }
  }
})

test('editor suggests either side from existing cards and preserves a custom definition', async ({
  page,
}, testInfo) => {
  await seed(page)
  await page.goto('/#/create')
  await page.getByRole('textbox', { name: 'Term', exact: true }).first().fill('Ribo')
  await expect(
    page.getByRole('group', { name: 'Suggestions for card 1' }).getByRole('button', { name: /Ribosome/ }),
  ).toBeVisible()
  await page.getByRole('group', { name: 'Suggestions for card 1' }).locator('..').screenshot({ path: `docs/suggestions-${testInfo.project.name}.png`, animations: 'disabled' })
  await page
    .getByRole('group', { name: 'Suggestions for card 1' })
    .getByRole('button', { name: /Ribosome/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Definition', exact: true }).first()).toHaveValue(
    'Produces proteins',
  )
  await page.getByRole('textbox', { name: 'Definition', exact: true }).first().fill('My own definition')
  await page.getByRole('textbox', { name: 'Term', exact: true }).first().fill('Ribo')
  await page
    .getByRole('group', { name: 'Suggestions for card 1' })
    .getByRole('button', { name: /Ribosome/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Definition', exact: true }).first()).toHaveValue(
    'My own definition',
  )
  await page.getByRole('textbox', { name: 'Definition', exact: true }).nth(1).fill('Controls what enters')
  await page
    .getByRole('group', { name: 'Suggestions for card 2' })
    .getByRole('button', { name: /Cell membrane/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Term', exact: true }).nth(1)).toHaveValue('Cell membrane')
})

test('dictionary suggestions keep attribution after saving and never insert markup', async ({ page }) => {
  await page.route('https://en.wiktionary.org/**', (route) =>
    route.fulfill({
      json: route.request().url().includes('/page/definition/')
        ? {
            en: [
              {
                definitions: [
                  {
                    definition:
                      '<script>window.badSuggestion=true</script>A process that uses <b>light</b> to make food.',
                  },
                ],
              },
            ],
          }
        : ['photosynthesis', [], [], []],
    }),
  )
  await page.goto('/#/create')
  await page.getByRole('textbox', { name: 'Set title' }).fill('Plants')
  await page.getByRole('textbox', { name: 'Term', exact: true }).first().fill('photosynthesis')
  await page
    .getByRole('group', { name: 'Suggestions for card 1' })
    .getByRole('button', { name: /A process that uses light/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Definition', exact: true }).first()).toHaveValue(
    'A process that uses light to make food.',
  )
  await page.getByRole('textbox', { name: 'Term', exact: true }).nth(1).fill('Leaf')
  await page.getByRole('textbox', { name: 'Definition', exact: true }).nth(1).fill('Part of a plant')
  await page.getByRole('button', { name: 'Create set', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plants', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Wiktionary', exact: true })).toHaveAttribute(
    'href',
    'https://en.wiktionary.org/wiki/photosynthesis',
  )
  expect(
    await page.evaluate(() => (window as unknown as { badSuggestion?: boolean }).badSuggestion),
  ).toBeUndefined()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('last-card suggestions can be selected with Tab and Enter', async ({ page }) => {
  await seed(page)
  await page.goto('/#/create')
  await page.getByRole('textbox', { name: 'Definition', exact: true }).last().fill('Produces pro')
  const suggestion = page.getByRole('group', { name: 'Suggestions for card 3' }).getByRole('button', { name: /Ribosome/ })
  await expect(suggestion).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(suggestion).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Term', exact: true })).toHaveCount(3)
  await expect(page.getByRole('textbox', { name: 'Term', exact: true }).last()).toHaveValue('Ribosome')
})

test('sounds play only after interaction and mute persists between visits', async ({ page }) => {
  await seed(page)
  await page.addInitScript(() => {
    const Original = window.AudioContext
    const data = window as unknown as { audioNotes: number }
    data.audioNotes = 0
    window.AudioContext = class extends Original {
      createOscillator() {
        data.audioNotes++
        return super.createOscillator()
      }
      createBufferSource() {
        data.audioNotes++
        return super.createBufferSource()
      }
    }
  })
  await page.goto(`/#/set/${set.id}/flashcards`)
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(0)
  await page.getByRole('button', { name: 'Mute sounds', exact: true }).click()
  await page.getByRole('button', { name: /Term: Ribosome/ }).click()
  expect(await page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes)).toBe(0)
  await page.getByRole('button', { name: 'Enable sounds', exact: true }).click()
  await page.getByRole('button', { name: /Definition: Produces proteins/ }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { audioNotes: number }).audioNotes))
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Mute sounds', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable sounds', exact: true })).toBeVisible()
})
