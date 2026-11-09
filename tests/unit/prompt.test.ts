import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompt'
import type { AiContext } from '@/lib/ai/client'
import { INCIDENT_TYPES, SECTION_LABELS, VENUE_AREAS } from '@/lib/report/catalog'
import type { Note } from '@/lib/report/types'

describe('prompt', () => {
  it('system prompt lists every SECTION_LABELS value and every INCIDENT_TYPES entry', () => {
    const p = buildSystemPrompt()
    for (const [key, label] of Object.entries(SECTION_LABELS)) {
      expect(p).toContain(key)
      expect(p).toContain(label)
    }
    for (const t of INCIDENT_TYPES) expect(p).toContain(t)
    for (const a of VENUE_AREAS) expect(p).toContain(a)
    expect(p).toMatch(/approx: true/)
    expect(p).toMatch(/sourcePhrase/)
    expect(p).toMatch(/answeringGap/)
    expect(p).toMatch(/suspected: true/)
    expect(p).not.toMatch(/askQuestion|answeringQuestion/)
    expect(p).toMatch(/updateIncident/)
    expect(p).toContain('"new:1"')
  })

  it('user prompt contains the note text and context JSON', () => {
    const note: Note = {
      id: 'n1',
      createdAt: '2026-11-08T22:12:00.000Z',
      text: 'awantura na bramce 23:10',
      attachments: [],
      status: 'pending',
      routedTo: [],
    }
    const context: AiContext = {
      shiftDate: '2026-11-08',
      startHHMM: '20:00',
      nowHHMM: '23:15',
      noteHHMM: '23:12',
      incidents: [{ id: 'i1', number: 1, type: 'Bójka', description: 'x', managerFields: [] }],
      sections: [],
      openGaps: [],
    }
    const p = buildUserPrompt(note, context)
    expect(p).toContain('awantura na bramce 23:10')
    expect(p).toContain('Note written at 23:12')
    expect(p).toContain(JSON.stringify(context))
  })
})
