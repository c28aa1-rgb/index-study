// Forgiving answer check for typed responses.
const norm = (s: string) => {
  const cleaned = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}\s+\-−=÷×/^.<>≤≥√%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (
    cleaned
      .replace(/\b(the|a|an|to)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || cleaned
  )
}

function lev(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export type Verdict = 'correct' | 'close' | 'equivalent' | 'wrong'

export function check(given: string, expected: string): Verdict {
  const g = norm(given)
  if (!g) return 'wrong'
  // accept any of several answers separated by ; or /
  const options = expected
    .split(/;|\s\/\s|\bor\b/)
    .map(norm)
    .filter(Boolean)
  options.push(norm(expected))
  for (const e of options) {
    if (g === e) return 'correct'
    const tol = e.length <= 4 ? 0 : e.length <= 10 ? 1 : 2
    if (
      e.length <= 120 &&
      !/[\d+\-−=÷×/^<>≤≥√%]/.test(e + g) &&
      Math.abs(e.length - g.length) <= tol &&
      lev(g, e) <= tol
    )
      return 'close'
  }
  return 'wrong'
}

// Deliberately conservative: common English rewordings, not general semantic understanding.
const groups = [
  'control regulate manage',
  'create produce generate make build',
  'change convert transform',
  'destroy eliminate eradicate',
  'stop prevent inhibit block',
  'keep retain preserve',
  'store hold contain',
  'carry transport convey',
  'consume use utilize',
  'release emit discharge',
  'absorb takein',
  'enter gointo',
  'leave exit gooutof',
  'increase raise boost grow',
  'decrease reduce lower diminish',
  'help assist aid',
  'allow permit enable',
  'require need',
  'separate divide split',
  'join connect link unite',
  'detect identify recognize',
  'protect defend safeguard',
  'remove extract',
  'quick rapid fast',
  'slow gradual',
  'large big',
  'small little tiny',
  'basic fundamental essential',
  'unit buildingblock',
  'life livingthings',
  'begin start',
  'end finish',
  'function role purpose',
  'location place position',
  'outside exterior external',
  'inside interior internal',
  'whole entire complete',
  'bloodstream blood',
  'hereditary genetic',
]
const synonyms = new Map<string, string>()
for (const group of groups) {
  const words = group.split(' ')
  for (const word of words) synonyms.set(word, words[0])
}
const irregular: Record<string, string> = {
  made: 'make',
  built: 'build',
  held: 'hold',
  kept: 'keep',
  began: 'begin',
  begun: 'begin',
  grew: 'grow',
  grown: 'grow',
  left: 'leave',
  leaves: 'leave',
  children: 'child',
  mice: 'mouse',
}
const stop = new Set(
  'a an the of in on at by for with and is are was were be being been it that which as its this these those also can may will has have had does do did what something refers called means'.split(
    ' ',
  ),
)
const relations = new Set(
  'cause become control create change destroy stop keep store carry consume release absorb enter leave increase decrease help allow require separate join detect protect remove chase eat follow precede attract repel pump filter measure encode decode translate transcribe'.split(
    ' ',
  ),
)
const boundaries = new Set('from to into before after above below than per'.split(' '))
const numberWords = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

function stem(word: string) {
  if (irregular[word]) return irregular[word]
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.length < suffix.length + 3 || !word.endsWith(suffix)) continue
    const root = word.slice(0, -suffix.length)
    if (synonyms.has(root) || relations.has(root)) return root
    if (synonyms.has(root + 'e') || relations.has(root + 'e')) return root + 'e'
  }
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (word.endsWith('s') && word.length > 3 && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
  return word
}

