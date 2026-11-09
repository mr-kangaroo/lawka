import { describe, expect, it } from 'vitest'
import { matches, normalizeForSearch, splitMatch } from '@/lib/report/search'

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

describe('splitMatch', () => {
  it('marks the matched part, keeping original diacritics', () => {
    expect(splitMatch('bój', 'Bójka')).toEqual([
      { text: 'Bój', match: true },
      { text: 'ka', match: false },
    ])
    expect(splitMatch('boj', 'Bójka')).toEqual([
      { text: 'Bój', match: true },
      { text: 'ka', match: false },
    ])
  })
  it('handles matches in the middle and at the end', () => {
    expect(splitMatch('toal', 'Toaleta męska')).toEqual([
      { text: 'Toal', match: true },
      { text: 'eta męska', match: false },
    ])
    expect(splitMatch('mesk', 'Toaleta męska')).toEqual([
      { text: 'Toaleta ', match: false },
      { text: 'męsk', match: true },
      { text: 'a', match: false },
    ])
    expect(splitMatch('ł', 'Bar główny')).toEqual([
      { text: 'Bar g', match: false },
      { text: 'ł', match: true },
      { text: 'ówny', match: false },
    ])
  })
  it('returns the whole label unmarked for no match or an empty query', () => {
    expect(splitMatch('xyz', 'Bójka')).toEqual([{ text: 'Bójka', match: false }])
    expect(splitMatch('', 'Bójka')).toEqual([{ text: 'Bójka', match: false }])
    expect(splitMatch('   ', 'Bójka')).toEqual([{ text: 'Bójka', match: false }])
  })
  it('maps indices when normalization changes length', () => {
    // "e" + combining acute (2 code units) normalizes to "e" (1)
    expect(splitMatch('ka', 'Bléka')).toEqual([
      { text: 'Blé', match: false },
      { text: 'ka', match: true },
    ])
  })
})
