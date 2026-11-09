import { describe, expect, it } from 'vitest'
import { estimateVagueTime, formatHHMM, minutesFromShiftStart, parseHHMM, timeSlots } from '@/lib/report/time'

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

describe('timeSlots', () => {
  it('lists a full day in 5-minute steps from the shift start, wrapping past midnight', () => {
    const slots = timeSlots('20:00')
    expect(slots).toHaveLength(288)
    expect(slots.slice(0, 3)).toEqual(['20:00', '20:05', '20:10'])
    expect(slots.slice(46, 50)).toEqual(['23:50', '23:55', '00:00', '00:05'])
    expect(slots[slots.length - 1]).toBe('19:55')
    expect(new Set(slots).size).toBe(288)
  })
  it('rounds a start that is off the 5-minute grid down to it', () => {
    const slots = timeSlots('21:13')
    expect(slots[0]).toBe('21:10')
    expect(slots[slots.length - 1]).toBe('21:05')
    expect(slots).toHaveLength(288)
  })
  it('handles a start right before midnight', () => {
    const slots = timeSlots('23:58')
    expect(slots.slice(0, 3)).toEqual(['23:55', '00:00', '00:05'])
  })
})

describe('estimateVagueTime', () => {
  const est = (text: string, start = '20:00') => estimateVagueTime(text, start)

  it('reads "po N" as half past N, after the shift start', () => {
    expect(est('po 1, ochroniarz wyrzucił 3 gości')).toEqual({ phrase: 'po 1', hhmm: '01:30' })
    expect(est('po 9 awantura')).toEqual({ phrase: 'po 9', hhmm: '21:30' })
    expect(est('po 1', '18:35')).toEqual({ phrase: 'po 1', hhmm: '01:30' })
    expect(est('po 12')).toEqual({ phrase: 'po 12', hhmm: '00:30' })
  })

  it('reads "koło/około N" as N:00 and keeps the phrase as written', () => {
    expect(est('Koło 1 dziewczyna zasłabła')).toEqual({ phrase: 'Koło 1', hhmm: '01:00' })
    expect(est('około 23:30 bójka')).toEqual({ phrase: 'około 23:30', hhmm: '23:30' })
  })

  it('reads "przed N" and midnight phrases', () => {
    expect(est('przed 2 ktoś zasłabł')).toEqual({ phrase: 'przed 2', hhmm: '01:45' })
    expect(est('tuż przed północą')).toEqual({ phrase: 'przed północą', hhmm: '23:45' })
    expect(est('po północy')).toEqual({ phrase: 'po północy', hhmm: '00:30' })
  })

  it('ignores text without a vague time phrase', () => {
    expect(est('chwilę temu kłótnia')).toBeNull()
    expect(est('po 300 zł rachunku')).toBeNull()
    expect(est('pobił kolegę')).toBeNull()
  })
})
