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
  incidents: [],
  sections: [],
  openGaps: [],
  openQuestions: [],
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

  it('without a time token uses the note time with approx: true', () => {
    const ops = fallbackOperations(note('Ktoś zasłabł na parkiecie, wezwana karetka'), context())
    expect(ops).toEqual([
      {
        op: 'addIncident',
        type: 'Zasłabnięcie / pomoc medyczna',
        time: { hhmm: '23:20', approx: true },
        description: 'Ktoś zasłabł na parkiecie, wezwana karetka',
      },
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

  it('unrelated text returns null', () => {
    expect(fallbackOperations(note('dj spóźnił się 20 min, sprzęt ok'), context())).toBeNull()
  })
})
