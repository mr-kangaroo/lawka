import { describe, expect, it } from 'vitest'
import { createIdGen } from '@/lib/report/ids'
import { openGaps, requiredCount } from '@/lib/report/gaps'
import { routeLabel, sortIncidents } from '@/lib/report/operations'
import { createDemoShift, createEmptyShift } from '@/lib/report/seed'

describe('seed', () => {
  it('demo shift has 2 incidents sorted Bójka then Zasłabnięcie', () => {
    const s = createDemoShift()
    expect(sortIncidents(s).map((i) => i.type?.value)).toEqual(['Bójka', 'Zasłabnięcie / pomoc medyczna'])
  })
  it('demo notes route to structured targets with the expected labels', () => {
    const s = createDemoShift()
    const labels = Object.fromEntries(s.notes.map((n) => [n.id, n.routedTo.map((t) => routeLabel(s, t))]))
    expect(labels).toEqual({
      'demo-n1': ['Publiczność i bezpieczeństwo', 'Imprezy prywatne'],
      'demo-n2': ['Incydent #1'],
      'demo-n3': ['Usterki i sprzęt'],
      'demo-n4': ['Incydent #2'],
      'demo-n5': [],
      'demo-n6': ['Publiczność i bezpieczeństwo', 'Podsumowanie'],
    })
    expect(s.notes[1].routedTo).toEqual([{ kind: 'incident', incidentId: sortIncidents(s)[0].id }])
  })
  it('demo shift requiredCount is 3', () => {
    expect(requiredCount(createDemoShift())).toBe(3)
  })
  it('demo shift has one open question attached to the 01:48 note', () => {
    const s = createDemoShift()
    const open = s.questions.filter((q) => q.status === 'open')
    expect(open).toHaveLength(1)
    const note = s.notes.find((n) => n.id === open[0].noteId)!
    expect(note.text).toContain('znowu ten typ')
    expect(new Date(note.createdAt).getHours()).toBe(1)
    expect(new Date(note.createdAt).getMinutes()).toBe(48)
  })
  it('demo shift optional gaps include rule:empty:security and the witness gap', () => {
    const optional = openGaps(createDemoShift()).filter((g) => g.weight === 'optional')
    expect(optional.some((g) => g.id === 'rule:empty:security')).toBe(true)
    expect(optional.some((g) => g.question === 'Czy ktoś z ochrony był świadkiem?')).toBe(true)
  })
  it('createDemoShift is deterministic', () => {
    expect(createDemoShift()).toEqual(createDemoShift())
  })
  it('createEmptyShift at 02:30 uses the previous calendar date', () => {
    const s = createEmptyShift(new Date(2026, 10, 9, 2, 30), createIdGen('e'))
    expect(s.date).toBe('2026-11-08')
    expect(s.authorId).toBe('kasia')
    expect(s.noIncidentsConfirmed).toBe(false)
    expect(createEmptyShift(new Date(2026, 10, 8, 21, 0), createIdGen('e')).date).toBe('2026-11-08')
  })
})
