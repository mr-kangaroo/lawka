import { describe, expect, it } from 'vitest'
import { mergeDictation } from '@/lib/dictation'

describe('mergeDictation', () => {
  it('returns the base when nothing was recognised', () => {
    expect(mergeDictation('Notatka', '', '')).toBe('Notatka')
    expect(mergeDictation('Notatka', '  ', ' ')).toBe('Notatka')
  })
  it('uses the spoken text alone when the base is empty', () => {
    expect(mergeDictation('', 'awantura', '')).toBe('awantura')
  })
  it('appends final then interim with single spaces', () => {
    expect(mergeDictation('23:10', 'awantura na bramce', 'dwóch gości')).toBe(
      '23:10 awantura na bramce dwóch gości',
    )
  })
  it('does not double the space after a base ending in whitespace', () => {
    expect(mergeDictation('Linia 1\n', 'tekst', '')).toBe('Linia 1\ntekst')
  })
  it('shows only the interim tail when nothing is final yet', () => {
    expect(mergeDictation('A', '', 'be')).toBe('A be')
  })
  it('is idempotent for a repeated interim (no duplication)', () => {
    expect(mergeDictation('A', 'b', 'c')).toBe(mergeDictation('A', 'b', 'c'))
  })
})
