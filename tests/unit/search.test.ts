import { describe, expect, it } from 'vitest'
import { matches, normalizeForSearch } from '@/lib/report/search'

describe('search', () => {
  it('normalizes diacritics and case', () => {
    expect(normalizeForSearch('Łazienka Żółć')).toBe('lazienka zolc')
  })
  it('matches ignoring diacritics and case', () => {
    expect(matches('boj', 'Bójka')).toBe(true)
    expect(matches('LAZ', 'Łazienka')).toBe(true)
    expect(matches('męsk', 'Toaleta męska')).toBe(true)
    expect(matches('kradz', 'Bójka')).toBe(false)
  })
  it('empty query matches everything', () => {
    expect(matches('', 'Bójka')).toBe(true)
  })
})
