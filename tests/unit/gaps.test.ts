import { describe, expect, it } from 'vitest'
import { createIdGen } from '@/lib/report/ids'
import { applyOperations, type Operation } from '@/lib/report/operations'
import { fieldGap, openGaps, requiredCount, ruleGaps, sectionQuestionGaps } from '@/lib/report/gaps'
import type { Gap, Shift } from '@/lib/report/types'

const now = '2026-11-09T01:00:00.000Z'
function shift(over: Partial<Shift> = {}): Shift {
  return {
    id: 's1', date: '2026-11-08', startedAt: '2026-11-08T20:00:00.000Z', authorId: 'p1',
    notes: [{ id: 'n1', createdAt: now, text: 'x', attachments: [], status: 'pending', routedTo: [] }],
    incidents: [], sections: {}, gaps: [], noIncidentsConfirmed: true, ...over,
  }
}
const apply = (s: Shift, ops: Operation[]) => applyOperations(s, ops, 'n1', now, createIdGen('t'))
const full: Operation = { op: 'addIncident', type: 'Bójka', location: 'Bar', description: 'Opis.', time: { hhmm: '01:00', approx: false } }

describe('gaps', () => {
  it('an empty shift has no badge count, but the no-incidents confirmation stays a required gap', () => {
    const empty = shift({ notes: [], noIncidentsConfirmed: false })
    expect(requiredCount(empty)).toBe(0)
    expect(openGaps(empty).some((g) => g.id === 'rule:no-incidents' && g.weight === 'required')).toBe(true)
    expect(requiredCount(shift({ noIncidentsConfirmed: false }))).toBe(1)
  })

  it('a suspected incident asks only "Czy to był incydent?" until confirmed', () => {
    const s = apply(shift(), [{ op: 'addIncident', type: 'Inne', description: 'Coś przy szatni.', suspected: true }])
    const id = s.incidents[0].id
    expect(ruleGaps(s).filter((g) => g.target.kind === 'incident')).toEqual([
      { id: `rule:${id}:suspected`, target: { kind: 'incident', incidentId: id }, question: 'Czy to był incydent?', weight: 'required', origin: 'rule' },
    ])
    expect(fieldGap(s, id, 'location')).toBeUndefined()
    const confirmed = { ...s, incidents: [{ ...s.incidents[0], suspected: undefined }] }
    expect(ruleGaps(confirmed).filter((g) => g.target.kind === 'incident').map((g) => g.id)).toEqual([`rule:${id}:time`, `rule:${id}:location`])
  })

  it('approx time yields a required rule gap', () => {
    const s = apply(shift(), [{ ...full, time: { hhmm: '01:00', approx: true, sourcePhrase: 'koło 1' } } as Operation])
    const g = ruleGaps(s).find((x) => x.id === `rule:${s.incidents[0].id}:time`)
    expect(g).toMatchObject({ weight: 'required', origin: 'rule', question: 'Dokładna godzina?' })
  })
  it('missing location yields "Gdzie?"', () => {
    const s = apply(shift(), [{ op: 'addIncident', type: 'Bójka', description: 'Opis.', time: { hhmm: '01:00', approx: false } }])
    expect(fieldGap(s, s.incidents[0].id, 'location')?.question).toBe('Gdzie?')
    expect(fieldGap(s, s.incidents[0].id, 'type')).toBeUndefined()
  })
  it('no incidents requires confirmation until noIncidentsConfirmed', () => {
    expect(ruleGaps(shift({ noIncidentsConfirmed: false })).find((g) => g.id === 'rule:no-incidents')).toMatchObject({
      weight: 'required', target: { kind: 'report' }, question: 'Potwierdź: brak incydentów',
    })
    expect(ruleGaps(shift({ noIncidentsConfirmed: true })).some((g) => g.id === 'rule:no-incidents')).toBe(false)
  })
  it('empty security section yields an optional gap; a section with content does not', () => {
    const s = apply(shift(), [{ op: 'appendToSection', key: 'security', paragraphs: ['Spokojnie.'] }])
    const ids = ruleGaps(s).map((g) => g.id)
    expect(ids).not.toContain('rule:empty:security')
    expect(ids).toContain('rule:empty:audience')
    expect(ruleGaps(shift()).find((g) => g.id === 'rule:empty:security')).toMatchObject({ weight: 'optional' })
  })
  const aiGap = (over: Partial<Gap>): Gap => ({
    id: 'g1', target: { kind: 'incident', incidentId: 'x' }, question: 'Czy?', weight: 'required', status: 'open', ...over,
  })
  it('answered AI gaps are excluded', () => {
    const s = shift({ gaps: [aiGap({ status: 'answered' }), aiGap({ id: 'g2', status: 'dismissed' })] })
    expect(openGaps(s).some((g) => g.origin === 'ai')).toBe(false)
  })
  it('AI field gap disappears once the field has a value', () => {
    const base = apply(shift(), [{ op: 'addIncident', type: 'Bójka', description: 'Opis.' }])
    const id = base.incidents[0].id
    const s = { ...base, gaps: [aiGap({ target: { kind: 'incident', incidentId: id, field: 'location' } })] }
    const filled = apply(s, [{ op: 'updateIncident', incidentId: id, location: 'Bar' }])
    expect(openGaps(filled).some((g) => g.id === 'g1')).toBe(false)
    expect(fieldGap(filled, id, 'location')).toBeUndefined()
  })
  it('AI gap on a removed incident is not counted', () => {
    const base = apply(shift(), [full])
    const id = base.incidents[0].id
    const s = { ...base, gaps: [aiGap({ target: { kind: 'incident', incidentId: id } })] }
    expect(requiredCount(s)).toBe(1)
    const removed = { ...s, incidents: [], noIncidentsConfirmed: true }
    expect(openGaps(removed).some((g) => g.id === 'g1')).toBe(false)
    expect(requiredCount(removed)).toBe(0)
    // Derived, not stored: putting the incident back ("Cofnij") brings the gap back.
    expect(requiredCount({ ...removed, incidents: s.incidents })).toBe(1)
  })
  it('AI field gap is not double-counted with the rule gap', () => {
    const base = apply(shift(), [{ op: 'addIncident', type: 'Bójka', description: 'Opis.', time: { hhmm: '01:00', approx: false } }])
    const id = base.incidents[0].id
    const s = { ...base, gaps: [aiGap({ target: { kind: 'incident', incidentId: id, field: 'location' }, question: 'W którym miejscu?' })] }
    expect(openGaps(s).filter((g) => g.weight === 'required').map((g) => g.question)).toEqual(['Gdzie?'])
    expect(requiredCount(s)).toBe(1)
  })
  it('blank type and location produce rule gaps', () => {
    const s = apply(shift(), [{ op: 'addIncident', type: '', location: '  ', description: 'Opis.', time: { hhmm: '01:00', approx: false } }])
    const id = s.incidents[0].id
    expect(fieldGap(s, id, 'type')?.question).toBe('Jaki typ zdarzenia?')
    expect(fieldGap(s, id, 'location')?.question).toBe('Gdzie?')
    // Blank values stored by older data still count as missing.
    const stored = structuredClone(s)
    stored.incidents[0].type = { value: ' ', prov: { by: 'manager', at: now, sourceNoteIds: [] } }
    expect(fieldGap(stored, id, 'type')).toBeDefined()
  })
  it('AI section gaps are listed for their section, as openGaps counts them', () => {
    const s = shift({ gaps: [aiGap({ target: { kind: 'section', key: 'bar' } }), aiGap({ id: 'g2', target: { kind: 'section', key: 'audience' } })] })
    expect(sectionQuestionGaps(s.gaps, 'bar').map((g) => g.id)).toEqual(['g1'])
    expect(openGaps(s).filter((g) => g.origin === 'ai').map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(sectionQuestionGaps([{ ...s.gaps[0], status: 'answered' }], 'bar')).toEqual([])
  })
  it('requiredCount counts only required gaps', () => {
    const s = shift({ noIncidentsConfirmed: false })
    expect(requiredCount(s)).toBe(1)
    expect(openGaps(s).length).toBeGreaterThan(1)
  })
})
