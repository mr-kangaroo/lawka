import { describe, expect, it } from 'vitest'
import { createIdGen } from '@/lib/report/ids'
import { OperationsResponseSchema, applyOperations, sortIncidents, type Operation } from '@/lib/report/operations'
import { docToPlainText, paragraphsToBlocks } from '@/lib/report/rich'
import type { Incident, Note, Shift } from '@/lib/report/types'

const now = '2026-11-09T01:00:00.000Z'
const mgr = { by: 'manager' as const, at: now, sourceNoteIds: [] as string[] }

function note(over: Partial<Note> = {}): Note {
  return { id: 'n1', createdAt: '2026-11-09T00:55:00.000Z', text: 'x', attachments: [], status: 'pending', routedTo: [], ...over }
}
function shift(over: Partial<Shift> = {}): Shift {
  return {
    id: 's1', date: '2026-11-08', startedAt: '2026-11-08T20:00:00.000Z', authorId: 'p1',
    notes: [note()], incidents: [], sections: {}, gaps: [], questions: [], noIncidentsConfirmed: true, ...over,
  }
}
const apply = (s: Shift, ops: Operation[], noteId = 'n1') => applyOperations(s, ops, noteId, now, createIdGen('t'))
const add: Operation = { op: 'addIncident', type: 'Bójka', location: 'Wejście', description: 'Dwóch gości się pobiło.', time: { hhmm: '01:00', approx: false } }
function incident(over: Partial<Incident> = {}): Incident {
  return { id: 'i1', createdAt: now, type: null, time: null, location: null, description: null, attachments: [], sourceNoteIds: [], ...over }
}

