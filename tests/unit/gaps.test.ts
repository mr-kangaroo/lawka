import { describe, expect, it } from 'vitest'
import { createIdGen } from '@/lib/report/ids'
import { applyOperations, type Operation } from '@/lib/report/operations'
import { fieldGap, openGaps, requiredCount, ruleGaps } from '@/lib/report/gaps'
import type { Gap, Shift } from '@/lib/report/types'

const now = '2026-11-09T01:00:00.000Z'
function shift(over: Partial<Shift> = {}): Shift {
  return {
    id: 's1', date: '2026-11-08', startedAt: '2026-11-08T20:00:00.000Z', authorId: 'p1',
    notes: [{ id: 'n1', createdAt: now, text: 'x', attachments: [], status: 'pending', routedTo: [] }],
    incidents: [], sections: {}, gaps: [], questions: [], noIncidentsConfirmed: true, ...over,
  }
}
const apply = (s: Shift, ops: Operation[]) => applyOperations(s, ops, 'n1', now, createIdGen('t'))
const full: Operation = { op: 'addIncident', type: 'Bójka', location: 'Bar', description: 'Opis.', time: { hhmm: '01:00', approx: false } }

describe('gaps', () => {
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
    expect(openGaps(s).some((g) => g.id === 'g1')).toBe(true)
    const filled = apply(s, [{ op: 'updateIncident', incidentId: id, location: 'Bar' }])
    expect(openGaps(filled).some((g) => g.id === 'g1')).toBe(false)
  })
  it('requiredCount counts only required gaps', () => {
    const s = shift({ noIncidentsConfirmed: false })
    expect(requiredCount(s)).toBe(1)
    expect(openGaps(s).length).toBeGreaterThan(1)
  })
})
