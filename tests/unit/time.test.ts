import { describe, expect, it } from 'vitest'
import { formatHHMM, minutesFromShiftStart, parseHHMM } from '@/lib/report/time'

describe('parseHHMM', () => {
  it('normalizes accepted formats', () => {
    expect(parseHHMM('1:25')).toBe('01:25')
    expect(parseHHMM('01:25')).toBe('01:25')
    expect(parseHHMM('1.25')).toBe('01:25')
    expect(parseHHMM('0125')).toBe('01:25')
  })
  it('rejects invalid input', () => {
    expect(parseHHMM('23.5')).toBeNull()
    expect(parseHHMM('25:99')).toBeNull()
    expect(parseHHMM('ab')).toBeNull()
    expect(parseHHMM('')).toBeNull()
  })
  it('accepts range bounds', () => {
    expect(parseHHMM('00:00')).toBe('00:00')
    expect(parseHHMM('23:59')).toBe('23:59')
    expect(parseHHMM('24:00')).toBeNull()
  })
})

describe('minutesFromShiftStart', () => {
  it('orders times across midnight', () => {
    const sorted = ['01:25', '23:50', '00:30'].sort(
      (a, b) => minutesFromShiftStart(a, '20:00') - minutesFromShiftStart(b, '20:00'),
    )
    expect(sorted).toEqual(['23:50', '00:30', '01:25'])
  })
  it('is zero at the start', () => {
    expect(minutesFromShiftStart('20:00', '20:00')).toBe(0)
  })
})

describe('formatHHMM', () => {
  it('formats local time of an ISO string', () => {
    const d = new Date(2026, 10, 9, 1, 5)
    expect(formatHHMM(d.toISOString())).toBe('01:05')
  })
})
