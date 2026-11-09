/** Lowercase, strip diacritics (ł -> l). */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function matches(query: string, label: string): boolean {
  return normalizeForSearch(label).includes(normalizeForSearch(query.trim()))
}

export type MatchPart = { text: string; match: boolean }

/**
 * Splits `label` around the first match of `query` (as `matches` finds it), so the matched
 * part can be shown in bold. Indices are mapped back to the original label, diacritics kept.
 */
export function splitMatch(query: string, label: string): MatchPart[] {
  const q = normalizeForSearch(query.trim())
  if (!q) return [{ text: label, match: false }]
  // Normalize one code point at a time, remembering where each normalized char came from.
  const chars = Array.from(label)
  const starts: number[] = [] // original string offset of each code point
  let normalized = ''
  const origin: number[] = [] // normalized index -> code point index
  let offset = 0
  chars.forEach((ch, i) => {
    starts.push(offset)
    offset += ch.length
    const n = normalizeForSearch(ch)
    for (let k = 0; k < n.length; k++) origin.push(i)
    normalized += n
  })
  starts.push(label.length)
  const at = normalized.indexOf(q)
  if (at < 0) return [{ text: label, match: false }]
  const first = origin[at]
  let last = origin[at + q.length - 1] + 1
  // Keep trailing combining marks with the matched letter.
  while (last < chars.length && normalizeForSearch(chars[last]) === '') last++
  const parts: MatchPart[] = [
    { text: label.slice(0, starts[first]), match: false },
    { text: label.slice(starts[first], starts[last]), match: true },
    { text: label.slice(starts[last]), match: false },
  ]
  return parts.filter((p) => p.text.length > 0)
}