describe('applyOperations', () => {
  it('addIncident creates ai-owned fields and copies note attachments', () => {
    const att = { id: 'a1', name: 'foto.jpg', kind: 'image' as const }
    const out = apply(shift({ notes: [note({ attachments: [att] })] }), [add])
    const inc = out.incidents[0]
    expect(inc.createdAt).toBe('2026-11-09T00:55:00.000Z')
    expect(inc.type).toEqual({ value: 'Bójka', prov: { by: 'ai', at: now, sourceNoteIds: ['n1'] } })
    expect(inc.location?.value).toBe('Wejście')
    expect(inc.time?.value.hhmm).toBe('01:00')
    expect(docToPlainText(inc.description!)).toBe('Dwóch gości się pobiło.')
    expect(inc.attachments).toEqual([att])
    expect(inc.sourceNoteIds).toEqual(['n1'])
  })

  it('addIncident clears noIncidentsConfirmed', () => {
    expect(apply(shift(), [add]).noIncidentsConfirmed).toBe(false)
  })

  it('updateIncident skips manager-owned fields', () => {
    const s = shift({
      incidents: [incident({ location: { value: 'Bar główny', prov: mgr }, type: { value: 'Stary', prov: { ...mgr, by: 'ai' } } })],
    })
    const out = apply(s, [{ op: 'updateIncident', incidentId: 'i1', location: 'Szatnia', type: 'Nowy', time: { hhmm: '01:25', approx: true } }])
    expect(out.incidents[0].location?.value).toBe('Bar główny')
    expect(out.incidents[0].type?.value).toBe('Nowy')
    expect(out.incidents[0].time?.value).toEqual({ hhmm: '01:25', approx: true })
  })

  it('updateIncident fills a null field even when other fields are manager-owned', () => {
    const s = shift({ incidents: [incident({ type: { value: 'T', prov: mgr } })] })
    const out = apply(s, [{ op: 'updateIncident', incidentId: 'i1', type: 'Inny', location: 'Hol' }])
    expect(out.incidents[0].type?.value).toBe('T')
    expect(out.incidents[0].location?.value).toBe('Hol')
  })

  it('appendToIncident appends to ai description and adds a new block after a manager block', () => {
    const aiDoc = paragraphsToBlocks(['Pierwsze.'], { by: 'ai', at: now, sourceNoteIds: ['n0'] })
    const mDoc = paragraphsToBlocks(['Moje.'], mgr)
    const s = shift({
      incidents: [
        incident({ id: 'i1', description: { type: 'doc', content: aiDoc } }),
        incident({ id: 'i2', description: { type: 'doc', content: mDoc } }),
        incident({ id: 'i3', description: null }),
      ],
    })
    const out = apply(s, [
      { op: 'appendToIncident', incidentId: 'i1', text: 'Drugie.' },
      { op: 'appendToIncident', incidentId: 'i2', text: 'Dodane.' },
      { op: 'appendToIncident', incidentId: 'i3', text: 'Nowe.' },
    ])
    expect(docToPlainText(out.incidents[0].description!)).toBe('Pierwsze. Drugie.')
    expect(out.incidents[1].description!.content).toHaveLength(2)
    expect(out.incidents[1].description!.content[0].attrs.by).toBe('manager')
    expect(out.incidents[1].description!.content[1].attrs.by).toBe('ai')
    expect(docToPlainText(out.incidents[2].description!)).toBe('Nowe.')
  })

  it('appendToSection creates the section and never edits existing blocks', () => {
    const first = apply(shift(), [{ op: 'appendToSection', key: 'bar', paragraphs: ['A'] }])
    expect(first.sections.bar?.doc.content[0].attrs).toEqual({ by: 'ai', at: now, sourceNoteIds: ['n1'] })
    const withMgr = shift({ sections: { bar: { key: 'bar', attachments: [], doc: { type: 'doc', content: paragraphsToBlocks(['Moje'], mgr) } } } })
    const out = apply(withMgr, [{ op: 'appendToSection', key: 'bar', paragraphs: ['B', '- c'] }])
    const c = out.sections.bar!.doc.content
    expect(c).toHaveLength(3)
    expect(c[0]).toEqual(withMgr.sections.bar!.doc.content[0])
    expect(c[1].attrs.by).toBe('ai')
  })

  it('setSummary is ignored when the summary has a manager block', () => {
    const s = shift({ sections: { summary: { key: 'summary', attachments: [], doc: { type: 'doc', content: paragraphsToBlocks(['Moje'], mgr) } } } })
    const out = apply(s, [{ op: 'setSummary', paragraphs: ['AI'] }])
    expect(docToPlainText(out.sections.summary!.doc)).toBe('Moje')
    expect(out.notes[0].routedTo).toEqual([])
  })

  it('setSummary replaces ai blocks', () => {
    const a = apply(shift(), [{ op: 'setSummary', paragraphs: ['Jeden'] }])
    const b = apply(a, [{ op: 'setSummary', paragraphs: ['Dwa'] }])
    expect(docToPlainText(b.sections.summary!.doc)).toBe('Dwa')
  })

  it('addGap deduplicates identical open gaps', () => {
    const gap: Operation = { op: 'addGap', target: { kind: 'section', key: 'bar' }, question: 'Ile?', weight: 'optional' }
    const out = apply(shift(), [gap, gap])
    expect(out.gaps).toHaveLength(1)
    expect(out.gaps[0].status).toBe('open')
  })

  it('resolveGap and askQuestion work, unknown gapId is skipped', () => {
    const s = shift({ gaps: [{ id: 'g1', target: { kind: 'section', key: 'bar' }, question: 'Q', weight: 'optional', status: 'open' }] })
    const out = apply(s, [
      { op: 'resolveGap', gapId: 'g1' },
      { op: 'resolveGap', gapId: 'nope' },
      { op: 'askQuestion', question: 'Który?', options: ['A', 'B'] },
    ])
    expect(out.gaps[0].status).toBe('answered')
    expect(out.questions).toEqual([{ id: 't-1', noteId: 'n1', question: 'Który?', options: ['A', 'B'], status: 'open' }])
  })

  it('unknown incidentId is skipped and the note is still processed', () => {
    const out = apply(shift(), [
      { op: 'updateIncident', incidentId: 'zzz', type: 'X' },
      { op: 'appendToIncident', incidentId: 'zzz', text: 'X' },
    ])
    expect(out.notes[0].status).toBe('processed')
    expect(out.notes[0].routedTo).toEqual([])
    expect(out.incidents).toEqual([])
  })

  it('routedTo lists applied targets in order', () => {
    const out = apply(shift(), [add, { op: 'appendToSection', key: 'maintenance', paragraphs: ['Awaria'] }])
    expect(out.notes[0].routedTo).toEqual(['Incydent #1', 'Usterki i sprzęt'])
  })

  it('attachments go to the first fed section when no incident was touched', () => {
    const att = { id: 'a1', name: 'f.jpg', kind: 'image' as const }
    const out = apply(shift({ notes: [note({ attachments: [att] })] }), [{ op: 'appendToSection', key: 'bar', paragraphs: ['A'] }])
    expect(out.sections.bar?.attachments).toEqual([att])
  })

  it('attachments follow updateIncident when no incident was created', () => {
    const att = { id: 'a1', name: 'f.jpg', kind: 'image' as const }
    const s = shift({
      notes: [note({ attachments: [att] })],
      incidents: [incident({ type: { value: 'T', prov: mgr } })],
    })
    const out = apply(s, [
      { op: 'updateIncident', incidentId: 'i1', type: 'Inny' },
      { op: 'appendToSection', key: 'bar', paragraphs: ['A'] },
    ])
    expect(out.incidents[0].attachments).toEqual([att])
    expect(out.sections.bar?.attachments).toEqual([])
  })

  it('appendToSection with empty paragraphs is a no-op', () => {
    const att = { id: 'a1', name: 'f.jpg', kind: 'image' as const }
    const out = apply(shift({ notes: [note({ attachments: [att] })] }), [
      { op: 'appendToSection', key: 'bar', paragraphs: [] },
      { op: 'appendToSection', key: 'kitchen', paragraphs: ['K'] },
    ])
    expect(out.sections.bar).toBeUndefined()
    expect(out.notes[0].routedTo).toEqual(['Kuchnia'])
    expect(out.sections.kitchen?.attachments).toEqual([att])
  })

  it('replyTo note marks its question answered; answersGapId note marks its gap answered', () => {
    const s = shift({
      notes: [note({ replyTo: 'q1', answersGapId: 'g1' })],
      questions: [{ id: 'q1', noteId: 'n0', question: '?', options: [], status: 'open' }],
      gaps: [{ id: 'g1', target: { kind: 'section', key: 'bar' }, question: 'Q', weight: 'optional', status: 'open' }],
    })
    const out = apply(s, [])
    expect(out.questions[0].status).toBe('answered')
    expect(out.gaps[0]).toMatchObject({ status: 'answered', answeredByNoteId: 'n1' })
  })

  it('does not mutate the input shift', () => {
    const s = shift({ incidents: [incident({ type: { value: 'A', prov: { ...mgr, by: 'ai' } } })] })
    const snap = structuredClone(s)
    apply(s, [add, { op: 'updateIncident', incidentId: 'i1', type: 'B' }, { op: 'appendToSection', key: 'bar', paragraphs: ['A'] }, { op: 'setSummary', paragraphs: ['S'] }])
    expect(s).toEqual(snap)
  })
})

describe('sortIncidents', () => {
  it('orders after-midnight times after evening times, untimed last', () => {
    const t = (hhmm: string) => ({ value: { hhmm, approx: false }, prov: mgr })
    const s = shift({
      incidents: [
        incident({ id: 'u', createdAt: '2026-11-09T02:00:00.000Z' }),
        incident({ id: 'late', time: t('01:10') }),
        incident({ id: 'early', time: t('23:30') }),
      ],
    })
    expect(sortIncidents(s).map((i) => i.id)).toEqual(['early', 'late', 'u'])
  })
})

describe('OperationsResponseSchema', () => {
  it('rejects an unknown op', () => {
    expect(OperationsResponseSchema.safeParse({ operations: [{ op: 'deleteEverything' }] }).success).toBe(false)
  })
  it('accepts all valid ops', () => {
    const r = OperationsResponseSchema.safeParse({
      operations: [add, { op: 'askQuestion', question: 'q', options: [] }, { op: 'appendToIncident', incidentId: 'i', text: 't' }],
    })
    expect(r.success).toBe(true)
  })
})
