import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const html = readFileSync(new URL('../deploy/legacy-redirect/index.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]

it.each([
  ['', ''],
  ['', '#/set/abc123/learn?starred=1'],
  ['', '#/shared/encoded%2Bcards%3D'],
  ['?code=oauth-code', '#/auth?next=%2Fset%2Fabc123'],
  ['?next=https%3A%2F%2Fexample.invalid', '#/explore'],
])('preserves the query and study route when forwarding %s %s', (search, hash) => {
  let redirected = ''
  runInNewContext(script, { URL, location: { search, hash, replace: (url: string) => { redirected = url } } })
  expect(redirected).toBe(`https://c28aa1-rgb.github.io/index-study/${search}${hash}`)
})
