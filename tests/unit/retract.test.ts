import { describe, expect, it } from 'vitest'
import { retractNote } from '@/lib/report/retract'
import { docToPlainText, paragraphsToBlocks } from '@/lib/report/rich'
import type { Author, Incident, RichDoc, Shift } from '@/lib/report/types'

const at = '2026-11-09T01:00:00.000Z'
const doc = (...blocks: Array<[string, Author, string[]]>): RichDoc => ({
  type: 'doc',
  content: blocks.flatMap(([text, by, sourceNoteIds]) => paragraphsToBlocks([text], { by, at, sourceNoteIds })),
})
const incident = (description: RichDoc | null): Incident => ({
  id: 'i1', createdAt: at, type: { value: 'Bójka', prov: { by: 'ai', at, sourceNoteIds: ['n1'] } },
  time: null, location: null, description, attachments: [], sourceNoteIds: ['n1'],
})
const shift = (over: Partial<Shift>): Shift => ({
  id: 's', date: '2026-11-08', startedAt: at, authorId: 'p', notes: [], incidents: [], sections: {}, gaps: [],
  noIncidentsConfirmed: false, ...over,
})

describe('retractNote', () => {
  it("removes only the AI blocks written from that note alone, outside the summary", () => {
    const s = shift({
      sections: {
        bar: { key: 'bar', attachments: [], doc: doc(['Z n1.', 'ai', ['n1']], ['Z n2.', 'ai', ['n2']], ['Moje.', 'manager', ['n1']], ['Z n1 i n2.', 'ai', ['n1', 'n2']]) },
        summary: { key: 'summary', attachments: [], doc: doc(['Podsumowanie.', 'ai', ['n1']]) },
      },
    })
    const out = retractNote(s, 'n1')
    expect(docToPlainText(out.sections.bar!.doc)).toBe('Z n2.\nMoje.\nZ n1 i n2.')
    expect(docToPlainText(out.sections.summary!.doc)).toBe('Podsumowanie.')
    expect(docToPlainText(s.sections.bar!.doc)).toContain('Z n1.') // input untouched
  })

  it('clears an incident description written only from that note but keeps the incident and its fields', () => {
    const out = retractNote(shift({ incidents: [incident(doc(['Opis.', 'ai', ['n1']]))] }), 'n1')
    expect(out.incidents).toHaveLength(1)
    expect(out.incidents[0].description).toBeNull()
    expect(out.incidents[0].type?.value).toBe('Bójka')
    const kept = retractNote(shift({ incidents: [incident(doc(['Opis.', 'manager', ['n1']]))] }), 'n1')
    expect(docToPlainText(kept.incidents[0].description!)).toBe('Opis.')
  })
})