function prepare(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/\b(can't|cannot)\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/−/g, '-')
    .replace(/\bbuilding blocks?\b/g, 'buildingblock')
    .replace(/\bliving (things|organisms)\b/g, 'livingthings')
    .replace(/\b(goes?|going|went) into\b/g, 'enter')
    .replace(/\b(goes?|going|went) out of\b/g, 'leave')
    .replace(/\btakes? in\b/g, 'takein')
    .replace(/\b(?:(?:one|a) )?half\b/g, '0.5')
    .replace(/\b(?:(?:one|a) )?quarter\b/g, '0.25')
    .replace(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g,
      (word) => String(numberWords.indexOf(word)),
    )
    .replace(/\bpercent\b/g, '%')
}

function numericTokens(text: string) {
  const numbers: string[] = []
  const value = text
    .replace(/\d,\d{3}(?:,\d{3})*/g, (match) => match.replaceAll(',', ''))
    .replace(/[+-]?\d+(?:\.\d+)?(?:\s*\/\s*[+-]?\d+(?:\.\d+)?)?\s*%?/g, (match) => {
      const parts = match.replace(/[%\s]/g, '').split('/').map(Number)
      let number = parts.length === 2 ? parts[0] / parts[1] : parts[0]
      if (match.includes('%')) number /= 100
      const token = Number.isFinite(number) ? Number(number.toPrecision(12)).toString() : 'invalid'
      numbers.push(token)
      return ` number${token} `
    })
  return { value, numbers: numbers.sort().join('|') }
}

function tokens(text: string) {
  return (
    text
      .match(/number[+-]?[\d.]+|[a-z]+/g)
      ?.filter((word) => !stop.has(word))
      .map((word) => {
        const root = synonyms.get(word) ?? stem(word)
        return synonyms.get(root) ?? root
      }) ?? []
  )
}

const sameBag = (a: string[], b: string[]) => [...a].sort().join('|') === [...b].sort().join('|')

function sameMeaning(given: string, expected: string) {
  let g = prepare(given),
    e = prepare(expected)
  const negatives = (text: string) => text.match(/\b(not|no|never|without|neither|nor)\b/g)?.join('|') ?? ''
  if (negatives(g) !== negatives(e)) return false
  const gn = numericTokens(g),
    en = numericTokens(e)
  if (gn.numbers !== en.numbers || gn.numbers.includes('invalid')) return false
  // Keep formulae, ionic charges and inequalities literal instead of guessing at their meaning.
  if (/[+=×÷^<>≤≥√]|[a-z][+-]/.test(g + e)) return false
  const passive = (text: string) =>
    text.replace(/^(.+?)\s+(?:is|are|was|were)\s+([a-z]+)\s+by\s+(.+?)[.!]?$/, '$3 $2 $1')
  g = passive(gn.value)
  e = passive(en.value)
  const gt = tokens(g),
    et = tokens(e)
  if (!gt.length || !et.length || gt.length > 200 || et.length > 200) return false
  if (gt.join(' ') === et.join(' ')) return true
  if (negatives(g)) return false
  const anchors = (words: string[]) => words.filter((word) => relations.has(word) || boundaries.has(word))
  const ga = anchors(gt),
    ea = anchors(et)
  if (ga.join('|') !== ea.join('|')) return false
  if (!ga.length && !/[,;]|\band\b/.test(g + ' ' + e) && !(gn.numbers && gt.length <= 3 && et.length <= 3))
    return false
  // Preserve subjects, objects and direction around verbs/prepositions while allowing lists to reorder.
  const sections = (words: string[]) => {
    const out: string[][] = [[]]
    for (const word of words) {
      if (relations.has(word) || boundaries.has(word)) out.push([])
      else out[out.length - 1].push(word)
    }
    return out
  }
  const gs = sections(gt),
    es = sections(et)
  return gs.length === es.length && gs.every((section, i) => sameBag(section, es[i]))
}

export function checkSmart(given: string, expected: string): Verdict {
  if (!given.trim() || given.length > 4000 || expected.length > 20_000) return check(given, expected)
  const negative = (value: string) =>
    prepare(value)
      .match(/\b(not|no|never|without|neither|nor)\b/g)
      ?.join('|') ?? ''
  const alternatives = [expected, ...expected.split(/;|\s\/\s/)]
  for (const answer of alternatives) {
    if (negative(given) !== negative(answer)) continue
    if (numericTokens(prepare(given)).numbers !== numericTokens(prepare(answer)).numbers) continue
    const direct = check(given, answer)
    if (direct === 'correct') return direct
    if (direct === 'close') {
      const words = norm(given).split(' '),
        reference = norm(answer).split(' ')
      const safe =
        words.length === reference.length &&
        words.every((word, i) => {
          const expectedWord = reference[i]
          if (word === expectedWord) return true
          const a = synonyms.get(stem(word)) ?? stem(word),
            b = synonyms.get(stem(expectedWord)) ?? stem(expectedWord)
          if (relations.has(a) && relations.has(b) && a !== b) return false
          const length = Math.min(word.length, expectedWord.length)
          return lev(word, expectedWord) <= (length <= 4 ? 0 : length <= 10 ? 1 : 2)
        })
      if (safe) return direct
    }
    if (sameMeaning(given, answer)) return 'equivalent'
  }
  return 'wrong'
}
