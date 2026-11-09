import type { RichBlock, RichDoc, Shift } from './types'

/** An AI block written from this note alone (a block merged from several notes is kept). */
const onlyFrom = (block: RichBlock, noteId: string) =>
  block.attrs.by === 'ai' && block.attrs.sourceNoteIds.length === 1 && block.attrs.sourceNoteIds[0] === noteId

const without = (doc: RichDoc, noteId: string): RichDoc => ({
  ...doc,
  content: doc.content.filter((b) => !onlyFrom(b, noteId)),
})

/**
 * Before an edited note is filed again: removes the text the AI wrote from that note alone, in
 * sections and incident descriptions, so the new version can replace it. The summary is left for
 * `setSummary` to rewrite. Manager-written blocks, incidents and their fields are never touched.
 */
export function retractNote(shift: Shift, noteId: string): Shift {
  const s = structuredClone(shift)
  for (const sec of Object.values(s.sections)) {
    if (sec && sec.key !== 'summary') sec.doc = without(sec.doc, noteId)
  }
  for (const inc of s.incidents) {
    if (!inc.description) continue
    const doc = without(inc.description, noteId)
    inc.description = doc.content.length ? doc : null
  }
  return s
}
