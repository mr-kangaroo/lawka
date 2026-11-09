import { describe, expect, it } from 'vitest'
import { fallbackOperations } from '@/lib/ai/fallback'
import type { AiContext } from '@/lib/ai/client'
import type { Note } from '@/lib/report/types'

const note = (text: string, extra: Partial<Note> = {}): Note => ({
  id: 'n1',
  createdAt: new Date(2026, 10, 8, 23, 20).toISOString(),
  text,
  attachments: [],
  status: 'pending',
  routedTo: [],
  ...extra,
})

const context = (extra: Partial<AiContext> = {}): AiContext => ({
  shiftDate: '2026-11-08',
  startHHMM: '20:00',
  nowHHMM: '23:20',
  noteHHMM: '23:20',
  incidents: [],
  sections: [],
  openGaps: [],
  ...extra,
})

describe('fallbackOperations', () => {
  it('"awantura na bramce 23:10" → addIncident Bójka at 23:10', () => {
    const ops = fallbackOperations(note('awantura na bramce 23:10'), context())
    expect(ops).toEqual([
      {
        op: 'addIncident',
        type: 'Bójka',
        time: { hhmm: '23:10', approx: false },
        description: 'awantura na bramce 23:10',
      },
    ])
  })

  it('takes the first time token even with trailing punctuation', () => {
    const ops = fallbackOperations(note('ukradli telefon z szatni ok. 1.25, potem 2:00'), context())
    expect(ops).toEqual([
      {
        op: 'addIncident',
        type: 'Kradzież',
        time: { hhmm: '01:25', approx: false },
        description: 'ukradli telefon z szatni ok. 1.25, potem 2:00',
      },
    ])
  })

  it('fallback leaves the time empty when the note names no hour (never the note or server time)', () => {
    const ops = fallbackOperations(note('Ktoś zasłabł na parkiecie, wezwana karetka'), context({ noteHHMM: '00:47' }))
    expect(ops).toEqual([
      { op: 'addIncident', type: 'Zasłabnięcie / pomoc medyczna', description: 'Ktoś zasłabł na parkiecie, wezwana karetka' },
    ])
  })

  it('gap answer appends "Czy wezwano policję? Nie." and resolves the gap', () => {
    const ctx = context({
      answeringGap: { id: 'g1', question: 'Czy wezwano policję?', target: { kind: 'incident', incidentId: 'i1' } },
    })
    expect(fallbackOperations(note('Nie', { answersGapId: 'g1' }), ctx)).toEqual([
      { op: 'appendToIncident', incidentId: 'i1', text: 'Czy wezwano policję? Nie.' },
      { op: 'resolveGap', gapId: 'g1' },
    ])
    // An answer that already ends with punctuation is not doubled.
    expect(fallbackOperations(note('nie.', { answersGapId: 'g1' }), ctx)?.[0]).toEqual({
      op: 'appendToIncident',
      incidentId: 'i1',
      text: 'Czy wezwano policję? Nie.',
    })
  })

  it('gap answer on a section appends a paragraph and resolves the gap', () => {
    const ctx = context({
      answeringGap: { id: 'g2', question: 'Ile skrzynek?', target: { kind: 'section', key: 'stock' } },
    })
    expect(fallbackOperations(note('dwie', { answersGapId: 'g2' }), ctx)).toEqual([
      { op: 'appendToSection', key: 'stock', paragraphs: ['Ile skrzynek? Dwie.'] },
      { op: 'resolveGap', gapId: 'g2' },
    ])
  })

  it('gap answer on a report-level gap only resolves the gap', () => {
    const ctx = context({
      answeringGap: { id: 'rule:no-incidents', question: 'Potwierdź: brak incydentów', target: { kind: 'report' } },
    })
    expect(fallbackOperations(note('tak, spokojnie', { answersGapId: 'rule:no-incidents' }), ctx)).toEqual([
      { op: 'resolveGap', gapId: 'rule:no-incidents' },
    ])
  })

  it('a vague time in the note is estimated from its phrase', () => {
    expect(fallbackOperations(note('po 1 bójka przy barze'), context())).toEqual([
      { op: 'addIncident', type: 'Bójka', time: { hhmm: '01:30', approx: true, sourcePhrase: 'po 1' }, description: 'po 1 bójka przy barze' },
    ])
  })

  it('"zgubiony bilet na szatnię" returns null', () => {
    expect(fallbackOperations(note('zgubiony bilet na szatnię'), context())).toBeNull()
    expect(fallbackOperations(note('sprzedaliśmy 300 biletów, gość zgubił się w szatni'), context())).toBeNull()
  })

  it('matches fight verb forms', () => {
    for (const text of ['ochroniarz pobił gościa', 'dwóch gości biło się przy barze', 'bili się na parkiecie', 'bił się z kolegą', 'bójka w palarni', 'bijatyka przed lokalem']) {
      expect(fallbackOperations(note(text), context())?.[0], text).toMatchObject({ op: 'addIncident', type: 'Bójka' })
    }
  })

  it('"awantura, 300 zł szkody" has no time: bare numbers are never read as times', () => {
    expect(fallbackOperations(note('awantura, 300 zł szkody'), context({ noteHHMM: '01:12' }))).toEqual([
      { op: 'addIncident', type: 'Bójka', description: 'awantura, 300 zł szkody' },
    ])
    expect(fallbackOperations(note('awantura 12 osób, rok 2026'), context({ noteHHMM: '01:12' }))?.[0]).not.toHaveProperty('time')
  })

  it('unrelated text returns null', () => {
    expect(fallbackOperations(note('dj spóźnił się 20 min, sprzęt ok'), context())).toBeNull()
  })
})
