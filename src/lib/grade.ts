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

export type Verdict = 'correct' | 'close' | 'wrong'

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
